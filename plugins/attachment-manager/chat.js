/* 附件上传 · 前端（attachment-manager 插件）
 *
 * 职责：把「图片 / 文件」两个按钮注入核心留的锚点 #owAttachTools，并实现上传。
 * 插件停用 → 本文件不加载 → 按钮不注入 → 输入框自然只剩表情。
 *
 * 为什么不直接在核心渲染按钮：按钮显隐是**功能是否存在**的体现，
 * 由插件自己决定，核心就不需要任何 `if (插件已启用)` 判断
 * （与第三方授权的 window.OwOauth 同一思路）。
 */
(function (w, d) {
    if (!w.OwChat || !OwChat.cfg) return;
    if (w.OwAttach) return;          // 防重复加载
    var OwApi = w.OwApi;
    if (!OwApi) return;

    var toast = w.toast || function (s) { w.alert(s); };

    /** 注入按钮（核心给的是空锚点；插不进去就安静退出，不报错） */
    function mount() {
        var box = d.getElementById('owAttachTools');
        if (!box) return;
        box.innerHTML =
            '<input type="file" id="owFileInput" accept="image/*" style="display:none">' +
            '<input type="file" id="owFileAttach" style="display:none">' +
            '<button class="ow-icon-btn" id="owBtnImage" title="发送图片">' + icon('image') + '</button>' +
            '<button class="ow-icon-btn" id="owBtnFile" title="发送文件">' + icon('paperclip') + '</button>';

        var bi = d.getElementById('owBtnImage'), bf = d.getElementById('owBtnFile');
        var fi = d.getElementById('owFileInput'), fa = d.getElementById('owFileAttach');
        if (bi) bi.onclick = function () { if (fi) fi.click(); };
        if (bf) bf.onclick = function () { if (fa) fa.click(); };
        if (fi) fi.onchange = function () { if (this.files && this.files[0]) uploadImage(this.files[0]); this.value = ''; };
        if (fa) fa.onchange = function () { if (this.files && this.files[0]) uploadFile(this.files[0]); this.value = ''; };
    }

    /**
     * 图标：与核心 ow_icon() 的同名图标**保持一致**（同一份 path data）。
     * 刻意内联而不是从核心 DOM 里「借」——借意味着核心还得保留按钮代码，
     * 与「上传相关代码移入插件」的做法相悖。
     * ⚠️ 换图标时两处一起改：index.php 的 SVG_PATH 与这里。
     */
    var SVG = {
        image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l4.5-4.5 3.5 3.5 3-3 5 5"/>',
        paperclip: '<g transform="scale(0.82) translate(2.6 2.6)"><path d="M16.5 7.5l-7 7a3.5 3.5 0 0 0 5 5l7-7a5.5 5.5 0 0 0-8-8L6 12a7.5 7.5 0 0 0 11 11"/></g>'
    };
    function icon(name) {
        return '<svg class="ow-ico" width="16" height="16" viewBox="0 0 24 24" fill="none"'
            + ' stroke="currentColor" stroke-width="1.8" stroke-linecap="round"'
            + ' stroke-linejoin="round" aria-hidden="true">' + (SVG[name] || '') + '</svg>';
    }

    /** 上传文件附件 → 发 file 消息 */
    function uploadFile(file) {
        toast('文件上传中…');
        OwApi.upload('plugin_attachment_manager_upload_file', file, {}, function (r) {
            if (!r.ok) { toast(r.msg); return; }
            OwChat.send({
                type: 'file',
                content: JSON.stringify({ name: r.file.name, size: r.file.size, ext: r.file.ext, path: r.file.path })
            });
        });
    }

    /** 上传图片 → 发 image 消息 */
    function uploadImage(file) {
        toast('图片上传中…');
        OwApi.upload('plugin_attachment_manager_upload', file, { kind: 'image' }, function (r) {
            if (r.ok) OwChat.send({ type: 'image', content: r.url });
            else toast(r.msg);
        });
    }

    w.OwAttach = { mount: mount, uploadFile: uploadFile, uploadImage: uploadImage };

    // 核心在 OwChat.init 之后才引入插件脚本，此时 DOM 已就绪
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount);
    else mount();
})(window, document);
