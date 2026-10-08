/* 第三方应用授权 · 前端（oauth-core 插件）
 *
 * 只有插件**启用**时这个文件才会被加载，所以：
 *   - 核心的「个人设置」里那个入口按钮是按 `window.OwOauth` 是否存在来渲染的；
 *   - 停用插件 → 文件不加载 → 入口自动消失，无需在核心里加任何开关判断。
 * 本文件**不定义全局的 OwChat 方法**，只挂一个 OwOauth 命名空间，避免污染核心对象。
 */
(function (w, d) {
    if (!w.OwChat || !OwChat.cfg) return;
    if (w.OwOauth) return;          // 防重复加载
    if (OwChat.cfg.actor.kind !== 'user') return;   // 游客没有「授权」语义

    var esc = w.esc || function (s) { return String(s == null ? '' : s); };
    var toast = w.toast || function (s) { w.alert(s); };
    var OwApi = w.OwApi;
    if (!OwApi) return;

    // 路由名带 plugin_<插件名>_ 前缀（核心 Plugin::route 的命名规则）
    var A = {
        apps:   'plugin_oauth_core_apps',
        grant:  'plugin_oauth_core_grant',
        revoke: 'plugin_oauth_core_revoke'
    };
    var list = [];   // 最近一次拉到的应用列表，供点击时按索引取回

    function el(id) { return d.getElementById(id); }
    function modal() { return el('owModal'); }

    /** 应用列表 */
    function openApps() {
        OwApi.post(A.apps, {}, function (r) {
            if (!r.ok) { toast(r.msg); return; }
            list = r.data || [];
            if (!list.length) {
                OwChat.openModal('<h3>第三方授权</h3>'
                    + '<div class="ow-panel-empty">还没有可授权的应用。装了带「应用授权」能力的插件后，这里会出现条目。</div>', 420);
                return;
            }
            renderApps();
        });
    }

    function renderApps() {
        var html = '<h3>第三方授权</h3>', i, a;
        for (i = 0; i < list.length; i++) {
            a = list[i];
            html += '<div class="ow-oa-row' + (a.granted ? ' is-granted' : '') + '">'
                + '<div class="ow-oa-icon">' + (a.icon
                    ? '<img src="' + esc(a.icon) + '" alt="" loading="lazy">'
                    : '<span>' + esc((a.name || '?').charAt(0)) + '</span>') + '</div>'
                + '<div class="ow-oa-main">'
                + '<div class="ow-oa-name">' + esc(a.name) + (a.granted ? '<span class="ow-sr-tag">已授权</span>' : '') + '</div>'
                + (a.desc ? '<div class="ow-oa-desc">' + esc(a.desc) + '</div>' : '')
                + (a.granted && a.granted_scopes ? '<div class="ow-oa-scopes">已授予：' + esc(a.granted_scopes) + '</div>' : '')
                + '</div>'
                + '<div class="ow-oa-ops">'
                + (a.granted
                    ? '<button class="ow-btn ow-btn-ghost ow-btn-mini" data-op="revoke" data-i="' + i + '">取消授权</button>'
                    : '<button class="ow-btn ow-btn-primary ow-btn-mini" data-op="grant" data-i="' + i + '">授权</button>')
                + '</div></div>';
        }
        OwChat.openModal(html, 420);
        var box = modal();
        if (!box) return;
        box.onclick = function (e) {
            var t = e.target;
            while (t && t !== box && !(t.getAttribute && t.getAttribute('data-op'))) t = t.parentNode;
            if (!t || t === box) return;
            var idx = parseInt(t.getAttribute('data-i'), 10);
            if (!list[idx]) return;
            if (t.getAttribute('data-op') === 'revoke') revoke(list[idx]);
            else openGrant(list[idx]);
        };
    }

    /** 授权弹窗：勾选权限 */
    function openGrant(app) {
        if (!app.scopes || !app.scopes.length) { toast('该应用没有声明任何权限'); return; }
        var granted = String(app.granted_scopes || '').split(',');
        var html = '<h3>授权「' + esc(app.name) + '」</h3>', i, s;
        if (app.desc) html += '<p class="ow-modal-desc">' + esc(app.desc) + '</p>';
        html += '<div class="ow-oa-scopes-box">';
        for (i = 0; i < app.scopes.length; i++) {
            s = app.scopes[i];
            // 之前授权过就预勾上，方便「改权限」而不是每次从零勾
            var on = app.granted ? (granted.indexOf(s.key) >= 0) : true;
            html += '<label class="ow-oa-scope"><input type="checkbox" value="' + esc(s.key) + '"' + (on ? ' checked' : '') + '>'
                + '<span class="ow-oa-scope-t">' + esc(s.name) + '</span>'
                + (s.desc ? '<span class="ow-oa-scope-d">' + esc(s.desc) + '</span>' : '')
                + '</label>';
        }
        html += '</div><div class="ow-modal-actions">'
            + '<button class="ow-btn ow-btn-ghost" data-oa="cancel">取消</button>'
            + '<button class="ow-btn ow-btn-primary" data-oa="ok">确认授权</button></div>';
        OwChat.openModal(html, 400);
        var box = modal();
        if (!box) return;
        box.onclick = function (e) {
            var t = e.target;
            while (t && t !== box && !(t.getAttribute && t.getAttribute('data-oa'))) t = t.parentNode;
            if (!t || t === box) return;
            if (t.getAttribute('data-oa') === 'cancel') { OwChat.closeModal(); return; }
            submitGrant(app);
        };
    }

    function submitGrant(app) {
        var boxes = d.getElementsByClassName('ow-oa-scope'), scopes = [], i;
        for (i = 0; i < boxes.length; i++) {
            var cb = boxes[i].querySelector('input[type=checkbox]');
            if (cb && cb.checked) scopes.push(cb.value);
        }
        if (!scopes.length) { toast('请至少勾选一项权限'); return; }
        OwApi.post(A.grant, { plugin: app.plugin || '', app_id: app.id, scopes: scopes }, function (r) {
            if (!r.ok) { toast(r.msg); return; }
            toast(r.msg || '已授权');
            openApps();      // 回到列表刷新状态
        });
    }

    /** 取消授权（二次确认） */
    function revoke(app) {
        OwChat.confirm('确定取消对「' + (app.name || '该应用') + '」的授权？\n取消后该应用将无法访问你的数据。', function () {
            OwApi.post(A.revoke, { plugin: app.plugin || '', app_id: app.id }, function (r) {
                if (!r.ok) { toast(r.msg); return; }
                toast(r.msg || '已取消授权');
                openApps();
            });
        });
    }

    w.OwOauth = { open: openApps };
})(window, document);
