/* ==========================================================================
 * 个性签名插件前端（纯原生 ES5，兼容旧浏览器，无外部依赖）
 *
 * 功能：
 *   1. 个人设置弹窗：在昵称下方注入「个性签名」文本框（上限 200 字）
 *   2. 保存设置时一并保存个性签名
 *   3. 用户资料卡：展示该用户的个性签名
 * ========================================================================== */
(function (w) {
    'use strict';

    if (!w.HaChat || !HaChat.cfg) return;
    if (w.__haSigLoaded) return;
    w.__haSigLoaded = true;

    function $(id) { return document.getElementById(id); }

    /* ---------- 1. 个人设置：注入个性签名输入框 ---------- */

    var origOpenSettings = HaChat.openSettings;
    HaChat.openSettings = function () {
        origOpenSettings.call(this);
        injectSignatureField();
    };

    function injectSignatureField() {
        var modal = $('haModal');
        if (!modal) return;
        // 避免重复注入
        if (modal.querySelector('#haSetSignature')) return;

        var nickInput = modal.querySelector('#haSetNick');
        if (!nickInput) return;
        var nickItem = nickInput.parentNode;   // .ha-form-item

        var div = document.createElement('div');
        div.className = 'ha-form-item';
        div.innerHTML = '<label>个性签名</label>'
            + '<textarea class="ha-input" id="haSetSignature" maxlength="200" rows="3"'
            + ' placeholder="介绍一下自己吧（最多 200 个字）"'
            + ' style="resize:vertical;width:100%;box-sizing:border-box"></textarea>';
        nickItem.parentNode.insertBefore(div, nickItem.nextSibling);

        // 加载已有签名
        HaApi.post('plugin_signature_get', { id: HaChat.cfg.me.id }, function (r) {
            if (r.ok) {
                var ta = $('haSetSignature');
                if (ta) ta.value = r.signature || '';
            }
        });
    }

    /* ---------- 2. 保存设置：一并保存个性签名 ---------- */

    var origSaveSettings = HaChat.saveSettings;
    HaChat.saveSettings = function () {
        var ta = $('haSetSignature');
        var sig = ta ? ta.value : '';
        // 先走核心的昵称/头像保存
        origSaveSettings.call(this);
        // 个性签名独立保存（与昵称/头像解耦，互不影响）
        HaApi.post('plugin_signature_save', { signature: sig }, function (r) {
            if (!r.ok) toast(r.msg);
        });
    };

    /* ---------- 3. 用户资料卡：展示个性签名 ---------- */

    var origUserCard = HaChat.userCard;
    HaChat.userCard = function (uid, nick) {
        if (!uid) { HaChat.pmHint(nick); return; }
        var self = this;
        // 临时接管 openModal：核心 userCard 渲染完资料卡后，注入个性签名
        var origOpenModal = HaChat.openModal;
        HaChat.openModal = function (html, width) {
            HaChat.openModal = origOpenModal;   // 立即还原，避免影响其它弹窗
            origOpenModal.call(this, html, width);
            injectSignatureIntoCard(uid);
        };
        origUserCard.call(self, uid, nick);
    };

    function injectSignatureIntoCard(uid) {
        HaApi.post('plugin_signature_get', { id: uid }, function (r) {
            if (!r.ok) return;
            var sig = (r.signature || '').replace(/^\s+|\s+$/g, '');
            if (!sig) return;
            var modal = $('haModal');
            if (!modal) return;
            // 避免重复注入
            if (modal.querySelector('.ha-sig-text')) return;
            // 资料卡结构：<h3> → <div>头像区 → <p>用户ID/积分/注册</p>
            // 在 <p>（用户信息段）之前插入签名
            var p = modal.querySelector('p');
            if (!p) return;
            var div = document.createElement('div');
            div.className = 'ha-sig-text';
            div.style.cssText = 'font-size:13px;color:#333;background:var(--ha-bg-sub,#f5f5f5);'
                + 'border-radius:4px;padding:8px 12px;margin:0 0 12px;word-break:break-word;'
                + 'white-space:pre-wrap;line-height:1.5';
            div.textContent = sig;
            p.parentNode.insertBefore(div, p);
        });
    }
})(window);
