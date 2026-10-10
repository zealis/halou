<?php
/**
 * 系统通知（v1.3.52）—— 账号安全事件的站内留痕。
 *
 * 为什么单独一张表而不复用 rooms/messages：通知是**按用户**的隐私内容（谁改了密码、
 * 谁被封过号），塞进一个全局房间会让所有人互相看得到。
 * 也不做进邮件：邮箱可能没绑、可能收不到，站内通知是账号自己的记录，与可达性无关。
 *
 * 文案集中在这里而不是散到各调用点：一是同一事件多处触发时口径必须一致，
 * 二是 lang-en 语言包按「中文原文」精确匹配，文案只有一个出处才好维护。
 */
class Notice
{
    /** 每人最多留多少条：超出即丢最旧的，避免长期累积（不需要为此再加一个计划任务） */
    private const KEEP = 200;

    /** 事件类型 → 通知正文。调用方只报「发生了什么」，措辞由这里定。 */
    private const TEXTS = [
        'pwd'       => '你的登录密码已修改。如果不是你本人操作，请立即再次修改密码并检查账号安全。',
        'email'     => '你的账号邮箱已修改。如果不是你本人操作，请立即联系管理员。',
        'twofa_on'  => '两步验证已开启，之后登录需要输入动态验证码。',
        'twofa_off' => '两步验证已关闭，登录不再需要动态验证码。',
        'banned'    => '你的账号已被管理员封禁，暂时无法登录与发言。',
        'unbanned'  => '你的账号已被解封，可以正常登录与发言。',
        // 禁言的正文是动态的（要带范围、群聊 id、时长），这条只是兜底：
        // 万一调用方没走 Notice::muted() 也不会发出一条空消息。
        'muted'     => '你的账号已被禁言。',
    ];

    /**
     * 禁言通知：必须让用户知道**在哪个群、多久**。
     * 文案放核心而不是拼在插件里 —— 禁言有两个入口（后台添加、群聊右键），
     * 两处各写一句迟早不一致；将来解封通知也要用同样的范围措辞。
     *
     * @param int $roomId 0 = 全站禁言（只有后台能设），其余为具体群聊
     * @param int $hours  0 = 永久
     */
    public static function muted(int $userId, int $roomId, int $hours): void
    {
        // 两种范围各配一个开头，动词只出现一次：
        //   群聊 → 「你在群聊 #12 被禁言 24 小时。」
        //   全站 → 「你的账号被全站禁言 24 小时。」
        // 早先写成拼接 '账号被全站' + ' 被永久禁言' 会输出「账号被全站 被永久禁言。」
        $head = $roomId > 0 ? '你在群聊 #' . $roomId . ' 被' : '你的账号被全站';
        self::push($userId, 'muted', $hours > 0 ? $head . '禁言 ' . $hours . ' 小时。' : $head . '永久禁言。');
    }

    /**
     * 系统通知的固定头像 = 生成式头像「小可爱（open-peeps）第 36 号」。
     * 写死风格与种子（而不是随机）：通知是长期留痕，头像必须每次都一样，
     * 否则用户回看时认不出是谁发的。种子取值范围见 Auth::AVATAR_SEED_COUNT。
     */
    private const AVATAR_STYLE = 'open-peeps';
    private const AVATAR_SEED  = '36';

    /** 通知头像 URL（侧栏那一行与消息流共用；avatar_source 设为内置时自动回落 identicon） */
    public static function avatarUrl(): string
    {
        return Auth::avatarGeneratedUrl(self::AVATAR_STYLE, self::AVATAR_SEED);
    }

    /** 列表下发给前端的类型标签（图标按它挑，不让前端猜文案） */
    public static function kinds(): array
    {
        return array_keys(self::TEXTS);
    }

    /**
     * 记一条通知。$kind 必须是已知类型（未知类型直接丢弃 —— 宁可不发，
     * 也不要在界面上出现一个没有图标、没有语义的孤立条目）。
     * 静默失败：通知是旁路留痕，绝不能因为它写失败就让「改密码」这种主流程报错回滚。
     */
    public static function push(int $userId, string $kind, string $body = ''): void
    {
        if ($userId <= 0 || !isset(self::TEXTS[$kind])) return;
        $text = $body !== '' ? $body : self::TEXTS[$kind];
        try {
            DB::insert('notices', [
                'user_id' => $userId, 'kind' => $kind, 'body' => $text,
                'created_at' => time(), 'read_at' => 0,
            ]);
            // 只保留最近 KEEP 条：一条 DELETE 解决，不给它配清理任务
            DB::run(
                'DELETE FROM notices WHERE user_id=? AND id NOT IN (SELECT id FROM notices WHERE user_id=? ORDER BY id DESC LIMIT ?)',
                [$userId, $userId, self::KEEP]
            );
        } catch (Throwable $e) {
            // 表还没建好（升级中途）等场景：吞掉，主流程照常
        }
    }

    /** 未读条数（rail 红点用）。游客恒为 0。 */
    public static function unread(int $userId): int
    {
        if ($userId <= 0) return 0;
        try {
            return (int)DB::val('SELECT COUNT(*) FROM notices WHERE user_id=? AND read_at=0', [$userId]);
        } catch (Throwable $e) { return 0; }
    }

    /**
     * 取最近的通知（新→旧），并把这次取到的都标为已读。
     * 「打开就全部已读」是站内通知的常规语义（没有逐条勾选的必要），
     * 也让红点在用户看过之后必然消失，不会留下清不掉的计数。
     */
    public static function forUser(int $userId, int $limit = 100): array
    {
        if ($userId <= 0) return [];
        $limit = max(1, min(200, $limit));
        try {
            $rows = DB::all(
                'SELECT id, kind, body, created_at FROM notices WHERE user_id=? ORDER BY id DESC LIMIT ?',
                [$userId, $limit]
            );
            if ($rows) DB::run('UPDATE notices SET read_at=? WHERE user_id=? AND read_at=0', [time(), $userId]);
        } catch (Throwable $e) {
            return [];
        }
        return $rows;
    }
}
