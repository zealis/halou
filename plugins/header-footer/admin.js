/**
 * 页头页脚插件 - 后台交互（v1.0.0）
 * 全局对象 OwHF：页面 HTML 由插件后台页注入，函数在点击时执行，
 * 依赖的 OwApi / toast / esc 由主 chat.js 提供。
 * 兼容老浏览器：仅使用 var、function，不使用箭头函数 / let / const。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    w.OwHF = {
        /* 保存页头 / 页脚内容 */
        save: function () {
            OwApi.post('plugin_header_footer_save', {
                head: $('owHFHead').value,
                foot: $('owHFFoot').value
            }, function (r) {
                var m = $('owHFMsg');
                m.innerHTML = '<span style="color:' + (r.ok ? 'var(--ow-green,#52C41A)' : 'var(--ow-red,#F5222D)') + '">' + esc(r.msg) + '</span>';
                toast(r.msg);
            });
        }
    };
})(window, document);
