/* ==========================================================================
   Halou-Chat 前端（纯原生 ES5，无框架无依赖，兼容旧内核浏览器）
   包含：HaAuth（登录/注册/找回）、HaChat（聊天主程序，长轮询）、HaAdmin（管理后台）
   ========================================================================== */
(function (w) {
    'use strict';

    /* ---------- 纯 JS MD5（标准实现，用于 API 签名 sign = md5(key|ts|action)） ----------
       注意：MD5 的 64 个 T 常量必须逐一写死，不能用公式推导，否则与服务端 md5 不一致。 */
    function md5(s) {
        function safeAdd(x, y) {
            var lsw = (x & 0xffff) + (y & 0xffff);
            var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xffff);
        }
        function rol(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
        function cmn(q, a, b, x, s, t) { return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
        function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
        function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
        function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
        function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
        function cycle(x, k) {
            var a = x[0], b = x[1], c = x[2], d = x[3];
            a = ff(a, b, c, d, k[0], 7, -680876936);    d = ff(d, a, b, c, k[1], 12, -389564586);
            c = ff(c, d, a, b, k[2], 17, 606105819);    b = ff(b, c, d, a, k[3], 22, -1044525330);
            a = ff(a, b, c, d, k[4], 7, -176418897);    d = ff(d, a, b, c, k[5], 12, 1200080426);
            c = ff(c, d, a, b, k[6], 17, -1473231341);  b = ff(b, c, d, a, k[7], 22, -45705983);
            a = ff(a, b, c, d, k[8], 7, 1770035416);    d = ff(d, a, b, c, k[9], 12, -1958414417);
            c = ff(c, d, a, b, k[10], 17, -42063);      b = ff(b, c, d, a, k[11], 22, -1990404162);
            a = ff(a, b, c, d, k[12], 7, 1804603682);   d = ff(d, a, b, c, k[13], 12, -40341101);
            c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);

            a = gg(a, b, c, d, k[1], 5, -165796510);    d = gg(d, a, b, c, k[6], 9, -1069501632);
            c = gg(c, d, a, b, k[11], 14, 643717713);   b = gg(b, c, d, a, k[0], 20, -373897302);
            a = gg(a, b, c, d, k[5], 5, -701558691);    d = gg(d, a, b, c, k[10], 9, 38016083);
            c = gg(c, d, a, b, k[15], 14, -660478335);  b = gg(b, c, d, a, k[4], 20, -405537848);
            a = gg(a, b, c, d, k[9], 5, 568446438);     d = gg(d, a, b, c, k[14], 9, -1019803690);
            c = gg(c, d, a, b, k[3], 14, -187363961);   b = gg(b, c, d, a, k[8], 20, 1163531501);
            a = gg(a, b, c, d, k[13], 5, -1444681467);  d = gg(d, a, b, c, k[2], 9, -51403784);
            c = gg(c, d, a, b, k[7], 14, 1735328473);   b = gg(b, c, d, a, k[12], 20, -1926607734);

            a = hh(a, b, c, d, k[5], 4, -378558);       d = hh(d, a, b, c, k[8], 11, -2022574463);
            c = hh(c, d, a, b, k[11], 16, 1839030562);  b = hh(b, c, d, a, k[14], 23, -35309556);
            a = hh(a, b, c, d, k[1], 4, -1530992060);   d = hh(d, a, b, c, k[4], 11, 1272893353);
            c = hh(c, d, a, b, k[7], 16, -155497632);   b = hh(b, c, d, a, k[10], 23, -1094730640);
            a = hh(a, b, c, d, k[13], 4, 681279174);    d = hh(d, a, b, c, k[0], 11, -358537222);
            c = hh(c, d, a, b, k[3], 16, -722521979);   b = hh(b, c, d, a, k[6], 23, 76029189);
            a = hh(a, b, c, d, k[9], 4, -640364487);    d = hh(d, a, b, c, k[12], 11, -421815835);
            c = hh(c, d, a, b, k[15], 16, 530742520);   b = hh(b, c, d, a, k[2], 23, -995338651);

            a = ii(a, b, c, d, k[0], 6, -198630844);    d = ii(d, a, b, c, k[7], 10, 1126891415);
            c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
            a = ii(a, b, c, d, k[12], 6, 1700485571);   d = ii(d, a, b, c, k[3], 10, -1894986606);
            c = ii(c, d, a, b, k[10], 15, -1051523);    b = ii(b, c, d, a, k[1], 21, -2054922799);
            a = ii(a, b, c, d, k[8], 6, 1873313359);    d = ii(d, a, b, c, k[15], 10, -30611744);
            c = ii(c, d, a, b, k[6], 15, -1560198380);  b = ii(b, c, d, a, k[13], 21, 1309151649);
            a = ii(a, b, c, d, k[4], 6, -145523070);    d = ii(d, a, b, c, k[11], 10, -1120210379);
            c = ii(c, d, a, b, k[2], 15, 718787259);    b = ii(b, c, d, a, k[9], 21, -343485551);

            x[0] = safeAdd(a, x[0]); x[1] = safeAdd(b, x[1]);
            x[2] = safeAdd(c, x[2]); x[3] = safeAdd(d, x[3]);
        }
        function blk(s) {
            var out = [], i;
            for (i = 0; i < 64; i += 4) {
                out[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) +
                    (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
            }
            return out;
        }
        function hex(n) {
            var s2 = '', i, v;
            for (i = 0; i < 4; i++) {
                v = (n >> (i * 8)) & 0xff;
                s2 += ('0' + v.toString(16)).slice(-2);
            }
            return s2;
        }
        var str = String(s == null ? '' : s), n, i, tail;
        try { str = unescape(encodeURIComponent(str)); } catch (e) { /* 旧内核降级：按原串处理 */ }
        n = str.length;
        var state = [1732584193, -271733879, -1732584194, 271733878];
        for (i = 64; i <= n; i += 64) cycle(state, blk(str.substring(i - 64, i)));
        str = str.substring(i - 64);
        tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < str.length; i++) tail[i >> 2] |= str.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) { cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
        tail[14] = n * 8;
        tail[15] = Math.floor(n / 0x20000000);
        cycle(state, tail);
        return hex(state[0]) + hex(state[1]) + hex(state[2]) + hex(state[3]);
    }

    /* ---------- 通用工具 ---------- */
    function $(id) { return document.getElementById(id); }

    /**
     * 开关（State 按钮）HTML 生成器 —— 通用样式轮子（v1.1.5）。
     *
     * 前后台与插件共用同一套结构与样式，勿各处手写：
     *   <label class="ha-switch-row">
     *     <input type="checkbox" class="ha-switch-input" id="...">   ← 真实状态载体，可被表单直接读取
     *     <span class="ha-switch-label">标签文字</span>
     *     <span class="ha-switch is-on"></span>                        ← 视觉轨道
     *     <p class="ha-switch-hint">提示文字（可省略）</p>
     *   </label>
     *
     * 用原生 checkbox 承载状态：可被 FormData 收集、可 Tab 聚焦、点击整行都能切换，
     * 视觉完全交给 .ha-switch，不需要额外同步逻辑。
     *
     * @param {string} id      input 的 id，绑定与读取都用它
     * @param {string} label   左侧标签文字
     * @param {boolean} on     初始状态
     * @param {string} [hint]  下方灰色提示文字，可省略
     * @param {boolean} [disabled] 是否禁用
     */
    function switchHtml(id, label, on, hint, disabled) {
        return '<label class="ha-switch-row' + (disabled ? ' is-disabled' : '') + '" for="' + esc(id) + '">'
            + '<input type="checkbox" class="ha-switch-input" id="' + esc(id) + '"' + (on ? ' checked' : '') + (disabled ? ' disabled' : '') + '>'
            + '<span class="ha-switch-label">' + esc(label) + '</span>'
            + '<span class="ha-switch' + (on ? ' is-on' : '') + '"></span>'
            + (hint ? '<p class="ha-switch-hint">' + esc(hint) + '</p>' : '')
            + '</label>';
    }

    /**
     * 绑定开关的视觉同步：监听 change，把 .ha-switch 的 is-on 跟上 checkbox。
     * 必须在元素插入 DOM 后调用（可传事件委托的容器，或单个 input）。
     * @param {Element|NodeList} scope 容器（含 checkbox）或 checkbox 本身
     */
    function bindSwitches(scope) {
        var list = [];
        if (!scope) return;
        if (scope.nodeType === 1 && scope.className && (' ' + scope.className + ' ').indexOf(' ha-switch-input ') >= 0) list.push(scope);
        else list = [].slice.call(scope.querySelectorAll ? scope.querySelectorAll('.ha-switch-input') : []);
        for (var i = 0; i < list.length; i++) {
            (function (cb) {
                var sw = cb.parentNode.querySelector('.ha-switch');
                if (!sw) return;
                var sync = function () { sw.className = 'ha-switch' + (cb.checked ? ' is-on' : ''); };
                cb.addEventListener ? cb.addEventListener('change', sync, false) : cb.attachEvent('onchange', sync);
                sync();
            })(list[i]);
        }
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function toast(msg, ms) {
        var t = $('haToast'); if (!t) return;
        t.innerHTML = esc(msg); t.style.display = 'block';
        clearTimeout(t._tm);
        t._tm = setTimeout(function () { t.style.display = 'none'; }, ms || 2200);
    }
    /* 用户 ID 展示补零：至少 3 位（001），超出 3 位按实际位数（1000 起）。
       仅影响显示，传输与存储始终是数字，后端搜索兼容 001 输入（(int) 归一）。 */
    function fmtUid(id) {
        var s = String(id == null ? 0 : id);
        var w = s.length > 3 ? s.length : 3;
        while (s.length < w) s = '0' + s;
        return s;
    }
    /** 归一化 class 字符串：去掉多余空格（增删 class 时避免累积空白） */
    function trimCls(s) { return String(s || '').replace(/\s+/g, ' ').replace(/^ | $/g, ''); }

    /* 枚举值中文显示（提交时仍用英文原始值，仅界面本地化） */
    // v1.1.16：'public' 的中文统一为「普通」（与后台/插件口径一致）。
    // 'public' 是 rooms.type 的**存储值**（不是 is_public），指「无密码无角色门槛」。
    var ROOM_TYPE_CN = { 'public': '普通', 'password': '密码房', 'role': '角色限定' };
    var ROLE_CN = { 'guest': '游客', 'member': '普通用户', 'vip': 'VIP', 'admin': '超级管理员' };
    function cn(map, v) { return map[v] || v; }
    function opts(map, keys, current) {
        var h = '', i;
        for (i = 0; i < keys.length; i++) {
            h += '<option value="' + esc(keys[i]) + '"' + (current === keys[i] ? ' selected' : '') + '>' + esc(cn(map, keys[i])) + '</option>';
        }
        return h;
    }

    /* ---------- 文件类型图标（v1.2.16）----------

       11 个彩色图标全部是「同一个文件外形 + 不同底色 + 不同内嵌符号」，
       外形路径完全一致，故抽成常量复用，只按类型查表取底色与符号。
       全部 viewBox 1024 实心版式，与 24 网格的 OW_SVG_PATHS 不同源，
       所以单独一套渲染函数，不塞进 OW_SVG_PATHS。 */
    var FILE_SILHOUETTE = 'M862 902c0 16.569-13.431 30-30 30H192c-16.569 0-30-13.431-30-30V122c0-16.569 13.431-30 30-30h476l194 194v616z';
    /* 右上角折角高光：11 个图标完全相同 */
    var FILE_FOLD = 'M862 286H698c-16.569 0-30-13.431-30-30V92';

    /* 类型 → { 底色, 内嵌符号 }。未命中走 unknown（灰色问号）。
       扩展名清单与后端 core/upload.php 的 EXT_MIME 保持一致。 */
    var FILE_ICON_MAP = {
        /* 压缩包：拉链 */
        archive: { c: '#7DB4FF', g: 'M289 92h70v70h-70zM359 162h70v70h-70zM289 232h70v70h-70zM359 302h70v70h-70zM289 372h70v70h-70zM289 468h140v110c0 16.569-13.431 30-30 30h-80c-16.569 0-30-13.431-30-30V468z' },
        /* 电脑端可执行文件：EXE 字样 */
        exe:    { c: '#7DB4FF', g: 'M403.76 540.84c0-44.48-13.76-75.84-73.92-75.84-54.08 0-85.44 19.52-85.44 89.6s31.36 89.6 84.16 89.6c30.08 0 56-6.08 66.24-12.16v-36.48c-11.2 6.08-36.16 12.16-57.28 12.16-30.72 0-45.12-11.2-46.72-35.84l111.36-7.04c0.96-4.8 1.6-14.08 1.6-24z m-112.96-1.28c0.96-27.2 10.56-39.68 39.04-39.68 27.2 0 31.68 15.36 31.68 34.24l-70.72 5.44zM420.4 641h54.72l36.48-59.52h1.92L549.36 641h55.04l-59.2-88.64 56-84.16h-53.76l-33.6 56.32h-1.92l-33.6-56.32h-54.4l56.32 84.48zM781.04 540.84c0-44.48-13.76-75.84-73.92-75.84-54.08 0-85.44 19.52-85.44 89.6s31.36 89.6 84.16 89.6c30.08 0 56-6.08 66.24-12.16v-36.48c-11.2 6.08-36.16 12.16-57.28 12.16-30.72 0-45.12-11.2-46.72-35.84l111.36-7.04c0.96-4.8 1.6-14.08 1.6-24z m-112.96-1.28c0.96-27.2 10.56-39.68 39.04-39.68 27.2 0 31.68 15.36 31.68 34.24l-70.72 5.44z' },
        /* 纯文本：T */
        text:   { c: '#BEBEBE', g: 'M638.17 362.94H385.82v65.17H475V703h73.99V428.11h89.18z' },
        /* 代码文件：</> */
        code:   { c: '#FFAB4E', g: 'M245.007043 548.186003m15.909903-15.909902l111.015764-111.015765q15.909903-15.909903 31.819805 0l0 0q15.909903 15.909903 0 31.819805l-111.015764 111.015765q-15.909903 15.909903-31.819805 0l0 0q-15.909903-15.909903 0-31.819805Z M292.736751 532.260544l111.015764 111.015765c8.786509 8.786509 8.787216 23.032589 0 31.819805-8.786509 8.786509-23.033296 8.786509-31.819805 0l-111.015764-111.015764C252.130437 555.293841 252.130437 541.047053 260.916946 532.260544c8.787216-8.787216 23.033296-8.786509 31.819805 0z M451.835252 687.708405m5.823428-21.733331l66.516495-248.242937q5.823429-21.733331 27.55676-15.909903l0 0q21.733331 5.823429 15.909902 27.55676l-66.516494 248.242937q-5.823429 21.733331-27.55676 15.909903l0 0q-21.733331-5.823429-15.909903-27.55676Z M779.499086 548.186057m-15.909902-15.909903l-111.015765-111.015764q-15.909903-15.909903-31.819805 0l0 0q-15.909903 15.909903 0 31.819805l111.015765 111.015764q15.909903 15.909903 31.819805 0l0 0q15.909903-15.909903 0-31.819805Z M731.769379 532.260598l-111.015765 111.015765c-8.786509 8.786509-8.787216 23.032589 0 31.819805 8.786509 8.786509 23.033296 8.786509 31.819805 0l111.015765-111.015765C772.375693 555.293894 772.375693 541.047107 763.589184 532.260598c-8.787216-8.787216-23.033296-8.786509-31.819805 0z' },
        /* 音频：音符 */
        audio:  { c: '#FF6359', g: 'M627.579498 327.776722m-7.764571 28.977775l-94.727771 353.528852q-7.764571 28.977775-36.742346 21.213204l0 0q-28.977775-7.764571-21.213203-36.742347l94.72777-353.528852q7.764571-28.977775 36.742347-21.213203l0 0q28.977775 7.764571 21.213203 36.742346Z M614.551831 328.726268c5.486288 6.671274 9.751378 12.915942 12.797461 18.733558C636.893966 365.698642 626.146831 376.906994 650.462485 404.234511c24.315654 27.327517 60.0614 26.208052 76.794976 50.59809 16.734542 24.390297 17.315177 28.648678 19.510288 52.420831 2.194145 23.771894-23.492776 74.570552-26.770242 49.91931-3.278432-24.6515-19.503267-42.787775-31.327354-73.082335-5.384355-13.797719-21.829962-19.055304-41.086699-26.765017-0.701151-0.281048-2.886169-1.380018-6.557435-3.29962a99.988 99.988 0 0 1-34.015467-29.076613L567.711128 371.924962c-10.264493-13.848523-8.838443-33.126309 3.350522-45.314888 11.479416-11.480083 30.091303-11.478933 41.570679-0.000742 0.674139 0.675497 1.315261 1.381488 1.920209 2.118161z M270.398574 649.322917a130.822 87.5 15 1 0 252.728697 67.71845 130.822 87.5 15 1 0-252.728697-67.71845Z' },
        /* 视频：胶片 */
        video:  { c: '#C076E5', g: 'M257 92h70v70h-70zM257 232h70v70h-70zM257 372h70v70h-70zM257 512h70v70h-70zM257 652h70v70h-70zM257 792h70v70h-70zM698 302h70v70h-70zM698 442h70v70h-70zM698 582h70v70h-70zM698 722h70v70h-70zM698 862h70v70h-70zM593.941 544.47l-138.743 95.568c-9.096 6.266-21.55 3.971-27.816-5.125a20 20 0 0 1-3.529-11.345V432.432c0-11.045 8.954-20 20-20a20 20 0 0 1 11.345 3.53l138.743 95.567c9.097 6.266 11.392 18.72 5.126 27.816a20 20 0 0 1-5.126 5.126z' },
        /* PPT：P */
        ppt:    { c: '#FF6359', g: 'M391.269 705h75.544V598.642h42.245c97.412 0 135.681-31.311 135.681-121.268 0-82.999-32.305-117.292-135.681-117.292H391.269V705z m75.544-166.992V419.722h32.305c50.694 0 68.586 14.91 68.586 59.143 0 45.724-17.395 59.143-68.586 59.143h-32.305z' },
        /* XLSX：X */
        xls:    { c: '#60C267', g: 'M495.93 707.9c93.59 0 130.83-35.77 130.83-102.41 0-63.21-17.64-88.69-98.98-108.29-49.98-11.76-57.82-19.6-57.82-41.65 0-28.91 16.17-36.26 54.88-36.26 28.42 0 67.62 6.86 84.28 12.25v-61.25c-18.13-6.37-48.51-12.25-87.22-12.25-78.89 0-124.46 27.44-124.46 99.47 0 60.76 21.07 81.34 93.59 98 51.94 12.74 61.74 22.05 61.74 48.02 0 30.38-14.7 40.67-59.78 40.67-34.3 0-74.97-5.88-96.04-13.72v65.17c21.07 5.88 59.29 12.25 98.98 12.25z' },
        /* Word：W */
        word:   { c: '#4895FF', g: 'M361.81 703h93.1l53.41-215.6h2.94L563.69 703h93.1l77.91-340.06h-76.93l-49.98 251.37h-2.94l-49-218.54h-86.24l-51.94 218.54h-2.94l-49-251.37h-77.91z' },
        /* PDF：PDF 字样 */
        pdf:    { c: '#FF6359', g: 'M234.64 641h48.64v-68.48h27.2c62.72 0 87.36-20.16 87.36-78.08 0-53.44-20.8-75.52-87.36-75.52h-75.84V641z m48.64-107.52v-76.16h20.8c32.64 0 44.16 9.6 44.16 38.08 0 29.44-11.2 38.08-44.16 38.08h-20.8zM437.52 418.92V641h76.16c65.28 0 108.16-25.28 108.16-111.04 0-92.48-42.88-111.04-108.16-111.04h-76.16z m48.64 180.48V459.88h24.96c40 0 60.48 12.8 60.48 70.08 0 54.08-19.52 69.44-60.48 69.44h-24.96zM801.36 461.16v-42.24H665.68V641h48.64v-86.4h80.64v-41.92h-80.64v-51.52z' },
        /* 未知：问号 */
        unknown:{ c: '#BEBEBE', g: 'M474.17 591.28h59.78v-11.27c0-16.66 5.88-25.97 35.77-48.02 33.32-24.99 44.1-42.63 44.1-88.2 0-68.6-33.32-86.73-113.68-86.73-29.4 0-55.86 3.43-73.99 8.82v60.76c17.15-5.39 39.69-8.33 59.78-8.33 39.69 0 51.94 6.37 51.94 35.77 0 20.58-4.41 29.89-25.97 47.04-28.91 24.99-37.73 40.18-37.73 68.11v22.05z m30.38 114.66c34.79 0 41.65-5.88 41.65-41.16 0-34.3-6.86-40.67-41.65-40.67-35.28 0-41.65 6.37-41.65 40.67 0 35.28 6.37 41.16 41.65 41.16z' }
    };

    /* 扩展名 → 图标类型。后端 core/upload.php 的 EXT_MIME 是允许清单，
       这里覆盖得更宽（含 md/log 等），多出的类型落到 unknown 也不影响。 */
    var FILE_EXT_ICON = {
        /* 压缩包 */
        'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'gz': 'archive',
        'tar': 'archive', 'bz2': 'archive', 'xz': 'archive',
        /* 电脑端可执行文件 */
        'exe': 'exe', 'msi': 'exe', 'bat': 'exe', 'cmd': 'exe', 'com': 'exe', 'scr': 'exe',
        /* 文本 / 文档 / 日志 / 数据 */
        'txt': 'text', 'log': 'text', 'md': 'text', 'rtf': 'text', 'ini': 'text', 'csv': 'text',
        /* 代码 */
        'js': 'code', 'ts': 'code', 'php': 'code', 'html': 'code', 'htm': 'code', 'css': 'code',
        'json': 'code', 'xml': 'code', 'py': 'code', 'java': 'code', 'c': 'code', 'cpp': 'code',
        'h': 'code', 'go': 'code', 'rs': 'code', 'rb': 'code', 'sh': 'code', 'sql': 'code',
        'yml': 'code', 'yaml': 'code', 'vue': 'code', 'tsv': 'code',
        /* 音频 */
        'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'ogg': 'audio', 'm4a': 'audio',
        'aac': 'audio', 'wma': 'audio', 'amr': 'audio', 'mid': 'audio',
        /* 视频 */
        'mp4': 'video', 'webm': 'video', 'avi': 'video', 'mkv': 'video', 'mov': 'video',
        'wmv': 'video', 'flv': 'video', 'm4v': 'video', 'rmvb': 'video', 'mpg': 'video', 'mpeg': 'video',
        /* PPT */
        'ppt': 'ppt', 'pptx': 'ppt',
        /* Excel */
        'xls': 'xls', 'xlsx': 'xls',
        /* Word */
        'doc': 'word', 'docx': 'word',
        /* PDF */
        'pdf': 'pdf'
    };
    function fileIconSvg(ext) {
        var e = String(ext || '').toLowerCase().replace(/^\./, '');
        var t = FILE_ICON_MAP[FILE_EXT_ICON[e] || 'unknown'];
        return haSvgFileType(t, 34);
    }

    /* 文件消息卡片：图标 + 文件名 + 大小 + 下载（下载链接带签名，服务端再校验房间权限）
       v1.2.14：第二行去掉「ZIP · 」这类扩展名前缀（与文件图标信息重复，且挤占文件名空间）。
       v1.2.18：文件名加 data-name 存**完整名**（中间省略只改显示，不改数据源），
       并补 title —— 省略后鼠标悬停仍能看到全名。 */
    function fileCardHtml(m) {
        var info = null;
        try { info = JSON.parse(m.content); } catch (e) { info = null; }
        if (!info) return '<span class="ha-file-card">文件内容已失效</span>';
        var s = HaApi.sign('file_download');
        var dl = '?action=file_download&id=' + m.id + '&ts=' + s.ts + '&sign=' + s.sign;
        var nm = info.name || '文件';
        return '<div class="ha-file-card">'
            + '<span class="ha-file-ico">' + fileIconSvg(info.ext) + '</span>'
            + '<span class="ha-file-meta"><span class="ha-file-name" data-name="' + esc(nm)
            + '" title="' + esc(nm) + '">' + esc(nm) + '</span>'
            + '<span class="ha-file-size">' + esc(sizeText(info.size)) + '</span></span>'
            + '<a class="ha-file-dl" href="' + dl + '" title="下载">' + haSvg('download', 18) + '</a></div>';
    }

    /* ---------- 文件名「中间省略」（v1.2.18） ----------
       CSS 的 text-overflow: ellipsis 只能砍**尾部**，而尾部恰好是扩展名 ——
       「…年度报表.xlsx」砍成「…年度报表.xls」甚至「…年度报表」，
       恰好把「这是什么文件」这条最关键的信息抹掉。
       这里改成保留「开头 + …… + 结尾（连扩展名）」，中间省略：
           啊啊啊啊啊啊……哈哈.txt

       ⚠️ 为什么不能用纯 CSS 兜底：
       - text-overflow: ellipsis —— 只能尾部，且**不换行**是前提；
       - direction: rtl + ellipsis —— 省略号会跑到开头，但 bidi 会把 .txt
         之类的拉丁片段甩到左侧，文件名视觉顺序直接乱掉，中文场景不可用；
       - 多层 background 渐变遮罩 —— 只能遮，不能真正改变文字内容，
         复制文件名出去还是被砍掉的那串。
       所以只能 JS 量像素后重排文本。

       ⚠️ 必须**元素已入 DOM 之后**才能做：要读 clientWidth/scrollWidth，
       在 innerHTML 字符串阶段还没布局，量不到宽度。
       ⚠️ 完整名始终从 data-name 重取，**绝不能基于已截断的 textContent 再算** ——
       否则 resize 二次调用会把「上次的截断结果」当成原文，越截越短。 */
    var FIT_ELLIPSIS = '……';
    function fitFileName(el) {
        var full = el.getAttribute('data-name') || '';
        if (!full) return;
        el.textContent = full;              // 先还原全名，再按**当前**宽度重算
        var avail = el.clientWidth;
        if (avail <= 0) return;             // 容器还没布局（页面隐藏 / display:none），跳过
        if (el.scrollWidth <= avail) return; // 放得下，原样显示

        // 拆扩展名：下标 > 0 的最后一个点才算（.gitignore 这类以点开头的没有扩展名）
        var dot = full.lastIndexOf('.');
        var ext = dot > 0 ? full.slice(dot) : '';
        var stem = dot > 0 ? full.slice(0, dot) : full;

        /* 二分「首尾一共保留多少个 stem 字符」。
           宽度对「保留字符数」单调递增，所以二分有效。
           head 用 ceil 略多于 tail：结尾往往只剩半个词，
           开头留多一点更符合读名习惯（结尾的扩展名已由 ext 单独占位）。 */
        var lo = 0, hi = stem.length, best = null;
        while (lo <= hi) {
            var k = (lo + hi) >> 1;
            var head = (k + 1) >> 1, tail = k - head;
            var s = stem.slice(0, head) + FIT_ELLIPSIS
                + stem.slice(stem.length - tail) + ext;
            el.textContent = s;
            if (el.scrollWidth <= avail) { best = s; lo = k + 1; }
            else hi = k - 1;
        }
        if (best) { el.textContent = best; return; }

        /* 走到这里 = 连 stem 一个字符都不留、只靠「……+ 扩展名」都还是超宽，
           即**扩展名本身就比卡片还长**（如「报告.a…a」几百个字符的畸形扩展名）。
           ⚠️ 这里绝不能直接 return —— 二分过程已经把 textContent 改成了
           「某半截 stem + …… + ext」的残骸，直接返回会把这份超宽残骸留在界面上，
           表现为「明明做了中间省略却仍横向溢出」。
           正确做法：先保证扩展名自己塞得下（同样按中间省略压到 avail 以内），
           再把它接回去；连压后的扩展名仍放不下，才彻底交给 CSS 的 ellipsis。 */
        el.textContent = ext;
        if (el.scrollWidth <= avail) { el.textContent = FIT_ELLIPSIS + ext; return; }
        ext = shrinkToWidth(el, ext, avail);
        el.textContent = ext;   // 极端情况：只留被压短的扩展名（保底一定不溢出）
    }

    /**
     * 把 s 压到不超过 avail 宽（二分，保留首尾）。
     * 用于扩展名本身超长的兜底 —— 正常文件名走不到这里。
     */
    function shrinkToWidth(el, s, avail) {
        var lo = 0, hi = s.length, best = null;
        while (lo <= hi) {
            var k = (lo + hi) >> 1;
            var head = (k + 1) >> 1, tail = k - head;
            var t = s.slice(0, head) + FIT_ELLIPSIS + s.slice(s.length - tail);
            el.textContent = t;
            if (el.scrollWidth <= avail) { best = t; lo = k + 1; }
            else hi = k - 1;
        }
        // 连「……」都放不下（极窄视口）：只留首字符，后面交给 CSS ellipsis
        return best || s.slice(0, 1);
    }

    /* 合并同一帧内的多次调用：懒加载一次插 30 条，若逐条立即量宽会强制 reflow 30 次。
       ⚠️ 入参是**整条消息的容器节点**，不是文件名元素本身 ——
       fitFileName 读的是元素自己的 data-name，直接把容器传进去会拿到 null 而静默返回。
       所以这里统一向下找出文件名节点。 */
    var fitQueue = [], fitRaf = 0;
    function scheduleFitFileName(box) {
        fitQueue.push(box);
        if (fitRaf) return;
        fitRaf = requestAnimationFrame(function () {
            var q = fitQueue;
            fitQueue = [];
            fitRaf = 0;
            for (var i = 0; i < q.length; i++) {
                if (!q[i] || !q[i].getElementsByClassName) continue;
                var list = q[i].getElementsByClassName('ha-file-name');
                for (var j = 0; j < list.length; j++) fitFileName(list[j]);
            }
        });
    }
    /** 重算消息区里所有文件名（窗口尺寸变化后卡片可用宽度跟着变） */
    function refitAllFileNames() {
        var box = $('haMessages');
        if (!box) return;
        var list = box.getElementsByClassName('ha-file-name');
        for (var i = 0; i < list.length; i++) fitFileName(list[i]);
    }
    function sizeText(n) {
        n = parseInt(n, 10) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(1) + ' MB';
    }
    /** 生成 ow 线性 SVG 图标（与服务端 ow_icon 保持一致的描边风格） */
    var OW_SVG_PATHS = {
        'file': '<path d="M13 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V9z"/><path d="M13 3.5V9h5.5"/>',
        'download': '<path d="M12 4v11"/><path d="M7.5 11L12 15.5 16.5 11"/><path d="M4.5 19.5h15"/>'
    };
    function haSvg(name, size) {
        var p = OW_SVG_PATHS[name] || '';
        return '<svg class="ha-icon" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" '
            + 'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
    }

    /* 彩色文件类型图标：实心版式（viewBox 1024），底色 + 内嵌符号均来自
       FILE_ICON_MAP 配置，与 24 网格的 OW_SVG_PATHS 不同源，故单独一个函数。
       颜色写死在配置里，不跟随主题 currentColor（这些是文件类型的语义色，
       与界面主题无关，跟随主题反而会丢失类型辨识度）。 */
    function haSvgFileType(t, size) {
        var s = size || 34;
        return '<svg class="ha-icon ha-icon-file" width="' + s + '" height="' + s + '" viewBox="0 0 1024 1024" version="1.1" '
            + 'xmlns="http://www.w3.org/2000/svg">'
            + '<path d="' + FILE_SILHOUETTE + '" fill="' + t.c + '"/>'
            + '<path d="' + FILE_FOLD + '" fill="#FFFFFF" fill-opacity=".296"/>'
            + '<path d="' + t.g + '" fill="#FFFFFF"/>'
            + '</svg>';
    }

    var HaApi = {
        key: '',
        tsOffset: 0,   // 客户端时钟与服务器的偏差（秒），由页面下发的服务器时间校正
        // 关键：签名用的 ts 以「服务器时间」为准，客户端系统时钟不准也不会导致签名失败
        setServerTime: function (ts) {
            if (!ts) return;
            this.tsOffset = parseInt(ts, 10) - Math.floor(new Date().getTime() / 1000);
        },
        sign: function (action) {
            var ts = Math.floor(new Date().getTime() / 1000) + this.tsOffset;
            return { ts: ts, sign: md5(this.key + '|' + ts + '|' + action) };
        },
        // 带文件的 multipart 上传：upload(action, file, cb) 或 upload(action, file, extraFields, cb)
        upload: function (action, file, extra, cb) {
            if (typeof extra === 'function') { cb = extra; extra = null; }
            var s = this.sign(action), fd, x, k;
            try { fd = new FormData(); } catch (e) { cb({ ok: false, msg: '当前浏览器不支持文件上传' }); return; }
            fd.append('ts', s.ts);
            fd.append('sign', s.sign);
            if (extra) { for (k in extra) if (extra.hasOwnProperty(k)) fd.append(k, extra[k]); }
            fd.append('file', file);
            x = new XMLHttpRequest();
            x.open('POST', '?action=' + action, true);
            x.onreadystatechange = function () {
                if (x.readyState !== 4) return;
                var r = null;
                try { r = JSON.parse(x.responseText); } catch (e) {}
                r = r || { ok: false, msg: '网络错误（' + x.status + '）' };
                if (r.ok === false && r.msg && r.msg.indexOf('签名验证失败') >= 0) {
                    HaApi.onSignExpired(function () { cb(r, x.status); });
                    return;
                }
                cb(r, x.status);
            };
            x.send(fd);
            return x;
        },

        /* 签名失效自愈：会话重建/页面为旧缓存时密钥对不上，自动刷新一次取新密钥 */
        onSignExpired: function (cb) {
            var flag = 'hal_sig_reload_at', now = new Date().getTime(), last = 0;
            try { last = parseInt(w.sessionStorage.getItem(flag) || '0', 10); } catch (e) {}
            if (last && now - last < 15000) { if (cb) cb(); return; } // 15 秒内只自动刷新一次，避免死循环
            try { w.sessionStorage.setItem(flag, String(now)); } catch (e) {}
            if (cb) cb();
            setTimeout(function () { location.reload(); }, 800);
        },
        post: function (action, data, cb) {
            var s = this.sign(action), body = 'ts=' + s.ts + '&sign=' + s.sign, k;
            for (k in (data || {})) if (data.hasOwnProperty(k)) body += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
            var x = new XMLHttpRequest();
            x.open('POST', '?action=' + encodeURIComponent(action), true);
            x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            x.onreadystatechange = function () {
                if (x.readyState !== 4) return;
                var r = null;
                try { r = JSON.parse(x.responseText); } catch (e) {}
                r = r || { ok: false, msg: '网络错误（' + x.status + '）' };
                if (r.ok === false && r.msg && r.msg.indexOf('签名验证失败') >= 0) {
                    HaApi.onSignExpired(function () { cb(r, x.status); });
                    return;
                }
                cb(r, x.status);
            };
            x.send(body);
            return x;
        },

        /**
         * 敏感操作（v1.0.91）：退出登录 / 删除内容 / 管理员删·恢复 / 禁用等。
         * 先取一次性操作票据（?action=ticket，签名保护），随请求提交，服务端校验后作废，
         * 防止签名窗口期内的请求重放与跨站劫持。用法与 post 相同：HaApi.secure(action, data, cb)
         */
        secure: function (action, data, cb) {
            this.post('ticket', {}, function (t) {
                if (!t.ok || !t.ticket) { cb({ ok: false, msg: t.msg || '安全校验组件不可用' }); return; }
                var d = {}, k;
                for (k in (data || {})) if (data.hasOwnProperty(k)) d[k] = data[k];
                d.ticket = t.ticket;
                HaApi.post(action, d, cb);
            });
        },
    };

    /* 提示音（内置短音 data URI，旧浏览器静默降级） */
    var BEEP = 'data:audio/wav;base64,UklGRl9vT1dQV0ZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAD//w==';
    function beep() {
        try {
            var AC = w.AudioContext || w.webkitAudioContext;
            if (AC) {
                var ctx = beep._ctx || (beep._ctx = new AC());
                var o = ctx.createOscillator(), g = ctx.createGain();
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.08, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                o.connect(g); g.connect(ctx.destination);
                o.start(); o.stop(ctx.currentTime + 0.25);
            } else {
                var a = new Audio(BEEP); a.play();
            }
        } catch (e) {}
    }

    /* 前台身份标签（v1.0.86）：只保留「群主 / 会员」两类身份展示——
       群主=当前群聊 owner（橙色），VIP=会员（保留 VIP 配色），普通用户与超级管理员=会员（灰色），
       游客与其它角色不再展示身份标签。超级管理员在别人创建的群聊里同样显示「会员」。 */
    var CUR_OWNER = 0;   // 当前群聊的 owner 用户 ID（HaChat 切换群聊时同步）
    function roleTag(role, title, uid) {
        var h = '';
        if (uid && uid === CUR_OWNER) h = '<span class="ha-tag ha-tag-owner">群主</span>';
        else if (role === 'vip') h = '<span class="ha-tag ha-tag-vip">会员</span>';
        else if (role === 'member' || role === 'admin') h = '<span class="ha-tag ha-tag-member">会员</span>';
        if (title) h += (h ? ' ' : '') + '<span class="ha-tag ha-tag-title">' + esc(title) + '</span>';
        return h;
    }

    /* 头像：有图用图；无图时游客固定米金底（#E5D5A0，深字保证可读），
       用户按昵称长度从色盘取色，群聊用固定的双人剪影图（见 roomAvatarHtml） */
    function avatarHtml(url, name, sm, role) {
        // 尺寸档：'xs'=20px、true/sm=28px（列表）、'md'=32px、'lg'=64px（资料卡/个人设置）、false=40px
        // v1.1.9：新增 'lg'。原来资料卡与个人设置都用 'md'(32px)，在 380px 弹窗里偏小。
        var sizeCls = sm === 'xs' ? ' ha-avatar-xs'
            : (sm === 'lg' ? ' ha-avatar-lg'
            : (sm === 'md' ? ' ha-avatar-md' : (sm ? ' ha-avatar-sm' : '')));
        var cls = 'ha-avatar' + sizeCls;
        if (url) return '<span class="' + cls + '"><img src="' + esc(url) + '" alt=""></span>';
        var ch = esc((name || '?').charAt(0));
        if (role === 'guest') {
            return '<span class="' + cls + '" style="background:#E5D5A0;color:#5C4500">' + ch + '</span>';
        }
        var colors = ['#0099FF', '#00558F', '#A05000', '#237804', '#5B21B6'];
        var ci = (name || '').length % colors.length;
        return '<span class="' + cls + '" style="background:' + colors[ci] + '">' + ch + '</span>';
    }

    /* ---------- 群聊默认头像（v1.1.19） ----------
       需求：所有**未设置自定义头像**的群聊统一用这张双人剪影图，
       不再用「群名首字 + 随机色块」——首字方案在侧栏里花花绿绿一片，
       且不同群颜色由昵称长度决定（`ci = name.length % 5`），看着像乱码。

       图源：设计文档/图标/svg/qunliao.svg，裁剪后落到 assets/img/room-default.svg。
       裁剪依据（浏览器实测内容包围盒，非估算）：
         原始画布 1024×1024，内容只有 538×388，**空白占横向 47% / 纵向 62%**
         —— 直接用原图在 40px 头像里会小到几乎看不见。
         内容中心 (512,512)，正方形 viewBox 取 `180 180 664 664`（边长 664）：
         边长 = 内容半对角线 331.8 × 2，圆容器（border-radius:50%）内刚好不裁角。
       图形已居中，容器与 <img> 的 CSS 尺寸锁由 .ha-avatar / .ha-cl-icon 负责。

       带 ?v= 版本号：与 CSS/JS 的缓存参数同一套做法（index.php 用 HALOU_VERSION），
       换图后不必手改文件名。 */
    var ROOM_DEFAULT_AVATAR = 'assets/img/room-default.svg';

    /**
     * 群头像 HTML。有自定义头像用图，无则回落到默认剪影图。
     * @param {string} url   rooms.avatar，空串表示未设置
     * @param {string} sm    尺寸档，同 avatarHtml
     * @param {string} extra 额外的 class（会话列表要用 .ha-cl-icon 而非 .ha-avatar）
     */
    function roomAvatarHtml(url, sm, extra) {
        var sizeCls = sm === 'xs' ? ' ha-avatar-xs'
            : (sm === 'lg' ? ' ha-avatar-lg'
            : (sm === 'md' ? ' ha-avatar-md' : (sm ? ' ha-avatar-sm' : '')));
        var cls = extra || ('ha-avatar' + sizeCls);
        var ver = (HaChat.cfg && HaChat.cfg.version) || '';
        var src = url || (ROOM_DEFAULT_AVATAR + (ver ? '?v=' + ver : ''));
        return '<span class="' + cls + '"><img src="' + esc(src) + '" alt=""></span>';
    }

    /* ---------- 侧栏入口行（v1.1.10） ----------
       右侧栏「群聊信息」区的统一行样式：图标 + 文案 + 右箭头，整行可点。
       「群聊设置」由核心渲染，「群公告」等插件入口复用同一外观（announcements 插件
       走 #haREExtras 容器并用 .ha-panel-entry 类），因此两行视觉上完全一致。
       icon 用内联 SVG 路径表（与 PHP 侧 ow_icon 的路径一致，避免为此新增接口）。 */
    var OW_ENTRY_ICONS = {
        gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
        mega: '<path d="M3 11v3l4 .5V10.5z"/><path d="M7 10.5L18 5v13l-11-4.5"/><path d="M9 15.5V18a2 2 0 0 0 4 .5"/>',
        // v1.2.28 私聊右侧栏四入口。统一 24 网格、stroke 1.8、round 端点，
        // 与 gear/mega 同一套描边风格（禁实心填充，保持扁平 UI）。
        pin: '<path d="M9 3.5h6M10 3.5v5.2L7.4 13h9.2L14 8.7V3.5"/><path d="M12 13v7.5"/>',
        pinOff: '<path d="M9 3.5h6M10 3.5v5.2L7.4 13h9.2M14 8.7V3.5"/><path d="M12 13v7.5"/><path d="M4 20.5L20 3.5"/>',
        trash: '<path d="M4 6.5h16"/><path d="M9.5 6.5V4.2h5v2.3"/><path d="M6.5 6.5l1 13.3h9l1-13.3"/><path d="M10.2 10v6.2M13.8 10v6.2"/>',
        userX: '<circle cx="10" cy="8" r="3.4"/><path d="M3.8 20.2c0-3.4 2.8-5.7 6.2-5.7 1 0 1.9.2 2.7.5"/><path d="M16.2 16.6l4.6 4.6M20.8 16.6l-4.6 4.6"/>',
        flag: '<path d="M5.5 21.2V3.6"/><path d="M5.5 4.6h11.8l-2.2 3.9 2.2 3.9H5.5z"/>'
    };

    /** 生成一行侧栏入口（整行可点）。onclick 缺省时渲染为不可点的静态行 */
    function entryRow(label, icon, onclick) {
        var d = OW_ENTRY_ICONS[icon] || OW_ENTRY_ICONS.gear;
        var svg = '<svg class="ha-ico ha-panel-entry-ico" width="16" height="16" viewBox="0 0 24 24" fill="none"'
            + ' stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
        var arrow = '<span class="ha-panel-entry-arrow">›</span>';
        if (!onclick) {
            return '<div class="ha-panel-entry is-static">' + svg + '<span class="ha-panel-entry-t">' + esc(label) + '</span>' + arrow + '</div>';
        }
        return '<div class="ha-panel-entry" role="button" tabindex="0" onclick="' + onclick + '"'
            + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();' + onclick + '}">'
            + svg + '<span class="ha-panel-entry-t">' + esc(label) + '</span>' + arrow + '</div>';
    }

    /* ==========================================================================
       HaAuth：登录 / 注册 / 找回密码
       ========================================================================== */
    var HaAuth = {
        init: function (opt) {
            HaApi.key = opt.key;
            HaApi.setServerTime(opt.ts);   // 用服务器时间校正本机时钟偏差
            var form = document.querySelector('.ha-auth-form');
            if (!form) return;
            var mode = form.getAttribute('data-mode');
            var msg = form.querySelector('.ha-form-msg');

            var img = $('haCaptchaImg');
            if (img) img.onclick = function () { img.src = '?action=captcha&_=' + new Date().getTime(); };

            var codeBtn = form.querySelector('[data-sendcode]');
            if (codeBtn) codeBtn.onclick = function () {
                var email = form.querySelector('[name=email]').value;
                if (!email) { msg.innerHTML = '<span style="color:#C41D1F">请先填写邮箱</span>'; return; }
                codeBtn.disabled = true;
                HaApi.post('send_code', { email: email, type: codeBtn.getAttribute('data-sendcode') }, function (r) {
                    msg.innerHTML = '<span style="color:' + (r.ok ? '#237804' : '#C41D1F') + '">' + esc(r.msg) + '</span>';
                    var n = 60;
                    if (r.ok) {
                        var tm = setInterval(function () {
                            codeBtn.innerHTML = n + 's';
                            if (--n < 0) { clearInterval(tm); codeBtn.disabled = false; codeBtn.innerHTML = '发验证码'; }
                        }, 1000);
                    } else codeBtn.disabled = false;
                });
            };

            form.onsubmit = function (e) {
                e.preventDefault();
                var data = {}, i, els = form.elements;
                // 跳过服务端预置的 ts/sign 隐藏域：由 HaApi 用实时值重新签名
                for (i = 0; i < els.length; i++) {
                    if (!els[i].name || els[i].name === 'ts' || els[i].name === 'sign') continue;
                    data[els[i].name] = els[i].value;
                }
                msg.innerHTML = '提交中…';
                HaApi.post(mode === 'login' ? 'login' : mode, data, function (r) {
                    if (r.ok) {
                        msg.innerHTML = '<span style="color:#237804">' + esc(r.msg) + '</span>';
                        // 注册成功不进入聊天（后端注册本就不建会话）：跳登录页由用户手动登录
                        setTimeout(function () {
                            location.href = mode === 'login' ? '?page=chat'
                                : mode === 'reset' ? '?page=login'
                                : '?page=login&registered=1';
                        }, 800);
                    } else {
                        msg.innerHTML = '<span style="color:#C41D1F">' + esc(r.msg) + '</span>';
                        if (r.captcha && $('haCaptchaRow')) {
                            $('haCaptchaRow').style.display = 'block';
                            if (img) img.src = '?action=captcha&_=' + new Date().getTime();
                        }
                    }
                });
            };
        }
    };

    /* ==========================================================================
       HaChat：聊天主程序
       ========================================================================== */
    /**
     * 通用聊天列表轮子（v1.1.0）：群聊与私聊会话共用的列表渲染器。
     * 与业务无关——只负责「头像 + 名称 + 右侧摘要/时间 + 标签 + 选中态」的 DOM 组装与点击分发，
     * 数据形状：[{ conv:'room'|'dm', id, peer, name, avatar, last_at, last_text, tag }]
     * opts: { container, activeKey, onClick(item, el), emptyText }
     */
    var ChatList = {
        time: function (ts) {
            if (!ts) return '';
            var d = new Date(ts * 1000), now = new Date();
            function p(n) { return (n < 10 ? '0' : '') + n; }
            var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
            if (sameDay) return p(d.getHours()) + ':' + p(d.getMinutes());
            if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '/' + d.getDate();
            return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
        },
        render: function (list, opts) {
            var box = typeof opts.container === 'string' ? $(opts.container) : opts.container;
            if (!box) return;
            if (!list || !list.length) {
                box.innerHTML = '<li class="ha-cl-empty">' + esc(opts.emptyText || '暂无会话') + '</li>';
                return;
            }
            var html = '', i, c;
            for (i = 0; i < list.length; i++) {
                c = list[i];
                var key = c.conv + ':' + (c.conv === 'dm' ? c.peer : c.id);
                // v1.1.19：群聊无自定义头像 → 统一默认剪影图；私聊沿用「首字色块」。
                // ⚠️ 必须按 c.conv 区分：私聊的 avatar 为空时用首字是**用户**语义，
                // 群聊用首字会与「群名首字随机色」的历史行为混在一起，看着像乱码。
                var isRoom = c.conv === 'room';
                var icon = isRoom
                    ? roomAvatarHtml(c.avatar, true, 'ha-cl-icon')
                    : (c.avatar
                        ? '<span class="ha-cl-icon"><img src="' + esc(c.avatar) + '" alt=""></span>'
                        : '<span class="ha-cl-icon">' + esc((c.name || '?').charAt(0)) + '</span>');
                html += '<li class="ha-cl-item' + (key === opts.activeKey ? ' active' : '') + (c.pinned ? ' is-pinned' : '') + '" data-key="' + esc(key) + '"'
                      + (c.conv === 'dm' ? ' data-dm="' + esc(c.peer) + '"' : ' data-room="' + (c.conv === 'room' ? c.id : 0) + '"')
                      + ' data-name="' + esc(c.name) + '" data-pw="' + (c.need_password ? 1 : 0) + '"'
                      + ' data-pin="' + (c.pinned ? 1 : 0) + '">'
                      + icon
                      + '<span class="ha-cl-main">'
                      // v1.2.28：置顶标记放在**标题内部最前**（与微信一致）。
                      // ⚠️ 必须放进 .ha-cl-title 里，不能放在 .ha-cl-main 下 ——
                      //   .ha-cl-main 是 column flex，多一个子节点就**独占一行**，
                      //   会把标题和摘要挤成三行。title 本身被 flex blockify，
                      //   里面的 inline span 才与文字同行。
                      + '<span class="ha-cl-title">'
                      + (c.pinned ? '<span class="ha-cl-pin" title="已置顶"></span>' : '')
                      + esc(c.name) + (c.tag ? '<span class="ha-cl-tag">' + esc(c.tag) + '</span>' : '') + '</span>'
                      + '<span class="ha-cl-sub">' + esc(c.last_text || '') + '</span>'
                      + '</span>'
                      // v1.2.28：hideTime 用于联系人列表（无消息流，时间没有参考价值）。
                      // 不渲染这个 span 而不是传空串 —— 空 span 仍占位、仍可能带 margin。
                      + (opts.hideTime ? '' : '<span class="ha-cl-time">' + ChatList.time(c.last_at) + '</span>')
                      + '</li>';
            }
            box.innerHTML = html;
            var items = box.getElementsByTagName('li'), k;
            for (k = 0; k < items.length; k++) {
                if (items[k]._noClick) continue;
                items[k].onclick = function () { if (opts.onClick) opts.onClick(this); };
            }
        },
        /** 定位并高亮当前会话对应的行 */
        activate: function (container, key) {
            var box = typeof container === 'string' ? $(container) : container;
            if (!box) return;
            var items = box.getElementsByTagName('li'), i;
            for (i = 0; i < items.length; i++) {
                items[i].className = items[i].className.replace(' active', '');
                if (items[i].getAttribute('data-key') === key) items[i].className += ' active';
            }
        }
    };
    w.ChatList = ChatList;

    var HaChat = {
        cfg: null, room: 0, since: 0, polling: false, failCount: 0,
        historyDone: false, loadingHistory: false, sound: true, lastMsgId: 0,
        emojis: '😀 😁 😂 🤣 😊 😍 😘 😜 🤔 😎 😴 😷 🤒 😱 😭 😡 👍 👎 👏 🙏 💪 🤝 ❤️ 💔 🎉 🔥 ⭐ 🌹 🍀 🎂 ☕ 🍺 ⚽ 🏀 🚀 ✈️ 🐱 🐶 🦉 🌙 ☀️ 🌈'.split(' '),

        init: function (cfg) {
            this.cfg = cfg;
            HaApi.key = cfg.key;
            HaApi.setServerTime(cfg.ts);
            this.room = cfg.room;
            this.syncRoomOwner();
            this.sound = cfg.settings.sound === '1';
            var self = this;

            this.loadConversations();   // 会话列表（群聊+私聊聚合）——私聊路由要靠它取昵称
            this.renderConversations();
            this.startConvPoll();       // v1.1.0：列表低频轮询，新消息会话自动前置（不打断当前聊天）
            this.renderMe();
            this.buildEmojiPanel();
            this.bindEvents();
            this.renderRoomPanel();      // v1.1.1：初始化右侧栏群聊设置区

            // 地址路由：私聊 ?dm=user:12 优先（v1.1.0），否则规范化为 ?room=当前群聊（replace）
            var dmFromUrl = this.dmFromUrl();
            // 前进/后退（或手动改 URL 回车）→ 切换到对应群聊 / 私聊
            w.onpopstate = function () {
                // ★ v1.1.0：dm 与 room 在 URL 上互斥（见 chat-url-mutex 约束）。
                //   正常情况下只会命中其中一个；这里以 URL 实际内容为准，
                //   若两个都在（历史遗留 / 外部链接），优先认群聊 room，避免莫名跳进私聊。
                var rid = self.roomFromUrl();
                if (rid) {
                    if (self.dm || rid !== self.room) {
                        for (var i = 0; i < cfg.rooms.length; i++) {
                            if (cfg.rooms[i].id === rid) { self.switchRoom(rid, cfg.rooms[i].name, null, true); return; }
                        }
                    }
                    return;
                }
                var dpeer = self.dmFromUrl();
                if (!dpeer) return;
                if (self.dm && self.dm.peer === dpeer) return;
                self.openDm(dpeer, self.dmNameOf(dpeer));
            };

            if (dmFromUrl) {
                // 私聊视图：昵称取自会话列表，但列表是异步到达的。
                // openDm 允许传入临时名（'私聊'），列表到达后 loadConversations 会重渲染并补上正确昵称，
                // 所以这里直接打开即可，无需轮询等待。
                this.setDmUrl(dmFromUrl, true);
                this.openDm(dmFromUrl, this.dmNameOf(dmFromUrl));
                // ★ 不触发 _fireRoomSwitch：私聊下 this.room=0，插件按 room_id=0 取数据是错的；
                //   群级装饰由 openDm 末尾的 _fireViewChange 通知插件清理。
                return;   // 私聊入口不加载群聊历史、不启动群聊长轮询
            }
            this.setRoomUrl(this.room, true);

            // 初始加载历史：是否需密码由服务端判定（管理员/已授权会直接放行，不会弹窗）
            var first = null, i;
            for (i = 0; i < cfg.rooms.length; i++) if (cfg.rooms[i].id === this.room) first = cfg.rooms[i];
            var load = function (password) {
                HaApi.post('room_join', { room_id: self.room, password: password || '' }, function (j) {
                    if (!j.ok) {
                        if (j.need_password) {
                            self.passForget(self.room);
                            self.askRoomPassword(self.room, first ? first.name : '', function (pw) { load(pw); });
                            return;
                        }
                        if (j.need_login) { location.href = '?page=login'; return; }
                    } else {
                        self.passRemember(self.room, j.ttl);
                    }
                    if (self.dm) return;   // 等待期间用户已切到私聊
                    HaApi.post('history', { room_id: self.room, before: 0 }, function (r) {
                        if (self.dm) return;
                        if (r.ok) {
                            for (var k = 0; k < r.data.length; k++) self.addMessage(r.data[k], true);
                            if (r.data.length) self.since = r.data[r.data.length - 1].id;
                            self.scrollBottom();
                            if (r.data.length < 30) self.historyDone = true;
                            // v1.2.6 懒加载：填不满屏幕就自动往前补
                            self.fillIfShort();
                        } else if (r.need_password) {
                            self.passForget(self.room);
                            self.askRoomPassword(self.room, first ? first.name : '', function (pw) { load(pw); });
                            return;
                        }
                        self._roomPollRunning = true;
                        self.startPoll();
                    });
                });
            };
            load('');
            this._fireRoomSwitch();   // 首次进入也通知插件（公告等按群拉取）
        },

        /** 从已加载的会话列表里取私聊对方昵称（供 URL 直达 / 前进后退时补名） */
        dmNameOf: function (peer) {
            var list = this.conversations || [], i;
            for (i = 0; i < list.length; i++) if (list[i].conv === 'dm' && list[i].peer === peer) return list[i].name;
            return '私聊';
        },

        bindEvents: function () {
            var self = this;
            // v1.2.20：侧栏标签条（消息 / 联系人 / 插件标签）
            self.bindSideTabs();
            $('haBtnSend').onclick = function () { self.send(); };
            var input = $('haInput');
            // 随内容自动增高；恢复上次手动拖出的高度
            try { self.inputUserH = parseInt(w.localStorage.getItem('hal_input_h') || '0', 10) || 0; } catch (e) {}
            self.bindInputResize();
            self.autoGrow();
            input.oninput = function () { self.autoGrow(); };
            input.onkeydown = function (e) {
                e = e || w.event;
                if (e.keyCode === 13 && !e.shiftKey) { e.preventDefault ? e.preventDefault() : (e.returnValue = false); self.send(); }
            };
            input.onpaste = function (e) {
                var items = (e.clipboardData || w.clipboardData).items;
                if (!items) return;
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') === 0) {
                        var f = items[i].getAsFile();
                        if (f) self.uploadImage(f);
                    }
                }
            };
            $('haBtnFile').onclick = function () { $('haFileAttach').click(); };
            $('haFileAttach').onchange = function () {
                var f = this.files && this.files[0];
                this.value = '';
                if (f) self.uploadFile(f);
            };
            $('haBtnImage').onclick = function () { $('haFileInput').click(); };
            $('haFileInput').onchange = function () {
                if (this.files && this.files[0]) self.uploadImage(this.files[0]);
                this.value = '';
            };
            // 表情面板：按钮切换 + 点击外部/Esc 关闭（原来只能靠再点一次按钮）
            var setEmoji = function (open) {
                var p = $('haEmojiPanel');
                if (!p) return;
                p.style.display = open ? 'block' : 'none';
            };
            $('haBtnEmoji').onclick = function () {
                var p = $('haEmojiPanel');
                setEmoji(getComputedStyle(p).display === 'none');
            };
            $('haBtnSound').onclick = function () {
                self.sound = !self.sound;
                this.innerHTML = this.getAttribute(self.sound ? 'data-on' : 'data-off');
                toast(self.sound ? '提示音已开启' : '提示音已关闭');
            };
            // 窄屏浮层遮罩：侧栏或成员面板打开时显示
            var syncMask = function () {
                var m = $('haMask');
                if (!m) return;
                var open = $('haSidebar').className.indexOf('open') >= 0 || $('haOnline').className.indexOf('open') >= 0;
                m.className = open ? 'ha-mask show' : 'ha-mask';
            };
            // 侧栏开关：真正的切换（原写法只加不减，打开后无法关闭）
            var setSide = function (open) {
                var s = $('haSidebar');
                var c = s.className.replace(' open', '');
                s.className = c + (open ? ' open' : '');
                syncMask();
            };
            $('haToggleSide').onclick = function () {
                setSide($('haSidebar').className.indexOf('open') < 0);
            };
            // 群聊信息面板：宽屏用 hidden 收起（常驻侧栏），窄屏用 open 浮层（默认收起）
            // v1.1.1：侧栏内容改为「上方群聊设置 + 下方所有成员」，开关时需重渲染设置区
            var isNarrow = function () { return (document.documentElement.clientWidth || w.innerWidth || 1024) <= 960; };
            var setPanel = function (open) {
                var o = $('haOnline');
                var c = o.className.replace(' open', '').replace(' hidden', '');
                var narrow = isNarrow();
                o.className = c + (open ? (narrow ? ' open' : '') : (narrow ? '' : ' hidden'));
                syncMask();
            };
            var togglePanel = function () {
                var o = $('haOnline');
                var open = isNarrow() ? (o.className.indexOf('open') >= 0) : (o.className.indexOf('hidden') < 0);
                setPanel(!open);
                if (!open) self.renderRoomPanel();   // 打开时刷新设置区（切群后内容可能已过期）
            };
            $('haTogglePanel').onclick = togglePanel;
            $('haOnlineClose').onclick = function () { setPanel(false); };
            // v1.2.31：站点名右侧 → 搜索按钮（原竖三点菜单已删除）
            var sb = $('haBrandSearch');
            if (sb) sb.onclick = function () { self.openSearch(); };
            // 所有成员面板默认一律不展开（v1.0.101，v1.0.119 恢复：游客入口已移到顶栏）
            setPanel(false);
            $('haMask').onclick = function () { setSide(false); setPanel(false); };
            // 创建群聊：侧栏底部按钮（仅登录用户渲染）→ 弹窗
            if ($('haBtnCreateRoom')) $('haBtnCreateRoom').onclick = function () {
                setEmoji(false);
                self.roomCreateModal();
            };
            // 窄屏浮层：点击浮层外部时收起（成员面板 / 左侧栏 / 表情面板 / 「+」菜单）
            document.addEventListener ? document.addEventListener('click', function (e) {
                var o = $('haOnline'), s = $('haSidebar'), em = $('haEmojiPanel');
                var t = e.target || e.srcElement, inside = false, n = t;
                while (n) {
                    if (n === o || n === $('haTogglePanel') || n === s || n === $('haToggleSide')
                        || n === em || n === $('haBtnEmoji')) { inside = true; break; }
                    n = n.parentNode;
                }
                if (inside) return;
                setEmoji(false);          // 点空白处顺手收起表情面板
                if (o && o.className.indexOf('open') >= 0) setPanel(false);
                if (s && s.className.indexOf('open') >= 0) setSide(false);
            }) : (document.onclick = null);
            /* v1.2.6 懒加载：向上滚到接近顶部时自动拉更早的一批，
               不再有「加载更早消息…」那个可点入口。
               阈值 120px 而非 40px：触屏上手指惯性滑动很容易冲到 0，
               贴着 0 才触发会出现「已经到底了却没反应」的错觉。
               loadingHistory 是并发闸门 —— 一次请求未回前不再发第二次。 */
            $('haMessages').onscroll = function () {
                if (this.scrollTop > 120) return;
                if (self.historyDone || self.loadingHistory) return;
                self.loadHistory();
            };
            /* v1.2.18：窗口尺寸变化后重算文件名中间省略。
               卡片是固定宽度，但 .ha-file-card 仍有 max-width:100% ——
               视口窄于卡片时会被压缩，可用宽度随之变化，必须重排。
               去抖 120ms：拖窗口时 resize 会连续触发几十次，
               每次都遍历全部消息重排会明显卡顿。 */
            var fitTimer = 0;
            window.addEventListener('resize', function () {
                if (fitTimer) clearTimeout(fitTimer);
                fitTimer = setTimeout(function () { fitTimer = 0; refitAllFileNames(); }, 120);
            });
            /* 消息时间：悬停「消息气泡」满 2 秒才显示，移开立即隐藏（v1.1.0）
               为什么不用 CSS :hover —— CSS 无法表达「持续满 N 秒」，
               一 hover 就出现会与快速扫读打架，也会让昵称行一直跳。
               用父容器委托而非逐条绑定：消息频繁重渲染（innerHTML 重建），
               逐条绑定会随重建丢失。
               计时器挂在 HaChat 上，切换会话时统一清理，避免残留。 */
            $('haMessages').onmouseover = function (e) {
                e = e || w.event;
                var t = e.target || e.srcElement, node = t;
                while (node && node !== this) {
                    if (node.className && (' ' + node.className + ' ').indexOf(' ha-msg ') >= 0) break;
                    node = node.parentNode;
                }
                if (!node || node === this) { self.hideMsgTime(); return; }
                if (self._timeMsg === node) return;          // 已在同一条计时中
                self.hideMsgTime();
                self._timeMsg = node;
                self._timeTimer = setTimeout(function () {
                    self._timeTimer = null;
                    if (self._timeMsg === node) node.className += ' ha-time-show';
                }, 2000);
            };
            $('haMessages').onmouseout = function (e) {
                e = e || w.event;
                var t = e.target || e.srcElement, node = t, to = e.relatedTarget || e.toElement;
                while (node && node !== this) {
                    if (node.className && (' ' + node.className + ' ').indexOf(' ha-msg ') >= 0) break;
                    node = node.parentNode;
                }
                if (!node || node === this) return;
                // 鼠标只是从消息内部移到了它自己的子元素上（不算真正离开）
                if (to && node.contains && node.contains(to)) return;
                self.hideMsgTime();
            };
            // v1.2.6：「加载更早消息…」入口节点已移除，改为滚动懒加载
            // （见上面的 onscroll），故这里不再需要 haLoadMore 的点击委托。
            // 右键消息气泡 → 操作菜单（@/私信/收藏/撤回，插件可追加）
            $('haMessages').oncontextmenu = function (e) {
                e = e || w.event;
                var t = e.target || e.srcElement, node = t;
                while (node && node !== this) {
                    if (node.id && /^haMsg\d+$/.test(node.id)) break;
                    node = node.parentNode;
                }
                if (!node || node === this || !node.id) { self.hideCtxMenu(); return; }
                var m = self.msgCache[parseInt(node.id.replace('haMsg', ''), 10)];
                if (!m || m.type === 'system' || m.recalled || m.deleted) { self.hideCtxMenu(); return; }
                if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
                // 右键落点分流（v1.0.69）：点在头像上 → 对该「人」的操作菜单；
                // 点在消息内容 / 其它区域 → 对该「消息」的操作菜单（复制 / 引用 / 删除）
                var onAvatar = false, n2 = e.target || e.srcElement;
                while (n2 && n2 !== node) {
                    if (n2.className && String(n2.className).indexOf('ha-avatar') >= 0) { onAvatar = true; break; }
                    n2 = n2.parentNode;
                }
                if (onAvatar) self.showUserMenu(e.clientX || 0, e.clientY || 0, m);
                else self.showContentMenu(e.clientX || 0, e.clientY || 0, m);
                return false;
            };
            // 点击菜单外 / Esc 关闭
            document.onclick = function (e) {
                var menu = $('haCtxMenu');
                if (!menu || menu.style.display === 'none') return;
                var t = e.target || e.srcElement;
                var inside = false, n = t;
                while (n) { if (n === menu) { inside = true; break; } n = n.parentNode; }
                if (!inside) self.hideCtxMenu();
            };
            document.onkeydown = function (e) {
                e = e || w.event;
                if (e.keyCode === 27) { self.hideCtxMenu(); setEmoji(false); }
            };
            // 菜单项点击（委托）：执行对应操作后收起菜单
            $('haCtxMenu').onclick = function (e) {
                e = e || w.event;
                var t = e.target || e.srcElement;
                // ⚠️ 必须**向上找最近的 <a>**：品牌区菜单首行是「头像+昵称」，
                // 点的往往是内部的 span/div，直接判 t.tagName==='A' 会点了没反应。
                var a = null;
                while (t && t !== this) {
                    if ((t.tagName || '').toUpperCase() === 'A') { a = t; break; }
                    t = t.parentNode;
                }
                if (!a) return;
                var it = self._ctxItems[parseInt(a.getAttribute('data-i'), 10)];
                // 禁用项（游客）：给出明确提示，不静默无反应，也不执行动作
                if (it && it.dis) { self.hideCtxMenu(); toast(it.tip || '请先登录后再使用该功能'); return; }
                self.hideCtxMenu();
                if (it && it.run) it.run();
            };
            $('haModalMask').onclick = function (e) { if (e.target === this) self.closeModal(); };
            $('haImgViewer').onclick = function () { this.style.display = 'none'; };
            var lo = $('haBtnLogout');
            if (lo) lo.onclick = function () {
                self.confirmModal('确定退出登录吗？', function () {
                    HaApi.secure('logout', {}, function () { location.href = '?page=login'; });
                });
            };
            var st = $('haBtnSettings');
            if (st) st.onclick = function () { self.openSettings(); };
        },

        /* ---------- 密码房：通行缓存 + 自研密码弹窗 ---------- */
        // 缓存键（按房间），仅存"已授权到几点"，不存密码本身
        passCacheKey: function (roomId) { return 'hal_room_pass_' + roomId; },
        passCached: function (roomId) {
            var v = 0;
            try { v = parseInt(w.sessionStorage.getItem(this.passCacheKey(roomId)) || '0', 10); } catch (e) {}
            return v > Math.floor(new Date().getTime() / 1000);
        },
        passRemember: function (roomId, ttl) {
            if (!ttl || ttl <= 0) { this.passForget(roomId); return; }
            // 比服务端有效期提前 60 秒失效，避免边界上反复弹窗
            var until = Math.floor(new Date().getTime() / 1000) + Math.max(60, ttl - 60);
            try { w.sessionStorage.setItem(this.passCacheKey(roomId), String(until)); } catch (e) {}
        },
        passForget: function (roomId) {
            try { w.sessionStorage.removeItem(this.passCacheKey(roomId)); } catch (e) {}
        },
        // 需要密码（且本地无有效缓存）时弹出自研弹窗，验证成功回调 onOk
        askRoomPassword: function (roomId, roomName, onOk) {
            var self = this;
            this.openModal(
                '<h3>需要密码</h3>'
                + '<p class="ha-modal-desc">进入「' + esc(roomName) + '」需要密码，验证成功后在有效期内不必重复输入。</p>'
                + '<div class="ha-form-item"><label>房间密码</label>'
                + '<input class="ha-input" type="password" id="haRoomPw" autocomplete="off" placeholder="请输入房间密码"></div>'
                + '<div class="ha-modal-actions">'
                + '<button class="ha-btn ha-btn-ghost" id="haRoomPwCancel">取消</button>'
                + '<button class="ha-btn ha-btn-primary" id="haRoomPwOk">进 入</button></div>'
                + '<div class="ha-form-msg" id="haRoomPwMsg"></div>'
            );
            var input = $('haRoomPw'), msg = $('haRoomPwMsg');
            var submit = function () {
                var pw = input.value;
                if (!pw) { msg.innerHTML = '<span style="color:#C41D1F">请输入密码</span>'; return; }
                msg.innerHTML = '验证中…';
                HaApi.post('room_join', { room_id: roomId, password: pw }, function (r) {
                    if (!r.ok) {
                        msg.innerHTML = '<span style="color:#C41D1F">' + esc(r.msg) + '</span>';
                        input.select();
                        return;
                    }
                    self.passRemember(roomId, r.ttl);
                    self.closeModal();
                    if (onOk) onOk();
                });
            };
            $('haRoomPwOk').onclick = submit;
            $('haRoomPwCancel').onclick = function () { self.closeModal(); };
            input.onkeydown = function (e) {
                e = e || w.event;
                if (e.keyCode === 13) { e.preventDefault ? e.preventDefault() : (e.returnValue = false); submit(); }
            };
            try { input.focus(); } catch (e) {}
        },

        /* ---------- 房间 ---------- */
        /**
         * 拉取会话列表（群聊 + 私聊聚合，服务端已按最后活跃时间倒序），交给通用轮子渲染。
         * v1.1.0：取代旧的 renderRooms —— 群聊与私聊共用同一列表与同一交互。
         * v1.1.24：**联系人视图下不拉会话** —— 联系人要的是好友名单，
         * 会话列表此刻是多余的请求，且会覆盖 `conversations` 字段导致切回来时列表闪空。
         */
        loadConversations: function () {            var self = this;
            // v1.2.20：不在「消息」标签时不拉会话 —— 拉回来也会被别的面板覆盖，
            // 白打接口。⚠️ 判断必须写成 `!== 'chat'` 而不是 `=== 'friends'`：
            //   view 现在还可能是插件标签（如 'orders'），只挡 friends 会漏。
            if (this.view !== 'chat') return;
            HaApi.post('conversations', {}, function (r) {
                if (!r.ok) return;
                self.conversations = r.data;
                // v1.2.20：原「会话总数徽标」已随标题一起移除（标签条不需要计数，
                // 数量在列表里本就一目了然）。r.total 仍在响应里，留给需要的地方用。
                // 私聊视图的标题用的是进入时的昵称；若当时列表未到（标题为占位「私聊」），
                // 这里用刚取到的真实昵称补正，避免刷新后标题一直停在占位文案
                if (self.dm && self.roomName === '私聊') {
                    var nm = self.dmNameOf(self.dm.peer);
                    if (nm && nm !== '私聊') {
                        self.roomName = nm;
                        $('haRoomName').innerHTML = esc(nm);
                    }
                }
                self.renderConversations();
            });
        },

        /* ---------- 侧栏标签页（v1.2.20，通用 Tabs 组件） ----------
           v1.1.24 时「联系人」藏在品牌区下拉菜单里，入口深、发现不了。
           v1.2.20 把它上移为侧栏顶部的常驻标签，与「消息」并列。

           面板模型：核心只有两个面板，**都不靠 DOM 创建/销毁**：
             chat    → #haRoomList（就在 HTML 里，切换只改显隐）
             friends → 复用同一个 #haRoomList 容器渲染联系人（ChatList 轮子）
           所以「切面板」= 换数据源重渲染 + 切标签高亮，不涉及容器搬运。

           插件面板：标签由服务端 Plugin::collect('sidebar.tabs') 产出 HTML，
           或前端 HaChat.onSideTabs 追加；其内容由插件自己往 #haSidePanels 里写。
           点插件标签时核心只切换标签高亮并触发 'panel' 回调，不碰插件内容。 */
        view: 'chat',              // 当前标签：'chat' | 'friends' | 插件自定义名
        friends: [],               // 好友列表（含签名，签名可能为空串）
        _sigProbe: null,           // signature 批量接口是否可用（探测一次，缓存结果）
        _tabsExt: [],              // 插件扩展：{ id, label, onShow } 数组
        _tabsInited: false,        // 标签条事件是否已绑定（只绑一次）

        /**
         * 插件扩展点：往侧栏标签条追加一个标签页。
         *
         * @param {Object} opt
         * @param {string}   opt.id      标签标识（= 服务端标签的 data-tab，需唯一）
         * @param {string}   opt.label   显示文字
         * @param {Function} opt.onShow  切到该标签时调用，参数为面板容器节点，
         *                               插件把自己的内容写进去（可重复调用，需自行做幂等）
         * @example
         * HaChat.onSideTabs({
         *     id: 'orders', label: '订单',
         *     onShow: function (panel) { panel.innerHTML = '<div>我的订单</div>'; }
         * });
         */
        onSideTabs: function (opt) {
            if (!opt || !opt.id || !opt.label) return;
            // 同 id 重复注册时覆盖，避免插件重复启用后出现两个同名标签
            for (var i = 0; i < this._tabsExt.length; i++) {
                if (this._tabsExt[i].id === opt.id) { this._tabsExt[i] = opt; return; }
            }
            this._tabsExt.push(opt);
        },

        /** 绑定标签条点击（委托，只绑一次；插件后加的标签也自动生效） */
        bindSideTabs: function () {
            if (this._tabsInited) return;
            var bar = $('haSideTabs');
            if (!bar) return;
            var self = this;
            bar.onclick = function (e) {
                e = e || w.event;
                var t = e.target || e.srcElement;
                // 从点击点向上找带 data-tab 的按钮（点的是里面的 span 文字）
                while (t && t !== bar && !t.getAttribute) t = t.parentNode;
                while (t && t !== bar && !t.getAttribute('data-tab')) t = t.parentNode;
                if (!t || t === bar) return;
                var tab = t.getAttribute('data-tab');
                if (tab) self.switchTab(tab);
            };
            this._tabsInited = true;
        },

        /** 切到指定标签（核心与插件标签统一入口） */
        switchTab: function (tab) {
            if (!tab) return;
            if (tab === this.view) return;
            this.view = tab;
            this._paintTabs();
            if (tab === 'chat') {
                this.renderConversations();
                // ⚠️ 兜底：若进页面后一直待在别处，conversations 可能从未拉过，
                //   此时列表是空的。补拉一次；已拉过则跳过（不白打接口）。
                if (!this.conversations) this.loadConversations();
                // v1.2.29：从「联系人」切回来时中间是空白的（那边已把 room/dm 清掉），
                // 这里补上「还没选会话」的闸门；点某个会话后由 switchRoom/openDm 解禁。
                if (!this.dm && !this.room) {
                    this.renderRoomPanel();
                    this.applyInputGate('conv');
                }
            } else if (tab === 'friends') {
                // v1.2.29：先「关掉」中间正在显示的会话，再渲染联系人名单。
                // 顺序不能反 —— 否则名单渲染完又被随后的清理逻辑影响。
                this.blankChatForFriends();
                this.loadFriends();
            } else {
                // 插件标签：把面板容器交给插件自己填
                this._showExtPanel(tab);
            }
        },

        /** 只更新标签高亮 + 面板显隐（不碰数据） */
        _paintTabs: function () {
            var bar = $('haSideTabs');
            if (bar) {
                var btns = bar.getElementsByClassName('ha-tab'), i;
                for (i = 0; i < btns.length; i++) {
                    var on = btns[i].getAttribute('data-tab') === this.view;
                    // ⚠️ 用 classList 逐项增删而不是整体赋值 ——
                    //   插件可能在自己标签上加了自己的类（如角标定位类），
                    //   整体覆盖 className 会把插件的类一起抹掉。
                    if (btns[i].classList) btns[i].classList[on ? 'add' : 'remove']('is-active');
                    else btns[i].className = on ? 'ha-tab is-active' : 'ha-tab';
                }
            }
            // 核心面板：只有「消息 / 联系人」两个，共用 #haRoomList
            var isCore = (this.view === 'chat' || this.view === 'friends');
            var list = $('haRoomList'), panels = $('haSidePanels');
            if (list) list.style.display = isCore ? '' : 'none';
            if (panels) panels.style.display = isCore ? 'none' : '';
        },

        /** 插件面板：在 #haSidePanels 里为该标签准备一个容器并回调插件填充 */
        _showExtPanel: function (tab) {
            var wrap = $('haSidePanels');
            if (!wrap) return;
            var panel = document.getElementById('haExtPanel-' + tab);
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'ha-tab-panel is-active';
                panel.id = 'haExtPanel-' + tab;
                panel.setAttribute('data-panel', tab);
                wrap.appendChild(panel);
            }
            // 隐藏同容器内其它插件面板（插件面板之间互斥）
            var kids = wrap.children, i;
            for (i = 0; i < kids.length; i++) {
                if (kids[i] !== panel) kids[i].style.display = 'none';
            }
            panel.style.display = '';
            for (i = 0; i < this._tabsExt.length; i++) {
                if (this._tabsExt[i].id === tab) {
                    try { this._tabsExt[i].onShow(panel); } catch (e) {}
                    return;
                }
            }
            // 标签是服务端渲染的、但前端没注册 onShow：给个空态，不留白板
            if (!panel.innerHTML) {
                panel.innerHTML = '<div class="ha-cl-empty">该标签页没有内容</div>';
            }
        },

        /**
         * 兼容旧入口：v1.1.24 的「联系人视图」切换。
         * noArg=true 时强制切到聊天（供「返回」类入口用）。
         * @deprecated 保留是因为插件/外部可能还在调；内部请直接用 switchTab。
         */
        toggleFriendsView: function (noArg) {
            this.switchTab(noArg ? 'chat' : (this.view === 'friends' ? 'chat' : 'friends'));
        },

        /**
         * 拉联系人名单 + 个性签名，然后渲染。
         * ⚠️ 签名来自 signature 插件，**插件未启用时该接口不存在** ——
         *   此时只渲染好友名单、签名留空（不报错、不阻断列表出现）。
         */
        loadFriends: function () {
            var self = this;
            HaApi.post('friends', {}, function (r) {
                if (!r.ok) {
                    // 游客：服务端返回空数组（friends 对游客直接返回 []），
                    // 正常不会走到这里；真报错说明未登录等异常，给明确提示
                    self.renderFriends([]);
                    return;
                }
                self.friends = r.data || [];
                self.loadFriendSignatures(self.friends);
            });
        },

        /**
         * 批量取个性签名并渲染。
         * 用 `plugin_signature_bulk`（v1.1.24 新增）一次拿完，避免 N 次请求。
         * 插件未启用 → 接口返回「未知操作」→ 直接渲染空签名，不打扰用户。
         */
        loadFriendSignatures: function (list) {
            var self = this;
            if (!list.length) { this.renderFriends(list); return; }
            var ids = [], i;
            for (i = 0; i < list.length; i++) ids.push(list[i].user_id);
            HaApi.post('plugin_signature_bulk', { ids: ids }, function (r) {
                var sigs = (r && r.ok && r.signatures) || {};
                for (var k = 0; k < self.friends.length; k++) {
                    var uid = self.friends[k].user_id;
                    // ⚠️ 插件未启用时 signatures 为空 → 全部留空串，前端显示空副行
                    self.friends[k].signature = sigs[String(uid)] || '';
                }
                self.renderFriends(self.friends);
            });
        },

        /* ---------- 联系人增删（v1.1.24） ----------
           入口在「用户资料卡」底部按钮（与「发私信」同排）。加/删互斥，
           靠 user_card 返回的 is_friend 决定显示哪个 —— 不做乐观切换，
           避免「界面显示已加、实际请求失败」的不一致。 */

        /** 加为联系人。幂等：重复加服务端返回明确错误，不插重行。
         *  ⚠️ v1.2.28：**只加，不切私聊**。
         *     加好友是「加一个联系人」的动作，不是「去跟 TA 聊天」——
         *     自动跳进私聊会让中间的消息区无声地换成另一个人，
         *     正在打字的消息就发到别处去了（用户明确要求避免这个）。 */
        addFriend: function (uid) {
            var self = this;
            HaApi.post('friend_add', { friend_id: uid }, function (r) {
                toast(r.msg || (r.ok ? '已添加' : '添加失败'));
                if (!r.ok) return;
                // 刷新资料卡让按钮切成「删除好友」（不切换会话）
                self.userCard(uid);
                // 正在联系人视图里则同步刷新名单
                if (self.view === 'friends') self.loadFriends();
            });
        },

        /** 删除联系人。走 HaApi.secure —— friend_remove 在 $SENSITIVE 内，需一次性票据。 */
        removeFriend: function (uid) {
            var self = this;
            HaApi.secure('friend_remove', { friend_id: uid }, function (r) {
                toast(r.msg || (r.ok ? '已删除' : '删除失败'));
                if (!r.ok) return;
                self.userCard(uid);
                if (self.view === 'friends') self.loadFriends();
            });
        },

        /**
         * 渲染联系人列表 —— **复用 ChatList 轮子**（同一个 DOM 结构与样式）。
         * 数据形状对齐 ChatList.render 需要的字段：
         *   conv='dm'（决定走用户头像分支）、peer=**'user:' + id**（点击走 openDm）、
         *   name=昵称、last_text=个性签名。
         *
         * v1.2.28 两处修正：
         *  ① peer 之前传的是**纯数字**（f.user_id），而 openDm 只认 `user:20` 这种
         *     带前缀的格式（`/^(\w+):(\d+)$/` 不匹配就静默 return）→ **点联系人进不去**。
         *  ② 右上角时间取消：原显示「加入联系人的时间」，
         *     联系人列表没有消息流，这个时间对用户没有参考价值。
         */
        renderFriends: function (list) {
            var self = this, box = $('haRoomList');
            if (!box) return;
            var rows = [], i;
            for (i = 0; i < (list || []).length; i++) {
                var f = list[i];
                rows.push({
                    conv: 'dm', peer: 'user:' + f.user_id, id: f.user_id,
                    name: f.nickname, avatar: f.avatar, role: f.role,
                    last_text: f.signature || '',
                    last_at: 0
                });
            }
            // v1.2.20：联系人数量徽标一并移除（与消息标签同理，计数非必要信息）
            ChatList.render(rows, {
                container: 'haRoomList',
                activeKey: this.dm ? ('dm:' + this.dm.peer) : '',
                emptyText: '还没有联系人，去「成员管理」或资料卡添加吧',
                hideTime: true,          // v1.2.28：取消右上角时间
                onClick: function (el) {
                    // v1.2.28：peer 现在是 'user:20' 完整格式，openDm 才认（旧代码传纯数字，静默失败）
                    var peer = el.getAttribute('data-dm');
                    if (peer) self.openDm(peer, el.getAttribute('data-name'));
                }
            });
        },

        /* ---------- 会话列表轻量轮询（v1.1.0） ----------
           需求：任何会话来了新消息，该会话自动排到列表最前，用户不必手动刷新。
           为什么不能靠消息长轮询带出来：群聊 poll 只监听「当前所在群」，
           私聊 dm_poll 只监听「当前所在私聊」——停在群聊2 时收不到群聊1 的消息。
           所以这里单独开一路低频轮询（10s），只重渲染左侧栏，
           完全不碰消息区 / 输入栏 / 当前会话，因此不会打断正在进行的聊天。 */
        _convTimer: null,
        startConvPoll: function () {
            var self = this;
            if (this._convTimer) return;
            var loop = function () {
                if (!self.cfg) return;
                self.loadConversations();   // 内部重渲染列表，幂等
                self._convTimer = setTimeout(loop, 10000);
            };
            this._convTimer = setTimeout(loop, 10000);
        },
        stopConvPoll: function () {
            if (this._convTimer) { clearTimeout(this._convTimer); this._convTimer = null; }
        },

        /** 按 peer_key 查会话项（v1.2.28：置顶/好友态的来源） */
        convByKey: function (peerKey) {
            var l = this._convList || [], i;
            for (i = 0; i < l.length; i++) { if (l[i].peer_key === peerKey) return l[i]; }
            return null;
        },

        /** 会话列表渲染 + 行点击分发（群聊走密码房流程，私聊进私聊页） */
        renderConversations: function () {
            var self = this, list = this.conversations || [];
            // v1.2.28：缓存整份会话，供 openDm 查「是否已置顶 / 是否是好友」
            //（右侧栏的「设为置顶」「删除好友」两行要用，不必再发一次请求）
            this._convList = list;
            // v1.2.20：非「消息」标签下**不要**渲染会话列表 —— 会把它上面板的内容冲掉。
            // loadConversations 已拦了一道，这里再兜一道：任何直接调
            // renderConversations 的路径（切会话、openDm 等）都不该踩坏别的面板。
            // ⚠️ 同样用 `!== 'chat'`，把插件标签一并挡掉。
            if (this.view !== 'chat') return;
            var activeKey = this.dm ? ('dm:' + this.dm.peer) : ('room:' + this.room);
            ChatList.render(list, {
                container: 'haRoomList',
                activeKey: activeKey,
                emptyText: '暂无会话',
                onClick: function (el) {
                    var dm = el.getAttribute('data-dm');
                    if (dm) return self.openDm(dm, el.getAttribute('data-name'));
                    var id = parseInt(el.getAttribute('data-room'), 10) || 0;
                    var name = el.getAttribute('data-name');
                    if (!id) return;
                    // 当前会话的公开性与成员态（服务端已随房间下发，前端不自行推断）
                    var meta = null, rl = self.cfg.rooms || [];
                    for (var k = 0; k < rl.length; k++) { if (rl[k].id === id) { meta = rl[k]; break; } }
                    var isPub = !meta || meta.is_public !== false;

                    // 群聊：先不带密码尝试一次（是否需要密码由服务端判定）
                    // v1.2.27：join=1 表示用户已在前台确认「加入」→ 服务端写 room_members
                    var tryJoin = function (password, join) {
                        HaApi.post('room_join', { room_id: id, password: password || '', join: join ? 1 : 0 }, function (rr) {
                            if (!rr.ok) {
                                if (rr.need_password) {
                                    if (password) toast(rr.msg);
                                    self.passForget(id);
                                    self.askRoomPassword(id, name, function (pw) { tryJoin(pw, join); });
                                    return;
                                }
                                toast(rr.msg);
                                if (rr.need_login) location.href = '?page=login';
                                return;
                            }
                            self.passRemember(id, rr.ttl);
                            // 加入成功后回写缓存，避免下次点同一个群又弹一次确认
                            if (meta && (rr.joined || rr.is_member)) meta.is_member = true;
                            self.switchRoom(id, rr.room.name, el);
                            // 立即刷新「所有成员」（刚加入的自己也要出现在列表里）
                            if (rr.members) self.renderMembers(rr.members, rr.guests, self._canStatus);
                        });
                    };

                    // v1.2.27：公开群聊点击时先确认是否加入（未加入者一律先弹窗）。
                    // 取消 = 不进入（用户选定口径：比「可浏览禁发言」更严格）。
                    // 游客 is_member 恒为 false，同样走这里 —— 游客看到的是同一句提示，
                    // 服务端对游客不写成员表，只当「确认进入」处理。
                    if (isPub && meta && !meta.is_member) {
                        self.confirm(
                            '是否加入「' + name + '」？'
                            + (isPub ? '\n即将加入公开群聊，请注意个人隐私安全。' : ''),
                            function () { tryJoin('', 1); }
                        );
                        return;
                    }
                    tryJoin('', 0);
                }
            });
            // 密码房标签：轮子渲染后补（数据里 need_password 时显示）
            var items = $('haRoomList').getElementsByTagName('li'), i;
            for (i = 0; i < items.length; i++) {
                if (items[i].getAttribute('data-pw') === '1' && items[i].querySelector('.ha-cl-lock')) continue;
                if (items[i].getAttribute('data-pw') === '1') {
                    var t = items[i].querySelector('.ha-cl-title');
                    if (t && !t.querySelector('.ha-cl-lock')) {
                        t.innerHTML += '<span class="ha-cl-tag ha-cl-lock">密码房</span>';
                    }
                }
            }
        },

        /**
         * 打开私聊会话（v1.1.0）：复用群聊骨架——消息区、输入栏、轮询全部沿用，
         * 仅切换「对方昵称」标题、会话目标（room_id=0 + to_user_id）与列表高亮。
         * peer 形如 'user:12'（服务端据此做双方可见性校验）。
         * v1.1.2：跨身份私聊下线，peer 里的 'guest:' 形态直接拒绝。
         */
        openDm: function (peer, name) {
            var self = this;
            var m = /^(\w+):(\d+)$/.exec(peer || '');
            if (!m) return;
            if (m[1] !== 'user') { toast('游客暂不支持私聊'); return; }
            // 已在该私聊：若只是补来了真实昵称（此前为占位「私聊」），只更新标题即可，不重载历史
            if (this.dm && this.dm.peer === peer) {
                if (name && name !== this.roomName && name !== '私聊') {
                    this.roomName = name;
                    $('haRoomName').innerHTML = esc(name);
                }
                return;
            }
            // 先切状态：startPoll 的 alive() 依赖 !this.dm，赋值即让群聊长轮询自杀
            // v1.2.28：从会话列表缓存里取「是否已置顶 / 是否是好友」，
            // 右侧栏的「设为置顶」「删除好友」两行依赖这两个值。
            var conv = this.convByKey('dm:' + peer);
            this.dm = {
                peer: peer, kind: m[1], id: parseInt(m[2], 10),
                pinned: !!(conv && conv.pinned),
                is_friend: !!(conv && conv.is_friend)
            };
            this.pollGen = (this.pollGen || 0) + 1;          // 作废在途的群聊轮询回调
            this._roomPollRunning = false;                  // 群聊长轮询就此停摆
            this.room = 0;
            this.since = 0;
            this.historyDone = false;
            this.loadingHistory = false;
            this.roomName = name || '私聊';
            this.syncRoomOwner();
            this.renderMe();
            this.clearQuote();
            $('haRoomName').innerHTML = esc(this.roomName);
            this.hideMsgTime();   // v1.1.0：消息区重渲染前清掉悬停计时（引用的元素已不存在）
            $('haMessages').innerHTML = '';   // v1.2.6：改懒加载，不再放「加载更早消息…」入口节点
            ChatList.activate('haRoomList', 'dm:' + peer);
            $('haSidebar').className = $('haSidebar').className.replace(' open', '');
            this.setDmUrl(peer);
            this.scrollBottom();
            // 历史：迟到响应需校验仍停留在同一私聊，否则丢弃（避免串到别的会话）
            var myPeer = peer;
            HaApi.post('dm_history', { peer: myPeer, before_id: 0 }, function (r) {
                if (!self.dm || self.dm.peer !== myPeer) return;
                if (!r.ok) { toast(r.msg); return; }
                // 服务端一并回传对方资料：首次私聊时会话列表里还没有该项，
                // 靠这里把标题从占位「私聊」换成真实昵称
                if (r.peer && r.peer.name && r.peer.name !== self.roomName) {
                    self.roomName = r.peer.name;
                    $('haRoomName').innerHTML = esc(r.peer.name);
                }
                for (var i = 0; i < r.data.length; i++) self.addMessage(r.data[i], true);
                if (r.data.length) self.since = r.data[r.data.length - 1].id;
                self.scrollBottom();
                if (r.data.length < 30) self.historyDone = true;
                if (!r.data.length) self.historyDone = true;
                // v1.2.6 懒加载：消息太少填不满屏幕时自动往前补，
                // 否则去掉「加载更早消息…」入口后，这类会话上方会一直留白。
                self.fillIfShort();
            });
            this.dmPollLoop();
            this.renderRoomPanel();   // v1.2.28：私聊下侧栏渲染四个会话操作入口（并隐藏「所有成员」）
            // v1.2.29：进私聊 → 解除「先选联系人 / 先选会话」的闸门
            //（私聊双方都是注册用户且不存在「未加入」，所以直接解禁）
            this.applyInputGate('');
            // v1.1.0：进入私聊视图 → 通知插件清理群级装饰（公告条等）
            this._fireViewChange();
        },

        /**
         * 私聊增量轮询（与群聊 poll 同构，20s 长挂起）。
         * 用 dmGen 世代号与「当前是否仍在私聊」双重判定，保证切回群聊后立刻停摆。
         */
        dmPollLoop: function () {
            var self = this;
            if (!this.dm) return;
            if (this._dmPollTimer) { clearTimeout(this._dmPollTimer); this._dmPollTimer = 0; }
            if (this._dmPollBusy) return;
            var myGen = this.dmGen = (this.dmGen || 0) + 1;
            var peer = this.dm.peer, since = this.since;
            var alive = function () { return self.dm && self.dm.peer === peer && self.dmGen === myGen; };
            this._dmPollBusy = true;
            var t0 = new Date().getTime();
            HaApi.post('dm_poll', { peer: peer, since_id: since }, function (r) {
                if (!alive()) { self._dmPollBusy = false; return; }
                self._dmPollBusy = false;
                if (r && r.ok) {
                    var hasNew = false;
                    for (var i = 0; i < r.messages.length; i++) { self.addMessage(r.messages[i]); hasNew = true; }
                    if (r.messages.length) self.since = r.messages[r.messages.length - 1].id;
                    if (hasNew) {
                        self.scrollBottom();
                        if (self.sound) beep();
                    }
                    $('haLatency').innerHTML = '● ' + (new Date().getTime() - t0) + ' ms';
                    $('haLatency').style.color = '#237804';
                    // 有新消息即刷新会话列表（排序会因这条消息而变）
                    if (hasNew) self.loadConversations();
                }
                if (alive()) self._dmPollTimer = setTimeout(function () { self.dmPollLoop(); }, 100);
            });
        },

        /**
         * 私聊地址路由：?dm=user:12（v1.1.0）。
         * 与 setRoomUrl 对称：互斥清理对方参数（私聊页不保留 room=），并保留其余查询参数。
         *
         * ⚠️ 冒号不能被编码：peer 形如 'user:12'，若用 encodeURIComponent 会变成 'user%3A12'，
         * 而 dmFromUrl 的正则按字面冒号匹配 → 应用自己写出的链接自己都解析不出来。
         * ':' 是 RFC 3986 允许出现在 query 中的字符，直接拼接即可。
         */
        setDmUrl: function (peer, replace) {
            try {
                if (!w.history || !w.history.pushState) return;
                var search = (w.location.search || '').replace(/^\?/, '')
                    .replace(/(^|&)dm=[^&]*/g, '').replace(/(^|&)room=[^&]*/g, '')
                    .replace(/^&+|&+$/g, '');
                var q = search ? search + '&dm=' + peer : 'dm=' + peer;
                var url = w.location.pathname + '?' + q;
                if (replace) w.history.replaceState({ dm: peer }, '', url);
                else w.history.pushState({ dm: peer }, '', url);
            } catch (e) {}
        },

        /**
         * 地址路由：把当前群聊 id 写进 URL（?page=chat&room=ID）。
         * 刷新、分享链接、前进/后退都停留在对应群聊；保留其他查询参数。
         */
        setRoomUrl: function (rid, replace) {
            try {
                if (!w.history || !w.history.pushState) return;
                // ★ v1.1.0 修复：dm 与 room 必须互斥。
                //   原先只删 room=，从私聊切回群聊会留下 ?page=chat&dm=user:20&room=2，
                //   刷新时 dmFromUrl() 优先解析 → 错误跳回私聊（表现为「跳到第一个群聊」）。
                //   这里同时清掉 dm= 与 room=，再写入 room=。
                var search = (w.location.search || '').replace(/^\?/, '')
                    .replace(/(^|&)dm=[^&]*/g, '')
                    .replace(/(^|&)room=[^&]*/g, '').replace(/^&+|&+$/g, '');
                var q = search ? search + '&room=' + rid : 'room=' + rid;
                var url = w.location.pathname + '?' + q;
                if (replace) w.history.replaceState({ room: rid }, '', url);
                else w.history.pushState({ room: rid }, '', url);
            } catch (e) {}
        },
        /** 从当前 URL 解析 room id（无则 0） */
        roomFromUrl: function () {
            var mt = (w.location.search || '').match(/[?&]room=(\d+)/);
            return mt ? parseInt(mt[1], 10) || 0 : 0;
        },

        /** 私聊地址解析：?dm=user:12（v1.1.0，兼容 %3A 编码形式）
         *  v1.1.2：跨身份私聊下线，guest: 形态直接丢弃（否则会走进一个必然报错的空会话） */
        dmFromUrl: function () {
            var mt = (w.location.search || '').match(/[?&]dm=([^&]+)/);
            if (!mt) return '';
            var v = decodeURIComponent(mt[1]);   // 外部链接可能带 %3A，需还原
            if (!/^(\w+:\d{1,10})$/.test(v)) return '';
            return v.indexOf('user:') === 0 ? v : '';
        },

        /** 同步当前群聊的 owner 用户 ID 到模块变量 CUR_OWNER（roleTag 群主标签用） */
        syncRoomOwner: function () {
            var rooms = (this.cfg && this.cfg.rooms) || [];
            for (var i = 0; i < rooms.length; i++) {
                if (rooms[i].id === this.room) { CUR_OWNER = rooms[i].owner_id || 0; return; }
            }
            CUR_OWNER = 0;
        },

        /* ---------- 前端扩展钩子（v1.0.102，供插件注册） ---------- */
        _roomSwitchHooks: [],
        _roomEditHooks: [],
        _viewChangeHooks: [],
        /** 注册「切换群聊」回调：fn({ roomId, ownerId, isAdmin })，切群时触发；注册时立即补发当前状态（插件脚本晚于 init 加载） */
        onRoomSwitch: function (fn) {
            if (typeof fn !== 'function') return;
            this._roomSwitchHooks.push(fn);
            try { fn({ roomId: this.room, ownerId: CUR_OWNER, isAdmin: this.cfg.actor.role === 'admin' }); } catch (e) {}
        },
        /**
         * 注册「群聊信息入口区渲染」回调：fn({ roomId, ownerId, isAdmin, isOwner })。
         * v1.1.1：触发时机从「打开群聊设置弹窗」改为「右侧栏群聊信息区渲染」
         * （init / 切群 / 进私聊 / 打开侧栏 / 保存群资料后都会触发），
         * 可往 #haREExtras 追加入口。
         * v1.1.10：群资料表单已搬回弹窗，#haREExtras 现在是**入口行容器**
         * （不再是表单里的一行），插件入口不再与表单耦合；请用 .ha-panel-entry
         * 类保持与「群聊设置」行一致的外观。#haREExtras 必定存在，
         * 但插件应按 ctx.isOwner || ctx.isAdmin 自行决定是否填充。
         */
        onRoomEdit: function (fn) { if (typeof fn === 'function') this._roomEditHooks.push(fn); },
        _fireRoomSwitch: function () {
            for (var i = 0; i < this._roomSwitchHooks.length; i++) {
                try { this._roomSwitchHooks[i]({ roomId: this.room, ownerId: CUR_OWNER, isAdmin: this.cfg.actor.role === 'admin' }); } catch (e) {}
            }
        },

        /* ---------- 「视图切换」钩子（v1.1.0） ----------
           群聊与私聊共用同一套消息区/输入栏/顶部标题，但群级装饰（公告条、群设置入口等）
           只在群聊视图成立。核心不直接操作插件 DOM——由插件自己注册本钩子，
           在 view='dm' 时清理自己的群级装饰，view='room' 时按 roomId 复原。
           ctx: { view: 'room'|'dm', roomId, peer, ownerId, isAdmin }
           注册时立即补发当前视图（插件脚本晚于 init 加载）。 */
        onViewChange: function (fn) {
            if (typeof fn !== 'function') return;
            this._viewChangeHooks.push(fn);
            this._fireViewChangeTo(fn);
        },
        _fireViewChangeTo: function (fn) {
            try {
                fn({
                    view: this.dm ? 'dm' : 'room',
                    roomId: this.dm ? 0 : this.room,
                    peer: this.dm ? this.dm.peer : '',
                    ownerId: CUR_OWNER,
                    isAdmin: this.cfg && this.cfg.actor ? this.cfg.actor.role === 'admin' : false
                });
            } catch (e) {}
        },
        _fireViewChange: function () {
            for (var i = 0; i < this._viewChangeHooks.length; i++) this._fireViewChangeTo(this._viewChangeHooks[i]);
        },

        switchRoom: function (id, name, el, fromPop) {
            // v1.1.0：离开私聊态 —— 作废私聊轮询世代号，随后 startPoll 会接管长轮询
            if (this.dm) { this.dmGen = (this.dmGen || 0) + 1; this.dm = null; }
            // v1.1.1：群聊↔群聊切换同样要作废在途轮询。
            // 原先只在「私聊→群聊」时重启，导致 A 群切 B 群时在途的那个长轮询
            // （最长 20s）仍会醒来用 **A 群的 online 列表**刷一次侧栏，
            // 表现为「切了群但成员列表还是上一个群的」延迟二十秒。
            if (this._roomPollRunning) {
                this._roomPollRunning = false;
                this.pollGen = (this.pollGen || 0) + 1;   // 旧循环醒来即自杀
            }
            this.room = id; this.roomName = name; this.since = 0; this.historyDone = false;
            // ⚠️ 必须重置 loadingHistory：切群时若上一批懒加载还在途，锁会一直卡在 true，
            // 导致新群的懒加载彻底不响应（onscroll 与 fillIfShort 都被它挡住）。
            this.loadingHistory = false;
            this.syncRoomOwner();
            this.renderMe();   // 资料区身份标签随群聊变化（群主/会员归属当前群）
            this.clearQuote();
            $('haRoomName').innerHTML = esc(name);
            this.hideMsgTime();   // v1.1.0：消息区重渲染前清掉悬停计时（引用的元素已不存在）
            $('haMessages').innerHTML = '';   // v1.2.6：改懒加载，不再放「加载更早消息…」入口节点
            var items = $('haRoomList').getElementsByTagName('li'), i;
            for (i = 0; i < items.length; i++) {
                items[i].className = items[i].className.replace(' active', '');
                // 未传 el（前进/后退、创建群聊跳转等）时按 data-room 自动定位高亮
                if (!el && String(items[i].getAttribute('data-room')) === String(id)) el = items[i];
            }
            if (el) el.className += ' active';
            $('haSidebar').className = $('haSidebar').className.replace(' open', '');
            if (!fromPop) this.setRoomUrl(id, false);
            var self = this;
            var load = function () {
                HaApi.post('history', { room_id: id, before: 0 }, function (r) {
                    // 已切走（切到私聊或别的群）则丢弃迟到响应
                    if (self.dm || self.room !== id) return;
                    if (r.ok) {
                        for (var i = 0; i < r.data.length; i++) self.addMessage(r.data[i], true);
                        if (r.data.length) self.since = r.data[r.data.length - 1].id;
                        self.scrollBottom();
                        if (r.data.length < 30) self.historyDone = true;
                        // 从私聊切回群聊时群聊长轮询是停的，需在此重新拉起
                        if (!self._roomPollRunning) { self._roomPollRunning = true; self.startPoll(); }
                        // v1.2.6 懒加载：填不满屏幕就自动往前补
                        self.fillIfShort();
                    } else if (r.need_password) {
                        // 通行授权已过期 → 重新验证，验证成功后自动重试
                        self.passForget(id);
                        self.askRoomPassword(id, name, load);
                    }
                });
            };
            load();
            this.renderRoomPanel();     // v1.1.1：右侧栏群聊设置区跟随切群刷新
            this._fireRoomSwitch();   // 插件钩子：切换群聊（公告等按群拉取）
            this._fireViewChange();   // v1.1.0：回到群聊视图 → 插件按 roomId 复原群级装饰
            // v1.2.27：立即渲染「所有成员」并校准发言闸门，不等首次 poll 返回（最长 20 秒）
            this.loadMembers();
        },

        /* ---------- 长轮询（主通道）+ 断线降级短轮询 ----------
           v1.1.0：引入 pollGen 世代号。群聊与私聊共用同一套消息区/输入栏，
           两条长轮询必须互斥——切换视图时自增世代号，旧循环醒来即自杀，
           避免两个 in-flight 请求同时刷新同一个 #haMessages、互相覆盖 since。 */
        startPoll: function () {
            var self = this;
            var myGen = this.pollGen = (this.pollGen || 0) + 1;
            var alive = function () { return self.pollGen === myGen && !self.dm; };
            function loop() {
                if (!alive()) return;
                var roomId = self.room, since = self.since;
                var t0 = new Date().getTime();
                HaApi.post('poll', { room_id: roomId, since: since }, function (r, status) {
                    if (!alive()) return;
                    if (!r || !r.ok) {
                        // 密码房授权过期：停止轮询，重新验证后继续
                        if (r && r.need_password) {
                            self.passForget(roomId);
                            self.askRoomPassword(roomId, self.roomName || '', function () { self.startPoll(); });
                            return;
                        }
                        self.failCount++;
                        // 降级：短轮询 + 指数退避（2s → 10s 封顶）
                        var wait = Math.min(10000, 2000 * self.failCount);
                        $('haLatency').innerHTML = '重连中…';
                        $('haLatency').style.color = '#C41D1F';
                        setTimeout(loop, wait);
                        return;
                    }
                    self.failCount = 0;
                    var ms = new Date().getTime() - t0;
                    $('haLatency').innerHTML = '● ' + ms + ' ms';
                    $('haLatency').style.color = '#237804';
                    self.since = r.since;
                    var i, hasNew = false;
                    for (i = 0; i < r.messages.length; i++) {
                        self.addMessage(r.messages[i]);
                        hasNew = true;
                    }
                    if (hasNew) {
                        self.scrollBottom();
                        if (self.sound) beep();
                        // v1.1.0：当前群有消息时立刻前置该会话（其余会话由 startConvPoll 兜底）
                        self.loadConversations();
                    }
                    // v1.2.27：优先用新的成员口径（成员全量 + 在场游客）；
                    // 老服务端没有 members 字段时退回原来的在线名单，不报错。
                    self._canStatus = r.online_status;
                    if (r.members) self.renderMembers(r.members, r.guests, r.online_status);
                    else self.renderOnline(r.online, r.online_status);
                    setTimeout(loop, 100);
                });
            }
            loop();
        },

        /* ---------- 输入框高度：随内容自动增高 + 拖拽手柄手动拉高 ---------- */
        inputMaxH: 120,      // 自动增高上限（拖拽可上调）
        inputUserH: 0,       // 用户手动拖出的高度（0=未设置，走自动增高）
        autoGrow: function () {
            var el = $('haInput');
            if (!el) return;
            el.style.height = 'auto';
            var h = el.scrollHeight + 2;
            var min = 40;
            if (this.inputUserH > 0) {
                // 手动设定过高度：内容再多也不超过用户设定，内容少时也不缩回去
                el.style.height = Math.max(min, Math.min(Math.max(h, this.inputUserH), 320)) + 'px';
                return;
            }
            el.style.height = Math.max(min, Math.min(h, this.inputMaxH)) + 'px';
        },
        bindInputResize: function () {
            var self = this, el = $('haInput'), handle = $('haInputResize');
            if (!el || !handle) return;
            handle.onmousedown = function (e) {
                e = e || w.event;
                var startY = e.clientY, startH = el.offsetHeight;
                if (e.preventDefault) e.preventDefault(); else e.returnValue = false;
                document.onmousemove = function (ev) {
                    ev = ev || w.event;
                    var h = startH + ((ev.clientY || 0) - startY);
                    h = Math.max(40, Math.min(h, 320));
                    self.inputUserH = h;
                    el.style.height = h + 'px';
                    try { w.localStorage.setItem('hal_input_h', String(h)); } catch (err) {}
                };
                document.onmouseup = function () {
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
                return false;
            };
        },
        msgCache: {},

        // 统一构建消息 DOM：头像一侧依次是「用户组标签、昵称」；
        // 时间不直接显示，悬停气泡满 2 秒才显示；操作（@/私信/收藏/撤回等）改为右键菜单
        buildMessage: function (m) {
            var cls = 'ha-msg';
            if (m.mine) cls += ' mine';
            if (m.type === 'mention') cls += ' mention';
            // v1.2.1：私聊标识来自服务端下发的 dm 位，不能再靠 m.type==='private'
            //（私聊里的图片/文件消息 type 分别是 image/file）
            if (m.dm) cls += ' private';
            if (m.type === 'system') cls += ' system';
            if (m.recalled) cls += ' recalled';
            // v1.1.0 软删除：服务端已清空 content，前台只显示占位文案
            if (m.deleted) cls += ' deleted';

            var content;
            if (m.deleted) content = '<span class="ha-msg-content">该消息已删除</span>';
            else if (m.recalled) content = '<span class="ha-msg-content">此消息已撤回</span>';
            // v1.2.13：图片与文件**不再套 .ha-msg-content 气泡**。
            // v1.2.7 把气泡底改成纯白后，这两种消息就多了一层「白底座」——
            // 图片外一圈白、文件卡片里又一层白（.ha-file-card 自带 background+border），
            // 呈现为白底里再套一个白框，视觉上像「双重边框」，很脏。
            // 两者自身都已具备完整外观：.ha-msg-img 有圆角，.ha-file-card 有白底+边框。
            // ⚠️ 不能靠「给 .ha-msg-content 加 class 再改 CSS」绕：那类节点还要参与
            // markRecalled 的 outerHTML 替换与引用跳转的 querySelector('.ha-msg-content')，
            // 去掉节点最干净。留空 span 反而会破坏 flex 基线对齐。
            else if (m.type === 'file') content = '<span class="ha-msg-plain">' + fileCardHtml(m) + '</span>';
            else if (m.type === 'image') content = '<span class="ha-msg-plain"><img class="ha-msg-img" src="' + esc(m.content) + '" onclick="HaChat.viewImg(this.src)" alt="图片"></span>';
            else content = '<span class="ha-msg-content">' + (m.quote && (m.quote.nick || m.quote.text)
                    ? '<span class="ha-msg-quote' + (m.quote.id ? ' ha-quote-link' : '') + '"'
                      + (m.quote.id ? ' title="点击查看原消息" onclick="HaChat.jumpToQuote(' + (m.quote.id | 0) + ')"' : '')
                      + '><b>' + esc(m.quote.nick || '') + '</b>'
                      + (m.quote.nick ? '：' : '') + esc(m.quote.text || '') + '</span>'
                    : '') + esc(m.content) + '</span>';

            var isSys = m.type === 'system';
            // meta 行：头像一侧依次是「用户组标签、昵称」；时间不直接显示，
            // 悬停满 2 秒才显示（见 ha-time-show 类与 hideMsgTime）
            var timeHtml = '<span class="ha-msg-time">' + esc(m.date + ' ' + m.time) + '</span>';
            var mainPart = roleTag(m.role, m.title, m.uid)
                + ' <span class="ha-msg-nick" onclick="HaChat.userCard(' + (m.uid || 0) + ',\'' + esc(m.nickname) + '\')">' + esc(m.nickname) + '</span>';
            // v1.1.0：去掉昵称后的「→ 昵称」私信文字标签。
            // 私聊会话页双方已确定；群聊内的 @提及 足以定位发给人，额外标注纯噪音。
            //
            // v1.2.8：**私聊不显示 meta 行**（昵称与角色标签都不显示）。
            // 私聊只有两个人、页面本身就是对话，顶部已写明对方是谁，
            // 每条消息上方再重复一遍昵称是纯噪音。头像仍保留（可点开资料卡）。
            // 判定用 m.dm（服务端下发的私聊标识），不靠 m.type —— v1.2.1 起
            // 私聊里的图片/文件消息 type 分别是 image/file，用 type 会漏判。
            // ⚠️ 悬停时间也一并去掉：meta 行整体不渲染，留个空 div 只会破坏
            // flex 布局与 .ha-msg-body 的基线对齐。
            var meta = (isSys || m.dm) ? '' :
                '<div class="ha-msg-meta">' + mainPart + timeHtml + '</div>';

            return {
                cls: cls,
                // v1.1.8：消息头像与昵称一样可点 —— 左击头像即打开该用户资料卡
                //（原先只有昵称带 onclick，头像是纯展示，两处行为不一致）。
                // 游客（uid 为 0）传 0，userCard 内部会走 pmHint 提示不可查看。
                // 加 .ha-msg-av 可点类供 CSS 给 cursor:pointer 与 hover 反馈。
                html: (isSys ? '' : '<span class="ha-msg-av" onclick="HaChat.userCard(' + (m.uid || 0) + ',\'' + esc(m.nickname) + '\')">'
                    + avatarHtml(m.avatar, m.nickname, false, m.role) + '</span>')
                    + '<div class="ha-msg-body">' + meta + content + '</div>'
            };
        },

        /** 创建群聊弹窗（用户也可创建，含后台创建房间的全部选项） */
        roomCreateModal: function () {
            var self = this;
            var TYPE = { 'public': '普通', 'password': '密码房', 'role': '角色限定' };
            var ROLE = { 'guest': '游客', 'member': '普通用户', 'vip': 'VIP', 'admin': '超级管理员' };
            // v1.1.14：服务端已按当前身份算好（管理员恒为 1），前端不再自行判 role
            var canPrivate = (this.cfg.settings || {}).room_private_create !== '0';
            var opts = function (map, keys, cur) {
                var h = '';
                for (var i = 0; i < keys.length; i++) {
                    h += '<option value="' + esc(keys[i]) + '"' + (cur === keys[i] ? ' selected' : '') + '>' + esc(map[keys[i]] || keys[i]) + '</option>';
                }
                return h;
            };
            /* v1.2.19：群名称改为**可选**，留空由服务端补「<昵称>的群聊」。
               前端这里只负责把「留空会得到什么」讲清楚 —— 不要等到创建完
               才发现群叫了个自己没写的名字。 */
            var me0 = this.cfg.me || {};
            var autoName = ((me0.nickname || '') || '我') + '的群聊';
            this.openModal(
                '<h3>创建群聊</h3>'
                + '<div class="ha-form-item"><label>群名称（可选）</label><input class="ha-input" id="haRCName" maxlength="30"'
                + ' placeholder="留空默认「' + esc(autoName) + '」"></div>'
                + '<div class="ha-form-item"><label>类型</label><select class="ha-input" id="haRCType">'
                + opts(TYPE, ['public', 'password', 'role'], 'public') + '</select></div>'
                + '<div class="ha-form-item" id="haRCPassRow" style="display:none"><label>房间密码</label><input class="ha-input" type="password" id="haRCPass" placeholder="密码群必须设置密码"></div>'
                + '<div class="ha-form-item" id="haRCRoleRow" style="display:none"><label>最低进入角色</label><select class="ha-input" id="haRCRole">'
                + opts(ROLE, ['guest', 'member', 'vip', 'admin'], 'guest') + '</select></div>'
                + '<div class="ha-form-item"><label>群简介（可选）</label><input class="ha-input" id="haRCDesc" maxlength="200" placeholder="一句话介绍这个群"></div>'
                // v1.1.11 公开性 State 开关。与上面的「类型」正交：
                // 类型管「进入方式」（密码/角色门槛），开关管「谁能发现这个群」。
                // v1.1.14：后台总闸关闭时对当前身份禁用（canPrivate 由服务端按身份算好后下发），
                // 避免留下「能点、提交必报错」的死开关。
                // v1.1.16：删掉「开启：显示在群聊列表，游客可进入并发言。关闭：不进公开列表…」，
                // 同样的理由（读着绕 + 「游客可发言」并非恒成立）。
                // 「谁能看到这个群」由下方 haRCPubNote 随开关实时说明，不重复写死。
                + '<div class="ha-form-item ha-form-item-switch">'
                // v1.1.18 修正：公开性开关的标签改回「公开群聊」。
                // v1.1.16 曾把 is_public 也译成「普通」，与同弹窗里 type=public 的
                // 「普通」撞词 → 两个「普通」并排，用户以为公开性开关消失了。
                // 定案：**类型**= 普通/密码群/角色限定，**公开性**= 公开/仅邀请。
                + switchHtml('haRCPublic', '公开群聊', true,
                    canPrivate ? ''
                               : '站点已关闭「创建仅邀请群聊」，新群只能公开（管理员不受此限制）。',
                    !canPrivate)
                + '</div>'
                + '<div class="ha-form-msg ha-rc-note" id="haRCPubNote"></div>'
                + '<div class="ha-room-form-tip" id="haRCTip"></div>'
                + '<div class="ha-form-msg" id="haRCMsg"></div>'
                + '<div class="ha-modal-actions">'
                + '<button class="ha-btn ha-btn-ghost" id="haRCCancel">取消</button>'
                + '<button class="ha-btn ha-btn-primary" id="haRCCreate">创 建</button></div>'
            );
            bindSwitches($('haModal'));
            var typeSel = $('haRCType'), tip = $('haRCTip'), msg = $('haRCMsg');
            var pubBox = $('haRCPublic'), pubNote = $('haRCPubNote');
            // 公开性提示随开关变化：把「谁能进这个群」讲清楚，避免建完才发现进不去。
            // v1.1.18：措辞改回「公开 / 仅邀请」。v1.1.16 误用「普通」，与类型撞词。
            var refreshPub = function () {
                if (!canPrivate) {
                    pubNote.innerHTML = '<span style="color:#C41D1F">站点已关闭「创建仅邀请群聊」，新群只能公开。</span>';
                    return;
                }
                pubNote.innerHTML = pubBox.checked
                    ? '<span style="color:var(--ha-text-sub)">群聊将出现在左侧列表，所有人（含游客）都能看到并进入。</span>'
                    : '<span style="color:#C41D1F">仅邀请：群聊不会出现在列表里。创建后只有你能进，其他人需要你或群成员在群聊设置里按用户 ID 邀请。</span>';
            };
            pubBox.onchange = refreshPub;
            refreshPub();
            var refreshTip = function () {
                var t = typeSel.value;
                $('haRCPassRow').style.display = t === 'password' ? 'block' : 'none';
                $('haRCRoleRow').style.display = t === 'role' ? 'block' : 'none';
            };
            typeSel.onchange = refreshTip;
            refreshTip();
            // 积分提示（创建成本由后台配置，管理员免费）
            var me = this.cfg.me || {};
            var cost = parseInt(this.cfg.settings.room_create_cost, 10) || 0;
            var pts = parseInt(me.points, 10) || 0;
            var notEnough = cost > 0 && me.role !== 'admin' && pts < cost;   // 管理员免费
            if (notEnough) {
                tip.innerHTML = '<span style="color:#C41D1F">积分不足：创建需要 <b>' + cost + '</b> 积分，当前 <b>' + pts + '</b>。</span>';
                $('haRCCreate').disabled = true;
                $('haRCCreate').style.opacity = '.5';
                $('haRCCreate').style.cursor = 'not-allowed';
            } else if (cost > 0) {
                tip.innerHTML = (me.role === 'admin')
                    ? '管理员创建免费（普通用户需 <b>' + cost + '</b> 积分，当前 ' + pts + '）。'
                    : '创建将扣除 <b>' + cost + '</b> 积分（当前 ' + pts + '）。';
            } else {
                tip.innerHTML = '创建免费。';
            }
            var submit = function () {
                if (notEnough) { msg.innerHTML = '<span style="color:#C41D1F">积分不足，无法创建</span>'; return; }
                var name = $('haRCName').value.replace(/^\s+|\s+$/g, '');
                /* v1.2.19：空 = 合法（走默认名）；填了才校验长度。
                   ⚠️ 不能写成 `name.length < 2` —— 那会把「留空」也判成非法，
                   与「可选」的设计直接矛盾。 */
                if (name !== '' && (name.length < 2 || name.length > 30)) {
                    msg.innerHTML = '<span style="color:#C41D1F">群名称需 2-30 个字符，'
                        + '或留空自动命名为「' + esc(autoName) + '」</span>';
                    return;
                }
                var t = typeSel.value;
                if (t === 'password' && !$('haRCPass').value) {
                    msg.innerHTML = '<span style="color:#C41D1F">密码群必须设置密码</span>'; return;
                }
                msg.innerHTML = '创建中…';
                HaApi.post('room_create', {
                    name: name, type: t, password: $('haRCPass') ? $('haRCPass').value : '',
                    min_role: $('haRCRole').value,
                    // v1.1.11：公开性开关。传 '0'/'1' 字符串，服务端按 === '0' 归一
                    description: $('haRCDesc').value,
                    is_public: pubBox.checked ? '1' : '0'
                }, function (r) {
                    if (!r.ok) { msg.innerHTML = '<span style="color:#C41D1F">' + esc(r.msg) + '</span>'; return; }
                    self.closeModal();
                    toast('群聊「' + r.name + '」已创建'
                        + (r.cost > 0 ? '，扣除 ' + r.cost + ' 积分' : '')
                        + (pubBox.checked ? '' : '（仅邀请，可在群聊设置里邀请成员）'));
                    self.refreshRooms(r.id, r.name);
                });
            };
            $('haRCCreate').onclick = submit;
            $('haRCCancel').onclick = function () { self.closeModal(); };
        },

        /** 重新拉取房间列表并定位到指定房间 */
        refreshRooms: function (gotoId, gotoName) {
            var self = this;
            HaApi.post('rooms', {}, function (r) {
                if (!r.ok) return;
                self.cfg.rooms = r.data;
                self.loadConversations();   // v1.1.0：列表为群聊+私聊聚合，须走 conversations
                var found = null, i, j;
                for (i = 0; i < r.data.length; i++) if (r.data[i].id === gotoId) found = r.data[i];
                if (found) {
                    self.switchRoom(gotoId, found.name, null);
                } else if (gotoName) {
                    $('haRoomName').innerHTML = esc(gotoName);
                }
            });
        },

        /* ---------- 消息流时间戳（v1.2.5） ---------- */
        /**
         * 相邻消息间隔阈值（秒）：超过才插时间戳。
         * 5 分钟是个平衡点：密集聊天时列表不被时间戳打断，
         * 而一段明显停顿（午休、下班、隔天回来）又能让人知道时间断层在哪。
         */
        TIME_DIVIDER_GAP: 300,

        /**
         * 是否需要在这条消息前插时间戳。
         * @param {number|null} prevTs 上一条消息的 ts（秒）；null = 消息流里的第一条
         * @param {number}      ts      当前消息的 ts
         */
        needTimeDivider: function (prevTs, ts) {
            // 流里第一条：上一条是「加载更早消息…」之类的非消息节点，
            // 不拿它当上一条消息比时间，否则会在列表最顶部多出一条无意义的时间戳。
            if (!prevTs || !ts) return false;
            return Math.abs(ts - prevTs) > this.TIME_DIVIDER_GAP;
        },

        /**
         * 时间戳文案分档（与气泡悬停时间 date('H:i') 的 24 小时制保持一致）：
         *   今天        → 13:00
         *   昨天        → 昨天 13:00
         *   本周内      → 周三 13:00
         *   更早        → 10月4日 13:00
         * 跨年时「更早」档补上年份，避免「去年 3 月 5 日」和今年混淆。
         */
        timeDividerText: function (ts) {
            var d = new Date(ts * 1000), now = new Date();
            var hm = (function (x) {
                return (x < 10 ? '0' : '') + x;
            });
            var timeStr = hm(d.getHours()) + ':' + hm(d.getMinutes());

            // 归零到当天 00:00 再算天数差，避开时分秒带来的小数误差
            var d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            var n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var dayDiff = Math.round((n0 - d0) / 86400000);

            if (dayDiff === 0) return timeStr;                       // 今天
            if (dayDiff === 1) return '昨天 ' + timeStr;              // 昨天
            if (dayDiff < 7) return '周' + '日一二三四五六'[d.getDay()] + ' ' + timeStr;
            var ymd = (d.getMonth() + 1) + '月' + d.getDate() + '日';
            if (d.getFullYear() !== now.getFullYear()) ymd = d.getFullYear() + '年' + ymd;
            return ymd + ' ' + timeStr;
        },

        /** 生成一个时间戳分隔节点（不进 msgCache，它不是消息） */
        buildTimeDivider: function (ts) {
            var el = document.createElement('div');
            el.className = 'ha-time-divider';
            var span = document.createElement('span');
            span.textContent = this.timeDividerText(ts);
            el.appendChild(span);
            return el;
        },

        /**
         * 取「插入点参考节点 ref 自身」的时间戳 ts。
         *
         * 向上翻页时新消息插在 ref **之前**，所以要比的时间是 **ref 自己**的时间，
         * 不是 ref 之前那条 —— 后者在本轮插入前根本不存在（这批更早的消息还没渲染），
         * 那是 addMessage 追加路径才需要的。
         */
        tsOfRef: function (ref) {
            if (!ref || !ref.id || ref.id.indexOf('haMsg') !== 0) return 0;
            var c = this.msgCache[parseInt(ref.id.replace('haMsg', ''), 10)];
            return c ? (parseInt(c.ts, 10) || 0) : 0;
        },

        addMessage: function (m, batch) {

            var box = $('haMessages');
            var exist = document.getElementById('haMsg' + m.id);
            if (exist) {
                // 轮询带回撤回状态时，同步更新已渲染的气泡（否则撤回后界面不变）
                if (m.recalled) this.markRecalled(m.id);
                return;
            }
            this.msgCache[m.id] = m;
            var b = this.buildMessage(m);
            var div = document.createElement('div');
            div.className = b.cls;
            div.id = 'haMsg' + m.id;
            div.innerHTML = b.html;

            // 时间戳：与已渲染的最后一条比时间（末尾追加路径）
            var lastMsg = null, kids = box.querySelectorAll('.ha-msg'), i;
            for (i = kids.length - 1; i >= 0; i--) { lastMsg = kids[i]; break; }
            var prevTs = 0;
            if (lastMsg) {
                var c = this.msgCache[parseInt(lastMsg.id.replace('haMsg', ''), 10)];
                prevTs = c ? (parseInt(c.ts, 10) || 0) : 0;
            }
            if (this.needTimeDivider(prevTs, m.ts)) box.appendChild(this.buildTimeDivider(m.ts));
            box.appendChild(div);
            // v1.2.18：文件名中间省略必须在**入 DOM 之后**量宽（见 fitFileName 注释），
            // 同一帧内的多次插入由 scheduleFitFileName 合并成一次重排。
            if (b.html.indexOf('ha-file-name') >= 0) scheduleFitFileName(div);

            // ⚠️ 裁剪条件必须按**消息条数**算，不能用 children.length ——
            // children 里混着时间戳节点，用它算会让上限被时间戳虚增，
            // 导致实际消息数远未到 500 就开始裁（表现为「消息莫名变少」）。
            if (!batch) {
                var msgCount = box.getElementsByClassName('ha-msg').length;
                while (msgCount > 500) {
                    // 只删「最靠上的那条消息」，并连带它**之后**紧跟的时间戳节点，
                    // 否则会留下一个失去参照的孤儿时间戳在顶部。
                    var old = box.querySelector('.ha-msg');
                    if (!old) break;
                    var oid = parseInt((old.id || '').replace('haMsg', ''), 10);
                    if (oid) delete this.msgCache[oid];
                    var after = old.nextSibling;
                    box.removeChild(old);
                    if (after && after.className
                        && after.className.indexOf('ha-time-divider') >= 0) {
                        box.removeChild(after);
                    }
                    msgCount--;
                }
            }
        },

        /** 把某条消息的气泡更新为「已撤回」状态 */
        markRecalled: function (id) {
            var el = document.getElementById('haMsg' + id);
            if (!el || el.className.indexOf('recalled') >= 0) return;
            el.className += ' recalled';
            // v1.2.13：图片 / 文件消息已不再套 .ha-msg-content（去白色底座），
            // 它们的承载节点是 .ha-msg-plain。两种都要查，否则撤回时
            // 占位文案不渲染、原图/文件仍留在界面上 —— 表现为「撤回了但内容还在」。
            // 删除/撤回占位统一回退成 .ha-msg-content，让 .ha-msg.recalled
            // 与 .ha-msg.deleted 的虚线弱化样式正常生效。
            var cs = el.querySelector('.ha-msg-content') || el.querySelector('.ha-msg-plain');
            if (cs) cs.outerHTML = '<span class="ha-msg-content">此消息已撤回</span>';
            this.msgCache[id] = this.msgCache[id] || {};
            this.msgCache[id].recalled = 1;
        },

        /** 自研确认弹窗（替代原生 confirm） */
        confirmModal: function (text, onOk) {
            var self = this;
            this.openModal(
                '<h3>确认操作</h3>'
                + '<p class="ha-modal-desc">' + esc(text) + '</p>'
                + '<div class="ha-modal-actions">'
                + '<button class="ha-btn ha-btn-ghost" id="haCfmNo">取消</button>'
                + '<button class="ha-btn ha-btn-danger" id="haCfmOk">确定</button></div>'
            );
            $('haCfmOk').onclick = function () { self.closeModal(); if (onOk) onOk(); };
            $('haCfmNo').onclick = function () { self.closeModal(); };
        },

        scrollBottom: function () {
            var box = $('haMessages');
            box.scrollTop = box.scrollHeight;
        },

        /**
         * 懒加载更早的一批消息（v1.2.6）。触发方有两个：
         *   1. 消息区向上滚到接近顶部（见 bindEvents 里的 onscroll）
         *   2. 首屏渲染完若**填不满容器**，自动续拉（见 fillIfShort）
         * 不再有「加载更早消息…」可点入口 —— 那是 v1.1.0 之前的做法。
         *
         * 视图分流沿用 v1.1.0：群聊走 history(room_id)，私聊走 dm_history(peer)，
         * 两者都是「取 before 之前的 30 条」。
         *
         * @param {function} done 加载完成回调（成功/失败/已切走都会调）
         */
        loadHistory: function (done) {
            var self = this, box = $('haMessages');
            var finish = function () { if (typeof done === 'function') done(); };
            if (this.historyDone || this.loadingHistory) { finish(); return; }
            var first = box.querySelector('.ha-msg');
            if (!first) { this.historyDone = true; finish(); return; }   // 一条都没有 = 拉完了
            var before = parseInt(first.id.replace('haMsg', ''), 10);
            var isDm = !!this.dm, peer = isDm ? this.dm.peer : '';
            var action = isDm ? 'dm_history' : 'history';
            var payload = isDm ? { peer: peer, before_id: before } : { room_id: this.room, before: before };
            this.loadingHistory = true;
            HaApi.post(action, payload, function (r) {
                self.loadingHistory = false;
                // ⚠️ 两边都必须先 !! 归一再比。
                // 群聊首次进入时 self.dm 从未被赋值，是 undefined；而 isDm 是 !!this.dm
                // 得到的 boolean false。直接用 !== 比较 undefined 与 false 恒为 true，
                // 会把每次响应都当成「已切走」丢弃 —— 表现为「懒加载永远不生效、
                // 往上滚什么都没反应」，且没有任何报错，很难定位。
                var nowIsDm = !!self.dm;
                if (nowIsDm !== isDm || (isDm && self.dm.peer !== peer)) { finish(); return; }
                if (!r.ok) { self.historyDone = true; finish(); return; }
                if (!r.data.length) { self.historyDone = true; finish(); return; }

                // ⚠️ 插入新节点会改变 scrollHeight，必须**先记旧高度、插完再按差值回推**，
                // 否则浏览器会保持 scrollTop 不变 → 视口猛地跳到新加载内容的位置（老实现就这毛病）。
                var oldH = box.scrollHeight, i;
                for (i = r.data.length - 1; i >= 0; i--) self.addMessageBefore(r.data[i], first);
                box.scrollTop = box.scrollHeight - oldH;

                // 不足一屏（scrollHeight <= clientHeight）说明还有空间，继续往前拉，
                // 避免新群/新会话只显示最后几条、上方却是一片空白。
                var short = box.scrollHeight <= box.clientHeight + 4;
                if (short && r.data.length >= 30) { self.loadHistory(finish); return; }
                if (r.data.length < 30) self.historyDone = true;   // 不足一页 = 没有更早的了
                finish();
            });
        },

        /**
         * 首屏渲染完成后调用：若消息区填不满容器，自动续拉更早的消息直到填满或拉完。
         * v1.2.6 懒加载配套 —— 少了「加载更早消息…」入口后，消息少的会话
         * 若不自动补，用户会看到上方空白且没有任何提示。
         */
        fillIfShort: function () {
            var box = $('haMessages');
            if (!box || this.historyDone || this.loadingHistory) return;
            if (box.scrollHeight > box.clientHeight + 4) return;   // 已填满，不用管
            if (!box.querySelector('.ha-msg')) return;           // 还没拿到任何消息，等首屏回调
            this.loadHistory();
        },

        addMessageBefore: function (m, ref) {
            var box = $('haMessages');
            if (document.getElementById('haMsg' + m.id)) return;
            this.msgCache[m.id] = m;
            var b = this.buildMessage(m);
            var div = document.createElement('div');
            div.className = b.cls;
            div.id = 'haMsg' + m.id;
            div.innerHTML = b.html;
            // 时间戳：与 ref（更晚的那条）比时间，插在**更早这条的上方**。
            // ⚠️ 顺序必须是「先 div 后 divider」：
            //   insertBefore 的第二个参数必须是 div 的**已在 DOM 中的后继节点**。
            //   若先插 divider，就得拿还没入 DOM 的 div 当参照 → 抛 NotFoundError。
            box.insertBefore(div, ref);
            // v1.2.18：同上，插入后才有宽度可量
            if (b.html.indexOf('ha-file-name') >= 0) scheduleFitFileName(div);
            var prevTs = this.tsOfRef(ref);
            if (this.needTimeDivider(prevTs, m.ts)) {
                box.insertBefore(this.buildTimeDivider(m.ts), div);
            }
        },

        /* ---------- 消息右键菜单（@ / 私信 / 收藏贴纸 / 撤回，插件可扩展） ---------- */
        _ctxItems: [],
        /**
         * 消息右键菜单扩展点（供插件追加菜单项，如禁言插件的「禁言」）。
         * 回调签名：function (items, msg, env) —— 直接 items.push({t:'文案', run:fn}) 即可。
         * env：{ roomId: 当前房间ID, actor: 当前身份对象 }
         */
        _ctxExt: [],
        _ctxExtContent: [],   // 右键「内容」菜单的插件扩展
        _quoteExt: [],        // 引用内容钩子（前端侧）
        quote: null,          // 当前待发送的引用 {nick,text}
        onMsgCtx: function (fn) { if (typeof fn === 'function') this._ctxExt.push(fn); },
        /** 插件扩展点：构造引用内容时可改写（服务端另有 message.quote 钩子做最终校验） */
        onQuote: function (fn) { if (typeof fn === 'function') this._quoteExt.push(fn); },
        showCtxMenu: function (x, y, m) { this.showUserMenu(x, y, m); },
        hideCtxMenu: function () {
            var menu = $('haCtxMenu');
            if (menu) { menu.style.display = 'none'; menu._from = ''; }
        },
        /* ---------- 消息时间显隐（v1.1.0）----------
           悬停消息气泡满 2 秒才显示时间，移开立即隐藏。
           计时状态集中在这里，切换会话 / 消息区重渲染前统一 hideMsgTime()，
           避免「已经移开鼠标但定时器还在跑」导致时间凭空出现。 */
        _timeMsg: null,
        _timeTimer: null,
        hideMsgTime: function () {
            if (this._timeTimer) { clearTimeout(this._timeTimer); this._timeTimer = null; }
            if (this._timeMsg && this._timeMsg.className) {
                this._timeMsg.className = this._timeMsg.className.replace(' ha-time-show', '');
            }
            this._timeMsg = null;
        },
        /**
         * 右键「头像」的用户菜单：对该发言人的操作（@ / 私信 / 收藏 / 撤回 / 禁言…）。
         * 插件通过 HaChat.onMsgCtx 追加的项也进这里（都是针对「人」的能力）。
         * @deprecated showCtxMenu 保留为别名，兼容既有插件 / 调用
         */
        showUserMenu: function (x, y, m) {
            var self = this, admin = this.cfg.actor.role === 'admin', items = [];
            if (!m.recalled && !m.deleted) {
                items.push({ t: '@ ' + m.nickname, run: function () { self.mention(m.nickname); } });
                // v1.1.2：**只有对方也是注册用户才给「私信」**（m.uid 为空即游客）。
                // 原先只判自己是不是注册用户，于是「注册用户 → 游客」的入口一直挂着，
                // 而服务端已彻底关闭跨身份私聊 —— 前端不收口就会变成点进去必然报错的死按钮。
                if (!m.mine && this.cfg.actor.kind === 'user' && m.uid)
                    items.push({ t: '私信', run: function () { self.openDmWith(m); } });
                // 收藏贴纸已移到内容菜单（showContentMenu）：它是对「图片」的操作，不是对「人」的操作
            }
            // 插件扩展（v1.0.54）：如禁言插件按「管理员 / 房主」身份追加菜单项；
            // IP 归属地已移出核心，插件可在此注册（服务端走 ip_loc + ip.location 钩子）
            for (i = 0; i < this._ctxExt.length; i++) {
                try { this._ctxExt[i](items, m, { roomId: this.room, actor: this.cfg.actor }); } catch (e) {}
            }
            if (!items.length) return;

            this._ctxItems = items;
            var menu = $('haCtxMenu');
            menu._from = 'msg';
            var html = '', i;
            for (i = 0; i < items.length; i++) {
                html += '<a href="javascript:;" data-i="' + i + '">' + esc(items[i].t) + '</a>';
            }
            menu.innerHTML = html;
            menu.style.display = 'block';
            // 视口边界：菜单放不下时往回挪
            var vw = w.innerWidth || document.documentElement.clientWidth;
            var vh = w.innerHeight || document.documentElement.clientHeight;
            var mw = menu.offsetWidth || 140, mh = menu.offsetHeight || items.length * 32;
            menu.style.left = Math.max(4, x + mw > vw ? x - mw : x) + 'px';
            menu.style.top = Math.max(4, y + mh > vh ? y - mh : y) + 'px';
        },

        /* ---------- 发送 ---------- */
        /**
         * 发送消息。v1.1.0：私聊视图下自动改写路由——
         * room_id=0（虚拟私聊空间）+ 对方标识（to_user_id）。
         *
         * v1.2.1 修复：原判断是 `if (this.dm && !opt.type)`，即「没显式指定类型才走私聊」。
         * 而图片 / 文件 / 贴纸发送时 opt.type 分别是 'image' / 'file'，
         * 于是这些消息绕过了私聊改写、带着上一个群的 room_id 走群聊通道，
         * 结果私聊里发图/文件必然失败（服务端按群校验直接拒绝）。
         * 私聊身份与消息形态本就是两个正交维度：只要处于私聊视图就一律走私聊路由，
         * type 只描述「发的是什么」，不再决定「发给谁」。
         *
         * 昵称仅作展示快照，不作身份；服务端以数字 ID 判定双方可见性。
         */
        send: function (opt) {
            opt = opt || {};
            var input = $('haInput');
            // v1.2.29：输入区闸门统一在这里拦一道。
            //   'join'   未加入群聊（服务端 send 也有同样校验）
            //   'friend' 停在「联系人」标签 —— 这是**防误发**的关键一环：
            //            中间是空白的，用户可能以为还在跟刚才那个人聊天
            //   'conv'   没选中任何会话
            if (this._inputGate === 'join') { toast('请先加入该群聊后再发言'); return; }
            if (this._inputGate === 'friend') { toast('请先选择一个联系人'); return; }
            if (this._inputGate === 'conv') { toast('请先选择一个会话'); return; }
            var content = opt.content != null ? opt.content : input.value;
            if (!content || !content.replace(/^\s+|\s+$/g, '')) return;
            var self = this;
            var payload = {
                room_id: this.room,
                type: opt.type || 'text',
                content: content,
                to_user_id: opt.to_user_id || '', to_guest_id: opt.to_guest_id || '',
                to_nickname: opt.to_nickname || '',
                // 引用快照：JSON 字符串，服务端会再次校验截断
                quote: this.quote ? JSON.stringify(this.quote) : ''
            };
            // 私聊视图：文本 / 图片 / 文件等所有形态一律发往对方
            if (this.dm) {
                // v1.1.2：跨身份私聊已下线 —— 理论上不会进入 guest 分支（入口已收口），
                // 这里仍硬拦一道，避免任何残留状态发出必然被服务端拒绝的请求
                if (this.dm.kind !== 'user') { toast('游客暂不支持私聊'); return; }
                payload.room_id = 0;
                payload.to_user_id = this.dm.id;
                payload.to_guest_id = '';
                payload.to_nickname = this.roomName;
            }
            var wasDm = !!this.dm;
            HaApi.post('send', payload, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                if (!opt.type || opt.type === 'text') input.value = '';
                self.clearQuote();   // 发送成功后清掉引用条
                self.autoGrow();   // 发送后回到单行（若手动拉高过则保持用户高度）
                if (wasDm && self.dm) self.loadConversations();   // 刷新会话排序（自己发的排最前）
            });
        },

        /**
         * 上传文件附件，并作为一条 file 消息发送。
         * v1.2.1：私聊可用（路由由 send() 统一处理，此处无需分支）。
         */
        uploadFile: function (file) {
            var self = this;
            toast('文件上传中…');
            HaApi.upload('upload_file', file, {}, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                self.send({
                    type: 'file',
                    content: JSON.stringify({
                        name: r.file.name, size: r.file.size,
                        ext: r.file.ext, path: r.file.path
                    })
                });
            });
        },

        uploadImage: function (file) {
            var self = this;
            toast('图片上传中…');
            HaApi.upload('upload', file, { kind: 'image' }, function (r) {
                if (r.ok) self.send({ type: 'image', content: r.url });
                else toast(r.msg);
            });
        },

        /**
         * 撤回消息 = 真正的删除，**全局生效**（所有人都不再看到，不可恢复）。
         * v1.2.4 起撤回是物理删除行，所以成功后直接把气泡从 DOM 移除，
         * 不再走 markRecalled（那是软删除时代的「留个已撤回占位」）。
         */
        recall: function (id) {
            var self = this;
            var text = '确定撤回这条消息吗？撤回后所有群成员都不再显示，且不可恢复。'
                + '（如只想自己不看，请用「删除」）';
            this.confirmModal(text, function () {
                HaApi.secure('recall', { id: id }, function (r) {
                    if (!r.ok) { toast(r.msg); return; }
                    var el = $('haMsg' + id);
                    if (el && el.parentNode) el.parentNode.removeChild(el);
                    delete self.msgCache[id];
                    toast(r.msg || '已撤回');
                    // 全局生效 → 会话摘要也会变，重拉让侧栏同步
                    self.loadConversations();
                });
            });
        },

        mention: function (nick) {
            var input = $('haInput');
            input.value += '@' + nick + ' ';
            input.focus();
            HaChat.autoGrow();
        },

        /**
         * 从一条消息进入与该作者的私聊（v1.1.0）。
         * 私聊不再用「弹窗写一条」的一次性交互，而是进入完整会话页——
         * 历史可翻、双方可继续对话，与群聊共用同一套消息区与输入栏。
         * 对象标识用 user:<id>（v1.1.2 起仅注册用户，游客不再提供私聊入口）。
         */
        openDmWith: function (m) {
            if (!m || !m.uid) { toast('游客暂不支持私聊'); return; }
            this.openDm('user:' + m.uid, m.nickname);
        },
        /** 兼容旧调用点（插件可能仍调 pm）；v1.1.0 起统一进入私聊会话页 */
        pm: function (nick, uid, gid) {
            if (uid) return this.openDm('user:' + uid, nick);
            if (gid) { toast('游客暂不支持私聊'); return; }   // v1.1.2：跨身份私聊已下线
            toast('无法确定私聊对象');
        },

        collect: function (url) {
            HaApi.post('sticker_add', { url: url }, function (r) { toast(r.msg); });
        },

        viewImg: function (src) {
            $('haImgViewerImg').src = src;
            $('haImgViewer').style.display = '-webkit-flex';
            $('haImgViewer').style.display = 'flex';
        },

        /* ---------- 用户资料卡 ---------- */
        /**
         * 打开用户资料卡。
         *
         * v1.1.9 重做布局：**头像左上 + 昵称/身份在右**（原为居中大图 + 下方文字）。
         * 与个人设置**共用同一套头像轮子**（cropForTarget → avatarCropSave
         * → avatarUpload），并统一头像尺寸：
         *  - 尺寸：资料卡与设置页都用 'lg'（64px）。v1.1.8 曾统一到 'md'(32px)，
         *    但 32px 在 380px 宽的弹窗里视觉权重太轻，看着仍偏小，故再放大一档。
         *    尺寸由 CSS 档位锁死（.ha-avatar + overflow:hidden + img 的 max-*），
         *    **与原图实际像素无关**，不会被大图撑破。
         *  - 自己的卡片：头像可点直接换头像（标题提示 + hover 反馈），
         *    与设置页的点击上传走同一条链；上传后两处预览同时回填。
         *  - v1.2.23：**不再有底部「关闭」按钮**（右上角 ✕ 已够）；
         *    自己的卡片因此没有按钮 → 不输出 actions 容器。
         * 用户名已取消：资料卡以用户 ID 作为唯一标识，昵称可重名只作展示。
         */
        userCard: function (uid, nick) {
            if (!uid) { this.pmHint(nick); return; }
            var self = this;
            HaApi.post('user_card', { id: uid }, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                var u = r.data;
                var meId = (self.cfg.me && self.cfg.me.id) || 0;
                var isMe = self.cfg.actor.kind === 'user' && meId > 0 && meId === u.id;
                // v1.1.0：资料卡加「发私信」入口，与头像右键菜单走同一条私聊路径
                var canPm = self.cfg.actor.kind === 'user' && !isMe && self.cfg.actor.id !== u.id;
                // 自己的卡片：头像包一层可点容器，点它=打开隐藏的 file input
                var avHtml = avatarHtml(u.avatar, u.nickname, 'lg', u.role);
                if (isMe) {
                    avHtml = '<span class="ha-set-avatar-btn" id="haCardAvatarPreview" title="点击更换头像"'
                        + ' onclick="HaChat.pickCardAvatar()">' + avHtml + '</span>'
                        + '<input type="file" id="haCardAvatarFile" accept="image/*" style="display:none">';
                }
                var regDate = u.created_at ? new Date(u.created_at * 1000).toLocaleDateString() : '-';
                var badges = roleTag(u.role, u.title, u.id);
                // v1.2.23：底部不再放「关闭」—— openModal 自带右上角 ✕（见 openModal），
                // 两个关闭入口纯冗余。
                // ⚠️ 连带影响：自己的卡片 canPm=false，删掉「关闭」后**一个按钮都不剩**，
                // 此时整个 .ha-modal-actions 都不输出（否则卡片底部留一道空边框）。
                // 自己的卡片就只能靠 ✕ / 点遮罩 / Esc 关闭 —— 这是有意的。
                // v1.1.24 联系人：加为联系人。
                // v1.2.24 文案：按钮写「加好友 / 删除好友」（用户要求）。
                //   ⚠️ 两个按钮是**互斥**的（已是好友只给「删除好友」），位置相同，
                //   只改其中一个会出现「加好友 / 删除联系人」的错位说法，所以成对改。
                //   ⚠️ 只改**界面文案**：后端 action 名仍是 friend_add / friend_remove、
                //   表名仍是 user_friends，服务端提示语仍是「为联系人」——
                //   术语统一是另一件事（涉及侧栏标签「联系人」与服务端文案），未一并动。
                // 删除走 HaApi.secure —— friend_remove 在 $SENSITIVE 内，需一次性票据。
                var acts = '';
                if (canPm) {
                    acts += (u.is_friend
                        ? '<button class="ha-btn ha-btn-ghost" onclick="HaChat.removeFriend(' + (u.id) + ')">删除好友</button>'
                        : '<button class="ha-btn ha-btn-ghost" onclick="HaChat.addFriend(' + (u.id) + ')">加好友</button>')
                        + '<button class="ha-btn ha-btn-primary" onclick="HaChat.closeModal();HaChat.openDm(\'user:' + (u.id) + '\',' + JSON.stringify(u.nickname).replace(/"/g, '&quot;') + ')">发私信</button>';
                }
                HaChat.openModal(
                    '<h3>用户资料</h3>'
                    + '<div class="ha-card-head">'
                    + avHtml
                    + '<div class="ha-card-id">'
                    // v1.2.23：昵称与身份标签**同一行**（标签在昵称右侧）；
                    // 昵称下方显示「ID xxxxx」—— 原「用户 ID」在下方 meta 行里，已上移，不再重复。
                    // ⚠️ badges 为空时不输出该 span：空 flex item 仍会吃掉一个 gap。
                    + '<div class="ha-card-name-row">'
                    + '<span class="ha-card-name">' + esc(u.nickname) + '</span>'
                    + (badges ? '<span class="ha-card-badges ha-card-badges-inline">' + badges + '</span>' : '')
                    + '</div>'
                    + '<div class="ha-card-sub">ID ' + esc(fmtUid(u.id)) + '</div>'
                    + '</div></div>'
                    + '<div class="ha-card-meta">'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">积分</span>'
                    + '<span class="ha-card-meta-v">' + esc(u.points || 0) + '</span></div>'
                    + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">注册</span>'
                    + '<span class="ha-card-meta-v">' + esc(regDate) + '</span></div>'
                    + '</div>'
                    // v1.2.23：插件内容锚点（个性签名等）。
                    // 由来：signature 插件原先靠 `modal.querySelector('p')` 定位，
                    // v1.1.9 资料卡重做布局后 <p> 被 .ha-card-meta 取代 → 拿到 null
                    // → 静默 return，签名从此不再显示。给个稳定 id 让插件不再猜结构。
                    + '<div id="haCardExtras"></div>'
                    + (acts ? '<div class="ha-modal-actions">' + acts + '</div>' : '')
                );
                // 绑定隐藏 file input：选图后走**与设置页完全相同**的裁剪轮子
                if (isMe) {
                    var f = $('haCardAvatarFile');
                    f.onchange = function () {
                        if (!this.files || !this.files[0]) return;
                        self.avatarCrop(this.files[0]);   // 轮子入口与 openSettings 一致
                        this.value = '';
                    };
                }
            });
        },

        /** 资料卡里点击自己的头像 → 打开隐藏的 file input（与设置页 pickAvatar 同义） */
        pickCardAvatar: function () {
            var f = $('haCardAvatarFile');
            if (f) f.click();
        },

        pmHint: function (nick) { toast('游客用户无法查看资料卡'); },

        /* ---------- 成员列表 ---------- */
        /**
         * 渲染成员列表。
         *
         * v1.1.1：在线状态（绿点/灰点）**仅超级管理员与群主可见**，
         * 口径由服务端 poll 返回的 online_status 决定，前端不自行判身份——
         * 否则两处判定漂移，就会重演「服务端允许、前台没有按钮」的契约不一致。
         * 成员名字对所有人可见（含游客）。
         */
        renderOnline: function (list, canStatus) {
            var box = $('haOnlineList'), cnt = $('haOnlineCount');
            if (cnt) cnt.innerHTML = list.length;
            if (!box) return;
            var html = '', i;
            for (i = 0; i < list.length; i++) {
                var o = list[i];
                html += '<li class="ha-online-item">'
                      + (canStatus ? '<span class="ha-online-dot"></span>' : '')
                      + avatarHtml(o.avatar, o.nickname, true, o.role)
                      + '<span class="ha-online-name" onclick="HaChat.userCard(' + (o.uid || 0) + ',\'' + esc(o.nickname) + '\')">' + esc(o.nickname) + '</span>'
                      + roleTag(o.role, '', o.uid) + '</li>';
            }
            box.innerHTML = html;
        },

        /* ---------- 所有成员（v1.2.27 改口径） ----------
           以前这里渲染的是 online 表（45 秒心跳 = 「谁在线」），
           需求要的是「群里都有谁」—— 改成：
             · 注册用户：room_members **全量**（含离线，群主自动补位）
             · 游客    ：online 表里本群的在场游客（心跳 45 秒，离开即消失）
           游客只出现在公开群（不公开群游客进不来，服务端查询结果自然为空）。
           在线点的显隐仍由服务端 canSeeOnlineStatus 决定，前端不自行判身份。 */
        renderMembers: function (members, guests, canStatus) {
            var box = $('haOnlineList'), cnt = $('haOnlineCount');
            var ms = members || [], gs = guests || [];
            if (cnt) cnt.innerHTML = ms.length + gs.length;
            if (!box) return;
            var html = '', i;
            for (i = 0; i < ms.length; i++) html += this._memberRow(ms[i], canStatus);
            for (i = 0; i < gs.length; i++) html += this._memberRow(gs[i], canStatus);
            box.innerHTML = html || '<li class="ha-online-empty">还没有成员</li>';
        },

        /** 单行成员/游客。游客没有资料卡，名字不可点（点了只会弹「游客无法查看资料卡」） */
        _memberRow: function (o, canStatus) {
            var isGuest = o.kind === 'guest';
            var dot = '';
            if (canStatus && !isGuest) {
                dot = '<span class="ha-online-dot' + (o.online ? '' : ' is-off') + '"></span>';
            }
            var nameAttr = isGuest ? '' : ' onclick="HaChat.userCard(' + (o.uid || 0) + ',\'' + esc(o.nickname) + '\')"';
            var tag = isGuest
                ? '<span class="ha-tag ha-tag-guest">游客</span>'
                : roleTag(o.role, '', o.uid);
            return '<li class="ha-online-item' + (isGuest ? ' is-guest' : '') + '">'
                + dot
                + avatarHtml(o.avatar, o.nickname, true, o.role)
                + '<span class="ha-online-name"' + nameAttr + '>' + esc(o.nickname) + '</span>'
                + tag + '</li>';
        },

        /** 切群后立即拉一次成员，不等 poll（poll 最长 20 秒才返回） */
        loadMembers: function () {
            var self = this, id = this.room;
            if (!id) return;
            HaApi.post('room_members', { room_id: id }, function (r) {
                if (!r.ok || self.room !== id) return;
                self.renderMembers(r.members, r.guests, r.online_status);
                self.applyJoinGate(r.is_member, r.is_public);
            });
        },

        /**
         * 切到「联系人」标签时**关掉**中间正在显示的会话（v1.2.29）。
         *
         * 要解决的问题：切标签只换了左侧栏，中间还留着刚才那个群聊/私聊的聊天记录，
         * 用户很容易「以为还在跟刚才那个人/群聊天」，直接在输入框打字发出去 ——
         * 发错对象。要让「切换标签」等价于「离开当前会话」。
         *
         * 四件事缺一不可：
         *  ① 停两路轮询（群聊长轮询 + 私聊长轮询），否则在途回调醒来又往
         *     已清空的 #haMessages 里塞消息（还会把 since 推走）；
         *  ② 清空消息区 + 取消列表高亮（视觉上彻底「关掉」）；
         *  ③ 清掉 this.room / this.dm（**不留后路**：否则输入框一解禁就能往刚才那个群发消息）；
         *  ④ 输入区落闸（禁发言 + 提示先选联系人）。
         */
        blankChatForFriends: function () {
            this.pollGen = (this.pollGen || 0) + 1;      // 作废群聊长轮询世代
            this.dmGen = (this.dmGen || 0) + 1;          // 作废私聊长轮询世代
            this._roomPollRunning = false;
            this.dm = null;
            this.room = 0;
            this.since = 0;
            this.historyDone = true;                     // 已无可加载历史，禁掉上滚懒加载
            this.loadingHistory = false;
            var box = $('haMessages');
            if (box) box.innerHTML = '';
            ChatList.activate('haRoomList', '');         // 取消任何一行的高亮
            this.renderRoomPanel();                      // 右侧栏回到「请先选择」空态
            this.applyInputGate('friend');
        },

        /**
         * 输入区闸门（v1.2.29 统一入口）。此前只有 applyJoinGate 一条路，
         * 现在要覆盖三种「不能发」的原因，抽成一处，避免多路径互相覆盖。
         *   ''        正常
         *   'join'    未加入该群聊 → 显示加入按钮
         *   'friend'  停在「联系人」标签 → 先点一个联系人
         *   'conv'    停在「消息」标签但没选中任何会话
         */
        applyInputGate: function (kind) {
            var box = $('haJoinGate');
            var input = $('haInput');
            this._inputGate = kind || '';
            if (!input) return;
            // 工具栏一并禁用：选图/选文件会直接走 send 发出消息，
            // 只禁输入框的话，用户还能从工具栏把消息发到「已经关掉的会话」里。
            var tbIds = ['haBtnEmoji', 'haBtnImage', 'haBtnFile'], i, tb;
            for (i = 0; i < tbIds.length; i++) {
                tb = $(tbIds[i]);
                if (tb) tb.disabled = !!kind;
            }
            if (!kind) {
                if (box) { box.style.display = 'none'; box.innerHTML = ''; }
                input.disabled = false;
                input.placeholder = '输入消息，按 Enter 发送，Ctrl+V 粘贴图片';
                return;
            }
            input.disabled = true;
            if (kind === 'join') {
                if (box) {
                    box.innerHTML = '<span>你还没有加入该群聊，加入后即可发言</span>'
                        + '<button class="ha-btn ha-btn-primary ha-btn-mini" onclick="HaChat.joinCurrentRoom()">加入群聊</button>';
                    box.style.display = '';
                }
                input.placeholder = '加入群聊后即可发言';
                return;
            }
            // 'friend' / 'conv'：没有具体对话对象，只禁用并给一句话提示
            if (box) { box.style.display = 'none'; box.innerHTML = ''; }
            input.placeholder = (kind === 'friend') ? '请先选择一个联系人' : '请先选择一个会话';
        },

        /**
         * 未加入群聊时的发言闸门（v1.2.27）。
         * 正常流程下点击公开群聊会先弹「是否加入」，取消就不进入，走不到这里；
         * 这里是 URL 直达 / 被移出成员 / 服务端已拒发等异常态的兜底：
         * 让界面自洽（看得见为什么发不出去）而不是让用户对着一个没反应的输入框。
         *
         * v1.2.29：实现已并入 applyInputGate，这里只保留业务判定。
         */
        applyJoinGate: function (isMember, isPublic) {
            var isUser = this.cfg.actor && this.cfg.actor.kind === 'user';
            var needJoin = !(!isUser || isPublic === false || isMember);
            this._needJoin = needJoin;
            this.applyInputGate(needJoin ? 'join' : '');
        },

        /** 在闸门里点「加入群聊」：就地加入，不必回会话列表重点一次 */
        joinCurrentRoom: function () {
            var self = this, id = this.room;
            if (!id) return;
            HaApi.post('room_join', { room_id: id, join: 1 }, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                toast('已加入群聊');
                // 同步侧栏缓存，否则再点一次该会话还会弹「是否加入」
                var rl = self.cfg.rooms || [];
                for (var i = 0; i < rl.length; i++) { if (rl[i].id === id) rl[i].is_member = true; }
                self.applyJoinGate(true, true);
                if (r.members) self.renderMembers(r.members, r.guests, self._canStatus);
                else self.loadMembers();
            });
        },

        /* ---------- 右侧栏：群聊信息入口区 ---------- */
        /**
         * 渲染右侧栏上方的「群聊信息」入口区（v1.1.10 重做）。
         *
         * 形态变更史（别走回头路）：
         *   v1.1.0  群资料是**弹窗**，入口在会话列表行内三点菜单。
         *   v1.1.1  改为**常驻侧栏内联表单**（本区块直接渲染可编辑表单）。
         *   v1.1.10 按需求回退到**弹窗**，侧栏只留两行入口：
         *     第 1 行「群聊设置」→ openRoomEdit() 打开模态框
         *     第 2 行「群公告」  → announcements 插件经 onRoomEdit 钩子填进 #haREExtras
         *     两行同款样式（.ha-panel-entry），群公告因此位于「所有成员」区块上方，
         *     **不再与群资料表单耦合**——插件不必关心表单是弹窗还是内联。
         *
         * 钩子契约（onRoomEdit）保持不变：
         *   fn({ roomId, ownerId, isAdmin, isOwner })，#haREExtras 必定存在。
         */
        renderRoomPanel: function () {
            var box = $('haRoomPanel');
            if (!box) return;
            var me = this.cfg.me || {}, isAdmin = this.cfg.actor.role === 'admin';
            var isDm = this.room === 0;                    // 私聊是 room_id=0 的虚拟空间
            var r = null, list = this.cfg.rooms || [], i;
            for (i = 0; i < list.length; i++) { if (list[i].id === this.room) { r = list[i]; break; } }

            // v1.2.29：什么会话都没选（刚进页、或从「联系人」标签切回来）——
            // 不属于私聊也不属于群聊，给一个中性空态，别误用私聊那套入口。
            var noTarget = !this.dm && !this.room;
            if (noTarget) {
                box.innerHTML = '<div class="ha-panel-hint">请先选择一个会话</div>';
                var memSec0 = document.querySelector('.ha-panel-members');
                if (memSec0) memSec0.style.display = 'none';
                return;
            }

            // v1.2.28：私聊**不显示「所有成员」区块** —— 那是群聊概念，
            // 私聊只有两个人，列出来是噪音。用 display 切换而不是移除节点：
            // 切回群聊时无需重建，且 poll 返回的 members 仍有地方可写。
            var memSec = document.querySelector('.ha-panel-members');
            if (memSec) memSec.style.display = isDm ? 'none' : '';

            // v1.2.28：私聊不再是「没有群聊信息」的空洞提示，改渲染四个会话操作入口。
            if (isDm) {
                box.innerHTML = this.dmPanelHtml();
                return;
            }
            if (!r) {
                box.innerHTML = '<div class="ha-panel-hint">请先选择一个群聊</div>';
                return;
            }
            var meId = me.id || 0;
            var isOwner = !!meId && meId === (r.owner_id || 0);

            box.innerHTML = entryRow('群聊设置', 'gear', 'HaChat.openRoomEdit()')
                + '<div class="ha-panel-entry-row" id="haREExtras"></div>';

            // 插件扩展钩子（v0.0.102 起）：群公告等入口往 #haREExtras 追加
            var ctx = { roomId: this.room, ownerId: r.owner_id || 0, isAdmin: isAdmin, isOwner: isOwner };
            for (var hi = 0; hi < this._roomEditHooks.length; hi++) {
                try { this._roomEditHooks[hi](ctx); } catch (e) {}
            }
        },

        /**
         * 私聊右侧栏的四个入口（v1.2.28）。样式与群聊的「群聊设置」**完全同款**
         * （同一个 entryRow + .ha-panel-entry-row）。
         *
         * ⚠️ 结构不能拍平：分隔线画在 .ha-panel-entry-row 的 border-top 上，
         * 且宽屏有 `@media (min-width:961px)` 把**首行**撑到 --ha-topbar-h - 1px
         * 来让这条线与顶栏（聊天名称下方那条）落在同一像素行。
         * 所以第一个入口必须是 .ha-panel-room-body 的**直接子元素**，
         * 其余三个放进紧随其后的 .ha-panel-entry-row —— 拍平成同级会同时丢掉：
         *   ① 顶部分隔线（第一条横线会消失/错位）
         *   ② 与顶栏横线的平行关系
         */
        dmPanelHtml: function () {
            var d = this.dm || {};
            var peer = d.peer || '';
            var uid = d.id || 0;
            var nick = (this.roomName || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var peerKey = peer ? 'dm:' + peer : '';
            var isGuest = this.cfg.actor.kind !== 'user';   // 游客无置顶/好友概念

            var first = isGuest || !peerKey
                ? entryRow('私聊会话', 'gear', '')       // 游客/异常态：静态行，只作占位保住首行结构
                : entryRow(d.pinned ? '取消置顶' : '设为置顶', d.pinned ? 'pinOff' : 'pin',
                    'HaChat.toggleDmPin()');

            var rest = entryRow('删除聊天记录', 'trash', 'HaChat.clearDmHistory()');
            // 「删除好友」只在对方确实是好友时给：否则点了必然报错（服务端会拒）
            if (!isGuest && uid && this.dm && this.dm.is_friend) {
                rest += entryRow('删除好友', 'userX', 'HaChat.removeDmFriend()');
            }
            // 「举报」来自 content-report 插件，插件未启用/未加载时**不渲染这一行**，
            // 不能给一个点了没反应的入口（插件不提供任何核心兜底）。
            if (!isGuest && uid && w.HaCR && typeof w.HaCR.openReport === 'function') {
                rest += entryRow('举报', 'flag', 'HaChat.reportDmPeer()');
            }
            return first + '<div class="ha-panel-entry-row">' + rest + '</div>';
        },

        /** 置顶 / 取消置顶当前私聊（仅影响自己的会话列表顺序） */
        toggleDmPin: function () {
            var self = this;
            var peerKey = (this.dm && this.dm.peer) ? ('dm:' + this.dm.peer) : '';
            if (!peerKey) { toast('私聊对象不合法'); return; }
            HaApi.post('dm_pin', { peer_key: peerKey }, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                if (self.dm) self.dm.pinned = !!r.pinned;
                toast(r.msg);
                self.loadConversations();     // 重排列表：置顶的会话整体提到最前
                self.renderRoomPanel();      // 行文案在「设为置顶 / 取消置顶」之间切
            });
        },

        /**
         * 清空本机聊天记录（v1.2.28）。
         * 语义 = 项目既有的「删除」：**只写 message_hides，对方照常能看到**，可逆。
         * 清完把当前会话消息区也清空，否则界面与实际状态不一致。
         */
        clearDmHistory: function () {
            var self = this;
            var peer = this.dm && this.dm.peer;
            if (!peer) { toast('私聊对象不合法'); return; }
            this.confirm('确定清空与「' + (this.roomName || '对方') + '」的聊天记录？\n'
                + '仅清空你自己这边的视图，对方仍能看到全部消息。', function () {
                HaApi.post('dm_clear', { peer: peer }, function (r) {
                    if (!r.ok) { toast(r.msg); return; }
                    toast(r.msg || '已清空聊天记录');
                    if (self.dm && self.dm.peer === peer) {
                        $('haMessages').innerHTML = '';
                        self.since = 0;
                        self.historyDone = true;    // 已无可加载的历史，避免上滚又拉回来
                    }
                    self.loadConversations();
                });
            });
        },

        /** 删除当前私聊对方这个好友（对方不是好友时按钮本就不渲染，这里再兜一层） */
        removeDmFriend: function () {
            var self = this;
            var uid = this.dm && this.dm.id;
            if (!uid) { toast('私聊对象不合法'); return; }
            this.confirm('确定删除好友「' + (this.roomName || '') + '」？\n删除后聊天记录仍会保留。', function () {
                self.removeFriend(uid);
            });
        },

        /** 举报当前私聊对方（入口来自 content-report 插件） */
        reportDmPeer: function () {
            var d = this.dm || {};
            if (!d.id || !w.HaCR) { toast('举报功能不可用'); return; }
            w.HaCR.openReport(d.id, this.roomName || '', 0, 0, 0);
        },

        /**
         * 群聊设置弹窗（v1.1.10 恢复弹窗形态，v1.1.1~v1.1.9 曾内联常驻在侧栏）。
         *
         * 与 v1.1.0 弹窗版的差异：
         *  - 群头像尺寸统一走 avatarHtml 的 'lg' 档（64px），与资料卡/个人设置一致；
         *  - 编辑区保留「群名称 + 群简介」两个字段（v1.1.0 的密码/类型设置不在本弹窗内，
         *    那部分历史上就是独立入口，勿在此扩张）；
         *  - 非群主看到只读信息（简介、群主、类型），可改与否由 room.can_edit 决定。
         */
        openRoomEdit: function () {
            var me = this.cfg.me || {}, isAdmin = this.cfg.actor.role === 'admin';
            var r = null, list = this.cfg.rooms || [], i;
            for (i = 0; i < list.length; i++) { if (list[i].id === this.room) { r = list[i]; break; } }
            if (this.room === 0 || !r) { toast('私聊会话没有群聊设置'); return; }

            var canEdit = !!r.can_edit;   // 服务端下发：群主 + 超管（口径唯一，前端不自行判身份）
            var meId = me.id || 0;
            var isOwner = !!meId && meId === (r.owner_id || 0);
            // v1.1.16：与创建弹窗 / 后端口径统一 —— type='public' 显示「普通」
            // （原先这里显示「群聊」，会与旁边的公开性标签「普通」凑成「群聊 + 普通」两个标签）
            var typeName = r.type === 'password' ? '密码群' : (r.type === 'role' ? '角色限定' : '普通');
            var isPublic = r.is_public !== false;   // 缺省视为公开，兼容旧缓存数据
            var canInvite = !!r.can_invite;
            // v1.1.14：普通用户在总闸关闭时不能把公开群改成不公开（服务端会拒），
            // 这里同步禁用开关。已经是不公开的群则放行——改个名不该被总闸拦住。
            var canTogglePublic = (this.cfg.settings || {}).room_private_create !== '0'
                || !isPublic || isAdmin;
            // 待保存头像按群缓存：切群时必须重置，否则会把上一个群的头像带过来
            if (this._roomAvatarRoom !== this.room) {
                this._roomAvatarRoom = this.room;
                this._roomAvatar = r.avatar || '';
            }

            this.openModal(
                '<h3>群聊设置</h3>'
                + '<div class="ha-card-head">'
                + '<span class="ha-set-avatar-btn" id="haRoomAvatarPreview"'
                + (canEdit ? ' title="点击更换群头像" onclick="HaChat.roomAvatarPick()"' : '') + '>'
                // v1.1.19：群头像改走 roomAvatarHtml —— 无自定义头像时显示默认剪影图，
                // 不再是「群名首字 + 随机色块」（那个 role 传 'member' 走的是色盘分支）。
                + roomAvatarHtml(this._roomAvatar, 'lg') + '</span>'
                + '<input type="file" id="haRoomAvatarFile" accept="image/*" style="display:none">'
                + '<div class="ha-card-id">'
                + '<div class="ha-card-name">' + esc(r.name) + '</div>'
                + '<div class="ha-card-badges"><span class="ha-tag ha-tag-green">' + typeName + '</span>'
                // v1.1.18：公开性徽章改回「公开」。v1.1.16 写成「普通」会与左边
                // type=public 的「普通」并排出现两个同词标签，等于把公开性信息抹掉了。
                + '<span class="ha-tag ha-tag-member">' + (isPublic ? '公开' : '仅邀请') + '</span></div>'
                + '</div></div>'
                + (canEdit
                    ? '<div class="ha-card-meta">'
                      + '<div class="ha-form-item"><label>群名称</label><input class="ha-input" id="haRoomEditName" value="' + esc(r.name) + '" maxlength="30"></div>'
                      + '<div class="ha-form-item" style="margin-top:10px"><label>群简介</label><input class="ha-input" id="haRoomEditDesc" value="' + esc(r.description || '') + '" maxlength="200" placeholder="一句话介绍这个群（可选）"></div>'
                      // v1.1.11 公开性开关：与「类型」正交，只控制谁能发现这个群。
                      // v1.1.14：总闸关闭且本群当前是公开时禁用，避免「保存必报错」。
                      // v1.1.16：删掉「开启：显示在群聊列表，游客可进入并发言。关闭：只有群主
                      // 与成员能进，需邀请加入。」这段说明 —— 一行讲两种状态读着绕，
                      // 且「游客可进入并发言」并非所有群都成立（受类型与角色门槛影响）。
                      // v1.1.18：公开性开关标签改回「公开群聊」（v1.1.16 误写「普通群聊」，
                      // 与上方类型徽章「普通」撞词，看起来像开关消失了）。
                      + '<div class="ha-form-item ha-form-item-switch">'
                      + switchHtml('haRoomPublic', '公开群聊', isPublic,
                          canTogglePublic ? ''
                                          : '站点已关闭「创建仅邀请群聊」，本群只能保持公开。',
                          !canTogglePublic)
                      + '</div>'
                      + '</div>'
                      + '<div class="ha-modal-actions ha-modal-actions-split">'
                      + (canInvite ? '<button class="ha-btn ha-btn-ghost" onclick="HaChat.roomMembers(' + r.id + ')">成员管理</button>' : '')
                      + '<span class="ha-modal-actions-sp"></span>'
                      + '<button class="ha-btn ha-btn-ghost" onclick="HaChat.closeModal()">取消</button>'
                      + '<button class="ha-btn ha-btn-primary" onclick="HaChat.roomEditSave(' + r.id + ')">保存</button></div>'
                    // 只读：非群主会员也能看到群名称 / 简介 / 群主，信息不设限，仅不可改
                    : '<div class="ha-card-meta">'
                      + (r.description
                          ? '<div class="ha-card-meta-row"><span class="ha-card-meta-k">简介</span><span class="ha-card-meta-v">' + esc(r.description) + '</span></div>'
                          : '<div class="ha-card-meta-row"><span class="ha-card-meta-v ha-panel-empty">群主还没有写简介</span></div>')
                      + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">群主</span><span class="ha-card-meta-v">' + esc(fmtUid(r.owner_id)) + '</span></div>'
                      + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">可见性</span><span class="ha-card-meta-v">' + (isPublic ? '公开（所有人可见）' : '仅邀请（仅群主与成员）') + '</span></div>'
                      + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">修改</span><span class="ha-card-meta-v">仅群主与超级管理员可修改</span></div>'
                      + '</div>'
                      + '<div class="ha-modal-actions ha-modal-actions-split">'
                      + (canInvite ? '<button class="ha-btn ha-btn-ghost" onclick="HaChat.roomMembers(' + r.id + ')">成员管理</button>' : '')
                      + '<span class="ha-modal-actions-sp"></span>'
                      + '<button class="ha-btn ha-btn-ghost ha-btn-block" onclick="HaChat.closeModal()">关闭</button></div>')
            );
            bindSwitches($('haModal'));

            var f = $('haRoomAvatarFile');
            if (f) f.onchange = function () {
                if (!this.files || !this.files[0]) return;
                var self2 = HaChat;
                self2.roomAvatarCrop(this.files[0]);   // 裁剪浮层独立，弹窗主体保持完好
                this.value = '';
            };
        },

        /* ---------- 群成员管理（v1.1.11） ---------- */
        /**
         * 成员管理弹窗：列出成员 + 按用户 ID 邀请 + 群主/超管移出成员。
         *
         * 身份口径：**只用数字用户 ID**。昵称可重名、邮箱属个人信息，
         * 二者都不能做身份标识或反查（见开发文档「开发约束」）。
         * 因此这里**不提供**「按昵称搜索用户」的功能——只接受对方主动报给你的 ID。
         */
        roomMembers: function (roomId) {
            var self = this;
            HaApi.post('room_members', { room_id: roomId }, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                var list = r.data || [], canInvite = !!r.can_invite;
                var isOwnerOrAdmin = (self.cfg.actor.role === 'admin')
                    || ((self.cfg.me || {}).id === r.owner_id);
                var meId = (self.cfg.me || {}).id || 0;
                var cards = '';
                if (!list.length) cards = '<div class="ha-mem-empty">还没有其他成员，可按用户 ID 邀请</div>';
                for (var i = 0; i < list.length; i++) {
                    var m = list[i];
                    cards += '<div class="ha-mem-row">'
                        + avatarHtml(m.avatar, m.nickname, 'sm', m.role)
                        + '<span class="ha-mem-name">' + esc(m.nickname || 'ID' + m.user_id) + '</span>'
                        + '<span class="ha-mem-id">ID ' + esc(fmtUid(m.user_id)) + '</span>'
                        + (isOwnerOrAdmin
                            ? '<button class="ha-btn ha-btn-ghost ha-btn-mini ha-mem-del" data-id="' + m.user_id + '">移出</button>'
                            : '')
                        + '</div>';
                }
                // 邀请码仅成员可见；不公开群没有它没法被外部找到，所以要提供
                var codeRow = '';
                if (r.invite_code) {
                    var link = self.cfg.site_url + '/?room_invite=' + esc(r.invite_code);
                    codeRow = '<div class="ha-card-meta">'
                        + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">邀请码</span>'
                        + '<span class="ha-card-meta-v">' + esc(r.invite_code) + '</span></div>'
                        + '<div class="ha-card-meta-row"><span class="ha-card-meta-k">邀请链接</span>'
                        + '<span class="ha-card-meta-v ha-mem-link">'
                        + '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(link) + '</a></span></div>'
                        + '</div>';
                }
                self.openModal(
                    '<h3>群成员</h3>'
                    + '<div class="ha-mem-head">共 ' + (list.length + 1) + ' 人（含群主）</div>'
                    + '<div class="ha-mem-list">' + cards + '</div>'
                    + (canInvite
                        ? '<div class="ha-mem-invite">'
                          + '<div class="ha-form-item"><label>邀请用户</label>'
                          + '<input class="ha-input" id="haMemInviteId" placeholder="对方用户 ID（数字）" inputmode="numeric"></div>'
                          + '<button class="ha-btn ha-btn-primary ha-btn-block" id="haMemInviteBtn">邀请加入</button>'
                          + '</div>'
                        : '')
                    + codeRow
                    + '<div class="ha-modal-actions">'
                    + (isOwnerOrAdmin && r.invite_code
                        ? '<button class="ha-btn ha-btn-ghost" onclick="HaChat.roomInviteReset(' + roomId + ')">重置邀请码</button>' : '')
                    + '<button class="ha-btn ha-btn-ghost ha-btn-block" onclick="HaChat.closeModal()">关闭</button></div>'
                );
                // 邀请
                var ib = $('haMemInviteBtn');
                if (ib) ib.onclick = function () {
                    var uid = ($('haMemInviteId').value || '').replace(/[^0-9]/g, '');
                    if (!uid) { toast('请输入对方的用户 ID（数字）'); return; }
                    ib.disabled = true; ib.textContent = '邀请中…';
                    HaApi.secure('room_invite', { room_id: roomId, user_id: uid }, function (res) {
                        toast(res.msg);
                        if (!res.ok) { ib.disabled = false; ib.textContent = '邀请加入'; return; }
                        self.closeModal();
                        self.roomMembers(roomId);   // 成功即刷新成员列表
                    });
                };
                // 移出（敏感操作：票据一次性）
                var delBtns = document.querySelectorAll('#haModal .ha-mem-del');
                for (var k = 0; k < delBtns.length; k++) {
                    (function (el) {
                        el.onclick = function () {
                            var uid = el.getAttribute('data-id');
                            self.confirm('确定把该成员移出本群？他将无法再进入仅邀请群。', function () {
                                HaApi.secure('room_remove_member', { room_id: roomId, user_id: uid }, function (res) {
                                    toast(res.msg);
                                    if (res.ok) { self.closeModal(); self.roomMembers(roomId); }
                                });
                            });
                        };
                    })(delBtns[k]);
                }
                var rb = $('haModal').querySelector('[onclick*="roomInviteReset"]');
                if (rb) rb.onclick = function () { self.roomInviteReset(roomId); };
            });
        },

        /** 重置邀请码（旧链接立即失效）；敏感操作 */
        roomInviteReset: function (roomId) {
            var self = this;
            this.confirm('重置后，旧邀请链接与邀请码立即失效。确定继续？', function () {
                HaApi.secure('room_invite_code_reset', { room_id: roomId }, function (r) {
                    toast(r.msg);
                    if (r.ok) { self.closeModal(); self.roomMembers(roomId); }
                });
            });
        },

        /* ---------- 公告轮播 ---------- */
        renderAnnounce: null,   // v1.0.102 公告已剥离为 announcements 插件（见 plugins/announcements/）

        /* ---------- 表情面板 ---------- */
        buildEmojiPanel: function () {
            var self = this, html = '<div class="ha-emoji-tabs">'
                + '<button class="ha-emoji-tab active" data-tab="emoji">Emoji</button>'
                + '<button class="ha-emoji-tab" data-tab="sticker">我的贴纸</button></div>'
                + '<div class="ha-emoji-grid" id="haEmojiGrid"></div>';
            $('haEmojiPanel').innerHTML = html;
            var tabs = $('haEmojiPanel').querySelectorAll('.ha-emoji-tab'), i;
            for (i = 0; i < tabs.length; i++) {
                tabs[i].onclick = function () {
                    var t = $('haEmojiPanel').querySelectorAll('.ha-emoji-tab'), j;
                    for (j = 0; j < t.length; j++) t[j].className = 'ha-emoji-tab';
                    this.className = 'ha-emoji-tab active';
                    self.renderEmojiGrid(this.getAttribute('data-tab'));
                };
            }
            this.renderEmojiGrid('emoji');
        },

        renderEmojiGrid: function (tab) {
            var grid = $('haEmojiGrid'), self = this, html = '', i;
            if (tab === 'emoji') {
                for (i = 0; i < this.emojis.length; i++) html += '<span class="ha-emoji-item">' + this.emojis[i] + '</span>';
                grid.innerHTML = html;
                var items = grid.getElementsByTagName('span');
                for (i = 0; i < items.length; i++) {
                    items[i].onclick = function () {
                        $('haInput').value += this.innerHTML;
                        $('haInput').focus();
                    };
                }
            } else {
                HaApi.post('stickers', {}, function (r) {
                    if (!r.ok || !r.data.length) { grid.innerHTML = '<p style="padding:20px;color:#5C5C5C;font-size:12px">暂无贴纸：把鼠标悬停在图片消息上点击「收藏贴纸」即可添加</p>'; return; }
                    for (i = 0; i < r.data.length; i++) html += '<img class="ha-sticker-item" src="' + esc(r.data[i].url) + '">';
                    grid.innerHTML = html;
                    var imgs = grid.getElementsByTagName('img');
                    for (i = 0; i < imgs.length; i++) {
                        imgs[i].onclick = function () {
                            self.send({ type: 'image', content: this.src });
                            $('haEmojiPanel').style.display = 'none';
                        };
                    }
                });
            }
        },

        /* ---------- 我的面板 / 设置 ---------- */
        renderMe: function () {
            var self = this, me = this.cfg.me, el = $('haMe');
            if (!el) return;
            if (me) {
                // 昵称与身份标签同行；整块可点击 → 弹出操作菜单（创建群聊/设置/管理后台/退出）
                // v1.0.93：侧栏不展示任何身份标签（群主/会员只在消息区、在线成员列表、资料卡显示）
                el.className = 'ha-me ha-me-click';
                el.innerHTML = avatarHtml(me.avatar, me.nickname, false, me.role)
                    + '<div class="ha-me-info">'
                    + '<div class="ha-me-line"><span class="ha-me-name">' + esc(me.nickname) + '</span>' + (me.title ? '<span class="ha-tag ha-tag-title">' + esc(me.title) + '</span>' : '') + '</div>'
                    + '<div style="font-size:11px;color:var(--ha-text-sub)">ID ' + esc(fmtUid(me.id || 0)) + ' · 积分 ' + esc(me.points || 0) + '</div></div>';
                el.onclick = function (e) {
                    // 阻止冒泡：否则 document 级「点击菜单外关闭」会立刻把刚打开的菜单关掉
                    e = e || w.event;
                    if (e.stopPropagation) e.stopPropagation(); else e.cancelBubble = true;
                    self.toggleMeMenu();
                };
            } else {
                el.className = 'ha-me';
                el.onclick = null;
                el.innerHTML = avatarHtml('', this.cfg.actor.nickname, false, 'guest')
                    + '<div><div class="ha-me-name">' + esc(this.cfg.actor.nickname) + '</div></div>';
            }
        },


        /* ---------- 搜索窗（v1.2.31，替代原「品牌区竖三点」菜单） ----------
           v1.2.31 之前这里是 onBrandMenu 扩展点 + toggleBrandMenu（头像+昵称/联系人/插件项）。
           用户要求删除并改成搜索：**默认搜「当前聊天」**，下方可切换搜索范围。
           ⚠️ onBrandMenu 扩展点一并删除（全项目零引用，plugins/ 下无任何调用）；
              打开自己资料卡仍有入口 —— 侧栏底部资料区 #haMe（toggleMeMenu）。 */

        /**
         * 搜索范围（v1.2.32 调整顺序：找人/群 挪到最后）。
         * 顺序即标签条上的呈现顺序；插件追加的排在最后。
         *   current  当前聊天（默认）
         *   messages 全站消息
         *   friends  联系人
         *   people   找人/群
         */
        _srScopeDefs: [
            { id: 'current', label: '当前聊天' },
            { id: 'messages', label: '消息' },
            { id: 'friends', label: '好友' },
            { id: 'people', label: '找人/群' },
        ],
        _searchExt: [],       // 插件追加的自定义搜索范围

        /**
         * 插件扩展点：追加自定义搜索范围。
         * 回调签名 fn(defs, env)：
         *   - 只给 {id, label} → 走核心 doSearch（后端需认得这个 scope，否则结果为空）
         *   - 给 {id, label, run(self, keyword)} → 点击该标签时由插件自己搜、自己渲染，
         *     核心只负责把输入框的值传过去（适合要调自己接口、或结果结构不同的插件）
         * @example
         * HaChat.onSearchScopes(function (defs) {
         *     defs.push({ id: 'files', label: '文件', run: function (self, kw) { /* 自搜 *\/ } });
         * });
         */
        onSearchScopes: function (fn) { if (typeof fn === 'function') this._searchExt.push(fn); },

        /** 取范围定义表（含插件追加项） */
        searchScopes: function () {
            var defs = [], i;
            for (i = 0; i < this._srScopeDefs.length; i++) defs.push(this._srScopeDefs[i]);
            for (i = 0; i < this._searchExt.length; i++) {
                try { this._searchExt[i](defs, { actor: this.cfg.actor, me: this.cfg.me }); } catch (e) {}
            }
            return defs;
        },

        /** 打开搜索窗。scope 缺省为「当前聊天」 */
        openSearch: function (scope) {
            var self = this;
            // v1.2.32：游客不能搜索（没有会话体系，搜什么都是空的）
            if (!this.cfg.actor || this.cfg.actor.kind !== 'user') {
                toast('游客暂不支持搜索');
                return;
            }
            this._srScope = scope || 'current';
            this._srTimer = null;
            this._srSeq = 0;
            this._srData = [];
            var cur = this.searchContext();
            var hint = this._srScope === 'current'
                ? (cur ? ('在「' + cur.name + '」里搜索') : '当前没有打开的会话')
                : '输入关键词';
            var defs = this.searchScopes(), i;
            var scopeHtml = '';
            for (i = 0; i < defs.length; i++) {
                scopeHtml += '<button class="ha-tab' + (defs[i].id === this._srScope ? ' is-active' : '')
                    + '" data-scope="' + esc(defs[i].id) + '" type="button">' + esc(defs[i].label) + '</button>';
            }
            this.openModal(
                '<h3>搜索</h3>'
                + '<div class="ha-tabs ha-sr-scope" id="haSrScope">' + scopeHtml + '</div>'
                // v1.2.32：maxlength=50（与服务端 cleanSearchKey 一致）
                + '<input class="ha-input" id="haSrQ" maxlength="50" placeholder="' + esc(hint) + '" autocomplete="off">'
                + '<div class="ha-sr-list" id="haSrList"></div>'
            , 460);
            var q = $('haSrQ');
            this.renderSearchResults([]);
            if (!q) return;
            // 防抖 300ms（输入过程），回车立即搜一次
            q.oninput = function () {
                if (self._srTimer) clearTimeout(self._srTimer);
                self._srTimer = setTimeout(function () { self.doSearch(q.value); }, 300);
            };
            q.onkeydown = function (e) {
                e = e || w.event;
                if (e.keyCode === 13) { if (self._srTimer) clearTimeout(self._srTimer); self.doSearch(q.value); }
            };
            var bar = $('haSrScope');
            if (bar) bar.onclick = function (e) {
                var t = e.target || e.srcElement;
                while (t && t !== bar && !(t.getAttribute && t.getAttribute('data-scope'))) t = t.parentNode;
                if (!t || t === bar) return;
                var sc = t.getAttribute('data-scope');
                if (!sc || sc === self._srScope) return;
                self._srScope = sc;
                var bs = bar.getElementsByClassName('ha-tab'), i2;
                for (i2 = 0; i2 < bs.length; i2++) {
                    if (bs[i2].getAttribute('data-scope') === sc) bs[i2].className += ' is-active';
                    else bs[i2].className = bs[i2].className.replace(' is-active', '');
                }
                // 插件自定义范围：走它自己的 run（自搜自渲染）
                var defs2 = self.searchScopes(), j;
                for (j = 0; j < defs2.length; j++) {
                    if (defs2[j].id === sc && typeof defs2[j].run === 'function') {
                        self._srData = [];
                        self.renderSearchResults([]);
                        try { defs2[j].run(self, ($('haSrQ') || {}).value || ''); } catch (err) {}
                        return;
                    }
                }
                // v1.2.32：「在「群名」里搜索」这种**带上下文的提示只属于「当前聊天」**，
                // 切到其它范围必须换回普通提示（否则「在『综合闲聊』里搜索」下面
                // 列出全站消息，自相矛盾还误导用户）；切回来也要**恢复**上下文提示。
                var qi = $('haSrQ');
                if (qi) {
                    if (sc === 'current') {
                        var c2 = self.searchContext();
                        qi.placeholder = c2 ? ('在「' + c2.name + '」里搜索') : '当前没有打开的会话';
                    } else {
                        qi.placeholder = '输入关键词';
                    }
                }
                self.doSearch(qi ? qi.value : '');
            };
            setTimeout(function () { try { q.focus(); } catch (e) {} }, 30);
        },

        /** 当前搜索上下文：群聊给 room_id，私聊给 peer；都没有返回 null */
        searchContext: function () {
            if (this.dm) return { roomId: 0, peer: this.dm.peer, name: this.roomName || '私聊' };
            if (this.room) return { roomId: this.room, peer: '', name: this.roomName || '' };
            return null;
        },

        /**
         * 执行搜索（竞态保护：只认最后一次请求的结果，先回来的旧请求直接丢弃）
         *
         * v1.2.32 新增三道限制：
         *  ① **10 秒一次**：`_srLastAt` 记录上次发起时间，间隔不足直接提示并返回。
         *     服务端还有一层 10 秒 3 次的限流（防绕过前端直接打接口）。
         *  ② **输入长度**：输入框 maxlength=50（与服务端一致，服务端再截一次）。
         *  ③ **字符清洗**：去掉控制字符与 SQL/HTML 符号后再发（后端还会再洗一次）。
         */
        doSearch: function (kw) {
            var self = this;
            kw = String(kw == null ? '' : kw)
                .replace(/[\x00-\x1F\x7F<>"'`\\\/%&|;=$()[\]{}*?!#~^,]/g, '')   // 异常字符
                .replace(/\s+/g, ' ')
                .replace(/^\s+|\s+$/g, '');
            if (kw.length > 50) kw = kw.slice(0, 50);
            var list = $('haSrList');
            if (!kw) { this.renderSearchResults([]); return; }
            if (this._srScope === 'current' && !this.searchContext()) {
                // 中间是空白的（切到「联系人」标签后就是这状态）→ 明确告诉用户，别让人干等
                if (list) list.innerHTML = '<div class="ha-sr-empty">当前没有打开的聊天，请先点开一个会话，或切换上面的搜索范围</div>';
                return;
            }
            // ① 10 秒节流
            var now = new Date().getTime();
            if (this._srLastAt && now - this._srLastAt < 10000) {
                var wait = Math.ceil((10000 - (now - this._srLastAt)) / 1000);
                if (list) list.innerHTML = '<div class="ha-sr-empty">搜索太频繁，请 ' + wait + ' 秒后再试</div>';
                return;
            }
            this._srLastAt = now;
            var ctx = this.searchContext() || { roomId: 0, peer: '' };
            var mySeq = ++this._srSeq;
            if (list) list.innerHTML = '<div class="ha-sr-empty">搜索中…</div>';
            HaApi.post('search', {
                scope: this._srScope, q: kw,
                room_id: ctx.roomId || 0, peer: ctx.peer || ''
            }, function (r) {
                if (mySeq !== self._srSeq) return;
                if (!r.ok) { if (list) list.innerHTML = '<div class="ha-sr-empty">' + esc(r.msg || '搜索失败') + '</div>'; return; }
                self._srData = r.data || [];
                self.renderSearchResults(self._srData);
            });
        },

        /** 渲染搜索结果（用户 / 群 / 消息 三类行） */
        renderSearchResults: function (list) {
            var self = this, box = $('haSrList');
            if (!box) return;
            if (!list.length) {
                var kw = ($('haSrQ') || {}).value || '';
                box.innerHTML = '<div class="ha-sr-empty">' + (kw ? '没有找到相关内容' : '输入关键词开始搜索') + '</div>';
                return;
            }
            var html = '', i, d;
            for (i = 0; i < list.length; i++) {
                d = list[i];
                if (d.type === 'msg') {
                    html += '<div class="ha-sr-item is-msg" data-i="' + i + '">'
                        + avatarHtml('', d.from, true, 'guest')
                        + '<span class="ha-sr-main">'
                        + '<span class="ha-sr-title">' + esc(d.from) + '<span class="ha-sr-tag">' + (d.room_id ? '群聊' : '私聊') + '</span></span>'
                        + '<span class="ha-sr-sub">' + esc(d.text) + '</span>'
                        + '</span></div>';
                } else if (d.type === 'room') {
                    // v1.2.32：群也显示 ID（可按 ID 直接搜到群）
                    html += '<div class="ha-sr-item" data-i="' + i + '">'
                        + roomAvatarHtml(d.avatar, true, 'ha-cl-icon')
                        + '<span class="ha-sr-main">'
                        + '<span class="ha-sr-title">' + esc(d.name)
                        + '<span class="ha-sr-tag">ID ' + esc(fmtUid(d.room_id)) + '</span>'
                        + (d.need_password ? '<span class="ha-sr-tag">密码房</span>' : '')
                        + '</span>'
                        + '<span class="ha-sr-sub">' + (d.need_password ? '需要密码才能进入' : '点击进入群聊') + '</span>'
                        + '</span></div>';
                } else {
                    // v1.2.32：ID 提到**标题行**做标签（原来只在副行一行小字，
                    // 找特定用户时扫一眼标题看不到，还得逐条读完副行）
                    html += '<div class="ha-sr-item" data-i="' + i + '">'
                        + avatarHtml(d.avatar, d.nickname, true, d.role)
                        + '<span class="ha-sr-main">'
                        + '<span class="ha-sr-title">' + esc(d.nickname)
                        + '<span class="ha-sr-tag">ID ' + esc(fmtUid(d.user_id)) + '</span>'
                        + (d.is_friend ? '<span class="ha-sr-tag">好友</span>' : '')
                        + '</span>'
                        + '<span class="ha-sr-sub">' + esc(d.signature || ('用户 ID ' + fmtUid(d.user_id))) + '</span>'
                        + '</span></div>';
                }
            }
            box.innerHTML = html;
            box.onclick = function (e) {
                var t = e.target;
                while (t && t !== box && !(t.getAttribute && t.getAttribute('data-i'))) t = t.parentNode;
                if (!t || t === box) return;
                var idx = parseInt(t.getAttribute('data-i'), 10);
                if (self._srData && self._srData[idx]) self.pickSearchResult(self._srData[idx]);
            };
        },

        /** 点击搜索结果的分发：人 → 私聊，群 → 进群，消息 → 跳到所在会话 */
        pickSearchResult: function (d) {
            var self = this;
            if (d.type === 'user') {
                this.closeModal();
                this.openDm('user:' + d.user_id, d.nickname);
                return;
            }
            if (d.type === 'room') {
                var rl = this.cfg.rooms || [], i;
                for (i = 0; i < rl.length; i++) {
                    if (rl[i].id === d.room_id) {
                        this.closeModal();
                        this.switchRoom(d.room_id, rl[i].name, null);
                        return;
                    }
                }
                toast('该群聊当前不可进入');
                return;
            }
            // 消息结果：跳到**那条消息**并弹出它的操作菜单（v1.2.32）
            this.closeModal();
            if (this.view !== 'chat') this.switchTab('chat');
            if (d.room_id) {
                var rs = this.cfg.rooms || [];
                for (var k = 0; k < rs.length; k++) {
                    if (rs[k].id === d.room_id) { this.switchRoom(d.room_id, rs[k].name, null); break; }
                }
                if (k >= rs.length) { toast('该消息所在的群聊已不可进入'); return; }
            } else if (d.peer) {
                this.openDm(d.peer, this.dmNameOf(d.peer));
            } else {
                return;
            }
            this.jumpToMsg(d);
        },

        /**
         * 跳到指定消息：先在当前 DOM 里找，找不到就**回溯加载历史**直到那条出现，
         * 然后滚动居中 + 高亮 + 弹出该消息的操作菜单（v1.2.32）。
         *
         * ⚠️ 不复用 loadHistory：它带 `loadingHistory` 并发闸门且会按 scrollHeight
         * 回推视口，套进来容易出现「回调永不触发 → 定位静默失败」。这里自己按页拉，
         * 逻辑直白：拉一页 → 看有没有 → 没有就继续往前。
         */
        jumpToMsg: function (d) {
            var self = this;
            setTimeout(function () { self._tryLocateMsg(d.msg_id, 0); }, 700);
        },

        _tryLocateMsg: function (msgId, page) {
            var self = this, box = $('haMessages');
            if (!box) return;
            var node = $('haMsg' + msgId);
            if (!node) {
                // 最多回溯 15 页（≈450 条）；到顶还找不到就放弃并说明
                if (page >= 15 || this.historyDone) { toast('该消息太靠前，未能定位'); return; }
                var first = box.querySelector('.ha-msg');
                if (!first) { toast('未能定位到该消息'); return; }
                var firstId = parseInt(first.id.replace('haMsg', ''), 10);
                if (firstId <= msgId) { toast('该消息太靠前，未能定位'); return; }
                var isDm = !!this.dm;
                var peer = isDm ? this.dm.peer : '';
                HaApi.post(isDm ? 'dm_history' : 'history',
                    isDm ? { peer: peer, before_id: firstId } : { room_id: this.room, before: firstId },
                    function (r) {
                        // 已切走/已切私聊 → 丢弃，别把别处的消息插进来
                        if ((!!self.dm) !== isDm || (isDm && self.dm.peer !== peer)) return;
                        if (!r.ok || !r.data.length) { self.historyDone = true; self._tryLocateMsg(msgId, 99); return; }
                        var oldH = box.scrollHeight, i;
                        for (i = r.data.length - 1; i >= 0; i--) self.addMessageBefore(r.data[i], first);
                        box.scrollTop = box.scrollHeight - oldH;   // 保持视口不跳
                        if (r.data.length < 30) self.historyDone = true;
                        self._tryLocateMsg(msgId, page + 1);
                    });
                return;
            }
            this._focusMsgNode(node);
        },

        /** 滚动到某条消息 → 高亮 → 弹出它的操作菜单 */
        _focusMsgNode: function (node) {
            var self = this, box = $('haMessages');
            var r = node.getBoundingClientRect(), br = box.getBoundingClientRect();
            // 居中：把元素中心对到容器中心
            box.scrollTop += (r.top - br.top) - (box.clientHeight / 2) + (r.height / 2);
            // ⚠️ 必须在此闭包外抓 self：setTimeout 回调里的 this 是 undefined
            //（本文件是严格模式），写 this.msgCache 会抛
            // 「Cannot read properties of undefined」并中断后面的菜单弹出。
            setTimeout(function () {
                var rr = node.getBoundingClientRect();
                node.className += ' ha-msg-hit';
                setTimeout(function () {
                    node.className = node.className.replace(' ha-msg-hit', '');
                }, 2400);
                var m = self.msgCache[parseInt(node.id.replace('haMsg', ''), 10)];
                if (m) self.showContentMenu(Math.round(rr.left + Math.min(rr.width, 360)), Math.round(rr.top + 8), m);
            }, 60);
        },

        /**
         * 个人资料区操作菜单：复用消息右键菜单（haCtxMenu）的展示 / 委托点击 /
         * 点击外部与 Esc 关闭，向上弹出（资料区位于侧栏底部）。
         */        toggleMeMenu: function () {
            var self = this, me = this.cfg.me, menu = $('haCtxMenu');
            if (!me || !menu) return;
            // 再次点击资料区 = 收起
            if (menu.style.display !== 'none' && menu._from === 'me') { this.hideCtxMenu(); return; }
            var items = [
                { t: '创建群聊', run: function () { self.roomCreateModal(); } },
                { t: '设置', run: function () { self.openSettings(); } },
            ];
            if (this.cfg.actor.role === 'admin') items.push({ t: '管理后台', run: function () { location.href = '?page=admin'; } });
            items.push({ t: '退出登录', run: function () {
                self.confirmModal('确定退出登录吗？', function () {
                    HaApi.secure('logout', {}, function () { location.href = '?page=login'; });
                });
            } });
            this._ctxItems = items;
            menu._from = 'me';
            var html = '';
            for (var i = 0; i < items.length; i++) html += '<a href="javascript:;" data-i="' + i + '">' + esc(items[i].t) + '</a>';
            menu.innerHTML = html;
            menu.style.display = 'block';
            // 定位：贴着资料区上缘，左边对齐侧栏
            var r = $('haMe').getBoundingClientRect();
            var mh = menu.offsetHeight || items.length * 34;
            menu.style.left = Math.max(4, r.left) + 'px';
            menu.style.top = Math.max(4, r.top - mh - 8) + 'px';
        },

        openSettings: function () {
            var me = this.cfg.me;
            if (!me) return;
            this.openModal(
                '<h3>个人设置</h3>'
                // 头像置顶：点击当前头像即触发上传（不另设上传按钮）
                + '<div class="ha-set-avatar">'
                + '<span id="haSetAvatarPreview" class="ha-set-avatar-btn" title="点击更换头像" onclick="document.getElementById(\'haSetAvatarFile\').click()">'
                + avatarHtml(me.avatar, me.nickname, 'lg', me.role) + '</span>'
                + '<input type="file" id="haSetAvatarFile" accept="image/*" style="display:none">'
                + '</div>'
                + '<div class="ha-form-item"><label>昵称</label><input class="ha-input" id="haSetNick" value="' + esc(me.nickname) + '">'
                + '<p style="font-size:12px;color:#5C5C5C;margin-top:4px">2-20 个字符，支持中英文、数字、下划线与短横线，不含空格或 @；允许重名。</p></div>'
                + '<button class="ha-btn ha-btn-primary ha-btn-block" onclick="HaChat.saveSettings()">保存</button>'
            );
            var self = this;
            $('haSetAvatarFile').onchange = function () {
                if (!this.files || !this.files[0]) return;
                // 选完图不直接上传：先进入裁剪弹窗，由滑块手动缩放后再导出
                self.avatarCrop(this.files[0]);
                this.value = '';
            };
        },

        /* ---------- 头像裁剪：滑块手动缩放 + 圆形取景 ---------- */

        /** 裁剪目标边长（与服务端 Upload::AVATAR_SIZE 保持一致） */
        avatarCropSize: 100,

        /**
         * 打开裁剪弹窗：圆形取景框内即最终头像，拖动滑块缩放图片。
         * @param File file 用户选择的原始图片
         */
        /**
         * 独立裁剪浮层（参考论坛 dialog 方案）：不复用 haModal——
         * 裁剪时编辑弹窗 / 后台表单保持完好，裁剪完直接回填预览。
         */
        openCropOverlay: function (html) {
            this.closeCropOverlay();
            var mask = document.createElement('div');
            mask.className = 'ha-modal-mask';
            mask.id = 'haCropMask';
            mask.style.zIndex = '110';   // 盖在普通弹窗（z100）之上
            mask.innerHTML = '<div class="ha-modal" id="haCropModal">'
                + '<button class="ha-modal-close" onclick="HaChat.closeCropOverlay()">✕</button>' + html + '</div>';
            document.body.appendChild(mask);
        },

        closeCropOverlay: function () {
            var m = $('haCropMask');
            if (m && m.parentNode) m.parentNode.removeChild(m);
        },

        avatarCrop: function (file) {
            this._cropTarget = 'me';
            this.cropForTarget(file);
        },

        /** 群聊头像裁剪：复用同一裁剪弹窗，保存时上传到群聊头像 */
        roomAvatarCrop: function (file) {
            this._cropTarget = 'room';
            this.cropForTarget(file);
        },

        /** 按 _cropTarget 走裁剪流程（me=个人头像 / room=群聊头像） */
        cropForTarget: function (file) {
            var self = this;
            if (!w.FileReader || !document.createElement('canvas').getContext) {
                // 老浏览器无裁剪能力：退回直接上传，由服务端兜底裁方形
                if (this._cropTarget === 'room') self.roomAvatarUpload(file);
                else self.avatarUpload(file);
                return;
            }
            var reader = new FileReader();
            reader.onload = function (ev) {
                self.openCropOverlay(
                    '<h3>调整头像</h3>'
                    + '<div class="ha-crop-wrap"><canvas id="haCropCanvas" width="200" height="200"></canvas></div>'
                    + '<div class="ha-crop-ctrl">'
                    + '<input type="range" id="haCropZoom" min="1" max="3" step="0.01" value="1">'
                    + '<span class="ha-crop-val" id="haCropVal">100%</span>'
                    + '</div>'
                    + '<div class="ha-modal-actions">'
                    + '<button class="ha-btn ha-btn-ghost" onclick="HaChat.avatarCropCancel()">取消</button>'
                    + '<button class="ha-btn ha-btn-primary" onclick="HaChat.avatarCropSave()">确定</button></div>'
                );
                var canvas = $('haCropCanvas'), zoom = $('haCropZoom'), val = $('haCropVal');
                var ctx = canvas.getContext('2d');
                var SIZE = canvas.width;                 // 200：取景框即 canvas 本身
                var img = new Image();
                var draw = function () {
                    if (!img.width || !ctx) return;
                    ctx.clearRect(0, 0, SIZE, SIZE);
                    ctx.fillStyle = '#fff';              // 白底：透明区转 jpg 不返黑
                    ctx.fillRect(0, 0, SIZE, SIZE);
                    // cover 基准：铺满画布所需最小缩放；滑块在此基础上 1~3 倍
                    var base = Math.max(SIZE / img.width, SIZE / img.height);
                    var z = parseFloat(zoom.value);
                    if (!isFinite(z) || z < 1) z = 1;
                    var s2 = base * z;
                    var dw = img.width * s2, dh = img.height * s2;
                    ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
                    val.textContent = Math.round(z * 100) + '%';
                };
                img.onload = function () { draw(); };
                img.src = String(ev.target.result);
                zoom.oninput = draw;
                zoom.onchange = draw;                    // 老浏览器无 input 事件时兜底
            };
            reader.readAsDataURL(file);
        },

        /**
         * 当前会话是否拥有「删除他人消息」的权限（v1.1.14）。
         * 口径与服务端 deleteMessage() 完全一致：超级管理员 + 本群群主。
         * 取自 rooms() 下发的 can_edit（其定义就是「群主 + 超管」），私聊无 can_edit → false。
         * ⚠️ 不用 cfg.actor.role 在这里另判一套，避免前后台口径漂移。
         */
        canRemoveOthers: function () {
            if (this.dm || !this.room) return false;
            var list = this.cfg.rooms || [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === this.room) return !!list[i].can_edit;
            }
            return false;
        },

        /**
         * 右键「消息内容」的菜单：复制 / 引用 / 撤回 / 删除。
         * 插件可通过 HaChat.onMsgContent 追加项（如翻译、举报、复制原文…）。
         *
         * v1.2.4 语义彻底对调（勿回退）：
         *   - **撤回** = 真正的删除，**全局生效**（所有人都不再看到），需满足撤回条件
         *     （自己发的 5 分钟内，或群主 / 超管处理违规内容）；
         *   - **删除** = 一律只在本机隐藏，**任何身份都是**（含超级管理员），
         *     别人照常看得到、换设备不生效。
         *
         * 因此删除入口**无条件对所有已登录用户开放**（不再判 canRemove）：
         * 它只是「我不想看这条」的私人视图行为，不涉及他人，故不存在越权问题。
         * 需要清除内容时走「撤回」——那条才有权限与时效约束。
         */
        showContentMenu: function (x, y, m) {
            var self = this, admin = this.cfg.actor.role === 'admin', items = [];
            if (!m.recalled && !m.deleted) {
                items.push({ t: '复制', run: function () { self.copyMsg(m); } });
                if (m.type === 'image' && this.cfg.actor.kind === 'user')
                    items.push({ t: '收藏为贴纸', run: function () { self.collect(m.content); } });
                if (this.cfg.actor.kind !== 'none')
                    items.push({ t: '引用', run: function () { self.quoteMsg(m); } });
                // 撤回 = 全局真删除，仅在满足条件时给入口（服务端还会再判一次）
                if (m.mine || admin || this.canRemoveOthers())
                    items.push({ t: '撤回', run: function () { self.recall(m.id); } });
                // 删除 = 本机隐藏，仅对已登录用户有意义：游客身份不落库，删了刷新就没
                if (this.cfg.actor.kind === 'user')
                    items.push({ t: '删除', run: function () { self.deleteMsg(m.id); } });
                for (var i = 0; i < this._ctxExtContent.length; i++) {
                    try { this._ctxExtContent[i](items, m, { roomId: this.room, actor: this.cfg.actor }); } catch (e) {}
                }
            }
            this._ctxItems = items;
            if (!items.length) return;
            var menu = $('haCtxMenu'), html = '', i2;
            menu._from = 'msg';
            for (i2 = 0; i2 < items.length; i2++) html += '<a href="javascript:;" data-i="' + i2 + '">' + esc(items[i2].t) + '</a>';
            menu.innerHTML = html;
            menu.style.display = 'block';
            var vw = w.innerWidth || document.documentElement.clientWidth, vh = w.innerHeight || document.documentElement.clientHeight;
            var mw = menu.offsetWidth || 140, mh = menu.offsetHeight || items.length * 32;
            menu.style.left = Math.max(4, x + mw > vw ? x - mw : x) + 'px';
            menu.style.top = Math.max(4, y + mh > vh ? y - mh : y) + 'px';
        },

        /** 插件扩展点：右键消息「内容」时追加菜单项 */
        onMsgContent: function (fn) { if (typeof fn === 'function') this._ctxExtContent.push(fn); },

        /** 复制消息内容（图片/文件消息复制其可读文本） */
        copyMsg: function (m) {
            var text = m.type === 'file' ? (function () {
                try { return JSON.parse(m.content).name || m.content; } catch (e) { return m.content; }
            })() : m.content;
            text = String(text || '');
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;top:0';
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            toast(ok ? '已复制' : '复制失败，请手动选择文本');
        },

        /**
         * 引用消息：在输入框上方生成引用条（可点 × 取消）；发送时随消息提交。
         * 触发 msg.quote 钩子，插件可改写引用内容。
         */
        quoteMsg: function (m) {
            var text = m.type === 'image' ? '[图片]' : (m.type === 'file' ? (function () {
                try { return '[文件] ' + (JSON.parse(m.content).name || ''); } catch (e) { return '[文件]'; }
            })() : String(m.content || ''));
            var q = { nick: m.nickname || '', text: text, id: m.id || 0 };
            for (var i = 0; i < this._quoteExt.length; i++) {
                try { this._quoteExt[i](q, m); } catch (e) {}
            }
            this.quote = { nick: String(q.nick || '').slice(0, 40), text: String(q.text || '').slice(0, 120), id: q.id || 0 };
            this.renderQuote();
            var input = $('haInput');
            if (input) input.focus();
        },

        /** 渲染 / 清除输入框上方的引用条 */
        renderQuote: function () {
            var box = $('haQuoteBar');
            if (!box) return;
            var q = this.quote;
            var input = $('haInput');
            // 有引用时输入框顶部留白，让引用条独占输入框内第一行
            if (input) {
                if (q && (q.nick || q.text)) input.className = 'ha-input ha-has-quote';
                else input.className = 'ha-input';
                this.autoGrow();   // padding 变化后重算高度
            }
            if (!q || (!q.nick && !q.text)) { this.quote = null; box.style.display = 'none'; box.innerHTML = ''; return; }
            box.style.display = 'block';
            box.innerHTML = '<div class="ha-quote-inner"><span class="ha-quote-nick">' + esc(q.nick) + '：</span>'
                + '<span class="ha-quote-text">' + esc(q.text) + '</span>'
                + '<button class="ha-quote-del" type="button" title="取消引用" onclick="HaChat.clearQuote()">✕</button></div>';
        },

        /** 取消引用 */
        clearQuote: function () { this.quote = null; this.renderQuote(); },

        /**
         * 触发群头像文件选择（群聊设置弹窗内的隐藏 input，v1.1.10）
         */
        roomAvatarPick: function () { var f = $('haRoomAvatarFile'); if (f) f.click(); },

        /**
         * 保存群聊设置（群聊设置弹窗内的表单，v1.1.10）
         *
         * v1.1.1~v1.1.9 表单内联在侧栏，保存后不关任何浮层；v1.1.10 恢复弹窗形态，
         * 因此保存成功必须 closeModal()，否则弹窗会盖在已更新的界面上继续显示旧数据。
         */
        roomEditSave: function (id) {
            var self = this;
            var nameEl = $('haRoomEditName'), descEl = $('haRoomEditDesc');
            if (!nameEl || !descEl) { toast('请先打开群聊设置弹窗'); return; }
            HaApi.post('room_update', {
                id: id,
                name: nameEl.value,
                description: descEl.value,
                avatar: this._roomAvatar || '',
                // v1.1.11 公开性：只在有开关时提交，避免别处复用本函数时误改
                is_public: $('haRoomPublic') ? ($('haRoomPublic').checked ? '1' : '0') : null
            }, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                toast('群聊信息已更新');
                self.closeModal();
                self.reloadRooms();
            });
        },

        /** 重新拉取群聊列表并重渲染 */
        reloadRooms: function () {
            var self = this;
            HaApi.post('rooms', {}, function (r) {
                if (!r.ok) return;
                self.cfg.rooms = r.data;
                // v1.1.0：列表已改为「群聊+私聊」聚合，走 conversations 重新拉取，
                // 直接 renderRooms 会把私聊行冲掉。
                self.loadConversations();
                // 群资料已变（名称/简介/头像）→ 顶栏群名与侧栏入口区同步刷新。
                // _roomAvatar 不用动：保存后它与服务端值一致；openRoomEdit / renderRoomPanel
                // 都只在「换了群」时才重置它（见 _roomAvatarRoom 判断）。
                self.renderRoomPanel();
            });
        },

        /**
         * 点击引用块 → 滚动到被引用的原消息并高亮闪烁。
         *
         * v1.2.6：原消息还没被懒加载到时，**自动往前拉**直到找到为止
         * （此前只能提示「请加载更早的消息」，但入口节点已移除，那样等于死路）。
         * 找不到时最多连拉 HISTORY_JUMP_MAX 页，避免无意义的无限翻页。
         */
        jumpToQuote: function (msgId) {
            var self = this;
            var tryJump = function () {
                var el = $('haMsg' + msgId);
                if (!el) return false;
                try {
                    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                } catch (e) {
                    // 老浏览器无 smooth 参数：手动滚动到居中
                    var box = $('haMessages'), r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
                    box.scrollTop += r.top - br.top - br.height / 2 + r.height / 2;
                }
                el.classList.remove('ha-msg-jump');
                // 强制重排以重启动画
                void el.offsetWidth;
                el.classList.add('ha-msg-jump');
                setTimeout(function () { el.classList.remove('ha-msg-jump'); }, 1800);
                return true;
            };
            if (tryJump()) return;

            var n = 0, max = 10;
            var pull = function () {
                if (self.historyDone || n >= max) {
                    if (!tryJump()) toast('原消息在更早的历史里，已加载到底');
                    return;
                }
                n++;
                self.loadHistory(function () {
                    if (tryJump()) return;
                    pull();          // 这一批里没有，继续往前拉
                });
            };
            pull();
        },

        /**
         * 删除消息（内容右键）
         *
         * v1.2.4：**删除 = 一律只在本机隐藏**，任何身份都是（含超级管理员）。
         * 别人照常看得到、消息仍在库里、换设备登录也不生效。
         * 真的删除走「撤回」（全局生效），见 recall()。
         *
         * 确认框必须写明「仅本机」：否则用户会以为所有人都看不到了，那是欺骗。
         * 移除 hideOnly 参数——已无权限分档，无需前端传期望值。
         */
        deleteMsg: function (id) {
            var self = this;
            var text = '确定删除这条消息吗？删除后仅本机不再看到，其他人不受影响。';
            this.confirmModal(text, function () {
                HaApi.secure('msg_delete', { id: id }, function (r) {
                    if (!r.ok) { toast(r.msg); return; }
                    var el = $('haMsg' + id);
                    if (el && el.parentNode) el.parentNode.removeChild(el);
                    delete self.msgCache[id];
                    // 本机隐藏只影响消息区，不影响会话摘要，无需重拉
                    toast(r.msg || '已删除（仅本机不再看到）');
                });
            });
        },

        /** 取消裁剪：仅关闭独立裁剪浮层（底下的弹窗/表单保持原状） */
        avatarCropCancel: function () {
            this.closeCropOverlay();
        },

        /** 按当前缩放导出正方形头像并上传（上传后仍需点「保存」写入资料） */
        avatarCropSave: function () {
            var self = this, canvas = $('haCropCanvas');
            if (!canvas) { toast('裁剪弹窗已关闭'); return; }
            var done = function (blob) {
                self.closeCropOverlay();
                if (!blob) { toast('当前浏览器无法处理图片，请更换浏览器'); return; }
                if (self._cropTarget === 'room') self.roomAvatarUpload(blob, 'room.jpg');
                else self.avatarUpload(blob, 'avatar.jpg');
            };
            if (canvas.toBlob) {
                canvas.toBlob(function (b) { done(b); }, 'image/jpeg', 0.9);
            } else {
                // 老浏览器：toDataURL → 手工转 Blob
                var b64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1] || '';
                var bin = w.atob ? w.atob(b64) : '';
                var arr = new Uint8Array(bin.length), i;
                for (i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                done(new Blob([arr], { type: 'image/jpeg' }));
            }
        },

        /**
         * 通用头像上传（复用用户头像上传 API：kind=avatar，服务端统一裁 100x100）。
         * 上传成功后调用 onOk(url)；UI 行为由调用方决定（个人头像 / 群聊头像）。
         */
        uploadAvatarBlob: function (file, filename, onOk) {
            var fd = new FormData();
            var s = HaApi.sign('upload');
            fd.append('ts', s.ts);
            fd.append('sign', s.sign);
            fd.append('kind', 'avatar');
            fd.append('file', file, filename || (file.name || 'avatar.jpg'));
            var x = new XMLHttpRequest();
            x.open('POST', '?action=upload', true);
            x.onreadystatechange = function () {
                if (x.readyState !== 4) return;
                var r = null;
                try { r = JSON.parse(x.responseText); } catch (e) {}
                r = r || { ok: false, msg: '网络错误' };
                if (!r.ok) { toast(r.msg); return; }
                if (onOk) onOk(r.url);
            };
            x.onerror = function () { toast('上传失败，请重试'); };
            x.send(fd);
        },

        /**
         * 上传个人头像（file 可为 File 或 canvas 导出的 Blob），成功后刷新全部预览。
         *
         * v1.1.8：改为**回填所有可能出现头像预览的容器** —— 个人设置弹窗
         * （#haSetAvatarPreview）与自己的资料卡（#haCardAvatarPreview）。
         * 原先只回填前者，于是从资料卡上传后，卡片里的头像还是旧图
         * （必须关掉再打开才刷新），而资料卡恰恰是最新的入口。
         * 裁剪 → 导出 → 上传 → 回填这一整条链路由 cropForTarget / avatarCropSave
         * 与本方法共享，群聊头像另走 roomAvatarUpload 但复用 uploadAvatarBlob。
         */
        avatarUpload: function (file, filename) {
            var self = this;
            try {
                self.uploadAvatarBlob(file, filename, function (url) {
                    self.cfg.me.avatar = url;
                    // 设置弹窗预览
                    var pv = $('haSetAvatarPreview');
                    if (pv) pv.innerHTML = avatarHtml(url, self.cfg.me.nickname, 'lg', self.cfg.me.role);
                    // 自己的资料卡预览
                    var cv = $('haCardAvatarPreview');
                    if (cv) cv.innerHTML = avatarHtml(url, self.cfg.me.nickname, 'lg', self.cfg.me.role);
                    self.renderMe();
                    toast('头像已上传，点击保存生效');
                });
            } catch (e) {
                toast('上传失败，请重试');
            }
        },

        /** 上传群聊头像：右侧栏内回显（保存时随 room_update 提交） */
        roomAvatarUpload: function (file, filename) {
            var self = this;
            self.uploadAvatarBlob(file, filename, function (url) {
                self._roomAvatar = url;
                var pv = $('haRoomAvatarPreview');
                if (pv) {
                    // 侧栏用头像组件，后台表单用图片预览（裁剪浮层独立，两者都完好）
                    // v1.1.19：群头像统一走 roomAvatarHtml（此处必有 url，行为与原来一致，
                    // 只是组件口径统一，将来加默认图时不会漏掉这一处）。
                    if (pv.getAttribute('class').indexOf('ha-set-avatar-btn') >= 0)
                        pv.innerHTML = roomAvatarHtml(url, false);
                    else
                        pv.innerHTML = '<img src="' + esc(url) + '" alt="">';
                }
                toast('群头像已上传，点击保存生效');
            });
        },

        saveSettings: function () {
            var self = this;
            HaApi.post('profile_save', {
                nickname: $('haSetNick').value,
                avatar: this.cfg.me.avatar || ''
            }, function (r) {
                toast(r.msg);
                if (r.ok) { self.cfg.me.nickname = $('haSetNick').value; self.renderMe(); self.closeModal(); }
            });
        },

        /* ---------- 弹层 ---------- */
        /** 打开弹窗；width 可选（px），供内容较宽的弹窗（如群公告页面）覆盖默认 380px */
        openModal: function (html, width) {
            // 后台页（HaAdmin）没有静态浮层：动态补建（closeModal 同样兼容）
            if (!$('haModalMask') || !$('haModal')) {
                var mask = document.createElement('div');
                mask.className = 'ha-modal-mask';
                mask.id = 'haModalMask';
                mask.style.display = 'none';
                mask.innerHTML = '<div class="ha-modal" id="haModal"></div>';
                document.body.appendChild(mask);
            }
            $('haModal').style.maxWidth = width ? (parseInt(width, 10) + 'px') : '';
            $('haModal').innerHTML = '<button class="ha-modal-close" onclick="HaChat.closeModal()">✕</button>' + html;
            $('haModalMask').style.display = '-webkit-flex';
            $('haModalMask').style.display = 'flex';
        },
        closeModal: function () { $('haModalMask').style.display = 'none'; },

        /** 自研确认弹窗（v1.0.112 前台版）：替代原生 confirm——全站禁止浏览器原生弹窗 */
        confirm: function (text, onOk) {
            var mask = document.createElement('div');
            mask.className = 'ha-modal-mask';
            mask.style.display = 'flex';
            mask.style.zIndex = 200;   // 叠在普通弹窗（z-index 100）之上
            mask.innerHTML = '<div class="ha-modal" style="width:340px;max-width:92%">'
                + '<button class="ha-modal-close">✕</button>'
                + '<h3>确认操作</h3>'
                + '<p class="ha-modal-desc">' + esc(text).replace(/\n/g, '<br>') + '</p>'
                + '<div class="ha-modal-actions">'
                + '<button class="ha-btn ha-btn-ghost">取消</button>'
                + '<button class="ha-btn ha-btn-danger">确定</button></div></div>';
            document.body.appendChild(mask);
            var close = function () { if (mask.parentNode) document.body.removeChild(mask); };
            mask.querySelector('.ha-modal-close').onclick = close;
            var bs = mask.querySelectorAll('.ha-modal-actions .ha-btn');
            bs[0].onclick = close;
            bs[1].onclick = function () { close(); if (onOk) onOk(); };
            mask.onclick = function (e) { if (e.target === mask) close(); };
        },
    };

    /* ==========================================================================
       HaAdmin：管理后台
       ========================================================================== */
    var HaAdmin = {
        /**
         * 通用确认弹窗（与前台 confirmModal 同一样式，v1.0.50）。
         * 所有删除 / 卸载 / 禁用等危险操作统一调用，不再使用原生 confirm。
         */
        /* ---------- 通用列表组件（v1.0.84）：分页条 / 多选批量计数，供各管理页复用 ---------- */

        /**
         * 分页条。go 回调接收新页码。
         * @param string|Element el 分页容器
         */
        uiPager: function (el, page, total, size, go) {
            el = typeof el === 'string' ? $(el) : el;
            if (!el) return;
            var pages = Math.max(1, Math.ceil(total / size));
            if (pages <= 1) {
                el.innerHTML = '<span style="font-size:12px;color:var(--ha-text-sub)">共 ' + total + ' 条</span>';
                return;
            }
            var h = '<div class="ha-pager">';
            if (page > 1) h += '<button type="button" class="ha-btn ha-btn-ghost" data-pg="' + (page - 1) + '">上一页</button>';
            // 数字页码：当前页前后各 2 页，首末页与区间之间用省略号
            var start = Math.max(1, page - 2), end = Math.min(pages, page + 2);
            if (start > 1) {
                h += '<button type="button" class="ha-btn ha-btn-ghost" data-pg="1">1</button>';
                if (start > 2) h += '<span class="ha-pager-dots">…</span>';
            }
            for (var i = start; i <= end; i++) {
                h += '<button type="button" class="ha-btn ' + (i === page ? 'ha-btn-primary' : 'ha-btn-ghost') + '"' + (i === page ? ' disabled' : '') + ' data-pg="' + i + '">' + i + '</button>';
            }
            if (end < pages) {
                if (end < pages - 1) h += '<span class="ha-pager-dots">…</span>';
                h += '<button type="button" class="ha-btn ha-btn-ghost" data-pg="' + pages + '">' + pages + '</button>';
            }
            if (page < pages) h += '<button type="button" class="ha-btn ha-btn-ghost" data-pg="' + (page + 1) + '">下一页</button>';
            // 页码跳转：输入页码回车直接跳
            h += '<span class="ha-pager-jump">跳至<input type="number" class="ha-pager-jump-input" min="1" max="' + pages + '" value="' + page + '">页</span>';
            h += '<span class="ha-pager-info">共 ' + total + ' 条</span>';
            h += '</div>';
            el.innerHTML = h;
            var btns = el.getElementsByTagName('button');
            for (var b = 0; b < btns.length; b++) {
                btns[b].onclick = function () {
                    var pg = parseInt(this.getAttribute('data-pg'), 10);
                    if (pg >= 1 && pg <= pages && pg !== page) go(pg);
                };
            }
            var jump = el.querySelector('.ha-pager-jump-input');
            if (jump) {
                var doJump = function () {
                    var v = parseInt(jump.value, 10);
                    if (v >= 1 && v <= pages && v !== page) go(v); else jump.value = page;
                };
                jump.onkeydown = function (e) { e = e || window.event; if (e.key === 'Enter' || e.keyCode === 13) doJump(); };
                jump.onchange = doJump;
            }
        },

        /**
         * 多选批量计数与按钮启停。约定：行复选框 class=chkCls，按钮 id 在 btnIds。
         * @return number 已选数量
         */
        uiBatchSync: function (chkCls, btnIds, statEl, base) {
            var boxes = document.getElementsByClassName(chkCls), n = 0;
            for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) n++;
            for (var j = 0; j < btnIds.length; j++) { var b = $(btnIds[j]); if (b) b.disabled = n === 0; }
            if (statEl) {
                statEl = typeof statEl === 'string' ? $(statEl) : statEl;
                if (statEl) statEl.textContent = n ? base + '，已选 ' + n + ' 条' : base;
            }
            return n;
        },

        confirm: function (text, onOk) {
            var mask = document.createElement('div');
            mask.className = 'ha-modal-mask';
            mask.style.display = 'flex';
            mask.innerHTML = '<div class="ha-modal" style="width:340px;max-width:92%">'
                + '<button class="ha-modal-close">✕</button>'
                + '<h3>确认操作</h3>'
                + '<p class="ha-modal-desc">' + esc(text).replace(/\n/g, '<br>') + '</p>'
                + '<div class="ha-modal-actions">'
                + '<button class="ha-btn ha-btn-ghost">取消</button>'
                + '<button class="ha-btn ha-btn-danger">确定</button></div></div>';
            document.body.appendChild(mask);
            var close = function () { if (mask.parentNode) document.body.removeChild(mask); };
            mask.querySelector('.ha-modal-close').onclick = close;
            var bs = mask.querySelectorAll('.ha-modal-actions .ha-btn');
            bs[0].onclick = close;
            bs[1].onclick = function () { close(); if (onOk) onOk(); };
            mask.onclick = function (e) { if (e.target === mask) close(); };
        },
        init: function (opt) {
            HaApi.key = opt.key;
            HaApi.setServerTime(opt.ts);
            var menu = $('haAdminMenu'), self = this;
            // 移动端抽屉：顶栏汉堡开合 + 遮罩点击收起 + 回到桌面宽度自动复位
            var side = $('haAdminSide'), mask = $('haAdminMask');
            var setSide = function (open) {
                if (!side) return;
                side.className = 'ha-admin-side' + (open ? ' open' : '');
                if (mask) mask.style.display = open ? 'block' : 'none';
            };
            if ($('haAdminToggle')) $('haAdminToggle').onclick = function () { setSide(side.className.indexOf('open') < 0); };
            if (mask) mask.onclick = function () { setSide(false); };
            window.onresize = function () {
                if ((document.documentElement.clientWidth || window.innerWidth || 1024) > 720) setSide(false);
            };
            var items = menu.getElementsByTagName('li'), i;
            // 记忆当前页面：启停插件等操作刷新后停留在原页面，而不是跳回默认页
            var remember = function (ap) {
                try { sessionStorage.setItem('haAdminPage', ap); } catch (e) {}
            };
            for (i = 0; i < items.length; i++) {
                items[i].onclick = function () {
                    var ap = this.getAttribute('data-apage'), all = menu.getElementsByTagName('li'), j;
                    // ① 只摘掉选中态，保留分组/子项/展开等布局类（否则子菜单会被一起抹掉）
                    for (j = 0; j < all.length; j++) {
                        all[j].className = trimCls(all[j].className.replace(/\bactive\b/g, ''));
                    }
                    // ② 插件分类：点标题自行折叠/展开；点插件子页面时保持展开
                    if (ap === 'plugins') self.togglePluginSub(false);
                    else if (ap.indexOf('plugin:') === 0) self.togglePluginSub(true);
                    // ③ 选中态最后加，避免被上面的类名重置覆盖
                    this.className += ' active';
                    remember(ap);
                    self.page(ap);
                    setSide(false);   // 移动端点完菜单收起抽屉
                };
            }
            /* 恢复上次所在页面（启停插件刷新后不跳回默认页）；无记录时进群聊管理 */
            var lastPage = 'rooms';
            try { lastPage = sessionStorage.getItem('haAdminPage') || 'rooms'; } catch (e) {}
            try { if (sessionStorage.getItem('haAdminPluginsOpen') === '1') self.togglePluginSub(true); } catch (e) {}
            // 摘掉服务端预置的默认选中态（rooms），避免双高亮
            var all0 = menu.getElementsByTagName('li'), k0;
            for (k0 = 0; k0 < all0.length; k0++) {
                all0[k0].className = trimCls(all0[k0].className.replace(/\bactive\b/g, ''));
            }
            if (menu.querySelector('li[data-apage="' + lastPage + '"]')) {
                if (lastPage.indexOf('plugin:') === 0) self.togglePluginSub(true);
                var li0 = menu.querySelector('li[data-apage="' + lastPage + '"]');
                li0.className += ' active';
                this.page(lastPage);
            } else {
                this.page('rooms');
            }
        },

        /**
         * 展开/收起「插件管理」下的插件子页面
         * @param {boolean} forceOpen true=强制展开（点击插件子页面时用），false=切换
         */
        togglePluginSub: function (forceOpen) {
            var menu = $('haAdminMenu'), all = menu.getElementsByTagName('li'), i, el, group = null;
            for (i = 0; i < all.length; i++) {
                if (all[i].className.indexOf('ha-admin-group') >= 0) { group = all[i]; break; }
            }
            if (!group) return;   // 没有任何插件声明后台页面 → 插件管理是普通菜单项
            var willOpen = forceOpen ? true : group.className.indexOf('ha-group-open') < 0;
            group.className = trimCls((group.className.replace(/\bow-group-open\b/g, ''))
                + (willOpen ? ' ha-group-open' : ''));
            for (i = 0; i < all.length; i++) {
                el = all[i];
                if (el.className.indexOf('ha-admin-sub') < 0) continue;
                el.className = trimCls((el.className.replace(/\bow-sub-open\b/g, ''))
                    + (willOpen ? ' ha-sub-open' : ''));
            }
            // 记录展开状态：刷新后恢复
            try {
                if (willOpen) sessionStorage.setItem('haAdminPluginsOpen', '1');
                else sessionStorage.removeItem('haAdminPluginsOpen');
            } catch (e) {}
        },

        page: function (name) {
            var main = $('haAdminMain');
            var M = HaAdmin.pages[name];
            // 移动端适配：主区内任何表格自动套横滚容器（含异步渲染与插件页）
            if (!main._tableObserver) {
                main._tableObserver = new MutationObserver(function () {
                    var tables = main.querySelectorAll('table.ha-table');
                    for (var i = 0; i < tables.length; i++) {
                        var t = tables[i];
                        if (t.parentNode.className !== 'ha-table-wrap') {
                            var w = document.createElement('div');
                            w.className = 'ha-table-wrap';
                            t.parentNode.insertBefore(w, t);
                            w.appendChild(t);
                        }
                    }
                });
                main._tableObserver.observe(main, { childList: true, subtree: true });
            }
            if (name.indexOf('plugin:') === 0) {
                HaApi.post('admin_plugin_page', { slug: name.substr(7) }, function (r) {
                    main.innerHTML = r.ok ? r.html : '<div class="ha-card">' + esc(r.msg) + '</div>';
                });
                return;
            }
            if (M) M(main);
        },

        pages: {
            /* 用户管理（v1.0.44）、禁言管理（v1.0.52）、系统公告（v1.0.102）、
               敏感词过滤（v1.0.104）已剥离为插件，见 plugins/ 对应目录 */
            plugins: function (main) {
                HaApi.post('admin_plugins', {}, function (r) {
                    var h = '<h2>插件管理</h2><p class="ha-admin-desc">安装（上传 zip）、启用 / 停用、下载与卸载插件。插件存放于 plugins/ 目录。</p>'
                        + '<div class="ha-card ha-upload-row">'
                        + '<input type="file" id="haPluginZip" accept=".zip" style="display:none">'
                        + '<button type="button" class="ha-btn ha-btn-ghost" onclick="document.getElementById(\'haPluginZip\').click()">选择文件</button>'
                        + '<span class="ha-upload-name" id="haPluginZipName">未选择文件</span>'
                        + '<button type="button" class="ha-btn ha-btn-primary" style="margin-left:auto" onclick="HaAdmin.pluginInstall()">上传安装</button>'
                        + '</div>'
                        + '<div class="ha-plugin-list">';
                    for (var i = 0; i < r.data.length; i++) {
                        var d = r.data[i];
                        h += '<div class="ha-plugin-card">'
                           + '<div class="ha-plugin-head"><b>' + esc(d.name) + '</b>'
                           + (d.enabled ? '<span class="ha-tag ha-tag-green">启用</span>' : '<span class="ha-tag ha-tag-guest">未启用</span>') + '</div>'
                           + '<div class="ha-plugin-meta">' + esc(d.id) + ' · v' + esc(d.version) + ' · ' + esc(d.source || '本地')
                           // 计划任务数放在最前：它是「这个插件会自己在后台动什么」的规模指标，
                           // 比「注册了几个函数」更值得管理员先看到（v1.1.13）
                           + ' · 计划任务 ' + (d.crons || 0)
                           + ' · 钩子 ' + (d.hooks || 0) + ' · 路由 ' + (d.routes || 0) + ' · 后台页 ' + (d.pages || 0) + '</div>'
                           + '<div class="ha-plugin-desc">' + esc(d.description || '') + '</div>'
                           + '<div class="ha-plugin-actions">'
                           + '<button class="ha-btn ha-btn-primary" onclick="HaAdmin.pluginToggle(\'' + esc(d.id) + '\',1)"' + (d.enabled ? ' disabled' : '') + '>启用</button>'
                           + '<button class="ha-btn ha-btn-ghost" onclick="HaAdmin.pluginToggle(\'' + esc(d.id) + '\',0)"' + (d.enabled ? '' : ' disabled') + '>停用</button>'
                           + '<a class="ha-btn ha-btn-ghost" href="?action=admin_plugin_download&name=' + esc(d.id) + '">下载</a>'
                           + '<button class="ha-btn ha-btn-ghost" onclick="HaAdmin.pluginUninstall(\'' + esc(d.id) + '\')">卸载</button>'
                           + '</div></div>';
                    }
                    if (!r.data.length) h += '<div class="ha-card" style="color:#5C5C5C">暂无插件</div>';
                    main.innerHTML = h + '</div>';
                    /* 自研上传控件：隐藏原生 file input，选择后回显文件名 */
                    var zip = $('haPluginZip');
                    if (zip) zip.onchange = function () {
                        var name = $('haPluginZipName');
                        if (this.files && this.files[0]) {
                            name.textContent = this.files[0].name;
                            name.className = 'ha-upload-name ha-has-file';
                        } else {
                            name.textContent = '未选择文件';
                            name.className = 'ha-upload-name';
                        }
                    };
                });
            },
            rooms: function (main) {
                // 群聊审核（v1.0.84）：服务端分页 + 搜索 + 多选批量 + 回收站可撤销
                HaAdmin._roomPage = 1;
                HaAdmin._roomTrashPage = 1;
                main.innerHTML = '<h2>群聊审核</h2><p class="ha-admin-desc">对群聊做合规处置：名称 / 头像不合法可重置，违规群聊可封禁或删除。所有处置均可在回收站撤销。</p>'
                    + '<div class="ha-card"><div class="ha-form-row">'
                    + '<div class="ha-form-item" style="min-width:120px"><label>房主用户ID</label>'
                    + '<input class="ha-input" id="haRVRoomOwner" type="number" min="0" placeholder="0=全部" value="0" onkeydown="if(event.key===\'Enter\')HaAdmin.roomLoad(1)"></div>'
                    + '<div class="ha-form-item" style="min-width:120px"><label>群聊ID</label>'
                    + '<input class="ha-input" id="haRVRoomId" type="number" min="0" placeholder="0=全部" value="0" onkeydown="if(event.key===\'Enter\')HaAdmin.roomLoad(1)"></div>'
                    + '<button class="ha-btn ha-btn-primary" onclick="HaAdmin.roomLoad(1)">搜索</button>'
                    + '<button class="ha-btn ha-btn-ghost" onclick="HaAdmin.roomResetFilter()">重置</button>'
                    + '</div></div>'
                    + '<div class="ha-card">'
                    + '<div class="ha-admin-batch">'
                    + '<button class="ha-btn ha-btn-ghost" id="haRVBatchName" onclick="HaAdmin.roomBatch(\'reset_name\')" disabled>批量重置名称</button>'
                    + '<button class="ha-btn ha-btn-ghost" id="haRVBatchAvatar" onclick="HaAdmin.roomBatch(\'reset_avatar\')" disabled>批量重置头像</button>'
                    + '<button class="ha-btn ha-btn-ghost" id="haRVBatchBan" onclick="HaAdmin.roomBatch(\'toggle_status\')" disabled>批量封禁</button>'
                    + '<button class="ha-btn ha-btn-danger" id="haRVBatchDel" onclick="HaAdmin.roomBatch(\'delete\')" disabled>批量删除</button>'
                    + '<span id="haRVStat" style="color:var(--ha-text-sub);font-size:12px"></span>'
                    + '</div>'
                    + '<div class="ha-table-wrap"><table class="ha-table" id="haRVTable"></table></div>'
                    + '<div id="haRVPager" style="margin-top:10px"></div></div>'
                    + '<div class="ha-card"><h3 style="margin:0 0 10px;font-size:14px">审核回收站</h3>'
                    + '<div class="ha-table-wrap"><table class="ha-table" id="haRoomTrash"></table></div>'
                    + '<div id="haTrashPager" style="margin-top:10px"></div>'
                    + '<p style="font-size:12px;color:#5C5C5C;margin:8px 0 0">撤销有顺序依赖：群聊被删除后，需先撤销「删除」才能恢复其之前的名称 / 头像 / 封禁状态。</p></div>';
                HaAdmin.roomLoad(1);
                HaAdmin.roomTrashLoad(1);
            },
logs: function (main) {
                HaApi.post('admin_logs', {}, function (r) {
                    var h = '<h2>安全日志</h2><p class="ha-admin-desc">记录登录、注册等关键操作的 IP 与请求数据（已脱敏）。</p>'
                        + '<div class="ha-card"><table class="ha-table"><tr><th>ID</th><th>动作</th><th>操作者</th><th>IP</th><th>数据</th><th>时间</th></tr>';
                    for (var i = 0; i < r.data.length; i++) {
                        var d = r.data[i];
                        h += '<tr><td>' + d.id + '</td><td>' + esc(d.action) + '</td><td>' + esc(d.actor || '') + '</td><td>' + esc(d.ip || '') + '</td>'
                           + '<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(d.data || '') + '</td>'
                           + '<td>' + new Date(d.created_at * 1000).toLocaleString() + '</td></tr>';
                    }
                    main.innerHTML = h + '</table></div>';
                });
            },
            /* 计划任务（v1.1.13）：插件通过 Plugin::cron() 声明式注册的任务。
               与旧的 cron.minute 钩子不同——那些任务在这里不可见、不可控。
               任务表只显示「已注册」的：插件停用后其任务仍在表里但每次都会被跳过，
               服务端用 plugin_active 标记，前端据此隐藏启停开关（避免给一个必然被跳过的
               任务提供「启用」按钮）。 */
            cron: function (main) {
                HaAdmin._cronPage = 1;
                HaAdmin.cronLoad(main);
            },
            settings: function (main) {
                HaApi.post('admin_settings_get', {}, function (r) {
                    var d = r.data;
                    function sel(k, opts) {
                        var h = '<select class="ha-input" id="haS_' + k + '">';
                        for (var v in opts) h += '<option value="' + v + '"' + (d[k] === v ? ' selected' : '') + '>' + opts[v] + '</option>';
                        return h + '</select>';
                    }
                    main.innerHTML = '<h2>系统设置</h2><p class="ha-admin-desc">站点、注册控制、游客与发言限制、存储方式。</p><div class="ha-card">'
                        + '<div class="ha-form-item"><label>站点名称</label><input class="ha-input" id="haS_site_name" value="' + esc(d.site_name || '') + '"></div>'
                        + '<div class="ha-form-item"><label>固定网站地址</label><input class="ha-input" id="haS_site_url" value="' + esc(d.site_url || '') + '" placeholder="留空自动识别"></div>'
                        + '<div class="ha-form-row">'
                        + '<div class="ha-form-item"><label>开放注册</label>' + sel('allow_register', { '1': '开放', '0': '关闭' }) + '</div>'
                        + '<div class="ha-form-item"><label>注册需邮箱验证</label>' + sel('reg_email_verify', { '1': '需要', '0': '不需要' }) + '</div>'
                        + '<div class="ha-form-item"><label>游客可浏览</label>' + sel('guest_browse', { '1': '允许', '0': '禁止' }) + '</div>'
                        + '<div class="ha-form-item"><label>游客可发言</label>' + sel('guest_chat', { '1': '允许', '0': '禁止' }) + '</div>'
                        + '</div><div class="ha-form-row">'
                        + '<div class="ha-form-item"><label>游客发言间隔(秒)</label><input class="ha-input" id="haS_guest_msg_interval" value="' + esc(d.guest_msg_interval || '30') + '"></div>'
                        + '<div class="ha-form-item"><label>发言频率窗口(秒)</label><input class="ha-input" id="haS_msg_rate_window" value="' + esc(d.msg_rate_window || '10') + '"></div>'
                        + '<div class="ha-form-item"><label>窗口内最大条数</label><input class="ha-input" id="haS_msg_rate_max" value="' + esc(d.msg_rate_max || '8') + '"></div>'
                        + '<div class="ha-form-item"><label>邮件发送间隔(秒)</label><input class="ha-input" id="haS_mail_rate_limit" value="' + esc(d.mail_rate_limit || '60') + '"></div>'
                        + '</div>'
                        + '<div class="ha-form-item"><label>密码房通行缓存(秒)</label><input class="ha-input" id="haS_room_pass_ttl" value="' + esc(d.room_pass_ttl || '1800') + '">'
                        + '<p style="font-size:12px;color:#5C5C5C;margin-top:4px">验证一次密码后，该时间内进入同一房间无需重复输入；填 0 表示每次进入都要输入。</p></div>'
                        + '<div class="ha-form-row">'
                        + '<div class="ha-form-item"><label>登录失败几次后要求验证码</label><input class="ha-input" id="haS_login_fail_captcha" value="' + esc(d.login_fail_captcha || '3') + '"></div>'
                        + '<div class="ha-form-item"><label>登录失败几次后锁定</label><input class="ha-input" id="haS_login_fail_lock" value="' + esc(d.login_fail_lock || '10') + '"></div>'
                        + '<div class="ha-form-item"><label>锁定时长(分钟)</label><input class="ha-input" id="haS_login_lock_minutes" value="' + esc(d.login_lock_minutes || '15') + '"></div>'
                        + '</div>'
                        + '<div class="ha-form-item"><label>注册最低年龄(周岁)</label><input class="ha-input" id="haS_min_register_age" value="' + esc(d.min_register_age || '0') + '">'
                        + '<p style="font-size:12px;color:#5C5C5C;margin-top:4px">填 0 表示不限制；填 18 则注册时必须选择出生日期且年满 18 周岁（按日期精确计算）。</p></div>'
                        + '<div class="ha-form-row">'
                        + '<div class="ha-form-item"><label>允许上传文件</label>' + sel('file_upload', { '1': '允许', '0': '禁止' }) + '</div>'
                        + '<div class="ha-form-item"><label>单文件大小上限(MB)</label><input class="ha-input" id="haS_file_max_size" value="' + esc(d.file_max_size || '10') + '"></div>'
                        + '</div>'
                        + '<div class="ha-form-item"><label>允许的文件扩展名</label><input class="ha-input" id="haS_file_exts" value="' + esc(d.file_exts || 'zip,rar,7z,pdf,txt,md,doc,docx,xls,xlsx,ppt,pptx,mp3,mp4') + '">'
                        + '<p style="font-size:12px;color:#5C5C5C;margin-top:4px">逗号分隔。只有内置安全类型表内登记过的扩展名才会生效；'
                        + 'svg/php/html 等可执行或可内嵌脚本的类型不予登记（即使填了也不会放行）。</p></div>'
                        + '<p style="font-size:12px;color:#5C5C5C;margin-bottom:12px">登录保护：验证码填错也计入失败次数（保证锁定可达），锁定按「账号+IP」记录，成功后清零。全部填 0 表示关闭对应保护。</p>'
                        + '<div class="ha-form-row">'
                        + '<div class="ha-form-item"><label>允许用户创建群聊</label>' + sel('room_create_allow', { '1': '允许', '0': '仅管理员' }) + '</div>'
                        + '<div class="ha-form-item"><label>创建群聊扣除积分</label><input class="ha-input" id="haS_room_create_cost" value="' + esc(d.room_create_cost || '0') + '"></div>'
                        + '</div>'
                        // v1.1.14 仅邀请群总闸：与「允许用户创建群聊」正交 ——
                        // 那个管能不能建群，这个管建出来的群能不能藏起来。
                        + '<div class="ha-form-item"><label>允许用户创建仅邀请群聊</label>'
                        + sel('room_private_create_allow', { '1': '允许', '0': '仅管理员' }) + '</div>'
                        + '<p style="font-size:12px;color:#5C5C5C;margin-bottom:12px">创建群聊：填 0 表示免费创建；管理员创建始终免费。用户创建的群聊 owner 归属创建者，可在群聊管理中调整。<br>'
                        // v1.1.18：这里原本写「只能创建普通群聊」，指的是**公开性**
                        // （is_public），不是房间类型，已改为「公开群聊」。
                        // 教训：公开性的中文不能叫「普通」，会与 type=public 的「普通」撞词。
                        + '仅邀请群聊只靠邀请链接传播，不出现在任何列表里。关闭后普通用户只能创建公开群聊，'
                        + '已存在的仅邀请群仍可正常改名、改简介（仅禁止把公开群改成仅邀请）；管理员始终不受此限制。</p>'
                        // v1.2.2 消息服务器保留期：到期即物理清除（附件同步删），无法恢复
                        + '<div class="ha-form-item"><label>消息服务器保留期(天)</label><input class="ha-input" id="haS_msg_retain_days" value="' + esc(d.msg_retain_days || '90') + '"></div>'
                        + '<p style="font-size:12px;color:#5C5C5C;margin:4px 0 12px">超过本期限的消息会被<b>物理删除</b>，其附件文件（uploads/file/）一并删除，<b>删除后无法恢复</b>。默认 90 天（约三个月）。填 0 表示永久保留。<br>'
                        + '「<b>删除</b>」只在本机生效（仅你看不到，别人照常看得到）；「<b>撤回</b>」才是全局删除，所有人都不再显示且不可恢复。</p>'
                        + '<div class="ha-form-item"><label>新消息提示音默认</label>' + sel('sound_default', { '1': '开', '0': '关' }) + '</div>'
                        + '<button class="ha-btn ha-btn-primary" onclick="HaAdmin.settingsSave()">保存设置</button></div>';
                });
            },
            /* 禁言管理自 v1.0.52 起剥离为插件 ban-manager，页面与交互见 plugins/ban-manager/ */
        },

        /* ---------- 用户管理动作已随 v1.0.44 剥离为插件（HaUM，plugins/user-manager/） ---------- */

        /* ---------- 房间动作 ---------- */
        /** 群聊审核动作：重置名称 / 恢复默认头像 / 封禁解封 */
        /** 审核回收站：列出最近处置，可撤销 */
        roomTrash: function () {
            HaApi.post('admin_room_trash_list', {}, function (r) {
                var el = document.getElementById('haRoomTrash');
                if (!el) return;
                var ACT = { reset_name: '重置名称', reset_avatar: '重置头像', toggle_status: '封禁/解封', delete: '删除' };
                if (!r.data.length) { el.innerHTML = '<span style="font-size:13px;color:#5C5C5C">暂无审核记录</span>'; return; }
                var h = '<table class="ha-table"><tr><th>时间</th><th>群聊</th><th>操作</th><th>操作前</th><th>状态</th><th></th></tr>';
                for (var i = 0; i < r.data.length; i++) {
                    var d = r.data[i];
                    var before = d.before_data && d.before_data.row ? '（整条群聊记录）'
                        : (d.before_data && typeof d.before_data === 'object' ? esc(Object.keys(d.before_data).map(function (k) { return k + '=' + d.before_data[k]; }).join('，')) : '-');
                    h += '<tr><td>' + new Date(d.created_at * 1000).toLocaleString() + '</td>'
                       + '<td>' + esc(d.room_name) + '（' + esc(fmtUid(d.room_id)) + '）</td>'
                       + '<td>' + esc(ACT[d.action] || d.action) + '</td>'
                       + '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + before + '</td>'
                       + '<td>' + (d.undone == 1 ? '<span style="color:#5C5C5C">已撤销</span>' : '-') + '</td>'
                       + '<td>' + (d.undone == 1 ? '' : '<a href="javascript:;" onclick="HaAdmin.roomTrashUndo(' + d.id + ')">撤销</a>') + '</td></tr>';
                }
                el.innerHTML = h + '</table>'
                    + '<p style="font-size:12px;color:#5C5C5C;margin:8px 0 0">撤销有顺序依赖：群聊被删除后，需先撤销「删除」才能恢复其之前的名称 / 头像 / 封禁状态。</p>';
            });
        },
        roomTrashUndo: function (id) {
            HaAdmin.confirm('确定撤销该审核操作？', function () {
                HaApi.secure('admin_room_trash_undo', { id: id }, function (r) {
                    toast(r.msg);
                    if (r.ok) { HaAdmin.roomTrashLoad(HaAdmin._roomTrashPage || 1); HaAdmin.roomLoad(HaAdmin._roomPage || 1); }
                });
            });
        },
        /* ---------- 群聊审核：搜索过滤 / 多选批量（v1.0.83） ---------- */

        /** 按房主ID / 群聊ID 过滤并渲染表格 */
        roomLoad: function (page) {
            this._roomPage = page || this._roomPage || 1;
            var self = this;
            HaApi.post('admin_rooms', {
                page: this._roomPage, size: 20,
                owner: ($('haRVRoomOwner') || {}).value || 0,
                rid: ($('haRVRoomId') || {}).value || 0
            }, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                var d = r.data;
                self._roomAll = d.list;
                var h = '';
                for (var i = 0; i < d.list.length; i++) {
                    var d2 = d.list[i];
                    var av = d2.avatar
                        ? '<img src="' + esc(d2.avatar) + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block">'
                        : '<span style="display:block;width:28px;height:28px;border-radius:50%;background:var(--ha-bg-sub);color:var(--ha-text-sub);font-size:12px;line-height:28px;text-align:center">' + esc(d2.name.charAt(0)) + '</span>';
                    h += '<tr><td><input type="checkbox" class="haRVChk" value="' + d2.id + '" onchange="HaAdmin.roomSyncBatch()"></td>'
                       + '<td>' + esc(fmtUid(d2.id)) + '</td><td>' + av + '</td><td>' + esc(d2.name) + '</td>'
                       + '<td>' + (d2.owner_id ? esc(fmtUid(d2.owner_id)) : '-') + '</td>'
                       + '<td>' + (d2.status == 1 ? '正常' : '<span style="color:#C41D1F">已封禁</span>') + '</td>'
                       + '<td style="white-space:nowrap">'
                       + '<a href="javascript:;" onclick="HaAdmin.roomReview(' + d2.id + ',\'reset_name\')">名称不合法</a> '
                       + '<a href="javascript:;" onclick="HaAdmin.roomReview(' + d2.id + ',\'reset_avatar\')">头像不合法</a> '
                       + '<a href="javascript:;" onclick="HaAdmin.roomReview(' + d2.id + ',\'toggle_status\')">' + (d2.status == 1 ? '封禁' : '解封') + '</a> '
                       + '<a href="javascript:;" onclick="HaAdmin.roomDel(' + d2.id + ')">删除</a></td></tr>';
                }
                $('haRVTable').innerHTML = '<tr><th style="width:32px"><input type="checkbox" id="haRVCheckAll" onchange="HaAdmin.roomToggleAll(this)"></th>'
                    + '<th>ID</th><th>头像</th><th>名称</th><th>房主ID</th><th>状态</th><th>操作</th></tr>'
                    + (h || '<tr><td colspan="7" style="color:var(--ha-text-sub)">无匹配的群聊</td></tr>');
                self.uiPager('haRVPager', d.page, d.total, d.size, function (pg) { self.roomLoad(pg); });
                self.roomSyncBatch();
            });
        },

        roomResetFilter: function () {
            $('haRVRoomOwner').value = '0';
            $('haRVRoomId').value = '0';
            this.roomLoad(1);
        },

        roomToggleAll: function (cb) {
            var boxes = document.getElementsByClassName('haRVChk');
            for (var i = 0; i < boxes.length; i++) boxes[i].checked = cb.checked;
            this.roomSyncBatch();
        },

        roomSyncBatch: function () {
            this.uiBatchSync('haRVChk', ['haRVBatchName', 'haRVBatchAvatar', 'haRVBatchBan', 'haRVBatchDel'], 'haRVStat', '共 ' + ((this._roomAll || []).length) + ' 条');
        },

        /** 批量审核（v1.0.83 补实现 v1.0.91）：act = reset_name / reset_avatar / toggle_status / delete */
        roomBatch: function (act) {
            var boxes = document.getElementsByClassName('haRVChk'), ids = [];
            for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) ids.push(parseInt(boxes[i].value, 10) || 0);
            if (!ids.length) { toast('未选择群聊'); return; }
            var ACT = { reset_name: '批量重置名称', reset_avatar: '批量重置头像', toggle_status: '批量封禁/解封', delete: '批量删除' };
            var self = this;
            this.confirm('确定对已选 ' + ids.length + ' 个群聊执行「' + (ACT[act] || act) + '」？', function () {
                HaApi.secure('admin_room_batch', { act: act, ids: ids.join(',') }, function (r) {
                    toast(r.msg);
                    if (r.ok) {
                        self.roomLoad(self._roomPage || 1);
                        self.roomTrashLoad(self._roomTrashPage || 1);
                    }
                });
            });
        },

        /** 审核回收站：服务端分页列出最近处置，可撤销 */
        roomTrashLoad: function (page) {
            this._roomTrashPage = page || this._roomTrashPage || 1;
            var self = this;
            HaApi.post('admin_room_trash_list', { page: this._roomTrashPage, size: 20 }, function (r) {
                var el = document.getElementById('haRoomTrash');
                if (!el || !r.ok) return;
                var d = r.data;
                var ACT = { reset_name: '重置名称', reset_avatar: '重置头像', toggle_status: '封禁/解封', delete: '删除' };
                if (!d.list.length) { el.innerHTML = '<tr><td colspan="6" style="color:var(--ha-text-sub)">暂无审核记录</td></tr>'; }
                else {
                    var h = '';
                    for (var i = 0; i < d.list.length; i++) {
                        var t = d.list[i];
                        var before = t.before_data && t.before_data.row ? '（整条群聊记录）'
                            : (t.before_data && typeof t.before_data === 'object' ? esc(Object.keys(t.before_data).map(function (k) { return k + '=' + t.before_data[k]; }).join('，')) : '-');
                        h += '<tr><td>' + new Date(t.created_at * 1000).toLocaleString() + '</td>'
                           + '<td>' + esc(t.room_name) + '（' + esc(fmtUid(t.room_id)) + '）</td>'
                           + '<td>' + esc(ACT[t.action] || t.action) + '</td>'
                           + '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + before + '</td>'
                           + '<td>' + (t.undone == 1 ? '<span style="color:#5C5C5C">已撤销</span>' : '-') + '</td>'
                           + '<td>' + (t.undone == 1 ? '' : '<a href="javascript:;" onclick="HaAdmin.roomTrashUndo(' + t.id + ')">撤销</a>') + '</td></tr>';
                    }
                    el.innerHTML = h;
                }
                self.uiPager('haTrashPager', d.page, d.total, d.size, function (pg) { self.roomTrashLoad(pg); });
            });
        },

        roomReview: function (id, act) {
            var tips = {
                reset_name: '确定该群聊名称不合法？将重置为「未命名群聊」。',
                reset_avatar: '确定该群聊头像不合法？将恢复默认头像。',
                toggle_status: ''
            };
            var run = function () {
                HaApi.post('admin_room_review', { id: id, act: act }, function (r) {
                    toast(r.msg);
                    if (r.ok) { HaAdmin.roomTrashLoad(HaAdmin._roomTrashPage || 1); HaAdmin.roomLoad(HaAdmin._roomPage || 1); }
                });
            };
            if (tips[act]) HaAdmin.confirm(tips[act], run);
            else run();
        },
        roomDel: function (id) {
            HaAdmin.confirm('确定删除该群聊？删除后可在「审核回收站」撤销恢复。', function () {
                HaApi.secure('admin_room_del', { id: id }, function (r) { toast(r.msg); HaAdmin.page('rooms'); });
            });
        },

        /* ---------- 计划任务（v1.1.13） ---------- */

        /* 状态徽标：ok 成功 / error 失败 / skip 跳过（插件未启用）。
           ⚠️ 只用 CSS 里真实存在的 ha-tag-*：green / owner / vip / member / guest / title。
           没有 ha-tag-red、没有 ha-tag-gray —— 别臆造，会静默退化成无背景的裸文字。
           失败借用 owner（橙红，视觉上最接近警示），跳过用 member（灰）。 */
        _cronStatusTag: function (s) {
            var map = { ok: 'green', error: 'owner', skip: 'member' };
            var cn = { ok: '成功', error: '失败', skip: '跳过' };
            return '<span class="ha-tag ha-tag-' + (map[s] || 'guest') + '">' + esc(cn[s] || s || '—') + '</span>';
        },

        /* 把相对时间说人话：刚刚 / N 分钟前 / N 小时前 / 具体日期 */
        _cronAgo: function (ts) {
            ts = parseInt(ts, 10) || 0;
            if (!ts) return '从未执行';
            var d = Math.floor((Date.now() / 1000 - ts) / 60);
            if (d < 1) return '刚刚';
            if (d < 60) return d + ' 分钟前';
            if (d < 1440) return Math.floor(d / 60) + ' 小时前';
            if (d < 10080) return Math.floor(d / 1440) + ' 天前';
            return new Date(ts * 1000).toISOString().slice(0, 10);
        },

        cronLoad: function (main) {
            var page = HaAdmin._cronPage || 1;
            main = main || $('haAdminMain');
            HaApi.post('admin_cron_list', { page: page, psize: 30 }, function (r) {
                if (!r.ok) { main.innerHTML = '<div class="ha-card">' + esc(r.msg) + '</div>'; return; }

                var lastRun = r.last_run ? HaAdmin._cronAgo(r.last_run) : '从未执行';
                var h = '<h2>计划任务</h2>'
                  + '<p class="ha-admin-desc">插件通过 <code>Plugin::cron()</code> 声明式注册的任务。'
                  + '由长轮询每分钟驱动一次（多进程下有排他锁，不会重复执行），也可挂系统计划任务访问触发地址。'
                  + '「立即执行」会忽略到期时间强制跑一遍，便于验证任务是否正常。</p>'
                  + '<div class="ha-card" style="margin-bottom:12px">'
                  + '<div class="ha-form-row" style="align-items:center;gap:10px">'
                  + '<button type="button" class="ha-btn ha-btn-primary" onclick="HaAdmin.cronRun()">立即执行全部</button>'
                  + '<button type="button" class="ha-btn ha-btn-ghost" onclick="HaAdmin.cronToken()">重置触发令牌</button>'
                  + '<button type="button" class="ha-btn ha-btn-ghost" onclick="HaAdmin.cronClearLogs()">清理 30 天前日志</button>'
                  + '<span style="margin-left:auto;color:#5C5C5C;font-size:12px">最近一次执行：' + esc(lastRun) + '</span>'
                  + '</div>'
                  + '<div class="ha-form-row" style="margin-top:10px">'
                  + '<div style="flex:1;min-width:0">'
                  + '<label style="display:block;font-size:12px;color:#5C5C5C;margin-bottom:4px">外部触发地址（系统计划任务用，间隔建议 1 分钟）</label>'
                  + '<input class="ha-input" readonly value="' + esc(HaAdmin._cronUrl(r.token)) + '" onclick="this.select()">'
                  + '</div></div></div>';

                /* ---- 任务表 ---- */
                h += '<div class="ha-card"><table class="ha-table"><tr>'
                  + '<th>任务</th><th>说明</th><th>间隔</th><th>下次执行</th><th>最近执行</th><th>状态</th><th>操作</th></tr>';
                if (!r.tasks.length) {
                    h += '<tr><td colspan="7" style="color:#5C5C5C">暂无计划任务。插件在 main.php 顶层调用 Plugin::cron() 注册后，刷新本页即会出现。</td></tr>';
                }
                for (var i = 0; i < r.tasks.length; i++) {
                    var t = r.tasks[i];
                    h += '<tr>'
                       + '<td><b>' + esc(t.plugin ? t.plugin + '::' + t.name : t.name) + '</b>'
                       +   (t.due ? ' <span class="ha-tag ha-tag-owner">待执行</span>' : '')
                       +   '<div style="color:#8A8A8A;font-size:12px">已运行 ' + (parseInt(t.run_count, 10) || 0) + ' 次</div></td>'
                       + '<td>' + esc(t.description || '—') + '</td>'
                       + '<td>' + esc(t.interval_text) + '</td>'
                       + '<td>' + esc(t.next_run_text) + '</td>'
                       + '<td>' + esc(t.last_run_text) + (t.last_status ? ' ' + HaAdmin._cronStatusTag(t.last_status) : '') + '</td>'
                       + '<td>' + (t.enabled ? '<span class="ha-tag ha-tag-green">启用</span>' : '<span class="ha-tag ha-tag-guest">停用</span>')
                       +   (t.plugin_active ? '' : '<div style="color:#F4995D;font-size:12px">插件未启用</div>') + '</td>'
                       + '<td>';
                    if (t.plugin_active) {
                        h += '<button class="ha-btn ha-btn-mini ' + (t.enabled ? 'ha-btn-ghost' : 'ha-btn-primary') + '"'
                           + ' onclick="HaAdmin.cronToggle(' + (parseInt(t.id, 10) || 0) + ')">'
                           + (t.enabled ? '停用' : '启用') + '</button>';
                    }
                    h += '</td></tr>';
                }
                h += '</table></div>';

                /* ---- 执行日志 ---- */
                h += '<h2 style="margin-top:20px">执行日志</h2><div class="ha-card"><table class="ha-table"><tr>'
                  + '<th>任务</th><th>结果</th><th>耗时</th><th>信息</th><th>时间</th></tr>';
                if (!r.logs.length) {
                    h += '<tr><td colspan="5" style="color:#5C5C5C">暂无执行记录</td></tr>';
                }
                for (var j = 0; j < r.logs.length; j++) {
                    var g = r.logs[j];
                    h += '<tr><td>' + esc(g.name) + '</td>'
                       + '<td>' + HaAdmin._cronStatusTag(g.status) + '</td>'
                       + '<td>' + (parseInt(g.duration, 10) || 0) + ' ms</td>'
                       + '<td>' + esc(g.message || '—') + '</td>'
                       + '<td>' + esc(new Date(parseInt(g.created_at, 10) * 1000).toISOString().slice(0, 19).replace('T', ' ')) + '</td></tr>';
                }
                h += '</table>';
                if (r.pages > 1) {
                    h += '<div class="ha-form-row" style="margin-top:10px;justify-content:center;gap:8px">'
                       + '<button class="ha-btn ha-btn-ghost ha-btn-mini" ' + (page <= 1 ? 'disabled' : '')
                       + ' onclick="HaAdmin.cronPage(' + (page - 1) + ')">上一页</button>'
                       + '<span style="font-size:12px;color:#5C5C5C">第 ' + page + ' / ' + r.pages + ' 页 · 共 ' + r.log_total + ' 条</span>'
                       + '<button class="ha-btn ha-btn-ghost ha-btn-mini" ' + (page >= r.pages ? 'disabled' : '')
                       + ' onclick="HaAdmin.cronPage(' + (page + 1) + ')">下一页</button></div>';
                }
                h += '</div>';

                main.innerHTML = h;
            });
        },

        _cronUrl: function (token) {
            var base = location.origin + location.pathname + '?action=cron';
            return token ? base + '&token=' + encodeURIComponent(token) : base;
        },
        cronPage: function (p) {
            HaAdmin._cronPage = Math.max(1, p);
            HaAdmin.cronLoad();
        },
        /* 启停：敏感操作，走一次性票据（HaApi.secure），不能用普通 post */
        cronToggle: function (id) {
            HaApi.secure('admin_cron_toggle', { id: id }, function (r) {
                toast(r.msg);
                if (r.ok) HaAdmin.cronLoad();
            });
        },
        cronRun: function () {
            HaAdmin.confirm('立即执行全部已启用的计划任务？\n忽略到期时间，任务可能包含清理类操作。', function () {
                HaApi.secure('admin_cron_run', {}, function (r) {
                    toast(r.msg);
                    if (r.ok) {
                        // 失败详情单独提示，否则「执行 3 个，失败 1 个」看不出是哪个挂了
                        var bad = [];
                        for (var i = 0; i < (r.results || []).length; i++) {
                            if (r.results[i].status !== 'ok') bad.push(r.results[i].name + '：' + (r.results[i].message || r.results[i].status));
                        }
                        if (bad.length) toast(bad.join('；'), 'err');
                        HaAdmin.cronLoad();
                    }
                });
            });
        },
        cronToken: function () {
            HaAdmin.confirm('重置外部触发令牌？\n旧地址立即失效，已配置的系統计划任务需要更新为新地址。', function () {
                HaApi.secure('admin_cron_token', {}, function (r) {
                    toast(r.msg);
                    if (r.ok) HaAdmin.cronLoad();
                });
            });
        },
        cronClearLogs: function () {
            HaAdmin.confirm('清理 30 天前的执行日志？该操作不可恢复。', function () {
                HaApi.secure('admin_cron_logs_clear', { days: 30 }, function (r) {
                    toast(r.msg);
                    if (r.ok) HaAdmin.cronLoad();
                });
            });
        },

        /* ---------- 其他动作（banAdd/banDel 已随 v1.0.52 剥离为插件 ban-manager；
           wordAdd/wordToggle/wordDel 已随 v1.0.104 剥离为插件 sensitive-words） ---------- */
        /* 系统公告管理（v1.0.102）已随公告剥离为 announcements 插件 */
        pluginToggle: function (name, en) {
            HaApi.post('admin_plugin_toggle', { name: name, enabled: en }, function (r) {
                toast(r.msg);
                // 启停改变侧栏子菜单与可用页面，整页刷新保证状态一致
                setTimeout(function () { location.reload(); }, 500);
            });
        },
        /* 卸载：删除插件目录，二次确认后执行 */
        pluginUninstall: function (name) {
            HaAdmin.confirm('确定卸载插件「' + name + '」吗？\n将停用并删除 plugins/' + name + ' 目录，不可恢复！', function () {
                HaApi.secure('admin_plugin_uninstall', { name: name }, function (r) {
                    toast(r.msg);
                    setTimeout(function () { location.reload(); }, 500);
                });
            });
        },
        pluginInstall: function () {
            var f = $('haPluginZip');
            if (!f.files || !f.files[0]) { toast('请选择 zip 文件'); return; }
            HaApi.upload('admin_plugin_install', f.files[0], {}, function (r) { toast(r.msg); if (r.ok) HaAdmin.page('plugins'); });
        },
        settingsSave: function () {
            HaApi.post('admin_settings_save', {
                site_name: $('haS_site_name').value,
                site_url: $('haS_site_url') ? $('haS_site_url').value : '',
                allow_register: $('haS_allow_register').value,
                reg_email_verify: $('haS_reg_email_verify').value,
                guest_browse: $('haS_guest_browse').value,
                guest_chat: $('haS_guest_chat').value,
                guest_msg_interval: $('haS_guest_msg_interval') ? $('haS_guest_msg_interval').value : '',
                // v1.2.2 消息服务器保留期（天），0 = 永久保留
                msg_retain_days: $('haS_msg_retain_days') ? $('haS_msg_retain_days').value : '',
                msg_rate_window: $('haS_msg_rate_window').value,
                msg_rate_max: $('haS_msg_rate_max').value,
                mail_rate_limit: $('haS_mail_rate_limit').value,
                room_pass_ttl: $('haS_room_pass_ttl') ? $('haS_room_pass_ttl').value : '',
                min_register_age: $('haS_min_register_age') ? $('haS_min_register_age').value : '',
                file_upload: $('haS_file_upload') ? $('haS_file_upload').value : '',
                file_max_size: $('haS_file_max_size') ? $('haS_file_max_size').value : '',
                file_exts: $('haS_file_exts') ? $('haS_file_exts').value : '',
                room_create_allow: $('haS_room_create_allow') ? $('haS_room_create_allow').value : '',
                room_create_cost: $('haS_room_create_cost') ? $('haS_room_create_cost').value : '',
                room_private_create_allow: $('haS_room_private_create_allow') ? $('haS_room_private_create_allow').value : '',
                login_fail_captcha: $('haS_login_fail_captcha') ? $('haS_login_fail_captcha').value : '',
                login_fail_lock: $('haS_login_fail_lock') ? $('haS_login_fail_lock').value : '',
                login_lock_minutes: $('haS_login_lock_minutes') ? $('haS_login_lock_minutes').value : '',
                sound_default: $('haS_sound_default').value
            }, function (r) { toast(r.msg); });
        }
    };

    w.HaAuth = HaAuth;
    w.HaChat = HaChat;
    w.HaAdmin = HaAdmin;
    w.HaApi = HaApi;   // 暴露给插件脚本（如用户管理插件 HaUM）使用
    // 通用助手同样暴露：插件脚本与主程序共用渲染与提示
    w.esc = esc; w.toast = toast; w.fmtUid = fmtUid; w.opts = opts; w.ROLE_CN = ROLE_CN;
    // 开关（State 按钮）通用轮子：前后台与插件共用同一套 HTML 与绑定逻辑
    w.switchHtml = switchHtml; w.bindSwitches = bindSwitches;
})(window);
