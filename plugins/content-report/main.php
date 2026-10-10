<?php
/**
 * 内容举报插件（content-report）v1.0.1
 *
 * 功能：
 *   - 前台聊天头像右键菜单增加「举报」入口（选择理由 + 补充说明弹窗）
 *   - 后台可配置举报理由（每行一条）、同一用户举报间隔（秒，0 关闭）、补充说明字数上限
 *   - 后台查看 / 处理 / 删除举报记录
 *
 * v1.0.1（v1.2.24）：**移除用户资料卡的「举报」按钮**。举报入口现只剩消息右键菜单
 * —— 举报针对的是具体的一条内容，不是某个人；资料卡底部摆红色举报按钮过于对立。
 *
 * 不修改主程序：依赖核心 OwChat.onMsgCtx 扩展点、Plugin::route / adminPage / asset。
 */
if (!defined('OWLSGO_VERSION')) exit;

/* ===================== 数据表（幂等建表） ===================== */

DB::run("CREATE TABLE IF NOT EXISTS plugin_content_report (
    id " . DB::autoId() . ",
    reporter_id INTEGER NOT NULL DEFAULT 0,
    reporter_nick VARCHAR(64) NOT NULL DEFAULT '',
    target_uid INTEGER NOT NULL DEFAULT 0,
    target_nick VARCHAR(64) NOT NULL DEFAULT '',
    reason VARCHAR(64) NOT NULL DEFAULT '',
    " . DB::textCol('description') . ",
    room_id INTEGER NOT NULL DEFAULT 0,
    msg_id INTEGER NOT NULL DEFAULT 0,
    msg_time INTEGER NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
)");

// 增量迁移：旧版数据表补齐 msg_time 字段。用公开的 ensureColumn()（内部按驱动查列是否存在），
// 不再自己写 PRAGMA + try/catch —— PRAGMA 是 SQLite 专有语句，MySQL 上只能靠吞异常兜过。
DB::ensureColumn('plugin_content_report', 'msg_time', 'int', '0');

DB::run("CREATE TABLE IF NOT EXISTS plugin_content_report_config (
    k VARCHAR(32) PRIMARY KEY,
    " . DB::textCol('v') . "
)");

/* ===================== 配置读取 ===================== */

/** 默认配置 */
function owCRDefaultConfig(): array
{
    return [
        'reasons'      => "垃圾广告\n辱骂攻击\n色情低俗\n违法违规\n刷屏灌水\n其他",
        'interval'     => 30,
        'desc_limit'   => 200,
        'require_desc' => 0,   // 必须填写补充说明
        'allow_self'   => 0,   // 允许举报自己的内容
        'show_guest'   => 0,   // 未登录显示举报入口（点击跳转登录）
    ];
}

/** 读取全部配置（缺失项补默认值） */
function owCRGetConfig(): array
{
    $cfg = owCRDefaultConfig();
    $rows = DB::all('SELECT k, v FROM plugin_content_report_config');
    foreach ($rows as $r) {
        if (array_key_exists($r['k'], $cfg)) $cfg[$r['k']] = $r['v'];
    }
    $cfg['interval']     = max(0, (int)$cfg['interval']);
    $cfg['desc_limit']   = max(10, min(2000, (int)$cfg['desc_limit']));
    $cfg['require_desc'] = (int)$cfg['require_desc'] ? 1 : 0;
    $cfg['allow_self']   = (int)$cfg['allow_self'] ? 1 : 0;
    $cfg['show_guest']   = (int)$cfg['show_guest'] ? 1 : 0;
    return $cfg;
}

/** 保存单个配置项（不存在则插入） */
function owCRSetConfig(string $k, string $v): void
{
    DB::upsert('plugin_content_report_config', ['k' => $k, 'v' => $v], ['k']);
}

/** 把理由文本按行拆分为数组（去空行、去重、保留顺序） */
function owCRParseReasons(string $raw): array
{
    $lines = preg_split('/\r\n|\r|\n/', $raw);
    $seen = [];
    $out = [];
    foreach ($lines as $l) {
        $l = trim($l);
        if ($l === '' || isset($seen[$l])) continue;
        $seen[$l] = true;
        $out[] = $l;
    }
    return $out;
}

/* ===================== 管理员鉴权 ===================== */

$crGuard = function (array $ctx): void {
    if (($ctx['actor']['role'] ?? '') !== 'admin') Api::json(['ok' => false, 'msg' => '需要管理员权限'], 403);
};

/* ===================== 后台页面 ===================== */

Plugin::adminPage('content-report', '内容举报', function () {
    $cfg = owCRGetConfig();
    // 开关 HTML（与核心 switchHtml 结构一致，由 admin.js 调 bindSwitches 绑定视觉同步）
    // v1.2.52：行容器改成 div、for 只挂轨道 —— 与核心同款修复（点文字/空白不再误切换）
    $sw = function (string $id, string $label, bool $on, string $hint = ''): string {
        return '<div class="ow-switch-row">'
            . '<span class="ow-switch-label">' . Sec::e($label) . '</span>'
            . '<input type="checkbox" class="ow-switch-input" id="' . Sec::e($id) . '"' . ($on ? ' checked' : '') . '>'
            . '<label class="ow-switch' . ($on ? ' is-on' : '') . '" for="' . Sec::e($id) . '"></label>'
            . ($hint ? '<p class="ow-switch-hint">' . Sec::e($hint) . '</p>' : '')
            . '</div>';
    };
    $h = '<h2>内容举报</h2><p class="ow-admin-desc">前台用户可通过头像右键菜单或资料卡举报他人，后台可在此配置举报规则并处理举报记录。</p>'
        // ---- 配置区 ----
        . '<div class="ow-card"><h3 style="margin-bottom:10px">举报规则配置</h3>'
        . '<div class="ow-form-item"><label>举报理由（每行一条，将作为前台下拉选项）</label>'
        . '<textarea class="ow-input" id="owCRReasons" rows="6" style="resize:vertical">' . Sec::e($cfg['reasons']) . '</textarea></div>'
        . '<div class="ow-form-row">'
        . '<div class="ow-form-item"><label>同一用户举报间隔（秒，0 关闭）</label>'
        . '<input class="ow-input" id="owCRInterval" type="number" min="0" value="' . (int)$cfg['interval'] . '"></div>'
        . '<div class="ow-form-item"><label>补充说明字数上限</label>'
        . '<input class="ow-input" id="owCRDescLimit" type="number" min="10" max="2000" value="' . (int)$cfg['desc_limit'] . '"></div>'
        . '</div>'
        . '<div id="owCRSwitches">'
        . $sw('owCRRequireDesc', '必须填写补充说明', (bool)$cfg['require_desc'], '开启后用户举报时必须填写补充说明')
        . $sw('owCRAllowSelf', '允许举报自己的内容', (bool)$cfg['allow_self'], '关闭后用户不能举报自己发送的内容')
        . $sw('owCRShowGuest', '未登录显示举报入口', (bool)$cfg['show_guest'], '开启后游客也能看到举报入口，点击跳转登录页')
        . '</div>'
        . '<button class="ow-btn ow-btn-primary" onclick="OwCR.saveConfig()">保存配置</button></div>'
        // ---- 举报列表 ----
        . '<div class="ow-card">'
        . '<div class="ow-admin-batch">'
        . '<span style="color:var(--ow-text-sub);font-size:12px">待处理举报会以高亮显示</span>'
        . '</div>'
        . '<div class="ow-table-wrap"><table class="ow-table" id="owCRTable"></table></div>'
        . '<div id="owCRPaging"></div></div>';
    return $h;
});

/* ===================== API 路由 ===================== */

/** 后台：获取配置 */
Plugin::route('plugin_content_report_config_get', function (array $ctx) use ($crGuard) {
    $crGuard($ctx);
    $cfg = owCRGetConfig();
    Api::json(['ok' => true, 'data' => $cfg]);
});

/** 后台：保存配置（敏感操作） */
Plugin::route('plugin_content_report_config_save', function (array $ctx) use ($crGuard) {
    $crGuard($ctx);
    $post = $ctx['post'];
    $reasons = trim((string)($post['reasons'] ?? ''));
    if ($reasons === '') Api::json(['ok' => false, 'msg' => '举报理由不能为空']);
    $parsed = owCRParseReasons($reasons);
    if (!$parsed) Api::json(['ok' => false, 'msg' => '举报理由不能为空']);
    // 重新用换行拼接（规范化）
    owCRSetConfig('reasons', implode("\n", $parsed));

    $interval = max(0, (int)($post['interval'] ?? 0));
    owCRSetConfig('interval', (string)$interval);

    $descLimit = max(10, min(2000, (int)($post['desc_limit'] ?? 200)));
    owCRSetConfig('desc_limit', (string)$descLimit);

    // 三个开关：on=1 / off=0
    owCRSetConfig('require_desc', !empty($post['require_desc']) ? '1' : '0');
    owCRSetConfig('allow_self', !empty($post['allow_self']) ? '1' : '0');
    owCRSetConfig('show_guest', !empty($post['show_guest']) ? '1' : '0');

    Sec::log('content_report_config', $ctx['actor']['nickname'], ['interval' => $interval, 'desc_limit' => $descLimit]);
    Api::json(['ok' => true, 'msg' => '配置已保存']);
}, ['sensitive' => true]);

/** 后台：举报列表（分页） */
Plugin::route('plugin_content_report_list', function (array $ctx) use ($crGuard) {
    $crGuard($ctx);
    $page = max(1, (int)($ctx['post']['page'] ?? 1));
    $size = min(100, max(1, (int)($ctx['post']['size'] ?? 20)));
    $status = isset($ctx['post']['status']) ? (int)$ctx['post']['status'] : -1;

    $where = '1=1';
    $args = [];
    if ($status >= 0) { $where .= ' AND status=?'; $args[] = $status; }

    $total = (int)DB::val('SELECT COUNT(*) FROM plugin_content_report WHERE ' . $where, $args);
    $rows = DB::all(
        'SELECT * FROM plugin_content_report WHERE ' . $where . ' ORDER BY id DESC LIMIT ' . $size . ' OFFSET ' . (($page - 1) * $size),
        $args
    );
    Api::json(['ok' => true, 'data' => ['list' => $rows, 'total' => $total, 'page' => $page, 'size' => $size]]);
});

/** 后台：处理举报（标记为已处理/忽略） */
Plugin::route('plugin_content_report_handle', function (array $ctx) use ($crGuard) {
    $crGuard($ctx);
    $id = (int)($ctx['post']['id'] ?? 0);
    $status = (int)($ctx['post']['status'] ?? 1);
    if (!in_array($status, [1, 2], true)) Api::json(['ok' => false, 'msg' => '非法状态']);
    DB::run('UPDATE plugin_content_report SET status=? WHERE id=?', [$status, $id]);
    Sec::log('content_report_handle', $ctx['actor']['nickname'], ['id' => $id, 'status' => $status]);
    Api::json(['ok' => true, 'msg' => '已更新']);
}, ['sensitive' => true]);

/** 后台：删除举报（敏感操作） */
Plugin::route('plugin_content_report_delete', function (array $ctx) use ($crGuard) {
    $crGuard($ctx);
    $id = (int)($ctx['post']['id'] ?? 0);
    DB::run('DELETE FROM plugin_content_report WHERE id=?', [$id]);
    Sec::log('content_report_delete', $ctx['actor']['nickname'], ['id' => $id]);
    Api::json(['ok' => true, 'msg' => '已删除']);
}, ['sensitive' => true]);

/** 前台：获取举报理由与规则配置
 *  游客也可访问，仅返回 show_guest（决定是否显示举报入口）；
 *  已登录用户额外返回理由列表与 require_desc / allow_self。
 */
Plugin::route('plugin_content_report_get_reasons', function (array $ctx) {
    $cfg = owCRGetConfig();
    $isUser = ($ctx['actor']['kind'] ?? '') === 'user';
    $data = ['show_guest' => (int)$cfg['show_guest']];
    if ($isUser) {
        $data['reasons']      = owCRParseReasons($cfg['reasons']);
        $data['desc_limit']   = (int)$cfg['desc_limit'];
        $data['require_desc'] = (int)$cfg['require_desc'];
        $data['allow_self']   = (int)$cfg['allow_self'];
    }
    Api::json(['ok' => true, 'data' => $data]);
});

/** 前台：提交举报（已登录用户） */
Plugin::route('plugin_content_report_submit', function (array $ctx) {
    $actor = $ctx['actor'];
    if (($actor['kind'] ?? '') !== 'user') Api::json(['ok' => false, 'msg' => '需要登录后操作'], 403);

    $post = $ctx['post'];
    $targetUid = (int)($post['target_uid'] ?? 0);
    $targetNick = trim((string)($post['target_nick'] ?? ''));
    $reason = trim((string)($post['reason'] ?? ''));
    $description = trim((string)($post['description'] ?? ''));
    $roomId = (int)($post['room_id'] ?? 0);
    $msgId = (int)($post['msg_id'] ?? 0);
    $msgTime = (int)($post['msg_time'] ?? 0);

    if ($targetUid <= 0) Api::json(['ok' => false, 'msg' => '举报对象无效']);

    $cfg = owCRGetConfig();

    // 允许举报自己：关闭时拦截
    if ($targetUid === (int)$actor['id'] && empty($cfg['allow_self'])) {
        Api::json(['ok' => false, 'msg' => '不能举报自己']);
    }

    $reasons = owCRParseReasons($cfg['reasons']);
    if (!$reasons || !in_array($reason, $reasons, true)) Api::json(['ok' => false, 'msg' => '请选择举报理由']);

    $descLimit = (int)$cfg['desc_limit'];
    if (mb_strlen($description) > $descLimit) {
        Api::json(['ok' => false, 'msg' => '补充说明不能超过 ' . $descLimit . ' 字']);
    }

    // 必须填写补充说明：开启时校验非空
    if (!empty($cfg['require_desc']) && $description === '') {
        Api::json(['ok' => false, 'msg' => '请填写补充说明']);
    }

    // 同一用户举报间隔校验：同一举报人对同一目标在间隔期内不可重复举报
    $interval = (int)$cfg['interval'];
    if ($interval > 0) {
        $last = (int)DB::val(
            'SELECT created_at FROM plugin_content_report WHERE reporter_id=? AND target_uid=? ORDER BY id DESC LIMIT 1',
            [(int)$actor['id'], $targetUid]
        );
        if ($last > 0 && (time() - $last) < $interval) {
            $remain = $interval - (time() - $last);
            Api::json(['ok' => false, 'msg' => '举报过于频繁，请 ' . $remain . ' 秒后再试']);
        }
    }

    // 补充说明做敏感词过滤（走核心 text.filter 钩子）
    if ($description !== '') {
        Plugin::fire('text.filter', [&$description, 'report', $actor]);
    }

    DB::insert('plugin_content_report', [
        'reporter_id'   => (int)$actor['id'],
        'reporter_nick' => (string)($actor['nickname'] ?? ''),
        'target_uid'    => $targetUid,
        'target_nick'   => $targetNick,
        'reason'        => mb_substr($reason, 0, 64),
        'description'   => mb_substr($description, 0, $descLimit),
        'room_id'       => $roomId,
        'msg_id'        => $msgId,
        'msg_time'      => $msgTime,
        'status'        => 0,
        'created_at'    => time(),
    ]);
    Sec::log('content_report_submit', $actor['nickname'] ?? '', ['target' => $targetUid, 'reason' => $reason]);
    Api::json(['ok' => true, 'msg' => '举报已提交，我们会尽快处理']);
});

/* ===================== 资源注册 ===================== */

Plugin::asset('js', 'content-report/chat.js');
Plugin::asset('js', 'content-report/admin.js');
Plugin::asset('css', 'content-report/admin.css');
