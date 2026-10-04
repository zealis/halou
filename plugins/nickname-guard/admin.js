/**
 * 昵称保留插件 - 后台交互（v1.3.1）
 * 全局对象 HaNG：页面 HTML 由插件后台页注入，函数在点击时执行，
 * 依赖的 HaApi / toast / esc 由主 chat.js 提供。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };

    w.HaNG = {
        /* 保存保留昵称列表 */
        save: function () {
            HaApi.post('plugin_nickname_guard_save', {
                list: $('haNGList').value
            }, function (r) {
                var m = $('haNGMsg');
                m.innerHTML = '<span style="color:' + (r.ok ? 'var(--ha-green,#52C41A)' : 'var(--ha-red,#F5222D)') + '">' + esc(r.msg) + '</span>';
                toast(r.msg);
            });
        }
    };
})(window, document);
