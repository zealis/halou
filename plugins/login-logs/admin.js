/**
 * 登录日志插件 - 后台交互（v1.0.0，v1.1.12 增加结果筛选与失败/登出渲染）
 * 全局对象 OwLL：页面 HTML 由插件后台页注入，函数在点击时执行，
 * 依赖的 OwApi / toast / esc / OwAdmin 由主 chat.js 提供。
 * 兼容老浏览器：仅使用 var / function，不使用箭头函数、let/const、fetch。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    /* 当前查询状态（v1.1.12 增加 result） */
    var state = { uid: 0, q: '', d1: '', d2: '', result: '', page: 1, psize: 20, total: 0, pages: 1 };

    w.OwLL = {
        /* 初始化：加载统计 + 首屏列表 */
        init: function () {
            OwLL.loadStats();
            OwLL.load(1);
        },

        /* 重置筛选 */
        resetFilter: function () {
            $('owLLU').value = '';
            $('owLLQ').value = '';
            $('owLLD1').value = '';
            $('owLLD2').value = '';
            var rEl = $('owLLR');
            if (rEl) rEl.value = '';
            OwLL.load(1);
        },

        /* 加载统计 */
        loadStats: function () {
            OwApi.post('plugin_login_logs_stats', {}, function (r) {
                if (!r || !r.ok) return;
                var h =
                      '<div class="owLLStatItem"><div class="num">' + r.total + '</div><div class="lbl">日志总数</div></div>'
                    + '<div class="owLLStatItem"><div class="num">' + r.users + '</div><div class="lbl">独立用户</div></div>'
                    + '<div class="owLLStatItem"><div class="num">' + r.today + '</div><div class="lbl">今日登录（' + r.today_str + '）</div></div>'
                    + '<div class="owLLStatItem"><div class="num">' + r.fail_today + '</div><div class="lbl">今日失败</div></div>'
                    + '<div class="owLLStatItem"><div class="num">' + r.fail + '</div><div class="lbl">累计失败</div></div>'
                    + '<div class="owLLStatItem"><div class="num">' + r.logout + '</div><div class="lbl">主动登出</div></div>';
                // 指纹不符是安全事件（会话被销毁，疑似 Cookie 被盗），非零时才提示，
                // 平时不占位，免得把真正的告警淹在恒为 0 的数字里。
                if (r.fp_mismatch > 0) {
                    h += '<div class="owLLStatItem"><div class="num" style="color:var(--ow-orange)">' + r.fp_mismatch
                       + '</div><div class="lbl">指纹不符（疑似盗用）</div></div>';
                }
                $('owLLStatCard').innerHTML = h;
            });
        },

        /* 加载列表 */
        load: function (page) {
            var uEl = $('owLLU'), qEl = $('owLLQ'), d1El = $('owLLD1'), d2El = $('owLLD2'), rEl = $('owLLR');
            if (!qEl) { toast('元素不存在'); return; }
            state.uid  = uEl ? (parseInt(uEl.value, 10) || 0) : 0;
            state.q    = qEl.value;
            state.d1   = d1El ? d1El.value : '';
            state.d2   = d2El ? d2El.value : '';
            state.result = rEl ? rEl.value : '';
            state.page = page || 1;
            OwApi.post('plugin_login_logs_list', {
                uid: state.uid, q: state.q, d1: state.d1, d2: state.d2,
                result: state.result,
                page: state.page, psize: state.psize
            }, function (r) {
                if (!r || !r.ok) { toast((r && r.msg) || '加载失败'); return; }
                state.total = r.total;
                state.pages = r.pages;
                OwLL.render(r.data);
                OwLL.renderPager();
            });
        },

        /* 结果徽标配色。
           ⚠️ 只用 CSS 里**真实存在**的 ow-tag-* 类（已逐一 grep 确认）：
           green / owner / vip / member / guest / title。
           没有 ow-tag-red、没有 ow-tag-gray —— 别臆造，会静默退化成无背景的裸文字。
           失败借用 owner（橙红，视觉上最接近警示），登出用 member（灰）。 */
        resultTag: function (r) {
            var map = { ok: 'green', fail: 'owner', logout: 'member' };
            var cls = 'ow-tag ow-tag-' + (map[r.result] || 'guest');
            return '<span class="' + cls + '">' + esc(r.result_cn || r.result || '') + '</span>';
        },

        /* 渲染表格 */
        render: function (rows) {
            var tbl = $('owLLTable');
            if (!tbl) return;
            var header = '<tr><th>ID</th><th>结果</th><th>用户 ID</th><th>昵称</th><th>邮箱</th>'
                + '<th>IP</th><th>方式</th><th>原因 / 登录标识</th><th>User-Agent</th><th>时间</th></tr>';
            var h = '';
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                // 失败记录常没有昵称（密码错时核心不返回用户行，防账号枚举），
                // 这时用用户提交的 identity 顶上，否则那一行整列空白看不出是谁在试
                var who = r.nickname || r.identity || '';
                var extra = '';
                if (r.reason_cn) extra = esc(r.reason_cn);
                if (r.identity && r.identity !== r.nickname) {
                    extra += (extra ? '<br>' : '') + '<span style="color:var(--ow-text-sub)">标识：' + esc(r.identity) + '</span>';
                }
                h += '<tr>'
                    + '<td>' + r.id + '</td>'
                    + '<td>' + OwLL.resultTag(r) + '</td>'
                    + '<td>' + (r.user_id ? r.user_id : '<span style="color:var(--ow-text-sub)">—</span>') + '</td>'
                    + '<td>' + esc(who) + '</td>'
                    + '<td title="' + esc(r.email) + '">' + esc(r.email) + '</td>'
                    + '<td>' + esc(r.ip) + '</td>'
                    + '<td>' + esc(r.method_cn) + '</td>'
                    + '<td>' + (extra || '<span style="color:var(--ow-text-sub)">—</span>') + '</td>'
                    + '<td title="' + esc(r.user_agent) + '">' + esc(r.user_agent) + '</td>'
                    + '<td>' + esc(r.time_text) + '</td>'
                    + '</tr>';
            }
            if (!rows.length) {
                h = '<tr><td colspan="10" style="color:var(--ow-text-sub);text-align:center;padding:24px">暂无登录记录</td></tr>';
            }
            tbl.innerHTML = header + h;
            $('owLLStat').innerHTML = '第 ' + state.page + ' / ' + state.pages + ' 页 · 共 ' + state.total + ' 条';
        },

        /* 清理旧日志（默认 90 天前） */
        clearOld: function () {
            OwAdmin.confirm('确认清理 90 天前的登录日志？\n此操作不可恢复，敏感操作需二次确认。', function () {
                OwApi.secure('plugin_login_logs_clear', { days: 90 }, function (r) {
                    toast(r.msg);
                    if (r.ok) {
                        OwLL.loadStats();
                        OwLL.load(1);
                    }
                });
            });
        },

        /* 渲染分页：复用主程序 OwAdmin.uiPager */
        renderPager: function () {
            OwAdmin.uiPager('owLLPager', state.page, state.total, state.psize, function (pg) {
                OwLL.load(pg);
            });
        }
    };

    /* 后台页面 HTML 由 admin_plugin_page 异步注入，监听 #owAdminMain 变化后自动初始化 */
    function _llWatchInit() {
        var main = $('owAdminMain');
        if (!main) return;
        var tryInit = function () {
            var el = $('owLLTable');
            if (el && el.getAttribute('data-ll-inited') !== '1') {
                el.setAttribute('data-ll-inited', '1');
                OwLL.init();
            }
        };
        if (typeof MutationObserver !== 'undefined') {
            var ob = new MutationObserver(tryInit);
            ob.observe(main, { childList: true, subtree: true });
        } else {
            setInterval(tryInit, 300);
        }
        tryInit();
    }
    if (d.readyState === 'loading') {
        d.addEventListener('DOMContentLoaded', _llWatchInit);
    } else {
        _llWatchInit();
    }
})(window, document);
