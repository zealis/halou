/**
 * 附件管理插件 - 后台交互（v1.0.0）
 * 全局对象 HaAM：页面 HTML 由插件后台页注入，函数在点击时执行，
 * 依赖的 HaApi / toast / esc 由主 chat.js 提供。
 * 兼容老浏览器：仅使用 var / function，不使用箭头函数、let/const、fetch。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    /* 当前查询状态 */
    var state = { q: '', room_id: 0, page: 1, psize: 20, total: 0, pages: 1 };

    w.HaAM = {
        /* 初始化：直接加载首屏列表（群聊ID输入框，0=全部） */
        init: function () {
            HaAM.load(1);
        },

        /* 重置筛选条件 */
        resetFilter: function () {
            $('haAMQ').value = '';
            $('haAMRoom').value = '0';
            HaAM.load(1);
        },

        /* 加载列表 */
        load: function (page) {
            var qEl = $('haAMQ'), rEl = $('haAMRoom');
            if (!qEl || !rEl) { toast('元素不存在'); return; }
            state.q = qEl.value;
            state.room_id = parseInt(rEl.value, 10) || 0;
            state.page = page || 1;
            HaApi.post('plugin_attachment_manager_list', {
                q: state.q, room_id: state.room_id,
                page: state.page, psize: state.psize
            }, function (r) {
                if (!r || !r.ok) { toast((r && r.msg) || '加载失败'); return; }
                state.total = r.total;
                state.pages = r.pages;
                HaAM.render(r.data);
                HaAM.renderPager();
            });
        },

        /* 渲染列表 */
        render: function (rows) {
            var tbl = $('haAMTable');
            if (!tbl) return;
            // 表头固定写死，避免 getElementsByTagName live collection 与 MutationObserver 冲突
            var header = '<tr><th style="width:32px"><input type="checkbox" id="haAMCheckAll" onchange="HaAM.toggleAll(this)"></th>'
                + '<th>类型</th><th>文件名</th><th>大小</th><th>消息</th><th>上传者</th><th>上传时间</th><th>操作</th></tr>';

            var h = '';
            for (var i = 0; i < rows.length; i++) {
                var f = rows[i];
                var s = HaApi.sign('plugin_attachment_manager_download');
                var dl = '?action=plugin_attachment_manager_download&id=' + f.id + '&ts=' + s.ts + '&sign=' + s.sign;
                h += '<tr>'
                    + '<td><input type="checkbox" class="haAMChk" value="' + f.id + '" onchange="HaAM.updateBatch()"></td>'
                    + '<td>' + esc(f.type_cn) + '</td>'
                    + '<td><span class="ha-file-name" title="' + esc(f.name) + '">' + esc(f.name) + '</span></td>'
                    + '<td>' + (f.ext ? esc(f.ext) + ' · ' : '') + esc(f.size_text) + '</td>'
                    + '<td>' + esc(f.scope_text) + '</td>'
                    + '<td>' + esc(f.nickname) + '</td>'
                    + '<td>' + esc(f.time_text) + '</td>'
                    + '<td><a href="' + dl + '" title="下载" target="_blank" rel="noopener">下载</a> '
                    + '<a href="javascript:;" onclick="HaAM.delOne(' + f.id + ')">删除</a></td>'
                    + '</tr>';
            }
            if (!rows.length) {
                h = '<tr><td colspan="8" style="color:#999;text-align:center;padding:24px">暂无附件</td></tr>';
            }
            // 一次性替换整个表格内容，避免 live collection 操作问题
            tbl.innerHTML = header + h;
            HaAM.updateBatch();
            // 总数由 uiPager 显示，这里只显示当前页信息
            $('haAMStat').innerHTML = '第 ' + state.page + ' / ' + state.pages + ' 页';
        },

        /* 全选 / 取消全选 */
        toggleAll: function (cb) {
            var boxes = d.getElementsByClassName('haAMChk');
            for (var i = 0; i < boxes.length; i++) boxes[i].checked = cb.checked;
            HaAM.updateBatch();
        },

        /* 更新批量删除按钮状态 */
        updateBatch: function () {
            var boxes = d.getElementsByClassName('haAMChk');
            var n = 0;
            for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) n++;
            var btn = $('haAMBatchDel');
            btn.disabled = n === 0;
            btn.innerHTML = n > 0 ? '批量删除（' + n + '）' : '批量删除';
        },

        /* 批量删除 */
        batchDelete: function () {
            var boxes = d.getElementsByClassName('haAMChk');
            var ids = [];
            for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) ids.push(boxes[i].value);
            if (!ids.length) { toast('请先选择要删除的附件'); return; }
            HaAdmin.confirm('确认删除选中的 ' + ids.length + ' 个附件？\n删除后消息记录与物理文件均不可恢复。', function () {
                HaApi.secure('plugin_attachment_manager_delete', { ids: ids.join(',') }, function (r) {
                    toast(r.msg);
                    if (r.ok) HaAM.load(state.page);
                });
            });
        },

        /* 删除单个 */
        delOne: function (id) {
            HaAdmin.confirm('确认删除该附件？\n删除后消息记录与物理文件均不可恢复。', function () {
                HaApi.secure('plugin_attachment_manager_delete', { ids: String(id) }, function (r) {
                    toast(r.msg);
                    if (r.ok) HaAM.load(state.page);
                });
            });
        },

        /* 渲染分页：复用主程序 HaAdmin.uiPager（与群聊审核等页面一致） */
        renderPager: function () {
            HaAdmin.uiPager('HAMPager', state.page, state.total, state.psize, function (pg) {
                HaAM.load(pg);
            });
        }
    };

    /* 后台页面 HTML 由 admin_plugin_page 异步注入，监听 #haAdminMain 变化后自动初始化 */
    function _amWatchInit() {
        var main = $('haAdminMain');
        if (!main) return;
        var tryInit = function () {
            var el = $('haAMQ');
            if (el && el.getAttribute('data-am-inited') !== '1') {
                el.setAttribute('data-am-inited', '1');
                HaAM.init();
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
        d.addEventListener('DOMContentLoaded', _amWatchInit);
    } else {
        _amWatchInit();
    }
})(window, document);
