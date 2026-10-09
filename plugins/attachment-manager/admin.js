/**
 * 附件管理插件 - 后台交互（v1.0.0）
 * 全局对象 OwAM：页面 HTML 由插件后台页注入，函数在点击时执行，
 * 依赖的 OwApi / toast / esc 由主 chat.js 提供。
 * 兼容老浏览器：仅使用 var / function，不使用箭头函数、let/const、fetch。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    /* 当前查询状态 */
    var state = { q: '', room_id: 0, page: 1, psize: 20, total: 0, pages: 1 };

    w.OwAM = {
        /* 初始化：直接加载首屏列表（群聊ID输入框，0=全部） */
        init: function () {
            OwAM.load(1);
            OwAT.loadCfg();      // v1.2.41：顺带把上传配置读进表单
        },

        /* 重置筛选条件 */
        resetFilter: function () {
            $('owAMQ').value = '';
            $('owAMRoom').value = '0';
            OwAM.load(1);
        },

        /* 加载列表 */
        load: function (page) {
            var qEl = $('owAMQ'), rEl = $('owAMRoom');
            if (!qEl || !rEl) { toast('元素不存在'); return; }
            state.q = qEl.value;
            state.room_id = parseInt(rEl.value, 10) || 0;
            state.page = page || 1;
            OwApi.post('plugin_attachment_manager_list', {
                q: state.q, room_id: state.room_id,
                page: state.page, psize: state.psize
            }, function (r) {
                if (!r || !r.ok) { toast((r && r.msg) || '加载失败'); return; }
                state.total = r.total;
                state.pages = r.pages;
                OwAM.render(r.data);
                OwAM.renderPager();
            });
        },

        /* 渲染列表 */
        render: function (rows) {
            var tbl = $('owAMTable');
            if (!tbl) return;
            // 表头固定写死，避免 getElementsByTagName live collection 与 MutationObserver 冲突
            var header = '<tr><th style="width:32px"><input type="checkbox" id="owAMCheckAll" onchange="OwAM.toggleAll(this)"></th>'
                + '<th>类型</th><th>文件名</th><th>大小</th><th>消息</th><th>上传者</th><th>上传时间</th><th>操作</th></tr>';

            var h = '';
            for (var i = 0; i < rows.length; i++) {
                var f = rows[i];
                var s = OwApi.sign('plugin_attachment_manager_download');
                var dl = '?action=plugin_attachment_manager_download&id=' + f.id + '&ts=' + s.ts + '&sign=' + s.sign;
                h += '<tr>'
                    + '<td><input type="checkbox" class="owAMChk" value="' + f.id + '" onchange="OwAM.updateBatch()"></td>'
                    + '<td>' + esc(f.type_cn) + '</td>'
                    + '<td><span class="ow-file-name" title="' + esc(f.name) + '">' + esc(f.name) + '</span></td>'
                    + '<td>' + (f.ext ? esc(f.ext) + ' · ' : '') + esc(f.size_text) + '</td>'
                    + '<td>' + esc(f.scope_text) + '</td>'
                    + '<td>' + esc(f.nickname) + '</td>'
                    + '<td>' + esc(f.time_text) + '</td>'
                    + '<td><a href="' + dl + '" title="下载" target="_blank" rel="noopener">下载</a> '
                    + '<a href="javascript:;" onclick="OwAM.delOne(' + f.id + ')">删除</a></td>'
                    + '</tr>';
            }
            if (!rows.length) {
                h = '<tr><td colspan="8" style="color:#999;text-align:center;padding:24px">暂无附件</td></tr>';
            }
            // 一次性替换整个表格内容，避免 live collection 操作问题
            tbl.innerHTML = header + h;
            OwAM.updateBatch();
            // 总数由 uiPager 显示，这里只显示当前页信息
            $('owAMStat').innerHTML = '第 ' + state.page + ' / ' + state.pages + ' 页';
        },

        /* 全选 / 取消全选 */
        toggleAll: function (cb) {
            var boxes = d.getElementsByClassName('owAMChk');
            for (var i = 0; i < boxes.length; i++) boxes[i].checked = cb.checked;
            OwAM.updateBatch();
        },

        /* 更新批量删除按钮状态 */
        updateBatch: function () {
            var boxes = d.getElementsByClassName('owAMChk');
            var n = 0;
            for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) n++;
            var btn = $('owAMBatchDel');
            btn.disabled = n === 0;
            btn.innerHTML = n > 0 ? '批量删除（' + n + '）' : '批量删除';
        },

        /* 批量删除 */
        batchDelete: function () {
            var boxes = d.getElementsByClassName('owAMChk');
            var ids = [];
            for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) ids.push(boxes[i].value);
            if (!ids.length) { toast('请先选择要删除的附件'); return; }
            OwAdmin.confirm('确认删除选中的 ' + ids.length + ' 个附件？\n删除后消息记录与物理文件均不可恢复。', function () {
                OwApi.secure('plugin_attachment_manager_delete', { ids: ids.join(',') }, function (r) {
                    toast(r.msg);
                    if (r.ok) OwAM.load(state.page);
                });
            });
        },

        /* 删除单个 */
        delOne: function (id) {
            OwAdmin.confirm('确认删除该附件？\n删除后消息记录与物理文件均不可恢复。', function () {
                OwApi.secure('plugin_attachment_manager_delete', { ids: String(id) }, function (r) {
                    toast(r.msg);
                    if (r.ok) OwAM.load(state.page);
                });
            });
        },

        /* 渲染分页：复用主程序 OwAdmin.uiPager（与群聊审核等页面一致） */
        renderPager: function () {
            OwAdmin.uiPager('HAMPager', state.page, state.total, state.psize, function (pg) {
                OwAM.load(pg);
            });
        }
    };

    /* 后台页面 HTML 由 admin_plugin_page 异步注入，监听 #owAdminMain 变化后自动初始化 */
    function _amWatchInit() {
        var main = $('owAdminMain');
        if (!main) return;
        var tryInit = function () {
            var el = $('owAMQ');
            if (el && el.getAttribute('data-am-inited') !== '1') {
                el.setAttribute('data-am-inited', '1');
                OwAM.init();
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

    /* =======================================================================
       OwAT：上传配置（v1.2.41 从核心「站点设置」迁入本插件）
       路由：plugin_attachment_manager_cfg_get / _cfg_save
       ======================================================================= */
    w.OwAT = {
        /** 读配置填表 + 显示当前生效的扩展名 */
        loadCfg: function () {
            OwApi.post('plugin_attachment_manager_cfg_get', {}, function (r) {
                if (!r.ok) { toast(r.msg || '读取配置失败'); return; }
                var c = r.config || {};
                var en = $('owAtEnabled'), mb = $('owAtMaxMb'), ex = $('owAtExts');
                if (en) en.value = c.enabled === '0' ? '0' : '1';
                if (mb) mb.value = c.max_mb || '10';
                if (ex) ex.value = c.exts || '';
                var act = $('owAtActive');
                if (act) act.textContent = (r.active_exts || []).join('、') || '（无）';
                // v1.2.0：压缩开关 + imagewebp() 实测支持状态；v1.3.0：细分复选框
                var cp = $('owAtCompress'), cq = $('owAtCompressQ'), wp = $('owAtWebp');
                if (cp) cp.value = c.compress === '1' ? '1' : '0';
                if (cq) cq.value = c.compress_q || '80';
                var mk = function (id, v) { var el = $(id); if (el) el.checked = v === '1'; };
                mk('owAtcAvatar', c.compress_avatar);
                mk('owAtcImage', c.compress_image);
                mk('owAtcSticker', c.compress_sticker);
                if (wp) {
                    OwAT.webpReady = !!r.webp_ready;
                    if (r.webp_ready) { wp.textContent = '✓ 可用'; wp.style.color = '#1a7f37'; }
                    else { wp.textContent = '✗ 不可用（GD 未编译 WebP）'; wp.style.color = '#C41D1F'; }
                }
            });
        },

        /** 保存配置 */
        saveCfg: function () {
            var en = $('owAtEnabled'), mb = $('owAtMaxMb'), ex = $('owAtExts');
            if (!en || !mb || !ex) { toast('配置表单不存在'); return; }
            var mbv = parseInt(mb.value, 10);
            if (isNaN(mbv) || mbv < 1 || mbv > 1024) { toast('大小上限请填 1~1024 的整数'); return; }
            var cp = $('owAtCompress'), cq = $('owAtCompressQ');
            var qv = cq ? parseInt(cq.value, 10) : 80;
            if (isNaN(qv) || qv < 1 || qv > 100) { toast('压缩质量请填 1~100 的整数'); return; }
            if (cp && cp.value === '1' && !OwAT.webpReady) {
                toast('本机 PHP 不支持 imagewebp()，已保持关闭');
                cp.value = '0';
            }
            var ck = function (id) { var el = $(id); return el && el.checked ? '1' : '0'; };
            OwApi.post('plugin_attachment_manager_cfg_save', {
                enabled: en.value, max_mb: String(mbv), exts: ex.value,
                compress: cp ? cp.value : '0', compress_q: String(qv),
                compress_avatar: ck('owAtcAvatar'), compress_image: ck('owAtcImage'),
                compress_sticker: ck('owAtcSticker')
            }, function (r) {
                if (!r.ok) { toast(r.msg || '保存失败'); return; }
                toast('配置已保存');
                OwAT.loadCfg();      // 回读：把被安全表过滤后的结果回显
            });
        },

        /** imagewebp() 支持状态缓存（loadCfg 时刷新，saveCfg 校验用） */
        webpReady: false,
    };

})(window, document);
