/**
 * 内容举报插件 - 后台交互
 * 全局对象 HaCR；依赖 HaApi / esc / toast / HaAdmin.uiPager / HaAdmin.confirm / HaApi.secure
 *
 * 功能：
 *   - 加载并保存举报规则配置（理由 / 间隔 / 字数上限）
 *   - 分页加载举报记录，支持按状态筛选
 *   - 处理举报（已处理 / 忽略）、删除举报
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    var state = { page: 1, size: 20, total: 0, status: -1 };

    w.HaCR = {
        init: function () {
            this.loadConfig();
            this.list(1);
        },

        /* ---------- 配置 ---------- */
        loadConfig: function () {
            HaApi.post('plugin_content_report_config_get', {}, function (r) {
                if (!r.ok) return;
                var c = r.data || {};
                if ($('haCRReasons')) $('haCRReasons').value = c.reasons || '';
                if ($('haCRInterval')) $('haCRInterval').value = c.interval || 0;
                if ($('haCRDescLimit')) $('haCRDescLimit').value = c.desc_limit || 200;
                if ($('haCRRequireDesc')) $('haCRRequireDesc').checked = !!c.require_desc;
                if ($('haCRAllowSelf')) $('haCRAllowSelf').checked = !!c.allow_self;
                if ($('haCRShowGuest')) $('haCRShowGuest').checked = !!c.show_guest;
                // 绑定开关视觉同步
                var sw = $('haCRSwitches');
                if (sw && typeof w.bindSwitches === 'function') w.bindSwitches(sw);
            });
        },

        saveConfig: function () {
            var reasons = $('haCRReasons') ? $('haCRReasons').value : '';
            var interval = $('haCRInterval') ? $('haCRInterval').value : 0;
            var descLimit = $('haCRDescLimit') ? $('haCRDescLimit').value : 200;
            HaApi.secure('plugin_content_report_config_save', {
                reasons: reasons,
                interval: interval,
                desc_limit: descLimit,
                require_desc: $('haCRRequireDesc') ? ($('haCRRequireDesc').checked ? 1 : 0) : 0,
                allow_self: $('haCRAllowSelf') ? ($('haCRAllowSelf').checked ? 1 : 0) : 0,
                show_guest: $('haCRShowGuest') ? ($('haCRShowGuest').checked ? 1 : 0) : 0
            }, function (r) {
                toast(r.msg || (r.ok ? '已保存' : '保存失败'));
            });
        },

        /* ---------- 举报列表 ---------- */
        list: function (page) {
            HaApi.post('plugin_content_report_list', {
                page: page || 1, size: state.size, status: state.status
            }, function (r) {
                var table = $('haCRTable');
                if (!table) return;
                if (!r.ok) { table.innerHTML = '<tr><td style="color:#5C5C5C">加载失败</td></tr>'; return; }
                state.total = r.data.total;
                state.page = r.data.page;
                w.HaCR.render(r.data.list);
                var pager = $('haCRPaging');
                if (pager) w.HaAdmin.uiPager(pager, state.page, state.total, state.size, function (pg) { w.HaCR.list(pg); });
            });
        },

        render: function (rows) {
            var table = $('haCRTable');
            var h = '<tr><th>ID</th><th>举报人</th><th>被举报人</th><th>理由</th><th>补充说明</th>'
                + '<th>来源</th><th>状态</th><th>时间</th><th>操作</th></tr>';
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var statusTag = '';
                if (row.status == 0) statusTag = '<span class="ha-tag ha-tag-guest">待处理</span>';
                else if (row.status == 1) statusTag = '<span class="ha-tag ha-tag-green">已处理</span>';
                else statusTag = '<span class="ha-tag">已忽略</span>';

                var source = '';
                if (row.room_id > 0) {
                    source = '群聊 #' + esc(row.room_id);
                    if (row.msg_time > 0) {
                        source += '<br><span style="color:#999;font-size:12px">' + esc(new Date(row.msg_time * 1000).toLocaleString()) + '</span>';
                    }
                } else {
                    source = '资料卡';
                }

                var rowClass = row.status == 0 ? ' style="background:#fff8e1"' : '';

                h += '<tr' + rowClass + '>'
                    + '<td>' + row.id + '</td>'
                    + '<td>' + esc(row.reporter_nick) + '<br><span style="color:#999;font-size:12px">#' + esc(row.reporter_id) + '</span></td>'
                    + '<td>' + esc(row.target_nick) + '<br><span style="color:#999;font-size:12px">#' + esc(row.target_uid) + '</span></td>'
                    + '<td>' + esc(row.reason) + '</td>'
                    + '<td class="ha-cr-desc">' + esc(row.description) + '</td>'
                    + '<td>' + source + '</td>'
                    + '<td>' + statusTag + '</td>'
                    + '<td>' + (row.created_at ? new Date(row.created_at * 1000).toLocaleString() : '-') + '</td>'
                    + '<td class="ha-cr-ops">'
                    + (row.status == 0
                        ? '<a href="javascript:;" onclick="HaCR.handle(' + row.id + ',1)">已处理</a> '
                        + '<a href="javascript:;" onclick="HaCR.handle(' + row.id + ',2)">忽略</a> '
                        : '')
                    + '<a href="javascript:;" onclick="HaCR.del(' + row.id + ')">删除</a>'
                    + '</td></tr>';
            }
            if (!rows.length) h += '<tr><td colspan="9" style="color:#5C5C5C;text-align:center">暂无举报记录</td></tr>';
            table.innerHTML = h;
        },

        handle: function (id, status) {
            HaApi.secure('plugin_content_report_handle', { id: id, status: status }, function (r) {
                toast(r.msg || (r.ok ? '已更新' : '操作失败'));
                if (r.ok) w.HaCR.list(state.page);
            });
        },

        del: function (id) {
            w.HaAdmin.confirm('确定删除该举报记录？', function () {
                HaApi.secure('plugin_content_report_delete', { id: id }, function (r) {
                    toast(r.msg || (r.ok ? '已删除' : '操作失败'));
                    if (r.ok) w.HaCR.list(state.page);
                });
            });
        }
    };

    /* 后台页 HTML 由 innerHTML 注入（script 不执行）：检测表格出现后自动初始化 */
    var mo = new MutationObserver(function () {
        var t = $('haCRTable');
        if (t && !t._inited) { t._inited = true; w.HaCR.init(); }
    });
    mo.observe(d.documentElement, { childList: true, subtree: true });
})(window, document);
