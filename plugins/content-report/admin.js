/**
 * 内容举报插件 - 后台交互
 * 全局对象 OwCRAdmin；依赖 OwApi / esc / toast / OwAdmin.uiPager / OwAdmin.confirm / OwApi.secure
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

    w.OwCRAdmin = {
        init: function () {
            this.loadConfig();
            this.list(1);
        },

        /* ---------- 配置 ---------- */
        loadConfig: function () {
            OwApi.post('plugin_content_report_config_get', {}, function (r) {
                if (!r.ok) return;
                var c = r.data || {};
                if ($('owCRReasons')) $('owCRReasons').value = c.reasons || '';
                if ($('owCRInterval')) $('owCRInterval').value = c.interval || 0;
                if ($('owCRDescLimit')) $('owCRDescLimit').value = c.desc_limit || 200;
                if ($('owCRRequireDesc')) $('owCRRequireDesc').checked = !!c.require_desc;
                if ($('owCRAllowSelf')) $('owCRAllowSelf').checked = !!c.allow_self;
                if ($('owCRShowGuest')) $('owCRShowGuest').checked = !!c.show_guest;
                // 绑定开关视觉同步
                var sw = $('owCRSwitches');
                if (sw && typeof w.bindSwitches === 'function') w.bindSwitches(sw);
            });
        },

        saveConfig: function () {
            var reasons = $('owCRReasons') ? $('owCRReasons').value : '';
            var interval = $('owCRInterval') ? $('owCRInterval').value : 0;
            var descLimit = $('owCRDescLimit') ? $('owCRDescLimit').value : 200;
            OwApi.secure('plugin_content_report_config_save', {
                reasons: reasons,
                interval: interval,
                desc_limit: descLimit,
                require_desc: $('owCRRequireDesc') ? ($('owCRRequireDesc').checked ? 1 : 0) : 0,
                allow_self: $('owCRAllowSelf') ? ($('owCRAllowSelf').checked ? 1 : 0) : 0,
                show_guest: $('owCRShowGuest') ? ($('owCRShowGuest').checked ? 1 : 0) : 0
            }, function (r) {
                toast(r.msg || (r.ok ? '已保存' : '保存失败'));
            });
        },

        /* ---------- 举报列表 ---------- */
        list: function (page) {
            OwApi.post('plugin_content_report_list', {
                page: page || 1, size: state.size, status: state.status
            }, function (r) {
                var table = $('owCRTable');
                if (!table) return;
                if (!r.ok) { table.innerHTML = '<tr><td style="color:#5C5C5C">加载失败</td></tr>'; return; }
                state.total = r.data.total;
                state.page = r.data.page;
                w.OwCRAdmin.render(r.data.list);
                var pager = $('owCRPaging');
                if (pager) w.OwAdmin.uiPager(pager, state.page, state.total, state.size, function (pg) { w.OwCRAdmin.list(pg); });
            });
        },

        render: function (rows) {
            var table = $('owCRTable');
            var h = '<tr><th>ID</th><th>举报人</th><th>被举报人</th><th>理由</th><th>补充说明</th>'
                + '<th>来源</th><th>状态</th><th>时间</th><th>操作</th></tr>';
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var statusTag = '';
                if (row.status == 0) statusTag = '<span class="ow-tag ow-tag-guest">待处理</span>';
                else if (row.status == 1) statusTag = '<span class="ow-tag ow-tag-green">已处理</span>';
                else statusTag = '<span class="ow-tag">已忽略</span>';

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
                    + '<td class="ow-cr-desc">' + esc(row.description) + '</td>'
                    + '<td>' + source + '</td>'
                    + '<td>' + statusTag + '</td>'
                    + '<td>' + (row.created_at ? new Date(row.created_at * 1000).toLocaleString() : '-') + '</td>'
                    + '<td class="ow-cr-ops">'
                    + (row.status == 0
                        ? '<a href="javascript:;" onclick="OwCRAdmin.handle(' + row.id + ',1)">已处理</a> '
                        + '<a href="javascript:;" onclick="OwCRAdmin.handle(' + row.id + ',2)">忽略</a> '
                        : '')
                    + '<a href="javascript:;" onclick="OwCRAdmin.del(' + row.id + ')">删除</a>'
                    + '</td></tr>';
            }
            if (!rows.length) h += '<tr><td colspan="9" style="color:#5C5C5C;text-align:center">暂无举报记录</td></tr>';
            table.innerHTML = h;
        },

        handle: function (id, status) {
            OwApi.secure('plugin_content_report_handle', { id: id, status: status }, function (r) {
                toast(r.msg || (r.ok ? '已更新' : '操作失败'));
                if (r.ok) w.OwCRAdmin.list(state.page);
            });
        },

        del: function (id) {
            w.OwAdmin.confirm('确定删除该举报记录？', function () {
                OwApi.secure('plugin_content_report_delete', { id: id }, function (r) {
                    toast(r.msg || (r.ok ? '已删除' : '操作失败'));
                    if (r.ok) w.OwCRAdmin.list(state.page);
                });
            });
        }
    };

    /* 后台页 HTML 由 innerHTML 注入（script 不执行）：检测表格出现后自动初始化 */
    var mo = new MutationObserver(function () {
        var t = $('owCRTable');
        if (t && !t._inited) { t._inited = true; w.OwCRAdmin.init(); }
    });
    mo.observe(d.documentElement, { childList: true, subtree: true });
})(window, document);
