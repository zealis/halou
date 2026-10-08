/**
 * 内容举报插件 · 前台能力
 *
 * 入口（v1.2.24 起只有这一个）：
 *   群聊消息右键「头像」菜单追加「举报」（通过 OwChat.onMsgCtx 扩展点），
 *   走同一个举报弹窗：选择理由 + 补充说明，提交到 plugin_content_report_submit。
 *
 * ⚠️ 用户资料卡的「举报」按钮 v1.2.24 已按要求移除（见文件内「资料卡『举报』按钮」一节）。
 *    举报入口现在**只有消息右键菜单这一条** —— 举报针对的是具体内容，不是某个人。
 *
 * 开关（后台配置）：
 *   - require_desc：必须填写补充说明
 *   - allow_self  ：允许举报自己的内容
 *   - show_guest  ：未登录显示举报入口（点击跳转登录）
 *
 * 兼容老浏览器：仅用 var / function，无箭头函数、无 const/let、无 fetch。
 */
(function (w, d) {
    if (!w.OwChat || !OwChat.cfg) return;
    if (w.__haCRLoaded) return;
    w.__haCRLoaded = true;

    var esc   = w.esc   || function (s) { return String(s == null ? '' : s); };
    var toast = w.toast || function () {};
    var pad   = w.fmtUid || function (n) { return String(n || ''); };
    var $ = function (id) { return d.getElementById(id); };

    var CR = w.OwCR = w.OwCR || {};

    /* ---------- 配置缓存（启动时拉取一次，菜单显隐与弹窗规则都依赖它） ---------- */
    var cfgCache = { show_guest: 0, require_desc: 0, allow_self: 0, reasons: [], desc_limit: 200, loaded: false };

    function loadCfg(cb) {
        OwApi.post('plugin_content_report_get_reasons', {}, function (r) {
            if (r.ok && r.data) {
                cfgCache.show_guest   = parseInt(r.data.show_guest, 10) || 0;
                cfgCache.require_desc = parseInt(r.data.require_desc, 10) || 0;
                cfgCache.allow_self   = parseInt(r.data.allow_self, 10) || 0;
                cfgCache.reasons      = r.data.reasons || [];
                cfgCache.desc_limit   = parseInt(r.data.desc_limit, 10) || 200;
            }
            cfgCache.loaded = true;
            if (cb) cb();
        });
    }
    loadCfg();

    /** 当前是否已登录 */
    function isLogin() {
        var actor = (OwChat.cfg || {}).actor || {};
        var me = (OwChat.cfg || {}).me || null;
        return actor.kind === 'user' && me && me.id;
    }

    /** 跳转登录页 */
    function goLogin() {
        w.location.href = '?page=login';
    }

    /* ---------- 资料卡「举报」按钮：v1.2.24 移除 ----------
       原实现：包装 OwChat.userCard 记下目标用户 → 再包装 OwChat.openModal，
       往资料卡的 <div class="ow-modal-actions"> 里塞一个 ow-btn-danger 按钮。
       移除理由：资料卡是「看这个人是谁」的地方，底部摆一个红色「举报」把气氛
       搞得很对立；而举报真正的场景是「看到一条具体的违规内容」，那里走
       OwChat.onMsgCtx（右键头像菜单）能精确定位到被举报对象，也更顺手。

       ⚠️ 删除时必须连**三件套**一起删：lastCardTarget 变量、userCard 包装、
       openModal 包装 —— 它们只服务于这一个按钮，留下任何一个都是死代码，
       而且 openModal 包装是全站弹窗的公共路径，留着等于给所有弹窗加一道
       字符串匹配，纯负担。openReport 本身保留（右键菜单还在用）。 */

    /* ---------- 举报弹窗：理由下拉 + 补充说明 ---------- */
    CR.openReport = function (targetUid, targetNick, roomId, msgId, msgTime) {
        targetUid = parseInt(targetUid, 10) || 0;
        msgTime = parseInt(msgTime, 10) || 0;
        if (targetUid <= 0) { toast('举报对象无效'); return; }

        // 未登录：跳转登录（show_guest 开启时游客可见入口）
        if (!isLogin()) { goLogin(); return; }

        var me = (OwChat.cfg || {}).me || null;
        // 允许举报自己关闭时，拦截自己
        if (me && me.id && targetUid === me.id && !cfgCache.allow_self) {
            toast('不能举报自己'); return;
        }

        // 配置未加载完时等待
        if (!cfgCache.loaded) {
            loadCfg(function () { CR.openReport(targetUid, targetNick, roomId, msgId, msgTime); });
            return;
        }

        var reasons = cfgCache.reasons || [];
        var descLimit = cfgCache.desc_limit || 200;
        var requireDesc = cfgCache.require_desc ? true : false;
        if (!reasons.length) { toast('管理员尚未配置举报理由'); return; }

        var opts = '';
        for (var i = 0; i < reasons.length; i++) {
            opts += '<option value="' + esc(reasons[i]) + '">' + esc(reasons[i]) + '</option>';
        }

        var descLabel = '补充说明（' + (requireDesc ? '必填' : '可选') + '，最多 ' + descLimit + ' 字）';

        OwChat.openModal(
            '<h3>举报用户</h3>'
            + '<p class="ow-modal-desc">举报对象：' + esc(targetNick) + '（用户 ID：' + esc(pad(targetUid)) + '）</p>'
            + '<div class="ow-form-item"><label>举报理由</label>'
            + '<select class="ow-input" id="owCRReason">' + opts + '</select></div>'
            + '<div class="ow-form-item"><label>' + descLabel + '</label>'
            + '<textarea class="ow-input" id="owCRDesc" rows="4" maxlength="' + descLimit + '" style="resize:vertical"></textarea></div>'
            + '<div class="ow-modal-actions">'
            + '<button class="ow-btn ow-btn-ghost" onclick="OwChat.closeModal()">取消</button>'
            + '<button class="ow-btn ow-btn-danger" id="owCRSubmit">提交举报</button></div>'
        );

        var submit = $('owCRSubmit');
        if (submit) {
            submit.onclick = function () {
                var reason = $('owCRReason') ? $('owCRReason').value : '';
                var desc = $('owCRDesc') ? $('owCRDesc').value : '';
                if (!reason) { toast('请选择举报理由'); return; }
                if (requireDesc && !desc.replace(/^\s+|\s+$/g, '')) { toast('请填写补充说明'); return; }
                submit.disabled = true;
                OwApi.post('plugin_content_report_submit', {
                    target_uid: targetUid,
                    target_nick: targetNick,
                    reason: reason,
                    description: desc,
                    room_id: roomId || 0,
                    msg_id: msgId || 0,
                    msg_time: msgTime || 0
                }, function (r2) {
                    submit.disabled = false;
                    if (r2.ok) OwChat.closeModal();
                    toast(r2.msg || (r2.ok ? '举报已提交' : '操作失败'));
                });
            };
        }
    };

    /* ---------- 注册到头像右键菜单（针对「人」的操作） ---------- */
    if (typeof OwChat.onMsgCtx === 'function') {
        OwChat.onMsgCtx(function (items, m) {
            if (!m || m.recalled) return;
            var targetUid = m.uid || 0;
            if (!targetUid) return;                       // 仅举报注册用户

            var loggedIn = isLogin();
            var me = (OwChat.cfg || {}).me || null;

            // 未登录：仅当 show_guest 开启时显示入口，点击跳转登录
            if (!loggedIn) {
                if (cfgCache.show_guest) {
                    items.push({ t: '举报', run: function () { goLogin(); } });
                }
                return;
            }

            // 已登录：允许举报自己关闭时，自己的消息不显示举报
            if (me && me.id && targetUid === me.id && !cfgCache.allow_self) return;

            items.push({
                t: '举报',
                run: function () { CR.openReport(targetUid, m.nickname || '', OwChat.room, m.id || 0, m.ts || 0); }
            });
        });
    }
})(window, document);
