<?php
/**
 * 附件管理插件（v1.0.0）
 *
 * 后台页面：Plugin::adminPage() 注册「附件管理」子页（插件管理分类下）。
 * API 路由：Plugin::route() 注册管理员操作，action 前缀 plugin_attachment_manager_。
 *   - list   分页列表，支持按群聊过滤、文件名包含搜索
 *   - delete 批量删除（同时删除消息记录与物理文件）
 *   - rooms  群聊下拉数据
 *   - download 管理员下载（不依赖房间状态）
 * 安全约束：所有路由第一步必须做管理员鉴权；SQL 全部参数化；
 *           文件删除走 Upload::fileAbs() 解析绝对路径，杜绝目录穿越。
 * 数据来源：messages 表 type IN ('file','image') 的记录。
 *   - file:  content 为 JSON {"name","size","ext","path"}
 *   - image: content 为 URL 字符串（如 uploads/image/xxx.png）
 */
if (!defined('HALOU_VERSION')) exit;   // 禁止直接 HTTP 访问本文件

/**
 * 主程序未在页面中引入 ?action=assets&type=css，插件 CSS 不会自动加载。
 * 通过 page.head 钩子注入 <link> 标签，确保后台样式生效。
 */
Plugin::on('page.head', function () {
    echo '<link rel="stylesheet" href="?action=assets&type=css&am=' . HALOU_VERSION . '">';
});

/** 管理员鉴权：插件路由的公共守卫 */
$amGuard = function (array $ctx): void {
    if (($ctx['actor']['role'] ?? '') !== 'admin') Api::json(['ok' => false, 'msg' => '需要管理员权限'], 403);
};

/**
 * 跨驱动提取附件名用于搜索：file 类型取 JSON 的 name 字段，image 类型取 content 本身（URL）。
 * file 的 content 是 JSON，image 的 content 是纯 URL 字符串，直接 LIKE 匹配即可。
 */
function haAM_search_expr(): string
{
    switch (DB::driver()) {
        case 'mysql':
            return "CASE WHEN m.type='file' THEN JSON_UNQUOTE(JSON_EXTRACT(m.content, '$.name')) ELSE m.content END";
        case 'pgsql':
            return "CASE WHEN m.type='file' THEN (m.content::json)->>'name' ELSE m.content END";
        default: // sqlite
            return "CASE WHEN m.type='file' THEN json_extract(m.content, '$.name') ELSE m.content END";
    }
}

/** 把字节数格式化为易读字符串 */
function haAM_size_text(int $n): string
{
    if ($n < 1024) return $n . ' B';
    if ($n < 1048576) return round($n / 1024, 1) . ' KB';
    return round($n / 1048576, 1) . ' MB';
}

/**
 * 将图片消息的 content（URL）解析为物理绝对路径。
 * 兼容两种格式：
 *   - 相对：uploads/image/xxx.png
 *   - 绝对：https://host/uploads/image/xxx.png
 */
function haAM_image_abs(string $url): ?string
{
    $path = parse_url($url, PHP_URL_PATH);
    if ($path === null || $path === '') return null;
    $rel = preg_replace('#^/?uploads/#', '', $path);
    if ($rel === $path || $rel === '' || strpos($rel, '..') !== false) return null;
    $cfg = require dirname(__DIR__, 2) . '/core/config.php';
    $abs = $cfg['upload']['dir'] . '/' . $rel;
    return is_file($abs) ? $abs : null;
}

/* ---------- 后台页面（HTML 注入 #haAdminMain，交互函数见 admin.js） ---------- */
Plugin::adminPage('attachment-manager', '附件管理', function () {
    return '<h2>附件管理</h2>'
        . '<p class="ha-admin-desc">管理聊天中上传的文件附件，可按房间ID过滤、搜索文件名，支持分页浏览与批量删除（删除会同时清理消息记录和物理文件）。</p>'
        . '<div class="ha-card">'
        . '<div class="ha-form-row">'
        . '<div class="ha-form-item" style="flex:1;min-width:160px"><label>文件名包含</label>'
        . '<input class="ha-input" id="haAMQ" placeholder="输入文件名关键词" onkeydown="if(event.key===\'Enter\')HaAM.load(1)"></div>'
        . '<div class="ha-form-item" style="min-width:120px"><label>房间ID</label>'
        . '<input class="ha-input" id="haAMRoom" type="number" min="0" placeholder="0=全部" value="0" onkeydown="if(event.key===\'Enter\')HaAM.load(1)"></div>'
        . '<button class="ha-btn ha-btn-primary" onclick="HaAM.load(1)">搜索</button>'
        . '<button class="ha-btn ha-btn-ghost" onclick="HaAM.resetFilter()">重置</button>'
        . '</div></div>'
        . '<div class="ha-card">'
        . '<div style="margin-bottom:10px">'
        . '<button class="ha-btn ha-btn-danger" id="haAMBatchDel" onclick="HaAM.batchDelete()" disabled>批量删除</button>'
        . '<span id="haAMStat" style="margin-left:12px;color:var(--ha-text-sub,#999);font-size:12px"></span>'
        . '</div>'
        . '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'
        . '<table class="ha-table" id="haAMTable">'
        . '<tr><th style="width:32px"><input type="checkbox" id="haAMCheckAll" onchange="HaAM.toggleAll(this)"></th>'
        . '<th>类型</th><th>文件名</th><th>大小</th><th>消息</th><th>上传者</th><th>上传时间</th><th>操作</th></tr>'
        . '</table>'
        . '</div>'
        . '<div id="haAMList" style="display:none"></div>'
        . '<div id="HAMPager" style="margin-top:12px"></div>'
        . '</div>';
});

/* ---------- 群聊列表（过滤下拉） ---------- */
Plugin::route('plugin_attachment_manager_rooms', function (array $ctx) use ($amGuard) {
    $amGuard($ctx);
    $rows = DB::all('SELECT id, name FROM rooms ORDER BY id');
    Api::json(['ok' => true, 'data' => $rows]);
});

/* ---------- 附件列表（分页 + 群聊过滤 + 文件名搜索） ---------- */
Plugin::route('plugin_attachment_manager_list', function (array $ctx) use ($amGuard) {
    $amGuard($ctx);
    $post = $ctx['post'];
    $page = max(1, (int)($post['page'] ?? 1));
    $psize = max(1, min(100, (int)($post['psize'] ?? 20)));
    $roomId = (int)($post['room_id'] ?? 0);
    $keyword = trim((string)($post['q'] ?? ''));

    $where = "WHERE m.type IN ('file','image')";
    $args = [];
    if ($roomId > 0) { $where .= ' AND m.room_id=?'; $args[] = $roomId; }
    if ($keyword !== '') {
        $where .= ' AND ' . haAM_search_expr() . ' LIKE ?';
        $args[] = '%' . $keyword . '%';
    }

    $total = (int)DB::val("SELECT COUNT(*) FROM messages m $where", $args);
    $offset = ($page - 1) * $psize;

    $sql = "SELECT m.id, m.type, m.room_id, m.nickname, m.created_at, m.content,
                   m.user_id, m.guest_id, m.to_user_id, m.to_guest_id,
                   r.name AS room_name
            FROM messages m
            LEFT JOIN rooms r ON r.id = m.room_id
            $where
            ORDER BY m.id DESC
            LIMIT $psize OFFSET $offset";
    $rows = DB::all($sql, $args);

    $list = [];
    foreach ($rows as $r) {
        $type = $r['type'];
        if ($type === 'file') {
            $info = json_decode((string)$r['content'], true);
            $name = is_array($info) ? (string)($info['name'] ?? '文件') : '文件';
            $ext  = is_array($info) ? strtoupper((string)($info['ext'] ?? '')) : '';
            $size = is_array($info) ? (int)($info['size'] ?? 0) : 0;
            $path = is_array($info) ? (string)($info['path'] ?? '') : '';
        } else {
            // image: content 是 URL 字符串，原始文件名未存储，只能显示存储后的文件名
            $url  = (string)$r['content'];
            $name = basename($url);
            $ext  = strtoupper(pathinfo($url, PATHINFO_EXTENSION));
            $size = 0;
            $path = '';
        }
        // 消息归属：群聊显示房间名，私聊显示发送方→接收方
        $isDm = (int)$r['room_id'] === 0
            && ((int)($r['to_user_id'] ?? 0) > 0 || (int)($r['to_guest_id'] ?? 0) > 0);
        if ($isDm) {
            $fromId = (int)$r['user_id'] > 0
                ? '用户' . (int)$r['user_id']
                : '游客' . (int)$r['guest_id'];
            $toId = (int)$r['to_user_id'] > 0
                ? '用户' . (int)$r['to_user_id']
                : '游客' . (int)$r['to_guest_id'];
            $scopeText = $fromId . ' → ' . $toId;
        } else {
            $scopeText = $r['room_name'] !== null ? (string)$r['room_name'] : '（房间已删除）';
        }
        $list[] = [
            'id' => (int)$r['id'],
            'type' => $type,
            'type_cn' => $type === 'file' ? '文件' : '图片',
            'name' => $name,
            'ext'  => $ext,
            'size' => $size,
            'size_text' => $size > 0 ? haAM_size_text($size) : '-',
            'path' => $path,
            'room_id' => (int)$r['room_id'],
            'scope_text' => $scopeText,
            'nickname' => (string)$r['nickname'],
            'created_at' => (int)$r['created_at'],
            'time_text' => date('Y-m-d H:i', (int)$r['created_at']),
        ];
    }

    Api::json([
        'ok' => true,
        'data' => $list,
        'total' => $total,
        'page' => $page,
        'psize' => $psize,
        'pages' => $psize > 0 ? (int)ceil($total / $psize) : 1,
    ]);
});

/* ---------- 批量删除（消息记录 + 物理文件） ---------- */
Plugin::route('plugin_attachment_manager_delete', function (array $ctx) use ($amGuard) {
    $amGuard($ctx);
    $ids = $ctx['post']['ids'] ?? '';
    if (is_array($ids)) {
        $idList = $ids;
    } else {
        $idList = preg_split('/[\s,]+/', (string)$ids) ?: [];
    }
    $idList = array_values(array_filter(array_map('intval', $idList), function ($v) { return $v > 0; }));
    if (!$idList) Api::json(['ok' => false, 'msg' => '未选择任何附件']);

    $deleted = 0;
    foreach ($idList as $mid) {
        $msg = DB::one('SELECT * FROM messages WHERE id=?', [$mid]);
        if (!$msg) continue;
        $type = $msg['type'];
        if ($type === 'file') {
            $info = json_decode((string)$msg['content'], true);
            if (is_array($info) && !empty($info['path'])) {
                $abs = Upload::fileAbs((string)$info['path']);
                if ($abs && is_file($abs)) @unlink($abs);
            }
        } elseif ($type === 'image') {
            $abs = haAM_image_abs((string)$msg['content']);
            if ($abs) @unlink($abs);
        }
        DB::run('DELETE FROM messages WHERE id=?', [$mid]);
        $deleted++;
    }
    Sec::log('admin_attachment_delete', $ctx['actor']['nickname'], ['count' => $deleted]);
    Api::json(['ok' => true, 'msg' => "已删除 $deleted 个附件", 'deleted' => $deleted]);
});
Plugin::sensitive('plugin_attachment_manager_delete');   // 删除附件与消息记录：敏感（v1.0.91）

/* ---------- 管理员下载（不依赖房间状态，直接校验文件归属） ---------- */
Plugin::route('plugin_attachment_manager_download', function (array $ctx) use ($amGuard) {
    $amGuard($ctx);
    $mid = (int)($_GET['id'] ?? 0);
    $msg = DB::one('SELECT * FROM messages WHERE id=?', [$mid]);
    if (!$msg) Api::json(['ok' => false, 'msg' => '文件不存在'], 404);
    $type = $msg['type'];
    if ($type === 'file') {
        $info = json_decode((string)$msg['content'], true);
        $abs = Upload::fileAbs((string)($info['path'] ?? ''));
        $name = (string)($info['name'] ?? 'file');
    } else {
        // image: content 是 URL（相对或绝对），用辅助函数解析物理路径
        $url = (string)$msg['content'];
        $abs = haAM_image_abs($url);
        $name = basename(parse_url($url, PHP_URL_PATH) ?: $url);
    }
    if (!$abs || !is_file($abs)) Api::json(['ok' => false, 'msg' => '物理文件不存在'], 404);
    $name = preg_replace('/[\r\n"]/', '', $name);
    header('Content-Type: application/octet-stream');
    header('Content-Length: ' . filesize($abs));
    header('Content-Disposition: attachment; filename="' . $name . '"; filename*=UTF-8\'\'' . rawurlencode($name));
    header('X-Content-Type-Options: nosniff');
    readfile($abs);
    exit;
});

// 注册后台交互脚本与样式（由 ?action=assets 合并输出，仅后台页面引入）
Plugin::asset('css', 'attachment-manager/admin.css');
Plugin::asset('js', 'attachment-manager/admin.js');
