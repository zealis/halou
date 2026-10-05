/**
 * 等级信任 —— 前台（资料卡等级行）
 *
 * 显示位置：**用户资料卡 .ha-card-meta 的最上面一行**。
 * 由核心 v1.2.42 的扩展点 `HaChat.onCardMetaTop(fn, prio)` 保证 ——
 * 核心在渲染 meta 时把扩展点的输出**前置**到「积分 / 注册」之前，
 * 而不是给插件一个空容器让插件自己 append（那样谁先注册谁在上面，且不抗漂移）。
 * prio=1 保证等级行在其它插件的顶部行之上。
 *
 * 数据：等级随核心 user_card 接口一起下发（服务端 user.card 钩子写入 u.level），
 * 前端**不再单独打一次接口** —— 弹窗打开时数据已经在手，不会出现「先空白再填充」。
 *
 * 游客：核心的 user_card 只查 users 表，游客 id 直接返回「用户不存在」，
 * 走不到这里；即便走到，u.level 为空也返回空串（不渲染这一行）。
 */
(function (w, d) {
    'use strict';
    // 幂等：合并资源包理论上只应加载一次，但历史上出现过被加载两遍的情况
    //（插件在 page.footer 里重复注入），届时扩展点会注册两次 → 资料卡出现两行等级。
    if (w.__haLevelLoaded) return;
    if (!w.HaChat || typeof HaChat.onCardMetaTop !== 'function') return;
    w.__haLevelLoaded = true;

    /** 任务 key → 中文（前台/后台共用） */
    var LABEL = {
        login: '登录', gm: '群发言', gfirst: '群聊首条',
        pfirst: '私聊首条', fup: '上传文件', fdl: '下载文件', fact: '群文件操作'
    };

    /** 等级徽章 HTML */
    function badge(lv, stageNo, honor) {
        var cls = 'ha-lt-badge ha-lt-s' + (stageNo || 1) + (honor ? ' ha-lt-honor' : '');
        return '<span class="' + cls + '">Lv.' + lv + '</span>';
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // v1.2.44：整行可点击 → 跳到前台等级页 ?page=level（规则 / 今日任务 / 解锁对比）。
    // 用 <a> 而不是 onclick：右键「新标签打开」和 Ctrl+点击才可用。
    HaChat.onCardMetaTop(function (u) {
        if (!u || !u.level) return '';      // 无等级（游客 / 数据缺失）→ 不渲染整行
        var title = u.level_honor ? '荣誉等级' : '等级';
        return '<a class="ha-card-meta-row ha-lt-row ha-lt-row-link" href="?page=level"'
            + ' title="查看等级规则与今日任务">'
            + '<span class="ha-card-meta-k">' + title + '</span>'
            + '<span class="ha-card-meta-v">'
            + badge(u.level, u.level_stage_no, u.level_honor)
            + (u.level_stage ? '<span class="ha-lt-stage">' + esc(u.level_stage) + '</span>' : '')
            + '<span class="ha-lt-go">详情 ›</span>'
            + '</span></a>';
    }, 1);

    /** 供其它插件/页面取用 */
    w.HaLevel = {
        LABEL: LABEL,
        badge: badge,
        /** 查「我的」等级与今日任务进度 */
        mine: function (cb) {
            HaApi.post('plugin_level_trust_mine', {}, function (r) {
                if (typeof cb === 'function') cb(r);
            });
        }
    };
})(window, document);
