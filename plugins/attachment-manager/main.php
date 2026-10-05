<?php
/**
 * 附件上传插件（v1.2.41 自核心剥离；原名「附件管理」）
 *
 * ## 职责边界
 *
 * **本插件负责**：聊天里的「图片消息」与「文件消息」两类附件上传 ——
 *   输入框按钮、上传接口、体积上限、扩展名白名单、文件落盘、后台管理与配置。
 *
 * **核心仍负责（刻意不挪）**：头像上传（个人设置/资料卡）与表情贴纸。
 *   理由：这两个是**账号/表情**功能而非「聊天附件」——
 *   若插件停用后连头像都换不了，用户会直接认为「网站坏了」。
 *
 * 停用本插件后：聊天输入框的图片/文件按钮消失、上传路由消失（调用报「未知操作」），
 * 历史消息里的附件**照常可查看/下载**（读取走核心的 file_abs / 消息渲染，不经本插件）。
 *
 * ## 按钮显隐由插件自己决定
 *
 * 核心在输入栏留了**锚点** `<span id="haAttachTools"></span>`，本插件的 chat.js
 * 加载后往里注入两个按钮。核心因此不需要任何 if 判断 ——
 * 与 v1.2.37 第三方授权（`window.HaOauth` 决定入口是否渲染）是同一思路。
 *
 * ## 配置从核心迁来（v1.2.41）
 *
 * 原先是核心后台设置页的三个全局项：file_upload / file_max_size / file_exts。
 * 现改为本插件自有配置（表 plugin_attachment_config），并在**首次读取时**
 * 自动吸收核心旧值（haATInitOnce），吸收后核心不再读这三个键。
 * 为什么要迁移：用户很可能已在核心后台调过上限与扩展名，直接重置成默认等于丢配置。
 */
if (!defined('HALOU_VERSION')) exit;   // 禁止直接 HTTP 访问本文件

/* ============================ 配置（原核心设置项迁入） ============================ */
DB::run("CREATE TABLE IF NOT EXISTS plugin_attachment_config (
    k VARCHAR(32) PRIMARY KEY,
    v TEXT NOT NULL DEFAULT ''
)");

/** 默认配置 */
function haATDefaultConfig(): array
{
    return [
        'enabled' => '1',   // 是否允许上传附件（0=关闭）
        'max_mb'  => '10',  // 单文件大小上限（MB）
        'exts'    => 'zip,rar,7z,pdf,txt,md,doc,docx,xls,xlsx,ppt,pptx,mp3,mp4',
    ];
}

/**
 * 一次性迁移：把核心旧设置搬进插件配置。
 * ⚠️ 只能读一次 —— 若每次请求都回落核心旧值，用户在插件后台改的值会被核心覆盖回去。
 */
function haATInitOnce(): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    $have = [];
    foreach (DB::all('SELECT k FROM plugin_attachment_config') as $r) $have[(string)$r['k']] = true;
    if (isset($have['enabled']) && isset($have['max_mb']) && isset($have['exts'])) return;
    $map = ['enabled' => 'file_upload', 'max_mb' => 'file_max_size', 'exts' => 'file_exts'];
    foreach ($map as $newKey => $oldKey) {
        if (isset($have[$newKey])) continue;
        $v = DB::setting($oldKey, '');
        if ($v === '') continue;   // 核心没这个键（全新安装）→ 保持默认值
        DB::run('INSERT OR REPLACE INTO plugin_attachment_config (k, v) VALUES (?, ?)', [$newKey, (string)$v]);
    }
}
haATInitOnce();

/** 读配置（缺失项补默认值） */
function haATConfig(): array
{
    $cfg = haATDefaultConfig();
    foreach (DB::all('SELECT k, v FROM plugin_attachment_config') as $r) {
        if (array_key_exists($r['k'], $cfg)) $cfg[$r['k']] = (string)$r['v'];
    }
    $cfg['max_mb'] = max(1, min(1024, (int)$cfg['max_mb']));   // 夹在 1~1024MB
    return $cfg;
}

/** 写配置（只接受白名单键；扩展名还要过安全表） */
function haATSaveConfig(array $in): array
{
    $def = haATDefaultConfig();
    $safe = haATExtMime();
    foreach ($in as $k => $v) {
        if (!array_key_exists($k, $def)) continue;
        $v = trim((string)$v);
        if ($k === 'max_mb') {
            $v = (string)max(1, min(1024, (int)$v));
        } elseif ($k === 'exts') {
            $clean = [];
            foreach (preg_split('/[\s,，;；]+/u', $v) ?: [] as $p) {
                $e = strtolower(ltrim(trim((string)$p), '.'));
                if ($e !== '' && isset($safe[$e])) $clean[$e] = true;   // 不在安全表里的直接忽略
            }
            $v = $clean ? implode(',', array_keys($clean)) : $def['exts'];
        }
        DB::run('INSERT OR REPLACE INTO plugin_attachment_config (k, v) VALUES (?, ?)', [(string)$k, $v]);
    }
    return haATConfig();
}

/* ============================ 安全：扩展名 → MIME 白名单 ============================ */
/**
 * 允许作为「文件附件」的扩展名 => 可接受真实 MIME 列表。
 * 这是**最后一道闸**：后台配置里写了什么扩展名，都必须先在这里登记过，
 * 且 finfo 读出的真实 MIME 必须落在对应列表里 ——
 * 把 .zip 改名为 .pdf 之类的伪装会被挡下。
 *
 * ⚠️ svg / svgz 一律不登记：它是 XML、可内嵌 <script>，浏览器按图片渲染时脚本会执行。
 * ⚠️ php/phtml/html 等可执行 & 网页类同样不登记（本项目不需要交换源码）。
 * ⚠️ office 2007+（docx/xlsx/pptx）本质是 zip 包，finfo 常报 application/zip，
 *   故其 MIME 列表里一并接受 zip 的 MIME，避免误伤正常文件。
 */
function haATExtMime(): array
{
    return [
        'zip'  => ['application/zip', 'application/x-zip-compressed'],
        'rar'  => ['application/x-rar-compressed', 'application/vnd.rar', 'application/x-rar'],
        '7z'   => ['application/x-7z-compressed'],
        'gz'   => ['application/gzip', 'application/x-gzip'],
        'pdf'  => ['application/pdf'],
        'txt'  => ['text/plain'],
        'md'   => ['text/markdown', 'text/plain'],
        'csv'  => ['text/plain', 'text/csv'],
        'log'  => ['text/plain', 'text/x-log'],
        'doc'  => ['application/msword', 'application/octet-stream'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'xls'  => ['application/vnd.ms-excel', 'application/octet-stream'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
        'ppt'  => ['application/vnd.ms-powerpoint', 'application/octet-stream'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
        'mp3'  => ['audio/mpeg'],
        'wav'  => ['audio/wav', 'audio/x-wav'],
        'mp4'  => ['video/mp4'],
        'webm' => ['video/webm'],
    ];
}

/* ============================ 上传实现 ============================ */

/** 附件总开关（图片与文件共用） */
function haATEnabled(): bool
{
    return haATConfig()['enabled'] === '1';
}

/**
 * 单文件体积上限（字节）。
 * v1.2.42：$actor 非空时先过 `upload.maxsize` 钩子 —— 等级信任插件会按等级
 * **下调**上限（设计文档「五次功能解锁」：3 级起 1/4 全局上限、10 级起 1/2）。
 * 只接受「比全局更小」的值：插件放行不了比站点配置更大的文件，避免越权。
 */
function haATMaxBytes(?array $actor = null): int
{
    $max = (int)haATConfig()['max_mb'] * 1048576;
    if ($actor !== null) {
        $tmp = $max;
        Plugin::fire('upload.maxsize', [&$tmp, $actor]);
        if ($tmp > 0 && $tmp < $max) $max = $tmp;
    }
    return $max;
}

/** 当前允许的扩展名（后台配置 ∩ 安全表） */
function haATExts(): array
{
    $safe = haATExtMime();
    $out = [];
    foreach (preg_split('/[\s,，;；]+/u', haATConfig()['exts']) ?: [] as $piece) {
        $ext = strtolower(ltrim(trim((string)$piece), '.'));
        if ($ext !== '' && isset($safe[$ext])) $out[$ext] = true;
    }
    return $out === [] ? ['zip', 'pdf', 'txt'] : array_keys($out);
}

/** 读真实 MIME（finfo，绝不信任客户端声明的 type） */
function haATRealMime(string $path): string
{
    if (class_exists('finfo')) {
        $f = new finfo(FILEINFO_MIME_TYPE);
        $m = $f->file($path);
        if (is_string($m) && $m !== '') return strtolower($m);
    }
    return 'application/octet-stream';
}

/**
 * 存图片消息：复用核心 Upload（头像/贴纸同一条本地存储通道），
 * 这里额外先卡一次体积上限（配置项在插件里，不能指望核心再读）。
 */
function haATStoreImage(array $f, ?array $actor = null): array
{
    if (!haATEnabled()) return [false, '站点已关闭附件上传'];
    $err = (int)($f['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($err !== UPLOAD_ERR_OK) return [false, '上传失败（错误码 ' . $err . '）'];
    $tmp = (string)($f['tmp_name'] ?? '');
    $max = haATMaxBytes($actor);
    if ($tmp !== '' && is_file($tmp) && (int)@filesize($tmp) > $max) {
        return [false, '图片超过 ' . round($max / 1048576, 1) . ' MB 限制'];
    }
    return Upload::handle($f, 'image');   // 核心内部还会做「仅 jpg/png/gif/webp」校验
}

/**
 * 存文件附件。
 * 安全要点：① 错误码 + 体积上限 ② finfo 真实 MIME（不信任 $_FILES['type']）
 *          ③ 双重白名单（后台配置 ∩ 内置安全表）④ 随机重命名 + 年月目录
 *          ⑤ 目录写 index.html 防列举
 */
function haATStoreFile(array $f, ?array $actor = null): array
{
    if (!haATEnabled()) return [false, '站点已关闭附件上传'];
    $err = (int)($f['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($err !== UPLOAD_ERR_OK) return [false, '上传失败（错误码 ' . $err . '）'];
    $tmp  = (string)($f['tmp_name'] ?? '');
    $orig = (string)($f['name'] ?? 'file');
    if ($tmp === '' || !is_file($tmp)) return [false, '临时文件不可读'];

    $max  = haATMaxBytes($actor);
    $size = (int)@filesize($tmp);
    if ($size <= 0) return [false, '文件内容为空'];
    if ($size > $max) return [false, '文件超过 ' . round($max / 1048576) . ' MB 限制'];   // ⚠️ $max 是字节，别直接当 MB 显示

    $mime  = haATRealMime($tmp);
    $extIn = strtolower((string)pathinfo($orig, PATHINFO_EXTENSION));
    $allow = haATExts();
    $safe  = haATExtMime();

    if ($extIn === '' || !in_array($extIn, $allow, true) || !in_array($mime, $safe[$extIn] ?? [], true)) {
        // 声明的扩展名不可用：再看真实内容是否属于站点已开放的类型
        $real = null;
        foreach ($allow as $e) {
            if (in_array($mime, $safe[$e], true)) { $real = $e; break; }
        }
        if ($real === null) return [false, '不支持的文件类型（' . $mime . '），仅允许：' . implode('/', $allow)];
        $extIn = $real;
    }

    $cfg = require dirname(__DIR__, 2) . '/core/config.php';
    $dir = $cfg['upload']['dir'] . '/file/' . date('Ym');
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) return [false, '无法创建上传目录'];
    if (!is_file($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');

    $name = date('dHis') . '_' . bin2hex(random_bytes(8)) . '.' . $extIn;   // 随机名，杜绝穿越/覆盖
    $dest = $dir . '/' . $name;
    if (!move_uploaded_file($tmp, $dest)) return [false, '保存失败'];
    @chmod($dest, 0644);

    $safeName = preg_replace('/[\\\\\/\x00-\x1F\x7F]/u', '', $orig) ?: 'file';
    return [true, [
        'name' => mb_substr($safeName, 0, 120),
        'ext'  => $extIn,
        'size' => $size,
        'path' => 'file/' . date('Ym') . '/' . $name,
        'mime' => $mime,
    ]];
}

/* ============================ 上传路由 ============================ */
/** 已登录才能上传（游客没有附件能力，与核心原有口径一致） */
$atGuard = function (array $ctx): bool {
    return ($ctx['actor']['kind'] ?? '') !== 'none';
};

Plugin::route('plugin_attachment_manager_upload', function (array $ctx) use ($atGuard) {
    if (!$atGuard($ctx)) Api::json(['ok' => false, 'msg' => '请先登录'], 403);
    if (empty($ctx['files']['file'])) Api::json(['ok' => false, 'msg' => '未接收到文件'], 400);
    $allowAtt = true; $attReason = '';
    Plugin::fire('attachment.guard', [&$allowAtt, &$attReason, $ctx['actor']]);
    if (!$allowAtt) Api::json(['ok' => false, 'msg' => $attReason !== '' ? $attReason : '当前等级无法上传图片'], 403);
    [$ok, $urlOrMsg] = haATStoreImage($ctx['files']['file'], $ctx['actor']);
    if (!$ok) Api::json(['ok' => false, 'msg' => $urlOrMsg], 400);
    Api::json(['ok' => true, 'url' => $urlOrMsg]);
});

Plugin::route('plugin_attachment_manager_upload_file', function (array $ctx) use ($atGuard) {
    if (!$atGuard($ctx)) Api::json(['ok' => false, 'msg' => '请先登录'], 403);
    if (empty($ctx['files']['file'])) Api::json(['ok' => false, 'msg' => '没有选择文件'], 400);
    if (!Sec::rateLimit('upload_file', $ctx['actor']['kind'] . ($ctx['actor']['id'] ?? '') . '|' . Sec::ip(), 60, 20)) {
        Api::json(['ok' => false, 'msg' => '上传过于频繁，请稍后再试'], 429);
    }
    // v1.2.42：附件闸门（等级信任插件按等级限制文件上传）。
    //   单独给「能否上传」一个钩子，而不是只靠 upload.maxsize 把上限压到 0 ——
    //   后者用户看到的会是「文件超过 0 MB 限制」这种莫名其妙的提示。
    $allowAtt = true; $attReason = '';
    Plugin::fire('attachment.guard', [&$allowAtt, &$attReason, $ctx['actor']]);
    if (!$allowAtt) Api::json(['ok' => false, 'msg' => $attReason !== '' ? $attReason : '当前等级无法上传文件'], 403);
    [$ok, $res] = haATStoreFile($ctx['files']['file'], $ctx['actor']);
    if (!$ok) Api::json(['ok' => false, 'msg' => $res], 400);
    Sec::log('upload_file', $ctx['actor']['nickname'], ['size' => $res['size'], 'ext' => $res['ext']]);
    // v1.2.42：上传成功事件（等级信任插件据此外挂「今日上传文件」任务）
    if (($ctx['actor']['kind'] ?? '') === 'user') {
        Plugin::fire('file.uploaded', [(int)$ctx['actor']['id'], 'file', (int)$res['size']]);
    }
    Api::json(['ok' => true, 'file' => $res]);
});

/* ============================ 后台配置路由 ============================ */
/** 管理员鉴权：插件路由的公共守卫。
 *  ⚠️ 必须定义在**所有 use($amGuard) 之前** —— use() 捕获的是变量**值**，
 *     定义在后面会捕获到 null，调用时直接致命错误。 */
$amGuard = function (array $ctx): void {
    if (($ctx['actor']['role'] ?? '') !== 'admin') Api::json(['ok' => false, 'msg' => '需要管理员权限'], 403);
};

Plugin::route('plugin_attachment_manager_cfg_get', function (array $ctx) use ($amGuard) {
    $amGuard($ctx);
    Api::json([
        'ok' => true,
        'config' => haATConfig(),
        'active_exts' => haATExts(),
        'safe_exts' => array_keys(haATExtMime()),
    ]);
});

Plugin::route('plugin_attachment_manager_cfg_save', function (array $ctx) use ($amGuard) {
    $amGuard($ctx);
    $post = $ctx['post'];
    $cfg = haATSaveConfig([
        'enabled' => $post['enabled'] ?? '',
        'max_mb'  => $post['max_mb'] ?? '',
        'exts'    => $post['exts'] ?? '',
    ]);
    Api::json(['ok' => true, 'config' => $cfg, 'active_exts' => haATExts()]);
});

/**
 * 主程序未在页面中引入 ?action=assets&type=css，插件 CSS 不会自动加载。
 * 通过 page.head 钩子注入 <link> 标签，确保后台样式生效。
 */
Plugin::on('page.head', function () {
    echo '<link rel="stylesheet" href="?action=assets&type=css&am=' . HALOU_VERSION . '">';
});

Plugin::asset('js', 'attachment-manager/chat.js');


/** 管理员鉴权：插件路由的公共守卫 */

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
Plugin::adminPage('attachment-manager', '附件上传', function () {
    return '<h2>附件上传</h2>'
        . '<p class="ha-admin-desc">配置聊天附件（图片 / 文件）的上传规则，并管理已上传的文件。'
        . '停用本插件后，聊天输入框的图片与文件按钮会一并消失。</p>'
        // v1.2.41：以下三项由本插件接管（原先在核心「站点设置」里）
        . '<div class="ha-card">'
        . '<div class="ha-form-row">'
        . '<div class="ha-form-item" style="min-width:140px"><label>允许上传附件</label>'
        . '<select class="ha-input" id="haAtEnabled"><option value="1">允许</option><option value="0">禁止</option></select></div>'
        . '<div class="ha-form-item" style="min-width:140px"><label>单文件大小上限(MB)</label>'
        . '<input class="ha-input" id="haAtMaxMb" type="number" min="1" max="1024" value="10"></div>'
        . '</div>'
        . '<div class="ha-form-item"><label>允许的文件扩展名</label>'
        . '<input class="ha-input" id="haAtExts" placeholder="zip,pdf,txt,docx">'
        . '<p style="font-size:12px;color:#5C5C5C;margin-top:4px">逗号分隔。只有安全类型表内登记过的扩展名才会生效；'
        . 'svg / php / html 等可执行或可内嵌脚本的类型不予登记（即使填了也不会放行）。'
        . '当前生效：<span id="haAtActive">-</span></p></div>'
        . '<button class="ha-btn ha-btn-primary" onclick="HaAT.saveCfg()">保存配置</button>'
        . '</div>'
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
