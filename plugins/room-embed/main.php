<?php
/**
 * 群聊嵌入插件（room-embed）v1.0.0
 *
 * 功能：
 *   - 群主/管理员可在「群聊信息」面板获取该群的 iframe 嵌入代码
 *   - 外部网站（博客等）将代码贴入页面，右下角即出现一个内置聊天室
 *   - 嵌入页复用主程序聊天页（?page=chat&room=ID&embed=1），不修改主程序
 *   - 嵌入模式下通过 page.head 注入精简 CSS，隐藏侧栏/右栏，仅保留消息+输入
 *
 * 不修改主程序的依据：
 *   - 页面入口用现有 ?page=chat&room=ID 直达群聊（核心已支持）
 *   - UI 精简走 page.head 钩子注入 CSS（核心已提供）
 *   - 「嵌入代码」入口走 HaChat.onRoomEdit 前端扩展点（核心已提供）
 *   - 消息收发/轮询全部复用核心 API（rooms/history/poll/send）
 */
if (!defined('HALOU_VERSION')) exit;

/* ===================== 嵌入模式 CSS ===================== */
// 仅当 URL 带 ?embed=1 时注入，把聊天页精简成适合 iframe 的小窗形态
Plugin::on('page.head', function (): void {
    if (!isset($_GET['embed']) || $_GET['embed'] !== '1') return;
    echo <<<'CSS'
<style>
/* ===== 嵌入模式：把聊天页压成右下角小窗 ===== */
.ha-layout{display:block}
.ha-sidebar{display:none!important}
.ha-online{display:none!important}
.ha-main{width:100%!important;max-width:none!important;min-width:0!important;border:none!important}
.ha-topbar{padding:8px 12px!important;border-bottom:1px solid var(--ha-border,#eee)}
.ha-topbar .ha-only-mobile{display:none!important}
.ha-topbar .ha-icon-btn{display:none!important}
.ha-room-name{font-size:14px!important;margin:0!important}
.ha-latency{display:none!important}
.ha-tag{display:none!important}
.ha-messages{padding:8px 10px!important}
.ha-msg{margin-bottom:6px!important}
.ha-msg-bubble{max-width:78%!important;font-size:13px!important;padding:6px 10px!important}
.ha-msg-meta{font-size:11px!important;margin-bottom:2px!important}
.ha-inputbar{padding:6px 8px!important;border-top:1px solid var(--ha-border,#eee)}
.ha-toolbar{gap:2px!important}
.ha-input-row{gap:6px!important}
.ha-input{font-size:13px!important;min-height:32px!important;padding:6px 8px!important}
.ha-send{width:34px!important;height:34px!important;min-width:34px!important}
.ha-emoji-panel{bottom:52px!important}
.ha-modal{width:92%!important;max-width:360px!important}
.ha-ctx-menu{font-size:12px!important}
/* 嵌入页背景与外层站点融合 */
body.ha-chat-body{background:var(--ha-bg,#fff)!important}
</style>
CSS;
});

/* ===================== 前端交互脚本 ===================== */
Plugin::asset('js', 'room-embed/chat.js');

/* ===================== 后台说明页 ===================== */
Plugin::adminPage('room-embed', '群聊嵌入', function () {
    return '<h2>群聊嵌入</h2>'
        . '<p class="ha-admin-desc">允许用户将自己创建的群聊以 iframe 方式嵌入到博客等网站，作为右下角内置聊天室。本插件不修改主程序，完全复用核心聊天能力。</p>'
        . '<div class="ha-card">'
        . '<h3 style="margin-top:0">使用方法</h3>'
        . '<ol style="line-height:2;color:var(--ha-text,#333)">'
        . '<li>群主或超级管理员进入任意群聊，点击右上角「⋮」打开群聊信息面板</li>'
        . '<li>在「群聊设置」下方点击「嵌入代码」</li>'
        . '<li>复制生成的 iframe 代码，粘贴到目标网站的 HTML 中即可</li>'
        . '</ol>'
        . '<h3>嵌入效果</h3>'
        . '<p style="color:var(--ha-text,#333)">嵌入后，网站右下角会出现一个聊天小窗，访客可直接在其中发言（受站点「游客发言」开关限制）。所有消息、禁言、敏感词等规则与主站完全一致。</p>'
        . '<h3>注意事项</h3>'
        . '<ul style="line-height:2;color:var(--ha-text,#333)">'
        . '<li>仅<strong>公开群聊</strong>可被嵌入；密码群/角色限定群/不公开群嵌入后访客无法进入</li>'
        . '<li>嵌入页面依赖主站会话，若访客未登录将以游客身份参与（需开启游客浏览/发言）</li>'
        . '<li>iframe 默认尺寸 380×560，可在生成代码中自行调整 width/height</li>'
        . '</ul>'
        . '</div>';
});
