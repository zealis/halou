/**
 * 禁言管理插件 - 后台交互（v1.0.52 自后台剥离）
 * 全局对象 OwBM；依赖主 chat.js 暴露的 OwApi / toast / esc。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    w.OwBM = {
        /* 列表渲染 */
        list: function () {
            OwApi.post('plugin_ban_manager_list', {}, function (r) {
                var h = '<div class="ow-card"><table class="ow-table"><tr><th>ID</th><th>类型</th><th>目标</th><th>房间</th><th>原因</th><th>过期时间</th><th>操作</th></tr>';
                for (var i = 0; i < r.data.length; i++) {
                    var b = r.data[i];
                    h += '<tr><td>' + b.id + '</td><td>' + esc(b.type === 'user' ? '用户' : b.type === 'guest' ? '游客' : 'IP') + '</td><td>' + esc(b.target) + '</td><td>' + (b.room_id == 0 ? '全局' : b.room_id) + '</td><td>' + esc(b.reason || '') + '</td>'
                       + '<td>' + (b.expires_at ? new Date(b.expires_at * 1000).toLocaleString() : '永久') + '</td>'
                       + '<td><a href="javascript:;" onclick="OwBM.del(' + b.id + ')">解除</a></td></tr>';
                }
                if (!r.data.length) h += '<tr><td colspan="7" style="color:#5C5C5C">暂无禁言记录</td></tr>';
                $('owBList').innerHTML = h + '</table></div>';
            });
        },

        /* 添加禁言 */
        add: function () {
            OwApi.secure('plugin_ban_manager_add', {
                type: $('owBType').value, target: $('owBTarget').value, room_id: $('owBRoom').value,
                hours: $('owBHours').value, reason: $('owBReason').value
            }, function (r) { toast(r.msg); if (r.ok) w.OwBM.list(); });
        },

        /* 解除 */
        del: function (id) {
            OwApi.secure('plugin_ban_manager_del', { id: id }, function (r) { toast(r.msg); w.OwBM.list(); });
        }
    };
})(window, document);
