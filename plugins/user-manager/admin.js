/**
 * 用户管理插件 - 后台交互（v1.0.44 自后台剥离）
 * 全局对象 HaUM：页面 HTML 由插件后台页注入，函数在点击时执行，
 * 依赖的 HaApi / toast / esc / fmtUid / opts 由主 chat.js 提供。
 *
 * v1.2.43：新增「等级」列与编辑。等级由「等级信任」插件提供，
 *   未安装 / 未启用时服务端返回 level = -1（哨兵值），此时隐藏该列，
 *   不给一个「能填但保存必报错」的输入框。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    w.HaUM = {
        /* 搜索：仅数字用户 ID 精确查询；非法输入服务端返回 {ok:false} 需拦截提示 */
        search: function () {
            HaApi.post('plugin_user_manager_search', { q: $('haAQ').value }, function (r) {
                if (!r.ok) { toast(r.msg); $('haAResult').innerHTML = ''; return; }
                // 等级是否可用：任一用户带回了 ≥1 的等级就说明装了等级插件
                var hasLevel = false;
                for (var k = 0; k < r.data.length; k++) {
                    if (parseInt(r.data[k].level, 10) >= 1) { hasLevel = true; break; }
                }
                var th = '<tr><th>ID</th><th>昵称</th><th>邮箱</th><th>角色</th><th>称号</th>'
                       + '<th>积分</th>' + (hasLevel ? '<th>等级</th>' : '') + '<th>状态</th><th>操作</th></tr>';
                var h = '<div class="ha-card"><table class="ha-table">' + th;
                for (var i = 0; i < r.data.length; i++) {
                    var u = r.data[i];
                    var isRoot = u.id === 1;   // 超级管理员：用户组锁定、不可禁用（v1.0.88）
                    h += '<tr><td>' + esc(fmtUid(u.id)) + '</td><td>' + esc(u.nickname) + '</td><td>' + esc(u.email) + '</td>'
                       + '<td>' + (isRoot
                           ? '<span class="ha-tag ha-tag-admin">超级管理员 · 锁定</span>'
                           : '<select class="ha-input" id="haUR' + u.id + '">'
                           + opts(ROLE_CN, ['member', 'vip', 'admin'], u.role)
                           + '</select>') + '</td>'
                       + '<td><input class="ha-input" id="haUT' + u.id + '" value="' + esc(u.title || '') + '"></td>'
                       + '<td><input class="ha-input" id="haUP' + u.id + '" value="' + esc(u.points || 0) + '" style="width:88px"></td>'
                       + (hasLevel
                           ? '<td><input class="ha-input" id="haUL' + u.id + '" type="number" min="1"'
                             + ' value="' + esc(parseInt(u.level, 10) >= 1 ? u.level : 1) + '" style="width:72px"></td>'
                           : '')
                       + '<td>' + (u.status == 1 ? '正常' : '禁用') + '</td>'
                       + '<td><a href="javascript:;" onclick="HaUM.detail(' + u.id + ')">详情</a>'
                       + ' <a href="javascript:;" onclick="HaUM.save(' + u.id + ')">保存</a>'
                       + (isRoot ? '' : ' <a href="javascript:;" onclick="HaUM.status(' + u.id + ',' + (u.status == 1 ? 0 : 1) + ')">' + (u.status == 1 ? '禁用' : '启用') + '</a>')
                       + '</td></tr>';
                }
                if (!r.data.length) {
                    if (r.hint) toast(r.hint);
                    h += '<tr><td colspan="8" style="color:#5C5C5C">无匹配用户</td></tr>';
                }
                $('haAResult').innerHTML = h + '</table></div>';
            });
        },

        /* ---------- 用户概览（v1.2.56）----------
           参考通用后台的「用户概览」弹窗：头像 + 昵称/角色/状态在顶行，
           下面是 ID / 邮箱 / 注册时间 / 注册 IP / 最后登录（相对时间 + IP）。
           样式全部复用现有轮子（.ha-modal / .ha-card-meta-row / .ha-tag），不新写 CSS。 */
        detail: function (id) {
            HaApi.post('plugin_user_manager_detail', { id: id }, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                var u = r.data;

                /* 相对时间：「13 天前」式（概览里突出「多久没来 / 多久前注册」） */
                function ago(ts) {
                    if (!ts) return '';
                    var s = Math.max(0, Math.floor(Date.now() / 1000) - parseInt(ts, 10));
                    if (s < 60) return '刚刚';
                    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
                    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
                    return Math.floor(s / 86400) + ' 天前';
                }
                function fmt(ts) {
                    var t = new Date(parseInt(ts, 10) * 1000);
                    function p(n) { return (n < 10 ? '0' : '') + n; }
                    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate())
                        + ' ' + p(t.getHours()) + ':' + p(t.getMinutes());
                }
                function metaRow(k, v) {
                    return '<div class="ha-card-meta-row"><span class="ha-card-meta-k">' + esc(k)
                        + '</span><span class="ha-card-meta-v">' + v + '</span></div>';
                }
                function tag(cls, text) {
                    return '<span class="ha-tag ' + cls + '">' + esc(text) + '</span>';
                }

                // 角色标签：管理场景（real）→ admin 显示「超级管理员」；普通 member 无标签
                var isRoot = parseInt(u.id, 10) === 1;
                var roleTag = (isRoot || u.role === 'admin') ? tag('ha-tag-admin', '超级管理员')
                    : (u.role === 'vip' ? tag('ha-tag-vip', 'VIP') : tag('ha-tag-member', '会员'));
                var statusTag = parseInt(u.status, 10) === 1 ? tag('ha-tag-green', '正常') : tag('ha-tag-red', '已禁用');

                // 头像：与核心 avatarHtml 同款兜底（无头像 = 首字 + 按昵称长度取色）
                var av;
                if (u.avatar) {
                    av = '<span class="ha-avatar ha-avatar-lg"><img src="' + esc(u.avatar) + '" alt=""></span>';
                } else {
                    var colors = ['#0099FF', '#00558F', '#A05000', '#237804', '#5B21B6'];
                    var c = colors[(u.nickname || '').length % colors.length];
                    av = '<span class="ha-avatar ha-avatar-lg" style="background:' + c + '">'
                        + esc((u.nickname || '?').charAt(0)) + '</span>';
                }

                // 头部行：头像 + 昵称/标签 + 状态
                var head = '<div style="display:flex;-webkit-display:flex;align-items:center;-webkit-align-items:center;gap:14px;margin:4px 0 14px">'
                    + av
                    + '<div style="min-width:0;-webkit-flex:1;flex:1">'
                    + '<div style="display:flex;-webkit-display:flex;align-items:center;-webkit-align-items:center;gap:8px;flex-wrap:wrap;-webkit-flex-wrap:wrap">'
                    + '<b style="font-size:16px;color:var(--ha-text-title)">' + esc(u.nickname) + '</b>'
                    + (roleTag ? '<span class="ha-card-badges ha-card-badges-inline">' + roleTag + '</span>' : '')
                    + statusTag
                    + '</div>'
                    + '<div style="font-size:12px;color:var(--ha-text-sub);margin-top:3px">ID ' + esc(fmtUid(u.id))
                    + (u.title ? ' · ' + esc(u.title) : '')
                    + (parseInt(u.level, 10) >= 1 ? ' · 等级 Lv.' + parseInt(u.level, 10) : '')
                    + '</div></div></div>';

                // 信息行：注册时间带相对时间，最后登录 = 相对时间 + IP（参考概览式排版）
                var meta = '<div class="ha-card-meta">'
                    + metaRow('邮箱', esc(u.email || '—'))
                    + metaRow('积分', esc(String(parseInt(u.points, 10) || 0)))
                    + metaRow('注册时间', u.created_at
                        ? esc(fmt(u.created_at)) + ' <span style="color:var(--ha-text-sub)">（' + esc(ago(u.created_at)) + '）</span>'
                        : '—')
                    + metaRow('注册 IP', esc(u.reg_ip || '—'))
                    + metaRow('最后登录', u.last_login
                        ? '<b>' + esc(ago(u.last_login)) + '</b> ' + esc(fmt(u.last_login))
                          + (u.last_login_ip ? ' <span style="color:var(--ha-text-sub)">' + esc(u.last_login_ip) + '</span>' : '')
                        : '从未登录')
                    + '</div>';

                var mask = document.createElement('div');
                mask.className = 'ha-modal-mask';
                mask.style.display = 'flex';
                mask.innerHTML = '<div class="ha-modal" style="width:460px;max-width:94%">'
                    + '<button class="ha-modal-close">✕</button>'
                    + '<h3>用户概览</h3>'
                    + head + meta
                    + '</div>';
                document.body.appendChild(mask);
                var close = function () { if (mask.parentNode) document.body.removeChild(mask); };
                mask.querySelector('.ha-modal-close').onclick = close;
                mask.onclick = function (e) { if (e.target === mask) close(); };
            });
        },

        /* 保存角色 / 称号 / 积分 / 等级（超管无下拉框，角色固定传 admin） */
        save: function (id) {
            var roleEl = $('haUR' + id);
            var lvEl = $('haUL' + id);
            var payload = {
                id: id, role: roleEl ? roleEl.value : 'admin',
                title: $('haUT' + id).value, points: $('haUP' + id).value
            };
            // 只在等级列存在时提交：否则服务端会当成「要改等级」并报未安装插件
            if (lvEl) payload.level = lvEl.value;
            HaApi.secure('plugin_user_manager_save', payload, function (r) {
                toast(r.msg);
                if (r.ok) w.HaUM.search();
            });
        },

        /* 禁用 / 启用后重查刷新列表 */
        status: function (id, s) {
            HaApi.secure('plugin_user_manager_status', { id: id, status: s }, function (r) { toast(r.msg); w.HaUM.search(); });
        }
    };
})(window, document);
