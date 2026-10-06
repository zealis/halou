<?php
/**
 * 用户管理插件（v1.0.44 自后台剥离）
 *
 * 后台页面：Plugin::adminPage() 注册「用户管理」子页（插件管理分类下）。
 * API 路由：Plugin::route() 注册三条管理员操作，action 前缀 plugin_user_manager_。
 * 安全约束：所有路由第一步必须做管理员鉴权（插件路由不在 Admin::handle 内，
 *           不会自动获得管理员保护）；搜索仅支持数字用户 ID（昵称允许重名，见开发约束）。
 * 历史同步：改角色/称号时同步刷新 messages 快照（v1.0.39 语义，随功能迁移）。
 */
if (!defined('HALOU_VERSION')) exit;   // 禁止直接 HTTP 访问本文件

/** 管理员鉴权：插件路由的公共守卫 */
$umGuard = function (array $ctx): void {
    if (($ctx['actor']['role'] ?? '') !== 'admin') Api::json(['ok' => false, 'msg' => '需要管理员权限'], 403);
};

/* ---------- 后台页面（HTML 注入 #haAdminMain，交互函数见 assets/admin.js） ---------- */
Plugin::adminPage('user-manager', '用户管理', function () {
    return '<h2>用户管理</h2><p class="ha-admin-desc">搜索用户，管理身份与头衔。昵称允许重名，仅支持按用户 ID 精确查询。</p>'
        . '<div class="ha-card"><h3 style="margin-bottom:10px">用户搜索</h3>'
        . '<div class="ha-form-row"><div class="ha-form-item" style="flex:1"><input class="ha-input" id="haAQ" placeholder="输入用户 ID（纯数字）"></div>'
        . '<button class="ha-btn ha-btn-primary" onclick="HaUM.search()">搜索用户</button></div></div>'
        . '<div id="haAResult"></div>';
});

/* ---------- 搜索：仅数字用户 ID 精确查询（原 admin_users） ---------- */
Plugin::route('plugin_user_manager_search', function (array $ctx) use ($umGuard) {
    $umGuard($ctx);
    $q = trim((string)($ctx['post']['q'] ?? ''));
    if ($q === '') Api::json(['ok' => true, 'data' => [], 'hint' => '请输入用户 ID']);
    if (!preg_match('/^\d{1,19}$/', $q)) Api::json(['ok' => false, 'msg' => '用户搜索仅支持数字用户 ID']);
    $rows = DB::all("SELECT id,nickname,email,role,title,points,status,created_at,last_login FROM users
        WHERE id=? LIMIT 1", [(int)$q]);
    // v1.2.43：带出等级（若安装了「等级信任」插件）。
    // 用钩子而不是直接查 plugin_level_trust 表 —— 本插件不该知道别的插件的表结构，
    // 也不该在对方未安装时报「表不存在」。哨兵值 -1 = 无等级体系，前端据此隐藏该列。
    foreach ($rows as &$u) {
        $lv = -1;
        Plugin::fire('user.level.get', [&$lv, (int)$u['id']]);
        $u['level'] = $lv;
    }
    unset($u);
    Api::json(['ok' => true, 'data' => $rows]);
});

/* ---------- 用户概览（v1.2.56）：详情弹窗数据 ----------
   与 search 的区别：带 avatar / status / reg_ip / last_login_ip 等概览字段。
   只读接口，不做任何修改 → 不进 sensitive，不消耗一次性票据。 */
Plugin::route('plugin_user_manager_detail', function (array $ctx) use ($umGuard) {
    $umGuard($ctx);
    $id = (int)($ctx['post']['id'] ?? 0);
    if ($id <= 0) Api::json(['ok' => false, 'msg' => '非法用户']);
    $u = DB::one('SELECT id,nickname,email,role,title,status,points,avatar,created_at,reg_ip,last_login,last_login_ip
        FROM users WHERE id=?', [$id]);
    if (!$u) Api::json(['ok' => false, 'msg' => '用户不存在'], 404);
    // 等级：与 search 同一口径 —— 走钩子问「等级信任」插件，-1 = 无等级体系
    $lv = -1;
    Plugin::fire('user.level.get', [&$lv, $id]);
    $u['level'] = $lv;
    Api::json(['ok' => true, 'data' => $u]);
});

/* ---------- 保存：角色 / 称号 / 积分（原 admin_user_set） ---------- */
Plugin::route('plugin_user_manager_save', function (array $ctx) use ($umGuard) {
    $umGuard($ctx);
    $post = $ctx['post'];
    $actor = $ctx['actor'];
    $id = (int)($post['id'] ?? 0);
    if ($id <= 0) Api::json(['ok' => false, 'msg' => '非法用户']);
    // 锁死超级管理员（uid=1）：用户组不可改动，否则系统将失去唯一超管（v1.0.88）
    if ($id === 1 && ($post['role'] ?? '') !== 'admin') {
        Sec::log('admin_user_lock', $actor['nickname'], ['id' => $id]);
        Api::json(['ok' => false, 'msg' => '超级管理员（1 号账号）用户组已被锁定，不可修改']);
    }
    $role = (string)($post['role'] ?? '');
    if (!in_array($role, ['member', 'vip', 'admin'], true)) Api::json(['ok' => false, 'msg' => '非法角色']);
    $title = (string)($post['title'] ?? '');
    DB::run('UPDATE users SET role=?, title=? WHERE id=?', [$role, $title, $id]);
    // 历史消息里的角色/称号为发送时快照，一并刷新（v1.0.39 语义随功能迁移）
    DB::run('UPDATE messages SET role=?, title=? WHERE user_id=?', [$role, $title, $id]);
    // 积分：允许单独调整（可为负数，但不接受非数字）
    if (isset($post['points']) && $post['points'] !== '') {
        $pts = (int)$post['points'];
        DB::run('UPDATE users SET points=? WHERE id=?', [$pts, $id]);
        Sec::log('admin_user_points', $actor['nickname'], ['id' => $id, 'points' => $pts]);
    }
    // v1.2.43：等级编辑（依赖「等级信任」插件；未安装时钩子无人响应，$ok 保持 null）。
    // ⚠️ 必须区分「未安装」与「设置失败」：前者提示去装插件，后者才是真失败。
    //    一律返回「已更新」会让管理员以为等级改成功了，实际没动。
    if (isset($post['level']) && $post['level'] !== '') {
        $lv = (int)$post['level'];
        if ($lv < 1) Api::json(['ok' => false, 'msg' => '等级需为 ≥1 的整数']);
        $lok = null; $lmsg = '';
        Plugin::fire('user.level.set', [$id, $lv, &$lok, &$lmsg]);
        if ($lok === null) {
            Api::json(['ok' => false, 'msg' => '未安装或未启用「等级信任」插件，无法编辑等级']);
        }
        if ($lok !== true) Api::json(['ok' => false, 'msg' => $lmsg !== '' ? $lmsg : '等级设置失败']);
        Sec::log('admin_user_level', $actor['nickname'], ['id' => $id, 'level' => $lv]);
    }
    Sec::log('admin_user_set', $actor['nickname'], ['id' => $id, 'role' => $role]);
    Api::json(['ok' => true, 'msg' => '已更新']);
});
Plugin::sensitive('plugin_user_manager_save');   // 改用户组/积分：敏感（v1.0.91）

/* ---------- 禁用 / 启用（原 admin_user_status） ---------- */
Plugin::route('plugin_user_manager_status', function (array $ctx) use ($umGuard) {
    $umGuard($ctx);
    $id = (int)($ctx['post']['id'] ?? 0);
    $status = (int)($ctx['post']['status'] ?? 1) === 1 ? 1 : 0;
    // 超管不可禁用：禁用后系统失去唯一超管，后台将无人可用（v1.0.88）
    if ($id === 1 && $status !== 1) {
        Api::json(['ok' => false, 'msg' => '超级管理员（1 号账号）不可禁用']);
    }
    DB::run('UPDATE users SET status=? WHERE id=?', [$status, $id]);
    Api::json(['ok' => true, 'msg' => '已更新']);
});
Plugin::sensitive('plugin_user_manager_status');   // 禁用账号：敏感（v1.0.91）

// 注册后台交互脚本（由 ?action=assets&type=js 合并输出，仅后台页面引入）
Plugin::asset('js', 'user-manager/admin.js');
