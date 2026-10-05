<?php
/**
 * 等级信任插件（v1.2.42）
 *
 * 规则出处：设计文档/等级设计.md
 *
 * ── 等级公式 ────────────────────────────────────────────────
 *   L = 1 + ⌊D + W_最终⌋
 *   D = 累计完成每日固定任务的天数
 *   W_最终 = min(W_总, 0.5 × D) × 追赶系数
 *   不设满级；每天最多升 2 级（由公式天然保证：D 每天 +1，W 每天最多 +0.8）
 *
 * ── 分阶段每日任务 ──────────────────────────────────────────
 *   新手 1-5    登录 + 群发言 1
 *   日常 6-15   登录 + 群发言 3 + 群聊首条
 *   活跃 16-30  登录 + 群发言 5 + 群文件操作 1 + 私聊首条
 *   核心 31-45  保底：登录 + 群发言 5 + 群聊首条；挑战：上传 1 + 下载 1
 *   荣誉 46+    保底：登录 + 群发言 10 + 群聊首条 + 私聊首条；挑战：上传 1 + 下载 1
 *   高阶段任务支持「替代」（无文件、无好友时不卡人），见 haLTStage() 的 alt。
 *
 * ── 五次功能解锁（设计文档第五节）────────────────────────────
 *   3 级  自定义头像、单文件 ≤ 1/4 全局上限
 *   10 级 加好友、创建 3 个群聊、单文件 ≤ 1/2 全局上限
 *   20 级 上传/设置贴纸、创建 5 个群聊
 *   35 级 管理权限候选资格（本插件不做，仅标记）
 *   50 级 创建最多 8 个群、高级文件权限（= 全局上限）
 *   ⚠️ 全部限制可由后台「等级信任 → 限制开关」一键关闭（默认开启）。
 *
 * 安全与性能约束：
 *   - 所有 SQL 参数化；等级行按 user_id 主键读写。
 *   - `user.active` 每请求都会触发（含长轮询），因此**同日内只做一次主键查询就返回**，
 *     不写库、不算加权；跨天才做迁移与结算。
 *   - 单插件抛异常不影响主流程（Plugin::fire 已兜底）。
 */
if (!defined('HALOU_VERSION')) exit;   // 禁止直接 HTTP 访问本文件

/* ============================ 建表 ============================ */

/** 懒建表：只在真正用到时执行（插件 main.php 顶层不做副作用） */
function haLTBoot(): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    $pk = 'INTEGER PRIMARY KEY';        // SQLite
    $ts = 'INTEGER NOT NULL';
    if (DB::driver() === 'mysql') {
        $pk = 'BIGINT UNSIGNED PRIMARY KEY';
        $ts = 'BIGINT UNSIGNED NOT NULL';
    } elseif (DB::driver() === 'pgsql') {
        $pk = 'BIGSERIAL PRIMARY KEY';
    }
    DB::run("CREATE TABLE IF NOT EXISTS plugin_level_trust (
        user_id      {$pk},
        level        INTEGER NOT NULL DEFAULT 1,      -- 当前等级
        days         INTEGER NOT NULL DEFAULT 0,      -- D：累计完成每日任务的天数
        weight       REAL    NOT NULL DEFAULT 0,      -- W：累计加权（天）
        login_streak INTEGER NOT NULL DEFAULT 0,      -- C：连续登录天数
        login_days   INTEGER NOT NULL DEFAULT 0,      -- 累计登录天数
        file_w_days  INTEGER NOT NULL DEFAULT 0,      -- 文件加权已累积次数（上限 3）
        day          TEXT    NOT NULL DEFAULT '',     -- 上次活跃日 Y-m-d
        today        TEXT    NOT NULL DEFAULT '{}',   -- 今日进度 JSON
        settled      INTEGER NOT NULL DEFAULT 0,      -- 今日是否已结算（加权每天只结算一次）
        frozen_day   INTEGER NOT NULL DEFAULT 0,      -- 被冻结的自然日 Ymd（0=未冻结）
        protect_used INTEGER NOT NULL DEFAULT 0,      -- 本月已用「连续登录保护」次数
        protect_mon  TEXT    NOT NULL DEFAULT '',     -- 保护计数所属月份 Y-m
        patch_used   INTEGER NOT NULL DEFAULT 0,      -- 本周已补签次数
        patch_week   TEXT    NOT NULL DEFAULT '',     -- 补签计数所属周（Y-W）
        updated_at   {$ts} DEFAULT 0)");
    DB::run("CREATE TABLE IF NOT EXISTS plugin_level_config (
        k TEXT PRIMARY KEY, v TEXT NOT NULL DEFAULT '')");
}

/** 读插件配置（缺省值内置，避免首次启用时空表导致限制全开/全关不确定） */
/**
 * 读插件配置。
 * ⚠️ 缓存放在 $GLOBALS 而不是函数内 static：函数级 static 无法被 haLTSetCfg 清掉，
 *    同请求内「后台刚关掉限制 → 上传仍被拦」这种不一致查起来非常费劲。
 */
function haLTCfg(string $k): string
{
    haLTBoot();
    if (!isset($GLOBALS['_haLTCfg']) || !is_array($GLOBALS['_haLTCfg'])) $GLOBALS['_haLTCfg'] = [];
    if (array_key_exists($k, $GLOBALS['_haLTCfg'])) return $GLOBALS['_haLTCfg'][$k];
    $v = DB::val('SELECT v FROM plugin_level_config WHERE k=?', [$k]);
    $def = ['gating' => '1'];
    $GLOBALS['_haLTCfg'][$k] = ($v === null || $v === false || $v === '') ? ($def[$k] ?? '') : (string)$v;
    return $GLOBALS['_haLTCfg'][$k];
}

function haLTSetCfg(string $k, string $v): void
{
    haLTBoot();
    DB::run('DELETE FROM plugin_level_config WHERE k=?', [$k]);
    DB::run('INSERT INTO plugin_level_config (k, v) VALUES (?,?)', [$k, $v]);
    unset($GLOBALS['_haLTCfg'][$k]);      // 立刻失效，同请求内后续读取拿到新值
}

/* ============================ 等级计算 ============================ */

/**
 * 阶段任务表。
 * base      = 保底任务，全部完成才升级
 * challenge = 挑战任务，完成给额外加权（不阻塞升级）
 * alt       = 替代任务组（组内全部满足即视为该任务完成），避免无文件/无好友时卡住
 */
function haLTStage(int $level): array
{
    if ($level <= 5) {
        return ['name' => '新手阶段', 'from' => 1, 'to' => 5, 'base' => [
            ['k' => 'login', 'n' => 1],
            ['k' => 'gm', 'n' => 1],
        ], 'ch' => []];
    }
    if ($level <= 15) {
        return ['name' => '日常阶段', 'from' => 6, 'to' => 15, 'base' => [
            ['k' => 'login', 'n' => 1],
            ['k' => 'gm', 'n' => 3],
            ['k' => 'gfirst', 'n' => 1],
        ], 'ch' => []];
    }
    if ($level <= 30) {
        return ['name' => '活跃阶段', 'from' => 16, 'to' => 30, 'base' => [
            ['k' => 'login', 'n' => 1],
            ['k' => 'gm', 'n' => 5],
            ['k' => 'fact', 'n' => 1, 'alt' => [['k' => 'pfirst', 'n' => 1], ['k' => 'gfirst', 'n' => 1]]],
            ['k' => 'pfirst', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 3]]],
        ], 'ch' => []];
    }
    if ($level <= 45) {
        return ['name' => '核心阶段', 'from' => 31, 'to' => 45, 'base' => [
            ['k' => 'login', 'n' => 1],
            ['k' => 'gm', 'n' => 5],
            ['k' => 'gfirst', 'n' => 1],
        ], 'ch' => [
            ['k' => 'fup', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 5]]],
            ['k' => 'fdl', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 5]]],
        ]];
    }
    return ['name' => '荣誉阶段', 'from' => 46, 'to' => 0, 'base' => [
        ['k' => 'login', 'n' => 1],
        ['k' => 'gm', 'n' => 10],
        ['k' => 'gfirst', 'n' => 1],
        ['k' => 'pfirst', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 3]]],
    ], 'ch' => [
        ['k' => 'fup', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 5]]],
        ['k' => 'fdl', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 5]]],
    ]];
}

/** 阶段号（1~5），用于前端配色与后台分布统计 */
function haLTStageNo(int $level): int
{
    if ($level <= 5) return 1;
    if ($level <= 15) return 2;
    if ($level <= 30) return 3;
    if ($level <= 45) return 4;
    return 5;
}

/** 某项进度。fact（群文件操作）是上传+下载的合计，不单独存 */
function haLTProg(array $t, string $k): int
{
    if ($k === 'fact') return (int)($t['fup'] ?? 0) + (int)($t['fdl'] ?? 0);
    return (int)($t[$k] ?? 0);
}

/**
 * 单个任务是否完成。
 * alt 是「替代任务组」——**组内每一项都要满足**才算替代成功
 * （例：上传文件 1 个 可用「私聊首条 + 群聊首条」替代，两条都要有）。
 */
function haLTTaskOk(array $task, array $t): bool
{
    if (haLTProg($t, $task['k']) >= (int)$task['n']) return true;
    $alt = $task['alt'] ?? [];
    if (!$alt) return false;
    foreach ($alt as $one) {
        if (!is_array($one) || !isset($one['k'])) return false;   // 结构异常：宁可不放行
        if (haLTProg($t, $one['k']) < (int)$one['n']) return false;
    }
    return true;                                                   // 替代组全部满足
}

function haLTBaseOk(array $stage, array $t): bool
{
    foreach ($stage['base'] as $task) if (!haLTTaskOk($task, $t)) return false;
    return true;
}

/** 全服等级中位数（每次请求只算一次，追赶系数要用） */
function haLTMedian(): float
{
    static $m = null;
    if ($m !== null) return $m;
    haLTBoot();
    $n = (int)DB::val('SELECT COUNT(*) FROM plugin_level_trust');
    if ($n <= 0) return ($m = 1.0);
    $off = (int)floor($n / 2);                       // 字面量整数，无注入风险
    $row = DB::one('SELECT level FROM plugin_level_trust ORDER BY level LIMIT 1 OFFSET ' . $off);
    return ($m = $row ? (float)$row['level'] : 1.0);
}

/** 追赶系数：低于中位数加速，高出中位数 10 级减速 */
function haLTCatchUp(int $level): float
{
    $med = haLTMedian();
    if ($level < $med) return 1.2;
    if ($level > $med + 10) return 0.8;
    return 1.0;
}

/**
 * 等级公式：L = 1 + ⌊D + min(W, 0.5D) × 追赶系数⌋
 * ⚠️ W 的单位是「天」，不是等级；封顶 0.5×D 防止活跃用户把休闲用户甩太远。
 */
function haLTCalc(int $days, float $weight, float $factor = 1.0): int
{
    $wv = min($weight, 0.5 * $days);
    return max(1, 1 + (int)floor($days + $wv * $factor));
}

/**
 * 按公式重算等级并写回 $row。
 * ⚠️ 取 max(旧等级, 公式值)：设计文档「未完成不降级」。追赶快慢切换、或后台直设过
 *    等级时，纯公式会算出**比当前更低**的等级 —— 表现为「什么都没做却掉级」。
 *    所有改等级的地方（每日结算、补签后台操作）都必须走这里，别各处自己算一遍。
 */
function haLTRecalc(array &$row): void
{
    $row['level'] = max((int)$row['level'],
        haLTCalc((int)$row['days'], (float)$row['weight'], haLTCatchUp((int)$row['level'])));
}

/* ============================ 行读写 ============================ */

function haLTDecode(string $json): array
{
    $a = json_decode($json ?: '{}', true);
    return is_array($a) ? $a : [];
}

/** 取等级行；不存在则按「注册默认 Lv.1」创建 */
function haLTRow(int $uid): array
{
    haLTBoot();
    $row = DB::one('SELECT * FROM plugin_level_trust WHERE user_id=?', [$uid]);
    if ($row) return $row;
    DB::run('INSERT INTO plugin_level_trust (user_id, level, days, weight, updated_at) VALUES (?,?,?,?,?)',
        [$uid, 1, 0, 0.0, time()]);
    return DB::one('SELECT * FROM plugin_level_trust WHERE user_id=?', [$uid]) ?: [];
}

function haLTSave(int $uid, array $row, array $t): void
{
    DB::run('UPDATE plugin_level_trust SET level=?, days=?, weight=?, login_streak=?, login_days=?,'
        . ' file_w_days=?, day=?, today=?, settled=?, frozen_day=?, protect_used=?, protect_mon=?,'
        . ' patch_used=?, patch_week=?, updated_at=? WHERE user_id=?', [
        (int)$row['level'], (int)$row['days'], (float)$row['weight'],
        (int)$row['login_streak'], (int)$row['login_days'], (int)$row['file_w_days'],
        (string)$row['day'], json_encode($t, JSON_UNESCAPED_UNICODE), (int)$row['settled'],
        (int)$row['frozen_day'], (int)$row['protect_used'], (string)$row['protect_mon'],
        (int)$row['patch_used'], (string)$row['patch_week'], time(), $uid,
    ]);
}

/**
 * 跨天迁移 + 记一次登录。
 * ⚠️ 同日内直接返回（零写入）—— user.active 每请求都触发，长轮询下不能每次都写库。
 */
function haLTTouch(int $uid): array
{
    $row = haLTRow($uid);
    if (!$row) return [null, []];
    $today = date('Y-m-d');
    if ((string)$row['day'] === $today) {
        // 今日已处理过：只把进度解出来，不做任何迁移
        return [$row, haLTDecode((string)$row['today'])];
    }

    $t = [];                                          // 新的一天：进度清零
    $prev = (string)$row['day'];
    $streak = (int)$row['login_streak'];
    if ($prev !== '') {
        $gap = (int)round((strtotime($today) - strtotime($prev)) / 86400);
        if ($gap === 1) {
            $streak++;                                // 连续
        } else {
            // 断签：每月 2 次保护机会，用完则连续天数减半（不清零，已得加权不受影响）
            $mon = date('Y-m');
            if ((string)$row['protect_mon'] !== $mon) { $row['protect_mon'] = $mon; $row['protect_used'] = 0; }
            if ((int)$row['protect_used'] < 2) {
                $row['protect_used'] = (int)$row['protect_used'] + 1;   // 消耗保护，连续天数保留
            } else {
                $streak = (int)floor($streak / 2);
            }
        }
    } else {
        $streak = 1;                                  // 首次活跃
    }
    $row['login_streak'] = $streak;
    $row['login_days'] = (int)$row['login_days'] + 1;
    $row['day'] = $today;
    $row['settled'] = 0;
    $t['login'] = 1;                                  // 登录任务：当天首次活跃即完成
    haLTSave($uid, $row, $t);
    return [$row, $t];
}

/* ============================ 有效行为判定 ============================ */

/**
 * 有效发言内容判定（设计文档第六节）：
 * 长度 ≥ 2、非纯表情、非纯链接。
 * 冷却（15 秒）与去重在 haLTAddMsg 里做 —— 它们依赖「今日进度」里的状态。
 */
function haLTValidText(string $s): bool
{
    $s = trim($s);
    if (mb_strlen($s) < 2) return false;
    if (preg_match('#^https?://\S+$#i', $s)) return false;              // 纯链接
    $stripped = preg_replace(
        '/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2190}-\x{21FF}\x{2B00}-\x{2BFF}\x{FE0F}\x{200D}\x{20E3}\s]/u',
        '', $s);
    if ($stripped === null || $stripped === '') return false;           // 纯表情
    return true;
}

/**
 * 记一次发言。
 * @param bool $isGroup 群聊（room_id>0）还是私聊
 */
function haLTAddMsg(int $uid, string $content, string $type, bool $isGroup): void
{
    if ($uid <= 0) return;
    if (!in_array($type, ['text', 'mention'], true)) return;   // 图片/文件/系统不算「发言」
    if (!haLTValidText($content)) return;

    [$row, $t] = haLTTouch($uid);
    if (!$row) return;
    if ((int)$row['frozen_day'] === (int)date('Ymd')) return;  // 当天被冻结

    $now = time();
    // ① 冷却 15 秒：距上一条**计入任务**的发言
    if (!empty($t['last_at']) && $now - (int)$t['last_at'] < 15) return;
    // ② 本分钟最多计入 5 条
    $minute = (int)floor($now / 60);
    if (empty($t['minute']) || (int)$t['minute'] !== $minute) { $t['minute'] = $minute; $t['minute_n'] = 0; }
    if ((int)($t['minute_n'] ?? 0) >= 5) return;
    // ③ 与最近 10 条内容不重复
    $h = md5(mb_strtolower(trim($content)));
    $recent = is_array($t['recent'] ?? null) ? $t['recent'] : [];
    if (in_array($h, $recent, true)) return;

    $t['minute_n'] = (int)$t['minute_n'] + 1;
    $t['last_at'] = $now;
    array_unshift($recent, $h);
    $t['recent'] = array_slice($recent, 0, 10);

    if ($isGroup) {
        $t['gm'] = haLTProg($t, 'gm') + 1;
        if (haLTProg($t, 'gm') === 1) $t['gfirst'] = 1;    // 群聊首条
    } else {
        $t['pfirst'] = 1;                                   // 私聊首条
    }
    haLTAfterProgress($uid, $row, $t);
}

/** 记一次文件操作（upload / download） */
function haLTAddFile(int $uid, string $kind): void
{
    if ($uid <= 0) return;
    [$row, $t] = haLTTouch($uid);
    if (!$row) return;
    if ((int)$row['frozen_day'] === (int)date('Ymd')) return;
    $key = $kind === 'download' ? 'fdl' : 'fup';
    // 设计文档：每天文件任务最多计 1 次上传 + 1 次下载
    if (haLTProg($t, $key) >= 1) { haLTAfterProgress($uid, $row, $t); return; }
    $t[$key] = haLTProg($t, $key) + 1;
    haLTAfterProgress($uid, $row, $t);
}

/* ============================ 结算 ============================ */

/** 进度变化后：判断是否达成保底任务 → 结算加权 → 重算等级 */
function haLTAfterProgress(int $uid, array $row, array $t): void
{
    if ((int)$row['settled'] === 1) { haLTSave($uid, $row, $t); return; }   // 今天已结算过
    $stage = haLTStage((int)$row['level']);
    if (!haLTBaseOk($stage, $t)) { haLTSave($uid, $row, $t); return; }

    // ① 连续登录加权（每天上限 0.3）
    $day = 0.0;
    $c = (int)$row['login_streak'];
    $dl = (int)$row['login_days'];
    if ($c > 0 && $c % 3 === 0) $day += 0.3;
    elseif ($dl > 0 && $dl % 30 === 0) $day += 0.1;
    // ② 每日发言加权 0.1~0.3（每天最多一次）
    if (haLTProg($t, 'gm') > 0) $day += 0.1 + (mt_rand(0, 200) / 1000);
    // ③ 文件操作加权 0.1~0.5（每天最多一次，最多累积 3 天）
    if (haLTProg($t, 'fact') > 0 && (int)$row['file_w_days'] < 3) {
        $day += 0.1 + (mt_rand(0, 400) / 1000);
        $row['file_w_days'] = (int)$row['file_w_days'] + 1;
    }
    if ($day > 0.8) $day = 0.8;                       // ④ 每日加权上限 0.8

    $row['weight'] = (float)$row['weight'] + $day;
    $row['days'] = (int)$row['days'] + 1;
    $row['settled'] = 1;
    haLTRecalc($row);          // 不降级由 haLTRecalc 保证
    haLTSave($uid, $row, $t);
}

/* ============================ 功能解锁 ============================ */

/**
 * 当前等级已解锁的能力。
 * ratio = 单文件上限相对「全局上限」的比例（0 = 禁止上传）
 */
function haLTUnlocks(int $level): array
{
    return [
        'avatar'   => $level >= 3,
        'sticker'  => $level >= 20,
        'friend'   => $level >= 10,
        // v1.2.43：'rooms'（建群数量上限）已移除 —— 建群不再受等级限制。
        //          保留注释而非字段，避免别处再看懂成「还可以按等级卡建群」。
        'ratio'    => $level >= 50 ? 1.0 : ($level >= 10 ? 0.5 : ($level >= 3 ? 0.25 : 0.0)),
        'mod_cand' => $level >= 35,          // 管理权限候选资格（标记，本插件不授予权限）
        'honor'    => $level >= 60,          // 荣誉标识（不解锁新功能，只显示）
    ];
}

/** 取用户当前等级（无记录 = 注册默认 Lv.1） */
function haLTLevelOf(int $uid): int
{
    if ($uid <= 0) return 1;
    haLTBoot();
    $v = DB::val('SELECT level FROM plugin_level_trust WHERE user_id=?', [$uid]);
    return $v === null || $v === false ? 1 : max(1, (int)$v);
}

/* ============================ 钩子 ============================ */

/** 每日登录（会话仍在就不走登录钩子，所以挂 user.active） */
Plugin::on('user.active', function (array $actor) {
    if (($actor['kind'] ?? '') !== 'user') return;
    $uid = (int)$actor['id'];
    if ($uid <= 0) return;
    [$row, $t] = haLTTouch($uid);
    if (!$row) return;
    // 登录本身就可能直接达成低阶段保底任务（新手阶段 = 登录 + 群发言 1，还差发言）
    haLTAfterProgress($uid, $row, $t);
});

/** 发言 */
Plugin::on('message.after_send', function ($id, $actor, $roomId, $content = '', $type = 'text', $toUserId = 0) {
    if (($actor['kind'] ?? '') !== 'user') return;                 // 游客没有等级
    haLTAddMsg((int)$actor['id'], (string)$content, (string)$type, (int)$roomId > 0);
});

/** 文件上传成功（附件上传插件） */
Plugin::on('file.uploaded', function (int $uid, string $kind, int $size = 0) {
    haLTAddFile($uid, 'upload');
});

/** 文件下载完成（核心 file_download） */
Plugin::on('file.downloaded', function (int $uid, int $msgId, int $ownerId = 0) {
    if ($ownerId > 0 && $ownerId === $uid) return;    // 下载自己的文件不计任务（防刷）
    haLTAddFile($uid, 'download');
});

/** 资料卡：把等级随 user_card 一起下发（前端无需再打一次接口） */
Plugin::on('user.card', function (array &$u, array $actor) {
    $lv = haLTLevelOf((int)($u['id'] ?? 0));
    $u['level'] = $lv;
    $u['level_stage'] = haLTStage($lv)['name'];
    $u['level_stage_no'] = haLTStageNo($lv);
    $u['level_honor'] = $lv >= 60 ? 1 : 0;
});

/** 上传闸门：头像 3 级起、贴纸 20 级起 */
Plugin::on('upload.guard', function (bool &$allow, string &$reason, string $kind, array $actor) {
    if (haLTCfg('gating') !== '1') return;
    if (($actor['role'] ?? '') === 'admin') return;            // 超管不受限
    $lv = haLTLevelOf((int)$actor['id']);
    $u = haLTUnlocks($lv);
    if ($kind === 'avatar' && !$u['avatar']) {
        $allow = false; $reason = '自定义头像需 3 级解锁（当前 Lv.' . $lv . '）';
    } elseif ($kind === 'sticker' && !$u['sticker']) {
        $allow = false; $reason = '上传贴纸需 20 级解锁（当前 Lv.' . $lv . '）';
    }
});

/** 加好友闸门：10 级起 */
Plugin::on('friend.guard', function (bool &$allow, string &$reason, array $actor, int $friendId) {
    if (haLTCfg('gating') !== '1') return;
    if (($actor['role'] ?? '') === 'admin') return;
    $lv = haLTLevelOf((int)$actor['id']);
    if (!haLTUnlocks($lv)['friend']) {
        $allow = false; $reason = '添加好友需 10 级解锁（当前 Lv.' . $lv . '）';
    }
});

/**
 * v1.2.43：**建群不再受等级限制**（用户定案）。
 * 原 room.create.guard 处理器已删除，核心侧的该钩子也一并移除 ——
 * 建群现在只受后台「允许用户创建群聊」开关约束。
 * 等级仍会在资料卡展示、仍影响头像 / 贴纸 / 好友 / 单文件大小，只是不卡建群。
 */

/** 单文件大小上限：按等级取全局上限的比例 */
Plugin::on('upload.maxsize', function (int &$maxBytes, array $actor) {
    if (haLTCfg('gating') !== '1') return;
    if (($actor['role'] ?? '') === 'admin') return;            // 超管用全局上限
    $ratio = haLTUnlocks(haLTLevelOf((int)$actor['id']))['ratio'];
    if ($ratio <= 0) { $maxBytes = 1; return; }                // 未解锁：只允许极小文件（实际会超限被拒）
    $maxBytes = (int)floor($maxBytes * $ratio);
});

/** 聊天附件闸门：3 级起才解锁文件上传（设计文档第 1 次解锁） */
Plugin::on('attachment.guard', function (bool &$allow, string &$reason, array $actor) {
    if (haLTCfg('gating') !== '1') return;
    if (($actor['role'] ?? '') === 'admin') return;
    $lv = haLTLevelOf((int)$actor['id']);
    if (haLTUnlocks($lv)['ratio'] <= 0) {
        $allow = false; $reason = '上传文件需 3 级解锁（当前 Lv.' . $lv . '）';
    }
});

/* ============================ 对外钩子（供其它插件读写等级） ============================ */

/**
 * `user.level.get` —— 取某用户等级。
 * 调用方把 $level 初始化为**哨兵值 -1**：没插件响应时它仍是 -1，
 * 调用方据此判断「等级插件未安装 / 未启用」并隐藏相关 UI。
 *
 * ```php
 * $lv = -1;
 * Plugin::fire('user.level.get', [&$lv, $uid]);
 * if ($lv < 0) { /* 无等级体系 *\/ }
 * ```
 */
Plugin::on('user.level.get', function (int &$level, int $uid) {
    if ($uid <= 0) return;
    $level = haLTLevelOf($uid);
});

/**
 * `user.level.set` —— 设置某用户等级（后台「用户管理」用）。
 * $ok 传入 **null**：没有插件响应时它保持 null，调用方据此提示「未安装等级插件」，
 * 而不是误报成功。等级只改数值，不重算加权（与插件后台的「直接设置」同口径）。
 *
 * ```php
 * $ok = null; $msg = '';
 * Plugin::fire('user.level.set', [$uid, $lv, &$ok, &$msg]);
 * ```
 */
Plugin::on('user.level.set', function (int $uid, int $level, ?bool &$ok, string &$msg) {
    if ($uid <= 0) { $ok = false; $msg = '非法用户'; return; }
    if ($level < 1) { $ok = false; $msg = '等级需为 ≥1 的整数'; return; }
    $row = haLTRow($uid);
    if (!$row) { $ok = false; $msg = '用户不存在'; return; }
    $t = haLTDecode((string)$row['today']);
    $row['level'] = max(1, $level);
    haLTSave($uid, $row, $t);
    $ok = true;
    $msg = '等级已设为 Lv.' . (int)$row['level'];
});

/* ============================ 前台路由 ============================ */

/** 我的等级（含今日任务进度，供资料卡/后续展示用） */
Plugin::route('plugin_level_trust_mine', function (array $ctx) {
    if (($ctx['actor']['kind'] ?? '') !== 'user') Api::json(['ok' => false, 'msg' => '游客没有等级']);
    $uid = (int)$ctx['actor']['id'];
    [$row, $t] = haLTTouch($uid);
    $stage = haLTStage((int)$row['level']);
    $tasks = [];
    foreach ($stage['base'] as $task) {
        $tasks[] = ['k' => $task['k'], 'n' => (int)$task['n'], 'cur' => haLTProg($t, $task['k']), 'alt' => !empty($task['alt'])];
    }
    Api::json([
        'ok' => true,
        'level' => (int)$row['level'], 'days' => (int)$row['days'],
        'weight' => round((float)$row['weight'], 2),
        'stage' => $stage['name'], 'stage_no' => haLTStageNo((int)$row['level']),
        'honor' => (int)$row['level'] >= 60 ? 1 : 0,
        'login_streak' => (int)$row['login_streak'], 'login_days' => (int)$row['login_days'],
        'settled' => (int)$row['settled'],
        'frozen' => (int)$row['frozen_day'] === (int)date('Ymd') ? 1 : 0,
        'tasks' => $tasks,
        'unlocks' => haLTUnlocks((int)$row['level']),
    ]);
});

/* ============================ 后台 ============================ */

/** 管理员鉴权：必须定义在 use($ltGuard) 之前（use 捕获的是变量值） */
$ltGuard = function (array $ctx): void {
    if (($ctx['actor']['role'] ?? '') !== 'admin') Api::json(['ok' => false, 'msg' => '需要管理员权限'], 403);
};

/** 后台概览：中位数 + 各阶段分布 */
Plugin::route('plugin_level_trust_stats', function (array $ctx) use ($ltGuard) {
    $ltGuard($ctx);
    haLTBoot();
    $rows = DB::all('SELECT level FROM plugin_level_trust');
    $dist = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
    $sum = 0;
    foreach ($rows as $r) { $dist[haLTStageNo((int)$r['level'])]++; $sum += (int)$r['level']; }
    Api::json([
        'ok' => true,
        'users' => count($rows),
        'median' => haLTMedian(),
        'avg' => $rows ? round($sum / count($rows), 1) : 0,
        'dist' => $dist,
        'gating' => haLTCfg('gating'),
    ]);
});

/** 查单个用户 */
Plugin::route('plugin_level_trust_user', function (array $ctx) use ($ltGuard) {
    $ltGuard($ctx);
    $uid = (int)($ctx['post']['uid'] ?? 0);
    if ($uid <= 0) Api::json(['ok' => false, 'msg' => '请填写用户 ID']);
    $u = DB::one('SELECT id, nickname, role FROM users WHERE id=?', [$uid]);
    if (!$u) Api::json(['ok' => false, 'msg' => '用户不存在']);
    [$row, $t] = haLTTouch($uid);
    $stage = haLTStage((int)$row['level']);
    $tasks = [];
    foreach ($stage['base'] as $task) {
        $tasks[] = ['k' => $task['k'], 'n' => (int)$task['n'], 'cur' => haLTProg($t, $task['k'])];
    }
    Api::json([
        'ok' => true,
        'uid' => $uid, 'nickname' => (string)$u['nickname'], 'role' => (string)$u['role'],
        'level' => (int)$row['level'], 'days' => (int)$row['days'], 'weight' => round((float)$row['weight'], 2),
        'stage' => $stage['name'], 'login_streak' => (int)$row['login_streak'], 'login_days' => (int)$row['login_days'],
        'settled' => (int)$row['settled'], 'frozen' => (int)$row['frozen_day'] === (int)date('Ymd') ? 1 : 0,
        'patch_used' => (int)$row['patch_used'], 'protect_used' => (int)$row['protect_used'],
        'tasks' => $tasks, 'today' => $t,
    ]);
});

/** 管理员操作：补签 / 冻结 / 解冻 / 直接设置 */
Plugin::route('plugin_level_trust_op', function (array $ctx) use ($ltGuard) {
    $ltGuard($ctx);
    $uid = (int)($ctx['post']['uid'] ?? 0);
    $op = (string)($ctx['post']['op'] ?? '');
    if ($uid <= 0) Api::json(['ok' => false, 'msg' => '请填写用户 ID']);
    $row = haLTRow($uid);
    if (!$row) Api::json(['ok' => false, 'msg' => '用户不存在']);
    $t = haLTDecode((string)$row['today']);

    switch ($op) {
        case 'patch':       // 补签：每周最多 1 次，视为完成当天全部固定任务，等级 +1
            $week = date('o-W');
            if ((string)$row['patch_week'] !== $week) { $row['patch_week'] = $week; $row['patch_used'] = 0; }
            if ((int)$row['patch_used'] >= 1) Api::json(['ok' => false, 'msg' => '本周补签次数已用完']);
            $row['patch_used'] = (int)$row['patch_used'] + 1;
            $row['days'] = (int)$row['days'] + 1;
            $row['settled'] = 1;
            haLTRecalc($row);
            haLTSave($uid, $row, $t);
            Api::json(['ok' => true, 'msg' => '已补签，等级提升至 Lv.' . (int)$row['level']]);

        case 'freeze':      // 冻结当天任务进度与加权
            $row['frozen_day'] = (int)date('Ymd');
            haLTSave($uid, $row, $t);
            Api::json(['ok' => true, 'msg' => '已冻结今日任务']);

        case 'unfreeze':
            $row['frozen_day'] = 0;
            haLTSave($uid, $row, $t);
            Api::json(['ok' => true, 'msg' => '已解除冻结']);

        case 'set':         // 直接设置等级与天数（迁移或纠错用）
            $lv = max(1, (int)($ctx['post']['level'] ?? 1));
            $days = max(0, (int)($ctx['post']['days'] ?? (int)$row['days']));
            $row['level'] = $lv;
            $row['days'] = $days;
            haLTSave($uid, $row, $t);
            Api::json(['ok' => true, 'msg' => '已设置为 Lv.' . $lv . '（累计 ' . $days . ' 天）']);

        case 'gate':        // 限制总开关
            $v = (string)($ctx['post']['v'] ?? '1') === '1' ? '1' : '0';
            haLTSetCfg('gating', $v);
            Api::json(['ok' => true, 'msg' => $v === '1' ? '已开启等级限制' : '已关闭等级限制']);

        default:
            Api::json(['ok' => false, 'msg' => '未知操作']);
    }
});
Plugin::sensitive('plugin_level_trust_op');   // 涉及改等级/补签，走一次性票据

Plugin::adminPage('level-trust', '等级信任', function () {
    return '<h2>等级信任</h2>'
        . '<p class="ha-admin-desc">等级公式 L = 1 + ⌊累计完成天数 D + 加权天数 W⌋，W 封顶 0.5×D 并按全服中位数做追赶。每天完成保底任务升 1 级，加权可再加速 1 级（每天最多 2 级）。</p>'
        . '<div class="ha-card">'
        . '<div class="ha-form-row">'
        . '<div class="ha-form-item" style="flex:1"><label>等级限制</label>'
        . '<select class="ha-input" id="haLTGate"><option value="1">开启（按等级限制头像/好友/建群/文件大小）</option>'
        . '<option value="0">关闭（不限制任何功能）</option></select></div>'
        . '<button class="ha-btn ha-btn-primary" onclick="HaLT.saveGate()">保存</button>'
        . '</div></div>'
        . '<div class="ha-card" id="haLTStats"></div>'
        . '<div class="ha-card">'
        . '<div class="ha-form-row">'
        . '<div class="ha-form-item" style="min-width:120px"><label>用户 ID</label>'
        . '<input class="ha-input" id="haLTUid" type="number" min="1" placeholder="如 1" onkeydown="if(event.key===\'Enter\')HaLT.query()"></div>'
        . '<button class="ha-btn ha-btn-primary" onclick="HaLT.query()">查询</button>'
        . '</div>'
        . '<div id="haLTUser"></div>'
        . '</div>';
});

/* ============================ 资源 ============================ */

Plugin::asset('css', 'level-trust/style.css');
Plugin::asset('js', 'level-trust/chat.js');
Plugin::asset('js', 'level-trust/admin.js');
