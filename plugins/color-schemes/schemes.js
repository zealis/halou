/**
 * color-schemes · 设置页「色系」段（v1.3.51）
 *
 * 由核心 chat.js 移出。加载路径：插件 JS 合并包（?action=assets&type=js），在 chat.js 之后。
 * **插件停用时这个文件不加载**，设置弹窗里就没有「色系」这一段，界面回到核心默认。
 *
 * 注入方式沿用 twofa 插件的既有套路：包一层 OwChat.openSettings，原弹窗渲染完再追加自己的
 * 区块；再包一层 applyTheme —— 行内变量优先级高于 [data-theme="dark"]，切深浅时必须让引擎
 * 按新档位重算，否则日间色会赖在深色页上。
 */
(function (w, d) {
    'use strict';
    var T = w.OwTheme, C = w.OwChat;
    if (!T || !C) return;   // 引擎没加载（非聊天页）→ 不注入任何 UI

    /**
     * 色板卡片网格 + 自建表单。三格 = 主色/悬浮/浅底，宽度 50/30/20 对应它们在界面里的实际用量。
     * ⚠️ 自建色系的名称是用户输入，必须 esc() 再拼进 innerHTML。
     */
    function gridHtml() {
        var schemes = T.all(), cur = T.id(), ids = [], k;
        for (k in schemes) { if (Object.prototype.hasOwnProperty.call(schemes, k)) ids.push(k); }
        var h = '<div class="ow-scheme-grid" id="owSchemeGrid">';
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i], s = schemes[id], on = (id === cur);
            h += '<span class="ow-scheme-card' + (on ? ' is-active' : '') + '">'
               + '<button type="button" class="ow-scheme-pick" data-scheme="' + w.esc(id) + '"'
               + ' aria-pressed="' + (on ? 'true' : 'false') + '">'
               + '<span class="ow-scheme-sw" aria-hidden="true">'
               + '<i style="background:' + w.esc(s.brand) + '"></i>'
               + '<i style="background:' + w.esc(s.hover) + '"></i>'
               + '<i style="background:' + w.esc(s.soft) + '"></i></span>'
               + '<span class="ow-scheme-name">' + w.esc(s.name) + '</span></button>'
               + (s.custom ? '<button type="button" class="ow-scheme-del" data-scheme-del="' + w.esc(id) + '"'
                   + ' title="删除该色系" aria-label="删除色系 ' + w.esc(s.name) + '">×</button>' : '')
               + '</span>';
        }
        h += '</div>';
        if (T.customSchemes().length >= T.MAX_CUSTOM) {
            h += '<p class="ow-form-hint">自建色系已达 ' + T.MAX_CUSTOM + ' 个上限，删除后才能再加。</p>';
        } else {
            h += '<div class="ow-scheme-add">'
               + '<input class="ow-input" type="text" id="owSchemeName" maxlength="12" placeholder="色系名称" aria-label="色系名称">'
               + '<label class="ow-scheme-color">主色<input type="color" id="owSchemeBrand" value="#00a0e9"></label>'
               + '<label class="ow-scheme-color">悬浮<input type="color" id="owSchemeHover" value="#0086c9"></label>'
               + '<label class="ow-scheme-color">浅底<input type="color" id="owSchemeSoft" value="#e6f7ff"></label>'
               + '<button type="button" class="ow-btn ow-btn-ghost" id="owSchemeCreate">新增色系</button>'
               + '</div>';
        }
        return h;
    }

    function bindGrid() {
        var grid = d.getElementById('owSchemeGrid');
        if (!grid) return;
        grid.onclick = function (e) {
            var t = e.target;
            var pick = t && t.closest ? t.closest('[data-scheme]') : null;
            if (pick) { pickScheme(pick.getAttribute('data-scheme')); return; }
            var del = t && t.closest ? t.closest('[data-scheme-del]') : null;
            if (del) removeScheme(del.getAttribute('data-scheme-del'));
        };
    }

    function refresh() {
        var wrap = d.getElementById('owSchemeWrap');
        if (!wrap) return;
        wrap.innerHTML = gridHtml();
        bindGrid();
    }

    /** 切换：立即生效 + 落 localStorage，不经过「保存」按钮（与日夜模式同一逻辑） */
    function pickScheme(id) {
        T.save(id);
        T.apply();
        refresh();
        w.toast('已切换到「' + (T.all()[id] || {}).name + '」色系');
    }

    /** 删除自建色系；删的正是当前用的就落回经典蓝 */
    function removeScheme(id) {
        var was = T.id();
        if (!T.remove(id)) return;
        if (was === id) T.save('classic');
        T.apply();
        refresh();
        w.toast('色系已删除');
    }

    function createScheme() {
        var g = function (i) { var e = d.getElementById(i); return e ? e.value : ''; };
        var name = g('owSchemeName').trim();
        if (name === '') {
            w.toast('请先填写色系名称');
            var n = d.getElementById('owSchemeName'); if (n) n.focus();
            return;
        }
        var s = T.add({ name: name, brand: g('owSchemeBrand'), hover: g('owSchemeHover'), soft: g('owSchemeSoft') });
        if (!s) { w.toast('色系保存失败，请检查颜色值'); return; }
        T.save(s.id);   // 新建即启用
        T.apply();
        refresh();
        w.toast('色系「' + s.name + '」已创建并启用');
    }

    /**
     * 把「色系」段插到「日夜模式」下面（两者都是本机外观偏好，分开摆会看不出是一组）。
     * 定位靠 #owThemeSeg 这个结构锚点而不是 label 文字 —— 文字会被 i18n 引擎换成英文，
     * 按字面匹配在英文模式下就找不到插入点了。
     */
    function inject() {
        var modal = d.getElementById('owModal');
        if (!modal || modal.querySelector('#owSchemeSection')) return;
        var seg = d.getElementById('owThemeSeg');
        // 没有「日夜模式」分段 = 核心弹窗压根没渲染（例如游客调 openSettings 时 cfg.me 为空会早退），
        // 这时不能往一个空弹窗里塞孤零零的色系段。
        if (!seg) return;
        var anchor = seg.closest ? seg.closest('.ow-form-item') : null;

        var sec = d.createElement('div');
        sec.className = 'ow-form-item';
        sec.id = 'owSchemeSection';
        sec.innerHTML = '<label>色系</label>'
            + '<div id="owSchemeWrap">' + gridHtml() + '</div>'
            // 长说明：无 class 的 ≤12.5px <p> 会被 OwTip 自动收进 label 右侧的 ⓘ
            + '<p style="font-size:12px;color:var(--ow-text-sub)">内置 6 套 + 自建（最多 ' + T.MAX_CUSTOM + ' 个），'
            + '只改界面配色、不动消息内容，且仅对本浏览器生效。'
            + '深色档下主色会自动提到可读亮度，所以同一色系在深浅两档看起来不完全一样。'
            + '删除正在使用的色系会回到经典蓝。</p>';

        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
        else modal.appendChild(sec);

        bindGrid();
        var btn = d.getElementById('owSchemeCreate');
        if (btn) btn.onclick = createScheme;
        if (w.OwTip && w.OwTip.scan) w.OwTip.scan(sec);   // 立刻收 ⓘ，不等观察器
    }

    var origOpen = C.openSettings;
    C.openSettings = function () {
        origOpen.call(this);
        inject();
    };

    var origApply = C.applyTheme;
    C.applyTheme = function (mode, persist) {
        origApply.call(this, mode, persist);
        T.applyScheme(d.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    };
})(window, document);
