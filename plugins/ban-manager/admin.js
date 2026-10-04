/**
 * 禁言管理插件 - 后台交互（v1.0.52 自后台剥离）
 * 全局对象 HaBM；依赖主 chat.js 暴露的 HaApi / toast / esc。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    w.HaBM = {
        /* 列表渲染 */
        list: function () {
            HaApi.post('plugin_ban_manager_list', {}, function (r) {
                var h = '<div class="ha-card"><table class="ha-table"><tr><th>ID</th><th>类型</th><th>目标</th><th>房间</th><th>原因</th><th>过期时间</th><th>操作</th></tr>';
                for (var i = 0; i < r.data.length; i++) {
                    var b = r.data[i];
                    h += '<tr><td>' + b.id + '</td><td>' + esc(b.type === 'user' ? '用户' : b.type === 'guest' ? '游客' : 'IP') + '</td><td>' + esc(b.target) + '</td><td>' + (b.room_id == 0 ? '全局' : b.room_id) + '</td><td>' + esc(b.reason || '') + '</td>'
                       + '<td>' + (b.expires_at ? new Date(b.expires_at * 1000).toLocaleString() : '永久') + '</td>'
                       + '<td><a href="javascript:;" onclick="HaBM.del(' + b.id + ')">解除</a></td></tr>';
                }
                if (!r.data.length) h += '<tr><td colspan="7" style="color:#5C5C5C">暂无禁言记录</td></tr>';
                $('haBList').innerHTML = h + '</table></div>';
            });
        },

        /* 添加禁言 */
        add: function () {
            HaApi.secure('plugin_ban_manager_add', {
                type: $('haBType').value, target: $('haBTarget').value, room_id: $('haBRoom').value,
                hours: $('haBHours').value, reason: $('haBReason').value
            }, function (r) { toast(r.msg); if (r.ok) w.HaBM.list(); });
        },

        /* 解除 */
        del: function (id) {
            HaApi.secure('plugin_ban_manager_del', { id: id }, function (r) { toast(r.msg); w.HaBM.list(); });
        }
    };
})(window, document);
