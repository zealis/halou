<?php
/**
 * 昵称保留插件（v1.3.1）
 *
 * 唯一能力：昵称保留。管理员在后台维护保留昵称列表（逗号分隔，textarea 可增删），
 * 首次显示内置默认保留（admin/root/administrator/system/support/official/staff/
 * moderator/api/www/login/register/account/help/about/null/undefined/guest/test）。
 * 启动插件（插件管理里启用本插件）后生效：注册 / 修改资料 / 安装向导设置昵称时，
 * 命中保留列表即拒绝。禁用插件则 main.php 不加载、钩子不注册，自然不生效。
 *
 * 钩子：nickname.before_save（见 core/auth.php Auth::checkNickname）
 *   回调签名 function (&$nick, &$err, $ctx)
 *     - $err 设为非空字符串即拦截，$err 即展示给用户的文案；
 *     - $ctx['scene'] 为 register / profile / install。
 *
 * 列表存储：settings 表 plugin_nickname_guard_list（英文逗号 + 空格分隔的归一化串）。
 * 分隔符：输入支持英文 , 与中文 ， 逗号，保存时 owNGNormalize 统一为英文逗号（去空、去重）。
 * 首次状态：plugin_nickname_guard_init 为 '0' 时，展示与拦截均回退到内置默认列表；
 *           管理员首次保存后置 '1'，之后以保存值为准（可为空 = 不保留任何昵称）。
 */
if (!defined('OWLSGO_VERSION')) exit;

/* ---------- 设置键 ---------- */
function owNGKeyList(): string { return 'plugin_nickname_guard_list'; }  // 逗号分隔原始字符串
function owNGKeyInit(): string { return 'plugin_nickname_guard_init'; }  // '1' 已首次保存 / '0' 未保存

/** 内置默认保留昵称（小写键 => true），首次展示与首次保存前拦截的回退来源 */
function owNGDefaults(): array
{
    static $d = null;
    if ($d !== null) return $d;
    $d = [];
    foreach ([
        'admin','root','administrator','system','support','official','staff','moderator',
        'api','www','login','register','account','help','about','null','undefined','guest','test',
    ] as $n) {
        $d[mb_strtolower($n, 'UTF-8')] = true;
    }
    return $d;
}

/**
 * 把原始输入归一化为保留昵称数组（保留原大小写）：
 *   - 同时识别英文逗号 , 与中文逗号 ， 作为分隔符；
 *   - 去除首尾空格与空白项；
 *   - 按小写去重，保留首次出现的大小写形式。
 */
function owNGNormalize(string $raw): array
{
    $out = [];
    $seen = [];
    foreach (preg_split('/[,，]/u', $raw) as $n) {
        $n = trim($n);
        if ($n === '') continue;
        $k = mb_strtolower($n, 'UTF-8');
        if (isset($seen[$k])) continue;
        $seen[$k] = true;
        $out[] = $n;
    }
    return $out;
}

/**
 * 当前生效的保留昵称集合（小写键 => true），请求内缓存。
 * 未首次保存（init=0）时回退内置默认；已保存则用保存值归一化解析。
 */
function owNGCurrentList(): array
{
    static $list = null;
    if ($list !== null) return $list;
    if (DB::setting(owNGKeyInit(), '0') === '1') {
        $names = owNGNormalize((string)DB::setting(owNGKeyList(), ''));
    } else {
        $names = array_keys(owNGDefaults());
    }
    $list = [];
    foreach ($names as $n) {
        $list[mb_strtolower($n, 'UTF-8')] = true;
    }
    return $list;
}

/* ---------- 钩子：命中保留列表即拒绝（插件启用时才注册） ---------- */
Plugin::on('nickname.before_save', function (string &$nick, ?string &$err, array $ctx): void {
    $list = owNGCurrentList();
    if (!$list) return;
    $key = mb_strtolower(trim($nick), 'UTF-8');
    if ($key === '') return;
    if (isset($list[$key])) {
        $err = '该昵称为系统保留，请更换';
        Sec::log('nickname_reserve_block', $nick, ['scene' => $ctx['scene'] ?? '']);
    }
});

/* ---------- 后台页面：保留昵称列表（可增删） ---------- */
Plugin::adminPage('nickname-guard', '昵称保留', function () {
    // 未首次保存时回退内置默认，便于管理员在此基础上增删
    if (DB::setting(owNGKeyInit(), '0') === '1') {
        $list = (string)DB::setting(owNGKeyList(), '');
    } else {
        $list = implode(', ', array_keys(owNGDefaults()));
    }
    return '<h2>昵称保留</h2>'
        . '<p class="ow-admin-desc">维护保留昵称列表（逗号分隔，可自由增删）。启用本插件后，用户注册或修改昵称时命中列表即拒绝。默认已填入一组常见保留昵称，可按需修改。</p>'
        . '<div class="ow-card">'
        . '<div class="ow-form-item"><label>保留昵称列表</label>'
        . '<textarea class="ow-input" id="owNGList" rows="8" style="width:100%;resize:vertical;font-family:var(--ow-mono,Consolas,monospace)" placeholder="例如：管理员, 客服, admin, root">' . Sec::e($list) . '</textarea>'
        . '<p style="font-size:12px;color:var(--ow-text-sub,#999);margin-top:4px">多个昵称用英文逗号或中文逗号分隔；保存时自动统一为英文逗号；匹配不区分大小写；自动去除首尾空格与重复项。清空并保存 = 不保留任何昵称。</p></div>'
        . '<div class="ow-form-row" style="margin-top:10px"><button class="ow-btn ow-btn-primary" onclick="OwNG.save()">保存设置</button></div>'
        . '<div id="owNGMsg" style="margin-top:10px"></div>'
        . '</div>';
});

/* ---------- 保存接口：仅列表（仅管理员） ---------- */
$ngGuard = function (array $ctx): void {
    if (($ctx['actor']['role'] ?? '') !== 'admin') Api::json(['ok' => false, 'msg' => '需要管理员权限'], 403);
};

Plugin::route('plugin_nickname_guard_save', function (array $ctx) use ($ngGuard) {
    $ngGuard($ctx);
    $raw = (string)($ctx['post']['list'] ?? '');
    // 归一化：中英文逗号都识别，去空、去重，统一存为英文逗号 + 空格分隔
    $store = implode(', ', owNGNormalize($raw));
    if (strlen($store) > 2000) Api::json(['ok' => false, 'msg' => '保留昵称列表过长（上限 2000 字符）']);
    DB::setSetting(owNGKeyList(), $store);
    DB::setSetting(owNGKeyInit(), '1');
    Sec::log('nickname_reserve_save', $ctx['actor']['nickname']);
    Api::json(['ok' => true, 'msg' => '已保存']);
});

// 注册后台交互脚本（由 ?action=assets&type=js 合并输出，仅后台页面引入）
Plugin::asset('js', 'nickname-guard/admin.js');
