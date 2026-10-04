/**
 * 内容举报插件 · 前台能力
 *
 * 入口：
 *   1. 群聊消息右键「头像」菜单追加「举报」（通过 HaChat.onMsgCtx 扩展点）
 *   2. 用户资料卡「举报」按钮（包装核心暴露的 HaChat.userCard + HaChat.openModal 实现，
 *      未修改核心源码）
 * 两者共用同一个举报弹窗：选择理由 + 补充说明，提交到 plugin_content_report_submit。
 *
 * 开关（后台配置）：
 *   - require_desc：必须填写补充说明
 *   - allow_self  ：允许举报自己的内容
 *   - show_guest  ：未登录显示举报入口（点击跳转登录）
 *
 * 兼容老浏览器：仅用 var / function，无箭头函数、无 const/let、无 fetch。
 */
(function (w, d) {
    if (!w.HaChat || !HaChat.cfg) return;
    if (w.__haCRLoaded) return;
    w.__haCRLoaded = true;

    var esc   = w.esc   || function (s) { return String(s == null ? '' : s); };
    var toast = w.toast || function () {};
    var pad   = w.fmtUid || function (n) { return String(n || ''); };
    var $ = function (id) { return d.getElementById(id); };

    var CR = w.HaCR = w.HaCR || {};

    /* ---------- 配置缓存（启动时拉取一次，菜单显隐与弹窗规则都依赖它） ---------- */
    var cfgCache = { show_guest: 0, require_desc: 0, allow_self: 0, reasons: [], desc_limit: 200, loaded: false };

    function loadCfg(cb) {
        HaApi.post('plugin_content_report_get_reasons', {}, function (r) {
            if (r.ok && r.data) {
                cfgCache.show_guest   = parseInt(r.data.show_guest, 10) || 0;
                cfgCache.require_desc = parseInt(r.data.require_desc, 10) || 0;
                cfgCache.allow_self   = parseInt(r.data.allow_self, 10) || 0;
                cfgCache.reasons      = r.data.reasons || [];
                cfgCache.desc_limit   = parseInt(r.data.desc_limit, 10) || 200;
            }
            cfgCache.loaded = true;
            if (cb) cb();
        });
    }
    loadCfg();

    /** 当前是否已登录 */
    function isLogin() {
        var actor = (HaChat.cfg || {}).actor || {};
        var me = (HaChat.cfg || {}).me || null;
        return actor.kind === 'user' && me && me.id;
    }

    /** 跳转登录页 */
    function goLogin() {
        w.location.href = '?page=login';
    }

    /* ---------- 记录最近一次打开资料卡的目标用户（供 openModal 注入举报按钮时取用） ---------- */
    var lastCardTarget = { uid: 0, nick: '' };

    /* ---------- 包装 HaChat.userCard：记录目标用户，原行为不变 ---------- */
    var origUserCard = HaChat.userCard;
    HaChat.userCard = function (uid, nick) {
        lastCardTarget = { uid: uid || 0, nick: nick || '' };
        return origUserCard.call(this, uid, nick);
    };

    /* ---------- 包装 HaChat.openModal：资料卡弹窗内注入「举报」按钮 ---------- */
    var origOpenModal = HaChat.openModal;
    HaChat.openModal = function (html, width) {
        // 仅对资料卡弹窗（标题含「用户资料」）注入按钮；举报弹窗自身标题为「举报用户」不受影响
        if (typeof html === 'string' && html.indexOf('用户资料') >= 0 && lastCardTarget.uid > 0) {
            var uid = lastCardTarget.uid;
            var nick = lastCardTarget.nick;
            var me = (HaChat.cfg || {}).me || null;
            // 允许举报自己关闭时，自己的资料卡不显示举报按钮
            if (me && me.id && uid === me.id && !cfgCache.allow_self) {
                // 不注入按钮
            } else {
                var nickJson = JSON.stringify(nick).replace(/"/g, '&quot;');
                var btn = '<button class="ha-btn ha-btn-danger" style="margin-right:auto" '
                    + 'onclick="HaCR.openReport(' + uid + ',' + nickJson + ',0,0,0)">举报</button>';
                html = html.replace('<div class="ha-modal-actions">', '<div class="ha-modal-actions">' + btn);
            }
        }
        return origOpenModal.call(this, html, width);
    };

    /* ---------- 举报弹窗：理由下拉 + 补充说明 ---------- */
    CR.openReport = function (targetUid, targetNick, roomId, msgId, msgTime) {
        targetUid = parseInt(targetUid, 10) || 0;
        msgTime = parseInt(msgTime, 10) || 0;
        if (targetUid <= 0) { toast('举报对象无效'); return; }

        // 未登录：跳转登录（show_guest 开启时游客可见入口）
        if (!isLogin()) { goLogin(); return; }

        var me = (HaChat.cfg || {}).me || null;
        // 允许举报自己关闭时，拦截自己
        if (me && me.id && targetUid === me.id && !cfgCache.allow_self) {
            toast('不能举报自己'); return;
        }

        // 配置未加载完时等待
        if (!cfgCache.loaded) {
            loadCfg(function () { CR.openReport(targetUid, targetNick, roomId, msgId, msgTime); });
            return;
        }

        var reasons = cfgCache.reasons || [];
        var descLimit = cfgCache.desc_limit || 200;
        var requireDesc = cfgCache.require_desc ? true : false;
        if (!reasons.length) { toast('管理员尚未配置举报理由'); return; }

        var opts = '';
        for (var i = 0; i < reasons.length; i++) {
            opts += '<option value="' + esc(reasons[i]) + '">' + esc(reasons[i]) + '</option>';
        }

        var descLabel = '补充说明（' + (requireDesc ? '必填' : '可选') + '，最多 ' + descLimit + ' 字）';

        HaChat.openModal(
            '<h3>举报用户</h3>'
            + '<p class="ha-modal-desc">举报对象：' + esc(targetNick) + '（用户 ID：' + esc(pad(targetUid)) + '）</p>'
            + '<div class="ha-form-item"><label>举报理由</label>'
            + '<select class="ha-input" id="haCRReason">' + opts + '</select></div>'
            + '<div class="ha-form-item"><label>' + descLabel + '</label>'
            + '<textarea class="ha-input" id="haCRDesc" rows="4" maxlength="' + descLimit + '" style="resize:vertical"></textarea></div>'
            + '<div class="ha-modal-actions">'
            + '<button class="ha-btn ha-btn-ghost" onclick="HaChat.closeModal()">取消</button>'
            + '<button class="ha-btn ha-btn-danger" id="haCRSubmit">提交举报</button></div>'
        );

        var submit = $('haCRSubmit');
        if (submit) {
            submit.onclick = function () {
                var reason = $('haCRReason') ? $('haCRReason').value : '';
                var desc = $('haCRDesc') ? $('haCRDesc').value : '';
                if (!reason) { toast('请选择举报理由'); return; }
                if (requireDesc && !desc.replace(/^\s+|\s+$/g, '')) { toast('请填写补充说明'); return; }
                submit.disabled = true;
                HaApi.post('plugin_content_report_submit', {
                    target_uid: targetUid,
                    target_nick: targetNick,
                    reason: reason,
                    description: desc,
                    room_id: roomId || 0,
                    msg_id: msgId || 0,
                    msg_time: msgTime || 0
                }, function (r2) {
                    submit.disabled = false;
                    if (r2.ok) HaChat.closeModal();
                    toast(r2.msg || (r2.ok ? '举报已提交' : '操作失败'));
                });
            };
        }
    };

    /* ---------- 注册到头像右键菜单（针对「人」的操作） ---------- */
    if (typeof HaChat.onMsgCtx === 'function') {
        HaChat.onMsgCtx(function (items, m) {
            if (!m || m.recalled) return;
            var targetUid = m.uid || 0;
            if (!targetUid) return;                       // 仅举报注册用户

            var loggedIn = isLogin();
            var me = (HaChat.cfg || {}).me || null;

            // 未登录：仅当 show_guest 开启时显示入口，点击跳转登录
            if (!loggedIn) {
                if (cfgCache.show_guest) {
                    items.push({ t: '举报', run: function () { goLogin(); } });
                }
                return;
            }

            // 已登录：允许举报自己关闭时，自己的消息不显示举报
            if (me && me.id && targetUid === me.id && !cfgCache.allow_self) return;

            items.push({
                t: '举报',
                run: function () { CR.openReport(targetUid, m.nickname || '', HaChat.room, m.id || 0, m.ts || 0); }
            });
        });
    }
})(window, document);
