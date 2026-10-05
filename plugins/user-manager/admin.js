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
