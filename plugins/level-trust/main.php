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
    // v1.2.44：按自然日归档的活跃数据（后台「活跃趋势」用）。
    //   不逐条记流水 —— 那样表会无上限膨胀，而趋势图只需要每天的汇总数。
    DB::run("CREATE TABLE IF NOT EXISTS plugin_level_daily (
        day      TEXT PRIMARY KEY,            -- Y-m-d
        actives  INTEGER NOT NULL DEFAULT 0,  -- 当日活跃过的用户数（去重）
        logins   INTEGER NOT NULL DEFAULT 0,  -- 当日新增登录人天
        upgrades INTEGER NOT NULL DEFAULT 0,  -- 当日升级次数
        msgs     INTEGER NOT NULL DEFAULT 0,  -- 计入任务的有效发言条数
        files    INTEGER NOT NULL DEFAULT 0,  -- 文件操作次数
        rooms    INTEGER NOT NULL DEFAULT 0,  -- 建群次数
        updated_at {$ts} DEFAULT 0)");
}

/** 确保当天的汇总行存在（各驱动没有统一的 INSERT OR IGNORE，用「查不到就插」最稳） */
function haLTEnsureDay(string $day): void
{
    haLTBoot();
    $has = DB::val('SELECT day FROM plugin_level_daily WHERE day=?', [$day]);
    if ($has === null || $has === false) {
        try {
            DB::run('INSERT INTO plugin_level_daily (day, updated_at) VALUES (?,?)', [$day, time()]);
        } catch (Throwable $e) {
            // 并发下另一个进程可能刚插入同一天 → 主键冲突，忽略即可
        }
    }
}

/**
 * 按天累加一项活跃指标（次数类）。
 * ⚠️ actives（人数）**不能**走这里 —— 同一用户一天活跃多次只应算 1 人，
 *    那种去重计数走 haLTMarkActive()。
 */
function haLTBump(string $field, int $n = 1): void
{
    static $known = ['logins', 'upgrades', 'msgs', 'files', 'rooms'];
    if (!in_array($field, $known, true)) return;   // 字段名走白名单，杜绝拼进 SQL 的列被污染
    $day = date('Y-m-d');
    haLTEnsureDay($day);
    DB::run('UPDATE plugin_level_daily SET ' . $field . '=' . $field . '+?, updated_at=? WHERE day=?',
        [$n, time(), $day]);
}

/** 记录「当日活跃人数」（同一用户当天只计一次） */
function haLTMarkActive(int $uid): void
{
    if ($uid <= 0) return;
    $day = date('Y-m-d');
    $key = 'act_' . $day . '_' . $uid;
    // 进程内先挡一次：长轮询下同一请求会多次触发 user.active，没必要每次都查库
    if (!empty($GLOBALS[$key])) return;
    $GLOBALS[$key] = 1;

    $has = DB::val('SELECT v FROM plugin_level_config WHERE k=?', [$key]);
    if ($has !== null && $has !== false) return;
    try {
        DB::run('INSERT INTO plugin_level_config (k, v) VALUES (?,?)', [$key, '1']);
    } catch (Throwable $e) {
        return;                                    // 并发下已被别人插入 → 说明今天已计过
    }
    haLTEnsureDay($day);
    DB::run('UPDATE plugin_level_daily SET actives=actives+1, updated_at=? WHERE day=?', [time(), $day]);
}

/**
 * 清理过期的「当日活跃」去重键（只保留最近 N 天）。
 * ⚠️ 不清理的话 plugin_level_config 会按「天数 × 人数」无限膨胀，
 *    而这些键只在当天有用 —— 留着就是纯垃圾，还会拖慢配置读取。
 */
function haLTPurgeActiveKeys(int $keepDays = 40): void
{
    haLTBoot();
    $cut = 'act_' . date('Y-m-d', time() - $keepDays * 86400);
    // k 形如 act_2026-10-06_20；下划线在 LIKE 里是通配符，必须 ESCAPE 后才能按字面匹配
    DB::run("DELETE FROM plugin_level_config WHERE k LIKE 'act@_%' ESCAPE '@' AND k < ?", [$cut]);
}

/**
 * 全部可调参数与默认值（v1.2.44：解锁等级 / 建群名额 / 加权参数 / 有效发言 / 阶段阈值
 * 全部可在后台「等级信任 → 参数设置」里改）。
 *
 * ⚠️ 每加一个新键，必须同时：
 *   ① 在这里给默认值；② 在后台表单里给输入框；③ 在 cfg_save 的白名单里放行。
 *   漏了 ③ 的表现是「后台保存成功但值没变」，很难查。
 */
function haLTDefaults(): array
{
    return [
        // ---- 总开关 ----
        'gating'        => '1',     // 是否按等级限制功能（0=只看等级不做限制）
        // ---- 能力解锁等级 ----
        'lv_avatar'     => '3',     // 自定义头像
        'lv_sticker'    => '20',    // 上传/设置贴纸
        'lv_friend'     => '10',    // 添加好友
        'lv_file'       => '3',     // 能上传文件（否则禁止）
        'lv_file_half'  => '10',    // 单文件上限放宽到全局 1/2
        'lv_file_full'  => '50',    // 单文件上限 = 全局上限
        'lv_mod_cand'   => '35',    // 管理权限候选资格（仅标记）
        'lv_honor'      => '60',    // 荣誉标识（不解锁新功能）
        // ---- 建群名额与积分 ----
        'room_min_level' => '10',   // 达到该等级起才有免费名额
        'room_tiers'     => "10:3\n20:5\n50:8",   // 等级:免费名额，逐行
        'room_point_cost' => '50',  // 每超出 1 个群（或等级不够时）消耗的积分；0=不允许付费建群
        // ---- 加权参数 ----
        'w_cap_ratio'    => '0.5',  // 加权封顶比例：W ≤ ratio × D
        'w_daily_cap'    => '0.8',  // 每日加权上限（天）
        'w_login_every'  => '3',    // 每连续 N 天
        'w_login_step'   => '0.3',  // 加多少天
        'w_days_every'   => '30',   // 累计登录每 N 天
        'w_days_step'    => '0.1',  // 加多少天
        'w_msg_min'      => '0.1',  // 每日发言加权下限
        'w_msg_max'      => '0.3',  // 上限
        'w_file_min'     => '0.1',  // 文件操作加权下限
        'w_file_max'     => '0.5',  // 上限
        'w_file_days'    => '3',    // 文件加权最多累积几次
        'catchup_slow'   => '1.2',  // 低于全服中位数：加速
        'catchup_fast'   => '0.8',  // 高出中位数 10 级：减速
        // ---- 有效发言判定 ----
        'msg_cooldown'   => '15',   // 距上一条计入任务的发言至少 N 秒
        'msg_per_minute' => '5',    // 每分钟最多计入 N 条
        'msg_dedupe'     => '10',   // 与最近 N 条内容去重
        'msg_min_len'    => '2',    // 内容至少 N 个字符
        // ---- 阶段阈值与任务量 ----
        'stage_2'        => '6',    // 日常阶段起始等级
        'stage_3'        => '16',   // 活跃阶段
        'stage_4'        => '31',   // 核心阶段
        'stage_5'        => '46',   // 荣誉阶段
        'stage_gm'       => '1,3,5,5,10',   // 五个阶段各自的群发言条数
    ];
}

/**
 * 读配置（字符串）。
 * ⚠️ 缓存放在 $GLOBALS 而不是函数内 static：函数级 static 无法被 haLTSetCfg 清掉，
 *    同请求内「后台刚关掉限制 → 上传仍被拦」这种不一致查起来非常费劲。
 */
function haLTCfg(string $k): string
{
    haLTBoot();
    if (!isset($GLOBALS['_haLTCfg']) || !is_array($GLOBALS['_haLTCfg'])) $GLOBALS['_haLTCfg'] = [];
    if (array_key_exists($k, $GLOBALS['_haLTCfg'])) return $GLOBALS['_haLTCfg'][$k];
    $v = DB::val('SELECT v FROM plugin_level_config WHERE k=?', [$k]);
    $def = haLTDefaults();
    $GLOBALS['_haLTCfg'][$k] = ($v === null || $v === false || $v === '') ? ($def[$k] ?? '') : (string)$v;
    return $GLOBALS['_haLTCfg'][$k];
}

/** 读整数配置 */
function haLTInt(string $k): int
{
    return (int)haLTCfg($k);
}

/** 读浮点配置（小数写进表里是字符串，必须显式转） */
function haLTFloat(string $k): float
{
    return (float)haLTCfg($k);
}

function haLTSetCfg(string $k, string $v): void
{
    haLTBoot();
    DB::run('DELETE FROM plugin_level_config WHERE k=?', [$k]);
    DB::run('INSERT INTO plugin_level_config (k, v) VALUES (?,?)', [$k, $v]);
    unset($GLOBALS['_haLTCfg'][$k]);      // 立刻失效，同请求内后续读取拿到新值
}

/**
 * 建群名额档位：解析 room_tiers（每行「等级:名额」）。
 * 返回 [[lv=>int, n=>int], ...] 按等级升序；解析不出任何档位时回落到默认表。
 */
function haLTRoomTiers(): array
{
    static $cached = null;
    if ($cached !== null) return $cached;
    $out = [];
    foreach (preg_split('/[\r\n,;]+/', haLTCfg('room_tiers')) ?: [] as $line) {
        $line = trim((string)$line);
        if ($line === '') continue;
        if (!preg_match('/^(\d{1,4})\s*[:：]\s*(\d{1,4})$/u', $line, $m)) continue;
        $out[] = ['lv' => (int)$m[1], 'n' => (int)$m[2]];
    }
    if (!$out) {
        $out = [['lv' => 10, 'n' => 3], ['lv' => 20, 'n' => 5], ['lv' => 50, 'n' => 8]];
    }
    usort($out, fn($a, $b) => $a['lv'] <=> $b['lv']);
    return ($cached = $out);
}

/** 某等级的免费建群名额（未达最低等级 = 0） */
function haLTRoomQuota(int $level): int
{
    if ($level < haLTInt('room_min_level')) return 0;
    $n = 0;
    foreach (haLTRoomTiers() as $t) {
        if ($level >= $t['lv']) $n = $t['n'];
    }
    return $n;
}

/* ============================ 等级计算 ============================ */

/**
 * 阶段任务表。
 * base      = 保底任务，全部完成才升级
 * challenge = 挑战任务，完成给额外加权（不阻塞升级）
 * alt       = 替代任务组（组内全部满足即视为该任务完成），避免无文件/无好友时卡住
 */
/**
 * 阶段阈值（可配）：返回 [日常, 活跃, 核心, 荣誉] 四个起始等级。
 * ⚠️ 必须保证单调递增，否则 haLTStageNo 会出现「高等级落在低阶段」的错乱。
 */
function haLTStageBounds(): array
{
    $b = [
        max(2, haLTInt('stage_2')),
        max(3, haLTInt('stage_3')),
        max(4, haLTInt('stage_4')),
        max(5, haLTInt('stage_5')),
    ];
    for ($i = 1; $i < 4; $i++) if ($b[$i] <= $b[$i - 1]) $b[$i] = $b[$i - 1] + 1;
    return $b;
}

/** 五个阶段的群发言条数（可配，逗号分隔；缺项用默认值补齐） */
function haLTStageGm(): array
{
    $def = [1, 3, 5, 5, 10];
    $parts = preg_split('/[\s,，]+/u', haLTCfg('stage_gm')) ?: [];
    $out = [];
    for ($i = 0; $i < 5; $i++) {
        $v = isset($parts[$i]) ? (int)trim((string)$parts[$i]) : 0;
        $out[$i] = $v > 0 ? $v : $def[$i];
    }
    return $out;
}

function haLTStage(int $level): array
{
    $b = haLTStageBounds();          // [日常, 活跃, 核心, 荣誉]
    $gm = haLTStageGm();             // 五阶段各自的群发言条数
    $login = [['k' => 'login', 'n' => 1]];

    if ($level < $b[0]) {
        return ['name' => '新手阶段', 'from' => 1, 'to' => $b[0] - 1, 'base' => array_merge($login, [
            ['k' => 'gm', 'n' => $gm[0]],
        ]), 'ch' => []];
    }
    if ($level < $b[1]) {
        return ['name' => '日常阶段', 'from' => $b[0], 'to' => $b[1] - 1, 'base' => array_merge($login, [
            ['k' => 'gm', 'n' => $gm[1]],
            ['k' => 'gfirst', 'n' => 1],
        ]), 'ch' => []];
    }
    if ($level < $b[2]) {
        return ['name' => '活跃阶段', 'from' => $b[1], 'to' => $b[2] - 1, 'base' => array_merge($login, [
            ['k' => 'gm', 'n' => $gm[2]],
            ['k' => 'fact', 'n' => 1, 'alt' => [['k' => 'pfirst', 'n' => 1], ['k' => 'gfirst', 'n' => 1]]],
            ['k' => 'pfirst', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 3]]],
        ]), 'ch' => []];
    }
    if ($level < $b[3]) {
        return ['name' => '核心阶段', 'from' => $b[2], 'to' => $b[3] - 1, 'base' => array_merge($login, [
            ['k' => 'gm', 'n' => $gm[3]],
            ['k' => 'gfirst', 'n' => 1],
        ]), 'ch' => [
            ['k' => 'fup', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 5]]],
            ['k' => 'fdl', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 5]]],
        ]];
    }
    return ['name' => '荣誉阶段', 'from' => $b[3], 'to' => 0, 'base' => array_merge($login, [
        ['k' => 'gm', 'n' => $gm[4]],
        ['k' => 'gfirst', 'n' => 1],
        ['k' => 'pfirst', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 3]]],
    ]), 'ch' => [
        ['k' => 'fup', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 5]]],
        ['k' => 'fdl', 'n' => 1, 'alt' => [['k' => 'gm', 'n' => 5]]],
    ]];
}

/** 阶段号（1~5），用于前端配色与后台分布统计 */
function haLTStageNo(int $level): int
{
    $b = haLTStageBounds();
    if ($level < $b[0]) return 1;
    if ($level < $b[1]) return 2;
    if ($level < $b[2]) return 3;
    if ($level < $b[3]) return 4;
    return 5;
}

/** 阶段名（供后台统计与前台页面复用，避免各处再写一份中文） */
function haLTStageName(int $no): string
{
    $m = [1 => '新手阶段', 2 => '日常阶段', 3 => '活跃阶段', 4 => '核心阶段', 5 => '荣誉阶段'];
    return $m[$no] ?? '新手阶段';
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
    if ($level < $med) return haLTFloat('catchup_slow');
    if ($level > $med + 10) return haLTFloat('catchup_fast');
    return 1.0;
}

/**
 * 等级公式：L = 1 + ⌊D + min(W, 0.5D) × 追赶系数⌋
 * ⚠️ W 的单位是「天」，不是等级；封顶 0.5×D 防止活跃用户把休闲用户甩太远。
 */
/** [min,max] 之间的浮点随机（配置里的小数位数不定，用千分位取整再还原） */
function haLTRandF(float $min, float $max): float
{
    if ($max <= $min) return $min;
    return $min + (mt_rand(0, (int)round(($max - $min) * 1000)) / 1000);
}

function haLTCalc(int $days, float $weight, float $factor = 1.0): int
{
    // ⑤ 加权封顶：W ≤ ratio × D（比例可配）
    $wv = min($weight, haLTFloat('w_cap_ratio') * $days);
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
    if (mb_strlen($s) < max(1, haLTInt('msg_min_len'))) return false;
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
function haLTAddMsg(int $uid, string $content, string $type, bool $isGroup): bool
{
    if ($uid <= 0) return false;
    if (!in_array($type, ['text', 'mention'], true)) return false;   // 图片/文件/系统不算「发言」
    if (!haLTValidText($content)) return false;

    [$row, $t] = haLTTouch($uid);
    if (!$row) return false;
    if ((int)$row['frozen_day'] === (int)date('Ymd')) return false;  // 当天被冻结

    $now = time();
    // ① 冷却：距上一条**计入任务**的发言至少 N 秒
    $cd = max(0, haLTInt('msg_cooldown'));
    if (!empty($t['last_at']) && $now - (int)$t['last_at'] < $cd) return false;
    // ② 本分钟最多计入 N 条
    $perMin = max(1, haLTInt('msg_per_minute'));
    $minute = (int)floor($now / 60);
    if (empty($t['minute']) || (int)$t['minute'] !== $minute) { $t['minute'] = $minute; $t['minute_n'] = 0; }
    if ((int)($t['minute_n'] ?? 0) >= $perMin) return false;
    // ③ 与最近 N 条内容不重复
    $h = md5(mb_strtolower(trim($content)));
    $recent = is_array($t['recent'] ?? null) ? $t['recent'] : [];
    if (in_array($h, array_slice($recent, 0, max(1, haLTInt('msg_dedupe'))), true)) return false;

    $t['minute_n'] = (int)$t['minute_n'] + 1;
    $t['last_at'] = $now;
    array_unshift($recent, $h);
    $t['recent'] = array_slice($recent, 0, max(1, haLTInt('msg_dedupe')));

    if ($isGroup) {
        $t['gm'] = haLTProg($t, 'gm') + 1;
        if (haLTProg($t, 'gm') === 1) $t['gfirst'] = 1;    // 群聊首条
    } else {
        $t['pfirst'] = 1;                                   // 私聊首条
    }
    haLTAfterProgress($uid, $row, $t);
    return true;                                            // 真正计入了任务
}

/** 记一次文件操作（upload / download） */
function haLTAddFile(int $uid, string $kind): bool
{
    if ($uid <= 0) return false;
    haLTMarkActive($uid);
    [$row, $t] = haLTTouch($uid);
    if (!$row) return false;
    if ((int)$row['frozen_day'] === (int)date('Ymd')) return false;
    $key = $kind === 'download' ? 'fdl' : 'fup';
    // 设计文档：每天文件任务最多计 1 次上传 + 1 次下载
    if (haLTProg($t, $key) >= 1) { haLTAfterProgress($uid, $row, $t); return false; }
    $t[$key] = haLTProg($t, $key) + 1;
    haLTAfterProgress($uid, $row, $t);
    haLTBump('files');
    return true;
}

/* ============================ 结算 ============================ */

/** 进度变化后：判断是否达成保底任务 → 结算加权 → 重算等级 */
function haLTAfterProgress(int $uid, array $row, array $t): void
{
    if ((int)$row['settled'] === 1) { haLTSave($uid, $row, $t); return; }   // 今天已结算过
    $stage = haLTStage((int)$row['level']);
    if (!haLTBaseOk($stage, $t)) { haLTSave($uid, $row, $t); return; }

    // ① 连续登录加权（参数：每连续 N 天 +step）
    $day = 0.0;
    $c = (int)$row['login_streak'];
    $dl = (int)$row['login_days'];
    $every = max(1, haLTInt('w_login_every'));
    $daysEvery = max(1, haLTInt('w_days_every'));
    if ($c > 0 && $c % $every === 0) $day += haLTFloat('w_login_step');
    elseif ($dl > 0 && $dl % $daysEvery === 0) $day += haLTFloat('w_days_step');
    // ② 每日发言加权（区间可配，每天最多一次）
    if (haLTProg($t, 'gm') > 0) $day += haLTRandF(haLTFloat('w_msg_min'), haLTFloat('w_msg_max'));
    // ③ 文件操作加权（区间可配，每天最多一次，最多累积 N 次）
    if (haLTProg($t, 'fact') > 0 && (int)$row['file_w_days'] < max(0, haLTInt('w_file_days'))) {
        $day += haLTRandF(haLTFloat('w_file_min'), haLTFloat('w_file_max'));
        $row['file_w_days'] = (int)$row['file_w_days'] + 1;
    }
    // ④ 每日加权上限
    $cap = haLTFloat('w_daily_cap');
    if ($day > $cap) $day = $cap;

    $row['weight'] = (float)$row['weight'] + $day;
    $row['days'] = (int)$row['days'] + 1;
    $row['settled'] = 1;
    $before = (int)$row['level'];
    haLTRecalc($row);          // 不降级由 haLTRecalc 保证
    haLTSave($uid, $row, $t);
    if ((int)$row['level'] > $before) haLTBump('upgrades');
}

/* ============================ 功能解锁 ============================ */

/**
 * 当前等级已解锁的能力。
 * ratio = 单文件上限相对「全局上限」的比例（0 = 禁止上传）
 */
function haLTUnlocks(int $level): array
{
    // v1.2.44：所有门槛改为**后台可配**（lv_* 系列）。
    // quota 是本等级的免费建群名额，pay_cost 是超额后每个群的积分价（0=不允许付费）。
    return [
        'avatar'   => $level >= haLTInt('lv_avatar'),
        'sticker'  => $level >= haLTInt('lv_sticker'),
        'friend'   => $level >= haLTInt('lv_friend'),
        'ratio'    => $level >= haLTInt('lv_file_full') ? 1.0
                    : ($level >= haLTInt('lv_file_half') ? 0.5
                    : ($level >= haLTInt('lv_file') ? 0.25 : 0.0)),
        'quota'    => haLTRoomQuota($level),
        'pay_cost' => max(0, haLTInt('room_point_cost')),
        'min_room_level' => haLTInt('room_min_level'),
        'mod_cand' => $level >= haLTInt('lv_mod_cand'),   // 管理权限候选资格（仅标记）
        'honor'    => $level >= haLTInt('lv_honor'),      // 荣誉标识（不解锁新功能）
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

/** 建群成功（活跃趋势的「建群次数」） */
Plugin::on('room.created', function ($roomId, $actor, $charged = 0) {
    if (($actor['kind'] ?? '') !== 'user') return;
    haLTBump('rooms');
});

/** 每日登录（会话仍在就不走登录钩子，所以挂 user.active） */
Plugin::on('user.active', function (array $actor) {
    if (($actor['kind'] ?? '') !== 'user') return;
    $uid = (int)$actor['id'];
    if ($uid <= 0) return;
    $isNewDay = (string)(haLTRow($uid)['day'] ?? '') !== date('Y-m-d');
    [$row, $t] = haLTTouch($uid);
    if (!$row) return;
    // v1.2.44 活跃趋势：当日活跃人数（同一人一天只计一次）
    haLTMarkActive($uid);
    if ($isNewDay) haLTBump('logins');      // 跨天才算一次「登录人天」
    // 登录本身就可能直接达成低阶段保底任务（新手阶段 = 登录 + 群发言 1，还差发言）
    haLTAfterProgress($uid, $row, $t);
});

/** 发言 */
Plugin::on('message.after_send', function ($id, $actor, $roomId, $content = '', $type = 'text', $toUserId = 0) {
    if (($actor['kind'] ?? '') !== 'user') return;                 // 游客没有等级
    $uid = (int)$actor['id'];
    haLTMarkActive($uid);
    if (haLTAddMsg($uid, (string)$content, (string)$type, (int)$roomId > 0)) haLTBump('msgs');
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
        $allow = false; $reason = '自定义头像需 ' . haLTInt('lv_avatar') . ' 级解锁（当前 Lv.' . $lv . '）';
    } elseif ($kind === 'sticker' && !$u['sticker']) {
        $allow = false; $reason = '上传贴纸需 ' . haLTInt('lv_sticker') . ' 级解锁（当前 Lv.' . $lv . '）';
    }
});

/** 加好友闸门：10 级起 */
Plugin::on('friend.guard', function (bool &$allow, string &$reason, array $actor, int $friendId) {
    if (haLTCfg('gating') !== '1') return;
    if (($actor['role'] ?? '') === 'admin') return;
    $lv = haLTLevelOf((int)$actor['id']);
    if (!haLTUnlocks($lv)['friend']) {
        $allow = false; $reason = '添加好友需 ' . haLTInt('lv_friend') . ' 级解锁（当前 Lv.' . $lv . '）';
    }
});

/**
 * 建群闸门（v1.2.44）。
 *
 * 三种结果，核心按 $dec 决定放行 / 收费 / 拒绝：
 *   ① 免费名额没用完      → free=true,  cost=0
 *   ② 名额用完 或 等级不够 → free=false, cost=单价（单价为 0 时拒绝）
 *   ③ 站点不允许付费建群  → allowed=false + 原因
 *
 * ⚠️ reason 必须**说清为什么**并给出可执行的信息（还差几级 / 需要多少积分 / 当前多少），
 *    用户原话就是「提升为什么不能创建群聊的原因」—— 一句「等级不足」等于没说。
 */
Plugin::on('room.create.gate', function (array &$dec, array $actor) {
    if (haLTCfg('gating') !== '1') return;                 // 后台关闭了等级限制
    if (($actor['role'] ?? '') === 'admin') return;         // 超管不受限，也不收费
    if (($actor['kind'] ?? '') !== 'user') return;          // 游客走不到这里（核心已拦）

    $uid  = (int)$actor['id'];
    $lv   = haLTLevelOf($uid);
    $u    = haLTUnlocks($lv);
    $used = (int)DB::val('SELECT COUNT(*) FROM rooms WHERE owner_id=?', [$uid]);
    $cost = (int)$u['pay_cost'];
    $pts  = (int)DB::val('SELECT points FROM users WHERE id=?', [$uid]);

    $dec['quota'] = (int)$u['quota'];
    $dec['used']  = $used;
    $dec['level'] = $lv;
    $dec['min_room_level'] = (int)$u['min_room_level'];   // 前端拼「还差几级」用

    // ① 还有免费名额
    if ($used < (int)$u['quota']) { $dec['free'] = true; return; }

    // ②/③ 需要付费：等级不够 或 名额用完
    $why = $lv < (int)$u['min_room_level']
        ? '建群需 ' . (int)$u['min_room_level'] . ' 级（当前 Lv.' . $lv . '）'
        : '免费名额已用完（' . $used . '/' . (int)$u['quota'] . '）';

    if ($cost <= 0) {
        // 后台把单价设为 0 = 不允许用积分绕过
        $dec['allowed'] = false;
        $dec['reason']  = $why . '，且站点未开启「消耗积分创建群聊」。';
        return;
    }
    $dec['free']   = false;
    $dec['cost']   = $cost;
    // ⚠️ reason 必须是**纯文本**：前端会整体 esc() 再插入，
    //    这里塞 <b> 会被原样显示成「<b>50</b>」（v1.2.44 实测踩过）。
    //    需要强调的数字由前端用结构化字段（cost/quota/used/level/points）自己拼。
    $dec['reason'] = $why . '，可消耗 ' . $cost . ' 积分创建（当前 ' . $pts . ' 积分）。';
});

/**
 * v1.2.43：**建群不再受等级限制**（用户定案）。

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
        $allow = false; $reason = '上传文件需 ' . haLTInt('lv_file') . ' 级解锁（当前 Lv.' . $lv . '）';
    }
});

/* ============================ 计划任务 ============================ */
// 每天清理一次「当日活跃」去重键。不清理的话这张表会按「天数 × 人数」无限膨胀。
Plugin::cron('purge_active_keys', 86400, function () {
    haLTPurgeActiveKeys(40);
}, '清理 40 天前的「当日活跃」去重键（活跃趋势统计用）');

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


/* ============================ 前台等级页（?page=level） ============================ */

/** 任务 key → 中文（前台页与后台共用，避免两处各写一份） */
function haLTTaskLabel(string $k): string
{
    $m = [
        'login' => '登录', 'gm' => '群发言', 'gfirst' => '当天首条群发言',
        'pfirst' => '当天首条私聊', 'fup' => '上传文件', 'fdl' => '下载文件',
        'fact' => '群文件操作',
    ];
    return $m[$k] ?? $k;
}

/** 舞台配色（与资料卡徽章一致） */
function haLTStageColor(int $no): string
{
    $c = [1 => '#9AA5B1', 2 => '#0099FF', 3 => '#13A8A8', 4 => '#7A5AF8', 5 => '#D4A017'];
    return $c[$no] ?? '#9AA5B1';
}

/** 能力解锁对比表：返回每一档的能力清单（档位取自全部配置过的等级门槛） */
function haLTUnlockMatrix(): array
{
    // 每一行 = 一个有意义的档位（所有能力门槛 ∪ 阶段起点），去重后升序
    // ⚠️ 必须**按配置现读**：后台改了解锁等级，这张表要跟着变，不能写死。
    $marks = array_values(array_unique(array_merge(
        [haLTInt('lv_file'), haLTInt('lv_avatar'), haLTInt('lv_friend'), haLTInt('lv_file_half'),
         haLTInt('lv_sticker'), haLTInt('lv_mod_cand'), haLTInt('lv_file_full'), haLTInt('lv_honor')],
        haLTStageBounds()
    )));
    sort($marks);
    foreach ($marks as $lv) {
        $u = haLTUnlocks($lv);
        $ratio = (float)$u['ratio'];
        $rows[] = [
            'lv' => $lv,
            'stage' => haLTStageName(haLTStageNo($lv)),
            'quota' => (int)$u['quota'],
            'avatar' => $u['avatar'],
            'sticker' => $u['sticker'],
            'friend' => $u['friend'],
            'file' => $ratio <= 0 ? '不可上传' : ($ratio >= 1 ? '全局上限' : ('1/' . (int)round(1 / $ratio) . ' 上限')),
            'mod' => $u['mod_cand'],
            'honor' => $u['honor'],
        ];
    }
    return $rows;
}

/**
 * 注册前台页 ?page=level。
 * 游客也能看（等级规则是公开信息），但「我的进度」那块会换成提示。
 */
Plugin::page('level', '等级', function (array $actor, $user = null) {
    $isUser = ($actor['kind'] ?? '') === 'user';
    $uid = (int)($actor['id'] ?? 0);
    $lv = $isUser ? haLTLevelOf($uid) : 1;
    $stageNo = haLTStageNo($lv);
    $stage = haLTStage($lv);
    $u = haLTUnlocks($lv);
    $h = '';

    /* ---------- 我的等级 ---------- */
    $h .= '<div class="ha-card ha-lv-hero ha-lv-s' . $stageNo . '">'
        . '<div class="ha-lv-hero-lv"><span class="ha-lt-badge ha-lt-s' . $stageNo
        . ($lv >= haLTInt('lv_honor') ? ' ha-lt-honor' : '') . '">Lv.' . $lv . '</span>'
        . '<span class="ha-lv-hero-stage">' . Sec::e($stage['name']) . '</span></div>';

    if ($isUser) {
        [$row, $t] = haLTTouch($uid);
        $factor = haLTCatchUp($lv);
        $days = (int)$row['days'];
        $weight = round((float)$row['weight'], 2);
        $wv = min($weight, haLTFloat('w_cap_ratio') * $days);
        $nextAt = (int)ceil($days + 1 - $wv * $factor);   // 达到该天数+加权后即为下一级
        $cur = 1 + (int)floor($days + $wv * $factor);
        $pct = $cur >= $nextAt ? 100 : (int)max(0, min(100, round((($cur - 1) / max(1, $nextAt - $cur)) * 100)));

        $h .= '<div class="ha-lv-hero-meta">'
            . '<span>累计完成 <b>' . $days . '</b> 天</span>'
            . '<span>加权 <b>' . $weight . '</b> 天（封顶 ' . round(haLTFloat('w_cap_ratio') * 100) . '% × 天数）</span>'
            . '<span>连续登录 <b>' . (int)$row['login_streak'] . '</b> 天</span>'
            . '<span>距 Lv.' . ($lv + 1) . ' 还需 <b>' . max(0, $nextAt - $cur) . '</b> 级进度</span>'
            . '</div>'
            . '<div class="ha-lv-bar"><i style="width:' . $pct . '%"></i></div>';
    } else {
        $h .= '<div class="ha-lv-hero-meta"><span>登录后即可看到你的等级进度与今日任务。</span></div>';
    }
    $h .= '</div>';

    /* ---------- 阶段总览（v1.2.59）---------- */
    $b = haLTStageBounds();
    $gm = haLTStageGm();
    $stageDefs = [
        [1, '新手阶段', 1, $b[0] - 1],
        [2, '日常阶段', $b[0], $b[1] - 1],
        [3, '活跃阶段', $b[1], $b[2] - 1],
        [4, '核心阶段', $b[2], $b[3] - 1],
        [5, '荣誉阶段', $b[3], 0],
    ];
    $h .= '<div class="ha-card"><h3 class="ha-lv-h3">阶段总览</h3>'
        . '<div class="ha-lv-stages"><div class="ha-lv-stage-connector"></div>';
    foreach ($stageDefs as $sd) {
        $sno = $sd[0];
        $isCur = $stageNo === $sno;
        $isPast = $stageNo > $sno;
        $cls = 'ha-lv-stage-item' . ($isCur ? ' is-cur' : ($isPast ? ' is-past' : ' is-future'));
        $range = $sd[3] > 0 ? ($sd[2] === $sd[3] ? (string)$sd[2] : ($sd[2] . '~' . $sd[3])) : ($sd[2] . ' 及以上');
        $h .= '<div class="' . $cls . '" style="--stage-color:' . haLTStageColor($sno) . '">'
            . '<div class="ha-lv-stage-dot-wrap"><div class="ha-lv-stage-dot"></div></div>'
            . '<div class="ha-lv-stage-name">' . Sec::e($sd[1]) . '</div>'
            . '<div class="ha-lv-stage-range">Lv.' . Sec::e($range) . '</div>'
            . '</div>';
    }
    $h .= '</div></div>';

    /* ---------- 今日任务 ---------- */
    if ($isUser) {
        $h .= '<div class="ha-card"><h3 class="ha-lv-h3">今日任务</h3>';
        $done = 0;
        foreach ($stage['base'] as $task) {
            $has = haLTProg($t, $task['k']);
            $n = (int)$task['n'];
            $ok = $has >= $n;
            if ($ok) $done++;
            $h .= '<div class="ha-lv-task">'
                . '<span class="ha-lv-task-k">' . Sec::e(haLTTaskLabel($task['k'])) . '</span>'
                . '<span class="ha-lv-task-bar"><i style="width:' . (int)min(100, $n > 0 ? $has / $n * 100 : 0) . '%"></i></span>'
                . '<span class="ha-lv-task-v' . ($ok ? ' done' : '') . '">' . $has . ' / ' . $n . '</span>'
                . (!empty($task['alt']) ? '<span class="ha-lv-task-alt" title="可替代任务">可替代</span>' : '')
                . '</div>';
        }
        $h .= '<div class="ha-lv-task-sum">'
            . '保底任务完成 <b>' . $done . ' / ' . count($stage['base']) . '</b>，'
            . '全部完成今天升 1 级' . ((int)$row['settled'] === 1 ? '（<b style="color:#237804">今日已结算</b>）' : '')
            . '。加权每天最多结算 ' . haLTFloat('w_daily_cap') . ' 天，配合加权当天最多升 2 级。'
            . '</div>';
        if (!empty($stage['ch'])) {
            $h .= '<div class="ha-lv-ch">挑战任务（不阻塞升级，完成后同样计入加权）：'
                . implode('、', array_map(function ($x) {
                    return Sec::e(haLTTaskLabel($x['k'])) . ' ' . (int)$x['n'];
                }, $stage['ch'])) . '</div>';
        }
        $h .= '</div>';
    }

    /* ---------- 等级公式 ---------- */
    $h .= '<div class="ha-card"><h3 class="ha-lv-h3">等级怎么算</h3>'
        . '<div class="ha-lv-formula">L = 1 + ⌊ D + min(W, ' . round(haLTFloat('w_cap_ratio') * 100) . '% × D) × 追赶系数 ⌋</div>'
        . '<ul class="ha-lv-ul">'
        . '<li><b>D</b>：累计完成每日保底任务的天数（每天最多 +1）</li>'
        . '<li><b>W</b>：活跃加权天数，由连续登录、每日发言、文件操作累加，'
        . '单日最多 ' . haLTFloat('w_daily_cap') . ' 天</li>'
        . '<li>连续登录每 ' . haLTInt('w_login_every') . ' 天 +' . haLTFloat('w_login_step')
        . ' 天；累计登录每 ' . haLTInt('w_days_every') . ' 天 +' . haLTFloat('w_days_step') . ' 天</li>'
        . '<li>每日有效发言 +' . haLTFloat('w_msg_min') . '~' . haLTFloat('w_msg_max') . ' 天（每天一次）</li>'
        . '<li>文件操作 +' . haLTFloat('w_file_min') . '~' . haLTFloat('w_file_max') . ' 天，每天一次、最多累积 '
        . haLTInt('w_file_days') . ' 次</li>'
        . '<li><b>追赶系数</b>：低于全服中位数 ×' . haLTFloat('catchup_slow')
        . '，高于中位数 10 级 ×' . haLTFloat('catchup_fast') . '，中间 ×1</li>'
        . '<li>加权最多占总进度一半，防止活跃用户把休闲用户甩太远</li>'
        . '<li>未完成当天任务不降级，已获得的加权也不会被收回</li>'
        . '</ul>'
        . '<div class="ha-lv-tip">有效发言需同时满足：内容 ≥ ' . haLTInt('msg_min_len') . ' 字、非纯表情/纯图片/纯链接、'
        . '距上一条计入任务 ≥ ' . haLTInt('msg_cooldown') . ' 秒、每分钟 ≤ ' . haLTInt('msg_per_minute')
        . ' 条、与最近 ' . haLTInt('msg_dedupe') . ' 条不重复。</div>'
        . '</div>';

    /* ---------- 各等级条件一览 ---------- */
    $h .= '<div class="ha-card"><h3 class="ha-lv-h3">各阶段任务一览</h3><table class="ha-lv-table">'
        . '<tr><th>阶段</th><th>等级</th><th>保底任务</th><th>挑战任务</th></tr>';
    $defs = [
        [1, '新手阶段', 1, $b[0] - 1, $gm[0], false],
        [2, '日常阶段', $b[0], $b[1] - 1, $gm[1], false],
        [3, '活跃阶段', $b[1], $b[2] - 1, $gm[2], false],
        [4, '核心阶段', $b[2], $b[3] - 1, $gm[3], true],
        [5, '荣誉阶段', $b[3], 0, $gm[4], true],
    ];
    foreach ($defs as $d) {
        $range = $d[3] > 0 ? ($d[2] === $d[3] ? (string)$d[2] : ($d[2] . '~' . $d[3])) : ($d[2] . ' 及以上');
        $base = '登录 + 群发言 ' . $d[4] . ' 条';
        if ($d[1] === '日常阶段') $base .= ' + 当天首条群发言';
        if ($d[1] === '活跃阶段') $base .= ' + 当天首条群发言 + 群文件操作 1 次（可用私聊/群聊首条替代） + 当天首条私聊';
        if ($d[1] === '核心阶段') $base .= ' + 当天首条群发言';
        if ($d[1] === '荣誉阶段') $base .= ' + 当天首条群发言 + 当天首条私聊';
        $ch = $d[5] ? '上传文件 1 个 + 下载文件 1 个（各可用群发言 5 条替代）' : '—';
        $h .= '<tr class="ha-lv-tr' . ($stageNo === $d[0] ? ' is-cur' : '') . '">'
            . '<td><span class="ha-lv-dot" style="background:' . haLTStageColor($d[0]) . '"></span>'
            . Sec::e($d[1]) . '</td>'
            . '<td>' . Sec::e($range) . '</td><td>' . Sec::e($base) . '</td><td>' . Sec::e($ch) . '</td></tr>';
    }
    $h .= '</table></div>';

    /* ---------- 能力解锁对比 ---------- */
    $h .= '<div class="ha-card"><h3 class="ha-lv-h3">能力解锁对比</h3><table class="ha-lv-table">'
        . '<tr><th>等级</th><th>阶段</th><th>建群名额</th><th>头像</th><th>贴纸</th>'
        . '<th>加好友</th><th>单文件上限</th><th>管理候选</th><th>荣誉</th></tr>';
    foreach (haLTUnlockMatrix() as $r) {
        $y = '<span class="ha-lv-yes">✓</span>';
        $n = '<span class="ha-lv-no">—</span>';
        $h .= '<tr class="' . ($r['lv'] === $lv ? 'is-cur' : '') . '">'
            . '<td><b>Lv.' . (int)$r['lv'] . '</b></td>'
            . '<td>' . Sec::e($r['stage']) . '</td>'
            . '<td>' . ((int)$r['quota'] > 0 ? (int)$r['quota'] . ' 个' : $n) . '</td>'
            . '<td>' . ($r['avatar'] ? $y : $n) . '</td>'
            . '<td>' . ($r['sticker'] ? $y : $n) . '</td>'
            . '<td>' . ($r['friend'] ? $y : $n) . '</td>'
            . '<td>' . Sec::e($r['file']) . '</td>'
            . '<td>' . ($r['mod'] ? $y : $n) . '</td>'
            . '<td>' . ($r['honor'] ? $y : $n) . '</td></tr>';
    }
    $h .= '</table>'
        . '<div class="ha-lv-tip">建群名额用完、或等级未到 '
        . haLTInt('room_min_level') . ' 级时，可消耗 <b>' . haLTInt('room_point_cost')
        . '</b> 积分创建群聊（每个群一次）。把该单价设为 0 即为「不允许用积分绕过」。</div>'
        . '</div>';

    return $h;
});

/* ============================ 后台 ============================ */

/** 管理员鉴权：必须定义在 use($ltGuard) 之前（use 捕获的是变量值） */
$ltGuard = function (array $ctx): void {
    if (($ctx['actor']['role'] ?? '') !== 'admin') Api::json(['ok' => false, 'msg' => '需要管理员权限'], 403);
};

/** 后台概览：中位数 + 各阶段分布 + 近 N 天活跃趋势 */
Plugin::route('plugin_level_trust_stats', function (array $ctx) use ($ltGuard) {
    $ltGuard($ctx);
    haLTBoot();
    $rows = DB::all('SELECT level FROM plugin_level_trust');
    $dist = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
    $sum = 0;
    foreach ($rows as $r) { $dist[haLTStageNo((int)$r['level'])]++; $sum += (int)$r['level']; }

    // 近 30 天趋势（含今天）。补齐空白天，否则折线会在没数据的日子断开。
    $days = (int)($ctx['post']['days'] ?? 30);
    $days = max(7, min(90, $days));
    $from = date('Y-m-d', time() - ($days - 1) * 86400);
    $got = [];
    foreach (DB::all('SELECT * FROM plugin_level_daily WHERE day>=? ORDER BY day ASC', [$from]) as $r) {
        $got[(string)$r['day']] = $r;
    }
    $trend = [];
    for ($i = 0; $i < $days; $i++) {
        $d = date('Y-m-d', time() - ($days - 1 - $i) * 86400);
        $r = $got[$d] ?? null;
        $trend[] = [
            'day' => $d,
            'actives' => (int)($r['actives'] ?? 0),
            'logins'  => (int)($r['logins'] ?? 0),
            'upgrades' => (int)($r['upgrades'] ?? 0),
            'msgs'    => (int)($r['msgs'] ?? 0),
            'files'   => (int)($r['files'] ?? 0),
            'rooms'   => (int)($r['rooms'] ?? 0),
        ];
    }

    Api::json([
        'ok' => true,
        'users' => count($rows),
        'median' => haLTMedian(),
        'avg' => $rows ? round($sum / count($rows), 1) : 0,
        'dist' => $dist,
        'gating' => haLTCfg('gating'),
        'trend' => $trend,
        // 口径说明随数据一起下发，前端直接展示 —— 写死在 JS 里日后容易与实际脱节
        'trend_note' => '近 ' . $days . ' 天 · 活跃用户仅统计登录用户（游客不计入），'
            . '历史长度受「当日活跃」去重键保留 40 天限制；升级次数为当日实际升幅之和（可能一次升 2 级）。',
    ]);
});

/** 读取全部可调参数（后台配置表单回填） */
Plugin::route('plugin_level_trust_cfg_get', function (array $ctx) use ($ltGuard) {
    $ltGuard($ctx);
    haLTBoot();
    $cfg = [];
    foreach (haLTDefaults() as $k => $def) $cfg[$k] = haLTCfg($k);
    Api::json(['ok' => true, 'cfg' => $cfg, 'tiers' => haLTRoomTiers()]);
});

/**
 * 保存可调参数。
 * ⚠️ 白名单 = haLTDefaults() 的键集合：只有在这里出现过的键才允许写入。
 *    这样即使前端偷偷塞了别的键（比如往配置表里写垃圾），也落不了库。
 */
Plugin::route('plugin_level_trust_cfg_save', function (array $ctx) use ($ltGuard) {
    $ltGuard($ctx);
    $post = $ctx['post'];
    $allow = array_keys(haLTDefaults());
    $saved = 0;
    foreach ($allow as $k) {
        if (!isset($post[$k])) continue;
        $v = trim((string)$post[$k]);
        // 数值键统一做范围收敛：后台填了 "-5" 或 "999999" 不该让算法彻底失灵
        if (preg_match('/^-?\d+(\.\d+)?$/', $v)) {
            $f = (float)$v;
            if ($f < 0) $f = 0;
            if ($f > 1000000) $f = 1000000;
            $v = (string)(floor($f) == $f ? (int)$f : $f);
        }
        if (mb_strlen($v) > 200) $v = mb_substr($v, 0, 200);
        haLTSetCfg($k, $v);
        $saved++;
    }
    // 档位表：解析不出任何行就拒绝，避免把「全部名额清零」这种破坏性配置写进去
    if (isset($post['room_tiers'])) {
        $tmp = [];
        foreach (preg_split('/[\r\n,;]+/', (string)$post['room_tiers']) ?: [] as $line) {
            $line = trim((string)$line);
            if ($line === '') continue;
            if (preg_match('/^(\d{1,4})\s*[:：]\s*(\d{1,4})$/u', $line, $m)) $tmp[] = ['lv' => (int)$m[1], 'n' => (int)$m[2]];
        }
        if (!$tmp) Api::json(['ok' => false, 'msg' => '名额档位格式不对，每行需形如「等级:名额」，例如 10:3']);
        haLTSetCfg('room_tiers', (string)$post['room_tiers']);
        $saved++;
    }
    Sec::log('level_cfg_save', (string)($ctx['actor']['nickname'] ?? ''), ['items' => $saved]);
    Api::json(['ok' => true, 'msg' => '参数已保存（' . $saved . ' 项）']);
});
Plugin::sensitive('plugin_level_trust_cfg_save');   // 改全站等级规则：敏感


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
    $f = function (string $k, string $label, string $hint = '') {
        return '<div class="ha-form-item"><label>' . Sec::e($label) . '</label>'
            . '<input class="ha-input" id="haCfg_' . $k . '" value="' . Sec::e(haLTCfg($k)) . '">'
            . ($hint !== '' ? '<p style="font-size:12px;color:#5C5C5C;margin-top:4px">' . Sec::e($hint) . '</p>' : '')
            . '</div>';
    };
    $head = '<h2>等级信任</h2>'
        . '<p class="ha-admin-desc">等级 L = 1 + ⌊D + min(W, ' . round(haLTFloat('w_cap_ratio') * 100) . '%×D) × 追赶系数⌋。'
        . '每天完成保底任务升 1 级，加权可再加速 1 级（每天最多 2 级）。以下参数全部可调，改完点最下方「保存全部参数」。</p>';

    $head .= '<div class="ha-card" id="haLTStats"></div>'
        . '<div class="ha-card"><h3 style="margin:0 0 4px">活跃趋势</h3><div id="haLTTrend"></div></div>';

    $head .= '<div class="ha-card"><h3 style="margin:0 0 10px">参数设置</h3>';

    $head .= '<h4 class="ha-lt-cap">总开关</h4><div class="ha-form-row">'
        . '<div class="ha-form-item" style="flex:1"><label>等级限制</label>'
        . '<select class="ha-input" id="haCfg_gating">'
        . '<option value="1"' . (haLTCfg('gating') === '1' ? ' selected' : '') . '>开启（按下面各项限制功能）</option>'
        . '<option value="0"' . (haLTCfg('gating') === '0' ? ' selected' : '') . '>关闭（等级只展示，不做任何限制）</option>'
        . '</select></div></div>';

    $head .= '<h4 class="ha-lt-cap">能力解锁等级</h4><div class="ha-form-row">'
        . $f('lv_file', '可上传文件（Lv）', '低于此级禁止上传图片/文件')
        . $f('lv_avatar', '自定义头像（Lv）')
        . $f('lv_friend', '添加好友（Lv）')
        . $f('lv_file_half', '单文件 1/2 上限（Lv）')
        . $f('lv_file_full', '单文件满额上限（Lv）')
        . $f('lv_sticker', '上传贴纸（Lv）')
        . $f('lv_mod_cand', '管理候选资格（Lv）', '仅作标记，不实际授予权限')
        . $f('lv_honor', '荣誉标识（Lv）', '达到后显示荣誉徽章')
        . '</div>';

    $head .= '<h4 class="ha-lt-cap">建群名额与积分</h4><div class="ha-form-row">'
        . $f('room_min_level', '免费建群最低等级（Lv）', '低于此级无免费名额，但可用积分创建')
        . $f('room_point_cost', '超额创建单价（积分）', '每个群扣一次；填 0 = 不允许用积分绕过')
        . '<div class="ha-form-item" style="flex:1;min-width:220px"><label>免费名额档位</label>'
        . '<textarea class="ha-input" id="haCfg_room_tiers" rows="3" style="font-family:Menlo,Consolas,monospace">'
        . Sec::e(haLTCfg('room_tiers')) . '</textarea>'
        . '<p style="font-size:12px;color:#5C5C5C;margin-top:4px">每行一条「等级:名额」，取最高命中档。默认 10:3 / 20:5 / 50:8</p>'
        . '</div></div>';

    $head .= '<h4 class="ha-lt-cap">阶段阈值与任务量</h4><div class="ha-form-row">'
        . $f('stage_2', '日常阶段起始（Lv）')
        . $f('stage_3', '活跃阶段起始（Lv）')
        . $f('stage_4', '核心阶段起始（Lv）')
        . $f('stage_5', '荣誉阶段起始（Lv）')
        . $f('stage_gm', '各阶段群发言条数', '逗号分隔：新手,日常,活跃,核心,荣誉')
        . '</div>';

    $head .= '<h4 class="ha-lt-cap">加权参数</h4><div class="ha-form-row">'
        . $f('w_cap_ratio', '加权封顶比例', 'W ≤ 该比例 × D')
        . $f('w_daily_cap', '每日加权上限（天）')
        . $f('w_login_every', '连续登录每 N 天 +1')
        . $f('w_login_step', '连续登录每次加（天）')
        . $f('w_days_every', '累计登录每 N 天 +1')
        . $f('w_days_step', '累计登录每次加（天）')
        . $f('w_msg_min', '发言加权下限（天）')
        . $f('w_msg_max', '发言加权上限（天）')
        . $f('w_file_min', '文件加权下限（天）')
        . $f('w_file_max', '文件加权上限（天）')
        . $f('w_file_days', '文件加权最多累积（次）')
        . $f('catchup_slow', '追赶系数·低于中位数')
        . $f('catchup_fast', '追赶系数·高出中位数10级')
        . '</div>';

    $head .= '<h4 class="ha-lt-cap">有效发言判定</h4><div class="ha-form-row">'
        . $f('msg_min_len', '内容最少字数')
        . $f('msg_cooldown', '计入冷却（秒）')
        . $f('msg_per_minute', '每分钟最多计入（条）')
        . $f('msg_dedupe', '与最近 N 条去重')
        . '</div>';

    $head .= '<div class="ha-modal-actions"><button class="ha-btn ha-btn-primary" onclick="HaLT.saveCfg()">保存全部参数</button></div></div>';

    $head .= '<div class="ha-card"><h3 style="margin:0 0 10px">用户查询</h3><div class="ha-form-row">'
        . '<div class="ha-form-item" style="min-width:120px"><label>用户 ID</label>'
        . '<input class="ha-input" id="haLTUid" type="number" min="1" placeholder="如 1"'
        . ' onkeydown="if(event.key===\'Enter\')HaLT.query()"></div>'
        . '<button class="ha-btn ha-btn-primary" onclick="HaLT.query()">查询</button>'
        . '</div><div id="haLTUser"></div></div>';

    return $head;
});

/* ============================ 资源 ============================ */

Plugin::asset('css', 'level-trust/style.css');
Plugin::asset('js', 'level-trust/chat.js');
Plugin::asset('js', 'level-trust/admin.js');
