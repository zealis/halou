/**
 * email-verify · 后台配置页交互（v1.0.0）
 * 全局对象 OwEv；依赖后台主脚本暴露的 OwApi / toast / esc。
 * 兼容老浏览器：只用 var / function，不用箭头函数、let/const、fetch。
 */
(function (w, d) {
    'use strict';
    var $ = function (id) { return d.getElementById(id); };
    function val(id, def) { var el = $(id); return el ? el.value : (def || ''); }

    /** 只收集当前通道用得上的字段：mail() 模式下 SMTP 那几栏是空壳，提交了也没意义 */
    function currentTrans() {
        var sel = $('owEvTransport');
        return sel && sel.value === 'mail' ? 'mail' : 'smtp';
    }

    w.OwEv = {
        showTrans: function () {
            var t = currentTrans();
            var rows = d.querySelectorAll('.ow-ev-trans'), i;
            for (i = 0; i < rows.length; i++) {
                rows[i].style.display = rows[i].getAttribute('data-owev-trans') === t ? '' : 'none';
            }
        },

        save: function () {
            var data = {
                enabled: val('owEvEnabled', '0'),
                transport: currentTrans()
            };
            var els = d.querySelectorAll('[data-owev]'), i, k;
            for (i = 0; i < els.length; i++) {
                k = els[i].getAttribute('data-owev');
                if (data.transport === 'mail' && k.indexOf('smtp_') === 0) continue;
                data[k] = els[i].value;
            }
            // 保存通道 = 能改登录/注册的验证凭证，走一次性票据
            OwApi.secure('plugin_email_verify_save', data, function (r) {
                toast(r.msg);
                if (r.ok) OwEv.showTrans();
            });
        },

        savePolicy: function () {
            var data = {}, els = d.querySelectorAll('[data-owev-set]'), i;
            for (i = 0; i < els.length; i++) data[els[i].getAttribute('data-owev-set')] = els[i].value;
            OwApi.secure('plugin_email_verify_policy', data, function (r) { toast(r.msg); });
        },

        /** 模板来源显示成中文：管理员必须知道现在生效的是哪一份，否则「改了没效果」无从排查 */
        srcLabel: function (src) {
            if (src === 'file') return '目录文件 data/mail-templates/（优先级最高，此处编辑不生效）';
            if (src === 'db') return '后台保存的模板';
            return '内置默认（尚未自定义）';
        },

        loadTpl: function () {
            var kind = val('owEvKind', 'register');
            OwApi.post('plugin_email_verify_template', { kind: kind }, function (r) {
                if (!r.ok || !r.data) { toast(r.msg || '模板读取失败'); return; }
                var s = $('owEvTplSubject'), b = $('owEvTplBody'), p = $('owEvTplSrc');
                if (s) s.value = r.data.subject || '';
                if (b) b.value = r.data.body || '';
                if (p) p.textContent = OwEv.srcLabel(r.data.source);
            });
        },

        restoreTpl: function () {
            OwApi.post('plugin_email_verify_template', { kind: val('owEvKind', 'register'), default: '1' }, function (r) {
                if (!r.ok || !r.data) { toast(r.msg || '读取失败'); return; }
                if ($('owEvTplSubject')) $('owEvTplSubject').value = r.data.subject;
                if ($('owEvTplBody')) $('owEvTplBody').value = r.data.body;
                toast('已填入内置默认，点「保存模板」即覆盖当前自定义');
            });
        },

        /** 占位符插到光标处（而不是无脑追加到末尾）：编辑长模板时追加等于重写 */
        paste: function (ph) {
            var b = $('owEvTplBody');
            if (!b) return;
            var s = b.selectionStart, e = b.selectionEnd, v = b.value || '';
            if (typeof s !== 'number') { b.value = v + ph; b.focus(); return; }
            b.value = v.slice(0, s) + ph + v.slice(e);
            b.selectionStart = b.selectionEnd = s + ph.length;
            b.focus();
        },

        saveTpl: function () {
            OwApi.secure('plugin_email_verify_template_save', {
                kind: val('owEvKind', 'register'),
                subject: val('owEvTplSubject'),
                body: val('owEvTplBody')
            }, function (r) {
                toast(r.msg);
                if (r.ok) OwEv.loadTpl();
            });
        },

        /** 预览走 sandbox iframe：模板是管理员自己写的 HTML，
         *  但把它塞进后台文档里执行等于给自己留一个 XSS 入口，脚本一律禁掉。 */
        preview: function () {
            var frame = $('owEvPrev');
            if (!frame) return;
            OwApi.post('plugin_email_verify_preview', {
                kind: val('owEvKind', 'register'),
                subject: val('owEvTplSubject'),
                body: val('owEvTplBody')
            }, function (r) {
                if (!r.ok || !r.data) { toast(r.msg || '预览失败'); return; }
                var doc = '<meta charset="utf-8"><style>body{margin:0;padding:14px;background:#fff;'
                    + 'font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2329}'
                    + '.sb{font-size:13px;color:#5b6470;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:12px}</style>'
                    + '<div class="sb">主题：' + esc(r.data.subject) + '</div>' + r.data.html;
                frame.setAttribute('srcdoc', doc);
            });
        },

        /** 发信会真的往外投递，服务端把该路由标了 sensitive，必须走一次性票据 */
        test: function () {
            OwApi.secure('plugin_email_verify_test', { kind: val('owEvKind', 'register') }, function (r) {
                toast(r.msg);
            });
        },

        clearLog: function () {
            OwApi.secure('plugin_email_verify_log_clear', {}, function (r) {
                toast(r.msg);
                // 重新渲染本页才能拿到空列表（后台子页面的键是 plugin:<slug>）
                if (r.ok && w.OwAdmin && OwAdmin.page) OwAdmin.page('plugin:email-verify');
            });
        }
    };

    /* 后台页面 HTML 由 admin_plugin_page 异步注入，监听 #owAdminMain 变化后自动初始化 */
    function watchInit() {
        var main = $('owAdminMain');
        if (!main) return;
        var tryInit = function () {
            var en = $('owEvEnabled');
            if (en && en.getAttribute('data-owev-inited') !== '1') {
                en.setAttribute('data-owev-inited', '1');
                OwEv.showTrans();
                OwEv.loadTpl();
                var t = $('owEvKind');
                if (t) t.onchange = OwEv.loadTpl;
            }
        };
        if (typeof MutationObserver !== 'undefined') {
            new MutationObserver(tryInit).observe(main, { childList: true, subtree: true });
        } else {
            setInterval(tryInit, 300);
        }
        tryInit();
    }

    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', watchInit);
    else watchInit();
})(window, document);
