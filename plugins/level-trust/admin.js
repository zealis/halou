/**
 * 等级信任 —— 后台交互
 * 全局对象 HaLT：统计概览 / 用户查询 / 补签·冻结·直设等级 / 限制总开关。
 * 兼容老浏览器：仅使用 var / function，不用箭头函数、let/const、fetch。
 * 敏感操作（plugin_level_trust_op）走 HaApi.secure —— 服务端已声明 sensitive。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };
    var LABEL = (w.HaLevel && w.HaLevel.LABEL) || {
        login: '登录', gm: '群发言', gfirst: '群聊首条',
        pfirst: '私聊首条', fup: '上传文件', fdl: '下载文件', fact: '群文件操作'
    };
    var KN = { k: 'login' };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function taskName(k) { return LABEL[k] || k; }

    w.HaLT = {
        init: function () {
            // ⚠️ 本文件随合并资源包在**所有**后台页加载，非本页时 #haLTStats 不存在，
            //    直接写 innerHTML 会抛「Cannot set properties of null」。
            //    真正的启动由下方 watch() 负责（插件页是 Ajax 异步渲染的）。
            boot();
        },

        /* ---------- 概览 ---------- */
        stats: function () {
            HaApi.post('plugin_level_trust_stats', {}, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                var g = $('haLTGate');
                if (g) g.value = String(r.gating || '1');
                var names = { 1: '新手 1-5', 2: '日常 6-15', 3: '活跃 16-30', 4: '核心 31-45', 5: '荣誉 46+' };
                var html = '<h3 style="margin:0 0 8px">概览</h3>'
                    + '<div class="ha-card-meta">'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">有等级记录</span>'
                    + '<span class="ha-card-meta-v">' + (r.users || 0) + ' 人</span></div>'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">等级中位数</span>'
                    + '<span class="ha-card-meta-v">Lv.' + (r.median || 1) + '</span></div>'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">平均等级</span>'
                    + '<span class="ha-card-meta-v">Lv.' + (r.avg || 0) + '</span></div>'
                    + '</div><div class="ha-lt-tasks">';
                for (var i = 1; i <= 5; i++) {
                    html += '<div class="ha-lt-task"><span class="ha-lt-task-k">' + names[i] + '</span>'
                        + '<span class="ha-lt-task-v">' + ((r.dist && r.dist[i]) || 0) + ' 人</span></div>';
                }
                html += '</div>';
                var box = $('haLTStats');
                if (box) box.innerHTML = html;
            });
        },

        saveGate: function () {
            var v = $('haLTGate') ? $('haLTGate').value : '1';
            HaApi.secure('plugin_level_trust_op', { op: 'gate', v: v, uid: 0 }, function (r) {
                toast(r.msg || (r.ok ? '已保存' : '保存失败'));
                if (r.ok) HaLT.stats();
            });
        },

        /* ---------- 用户查询 ---------- */
        query: function () {
            var uid = parseInt(($('haLTUid') || {}).value, 10);
            if (!uid || uid <= 0) { toast('请填写用户 ID'); return; }
            HaApi.post('plugin_level_trust_user', { uid: uid }, function (r) {
                var box = $('haLTUser');
                if (!box) return;
                if (!r.ok) { box.innerHTML = '<p class="ha-panel-empty">' + esc(r.msg) + '</p>'; return; }

                var html = '<div class="ha-card-meta" style="border-top:0;padding-top:0">'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">用户</span>'
                    + '<span class="ha-card-meta-v">' + esc(r.nickname) + '（ID ' + r.uid + '）'
                    + (r.role === 'admin' ? ' · 超级管理员' : '') + '</span></div>'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">等级</span>'
                    + '<span class="ha-card-meta-v">' + (w.HaLevel
                        ? w.HaLevel.badge(r.level, r.stage_no, r.honor) : 'Lv.' + r.level)
                    + '<span class="ha-lt-stage">' + esc(r.stage) + '</span></span></div>'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">累计完成</span>'
                    + '<span class="ha-card-meta-v">' + r.days + ' 天 · 加权 ' + r.weight + ' 天</span></div>'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">登录</span>'
                    + '<span class="ha-card-meta-v">连续 ' + r.login_streak + ' 天 · 累计 ' + r.login_days + ' 天</span></div>'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">今日</span>'
                    + '<span class="ha-card-meta-v">'
                    + (r.frozen ? '已冻结' : (r.settled ? '已完成并结算' : '进行中'))
                    + ' · 本周已补签 ' + r.patch_used + ' 次 · 本月已用保护 ' + r.protect_used + ' 次'
                    + '</span></div>'
                    + '</div>';

                html += '<div class="ha-lt-tasks">';
                for (var i = 0; i < (r.tasks || []).length; i++) {
                    var t = r.tasks[i];
                    var done = t.cur >= t.n;
                    html += '<div class="ha-lt-task"><span class="ha-lt-task-k">'
                        + esc(taskName(t.k)) + '</span>'
                        + '<span class="ha-lt-task-v' + (done ? ' done' : '') + '">'
                        + t.cur + ' / ' + t.n + '</span></div>';
                }
                html += '</div>';

                html += '<div class="ha-modal-actions" style="margin-top:12px">'
                    + '<button class="ha-btn ha-btn-ghost" onclick="HaLT.op(' + r.uid + ',\'patch\')">补签（每周 1 次）</button>'
                    + '<button class="ha-btn ha-btn-ghost" onclick="HaLT.op(' + r.uid + ',\'' + (r.frozen ? 'unfreeze' : 'freeze') + '\')">'
                    + (r.frozen ? '解除冻结' : '冻结今日') + '</button>'
                    + '<button class="ha-btn ha-btn-primary" onclick="HaLT.setLevel(' + r.uid + ',' + r.level + ',' + r.days + ')">直接设置</button>'
                    + '</div>';
                box.innerHTML = html;
            });
        },

        /** 补签 / 冻结 / 解冻 */
        op: function (uid, op) {
            HaApi.secure('plugin_level_trust_op', { uid: uid, op: op }, function (r) {
                toast(r.msg || (r.ok ? '已操作' : '操作失败'));
                if (r.ok) HaLT.query();
            });
        },

        /**
         * 直接设置等级：用核心自研弹窗（**禁用浏览器原生 prompt**）。
         * 等级与天数一次填完再提交 —— 分两次弹窗时用户容易改了等级忘了天数，
         * 结果等级与「累计完成天数」对不上，后面再升级会算出一个跳变的等级。
         */
        setLevel: function (uid, lv, days) {
            HaChat.openModal(
                '<h3>设置等级</h3>'
                + '<div class="ha-form-item"><label>等级（≥1）</label>'
                + '<input class="ha-input" id="haLtSetLv" type="number" min="1" value="' + lv + '"></div>'
                + '<div class="ha-form-item"><label>累计完成天数（≥0）</label>'
                + '<input class="ha-input" id="haLtSetDays" type="number" min="0" value="' + days + '">'
                + '<p style="font-size:12px;color:#5C5C5C;margin-top:4px">'
                + '等级一般由公式 L = 1 + ⌊天数 + 加权⌋ 自动算出；这里只用于迁移或纠错，'
                + '直接改数值不会同步改加权。</p></div>'
                + '<div class="ha-modal-actions">'
                + '<button class="ha-btn ha-btn-ghost" onclick="HaChat.closeModal()">取消</button>'
                + '<button class="ha-btn ha-btn-primary" onclick="HaLT.doSet(' + uid + ')">保存</button>'
                + '</div>', 420);
        },

        doSet: function (uid) {
            var n = parseInt(($('haLtSetLv') || {}).value, 10);
            var dd = parseInt(($('haLtSetDays') || {}).value, 10);
            if (!n || n < 1) { toast('等级需为 ≥1 的整数'); return; }
            if (isNaN(dd) || dd < 0) { toast('累计天数需为 ≥0 的整数'); return; }
            HaApi.secure('plugin_level_trust_op', { uid: uid, op: 'set', level: n, days: dd }, function (r) {
                toast(r.msg || (r.ok ? '已设置' : '设置失败'));
                if (r.ok) { HaChat.closeModal(); HaLT.query(); }
            });
        }
    };

    var booted = false;

    /** 真正初始化（#haLTStats 存在才做） */
    function boot() {
        if (booted || !$('haLTStats')) return;
        booted = true;
        HaLT.stats();
    }

    /**
     * ⚠️ 不能只在 DOMContentLoaded 时初始化：插件后台页是**点菜单后由 Ajax 塞进
     * #haAdminMain** 的，DOMContentLoaded 那一刻本页 HTML 还不存在，
     * `$('haLTStats').innerHTML` 会抛「Cannot set properties of null」。
     * 也不能只跑一次就放弃：用户在后台里切走再切回来，容器会被重建。
     * 因此监听 #haAdminMain 的变化，容器出现就初始化、消失就把标记复位。
     */
    function watch() {
        var main = d.getElementById('haAdminMain');
        if (!main || !w.MutationObserver) { boot(); return; }
        new w.MutationObserver(function () {
            if (!$('haLTStats')) { booted = false; return; }
            boot();
        }).observe(main, { childList: true, subtree: true });
        boot();
    }

    if (d.readyState === 'loading') {
        d.addEventListener('DOMContentLoaded', function () { setTimeout(watch, 0); });
    } else {
        setTimeout(watch, 0);
    }
})(window, document);
