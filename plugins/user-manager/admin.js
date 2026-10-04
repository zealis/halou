/**
 * 用户管理插件 - 后台交互（v1.0.44 自后台剥离）
 * 全局对象 HaUM：页面 HTML 由插件后台页注入，函数在点击时执行，
 * 依赖的 HaApi / toast / esc / fmtUid / opts 由主 chat.js 提供。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    w.HaUM = {
        /* 搜索：仅数字用户 ID 精确查询；非法输入服务端返回 {ok:false} 需拦截提示 */
        search: function () {
            HaApi.post('plugin_user_manager_search', { q: $('haAQ').value }, function (r) {
                if (!r.ok) { toast(r.msg); $('haAResult').innerHTML = ''; return; }
                var h = '<div class="ha-card"><table class="ha-table"><tr><th>ID</th><th>昵称</th><th>邮箱</th><th>角色</th><th>称号</th><th>积分</th><th>状态</th><th>操作</th></tr>';
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
                       + '<td>' + (u.status == 1 ? '正常' : '禁用') + '</td>'
                       + '<td><a href="javascript:;" onclick="HaUM.save(' + u.id + ')">保存</a>'
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

        /* 保存角色 / 称号 / 积分（超管无下拉框，角色固定传 admin） */
        save: function (id) {
            var roleEl = $('haUR' + id);
            HaApi.secure('plugin_user_manager_save', {
                id: id, role: roleEl ? roleEl.value : 'admin',
                title: $('haUT' + id).value, points: $('haUP' + id).value
            }, function (r) { toast(r.msg); });
        },

        /* 禁用 / 启用后重查刷新列表 */
        status: function (id, s) {
            HaApi.secure('plugin_user_manager_status', { id: id, status: s }, function (r) { toast(r.msg); w.HaUM.search(); });
        }
    };
})(window, document);
