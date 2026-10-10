/**
 * 等级修仙 —— 把「Lv.X」文字徽章替换为修仙境界 SVG 图标
 *
 * 实现：扫描 .ow-lt-badge（资料卡 / 侧栏 / 等级页共用），解析文本里的等级，
 *       按映射表替换为对应境界的内联 SVG。用 MutationObserver 监听新增节点，
 *       再叠加一个低频定时器兜底，避免漏替换。
 *
 * 等级 → 境界（每境界 4 级，4 个低阶合成 1 个高阶，金仙从 41 级起）：
 *   1-4  练气   5-8  筑基   9-12 金丹  13-16 元婴  17-20 化神
 *  21-24 合体  25-28 渡劫  29-32 大乘  33-36 真仙  37-40 玄仙  41+ 金仙
 * 显示方式（仿 QQ 等级）：当前境界内显示 1-4 个图标，4 个合成下一境界。
 */
(function (w, d) {
    'use strict';
    if (w.__haCultLoaded) return;
    if (!w.OwChat) return;                       // 只要 OwChat 存在就执行（等级页也有徽章要替换）
    w.__haCultLoaded = true;

    /* ---------- 11 个境界 SVG（已去掉 width/height，靠 viewBox + CSS 缩放） ---------- */
    var ICONS = {
        1: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><circle cx="512" cy="512" r="120" fill="#8FA7A8"/><g fill="#8FA7A8"><path id="ow-cult-comma1" d="M 780 512 A 268 268 0 0 1 465.5 775.9 A 314.4 314.4 0 0 0 724 512 A 28 28 0 0 1 780 512 Z"/><use href="#ow-cult-comma1" transform="rotate(120 512 512)"/><use href="#ow-cult-comma1" transform="rotate(240 512 512)"/></g></svg>',
        2: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><circle cx="512" cy="350" r="56" fill="#3FAE8C"/><polygon points="392,450 632,450 752,630 272,630" fill="#3FAE8C" stroke="#3FAE8C" stroke-width="24" stroke-linejoin="round"/><rect x="212" y="666" width="600" height="64" rx="32" fill="#3FAE8C"/></svg>',
        3: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><circle cx="512" cy="512" r="140" fill="#F5C542"/><g fill="none" stroke="#F5C542" stroke-width="56" stroke-linecap="round"><path id="ow-cult-seg3" d="M 745.75 574.63 A 242 242 0 0 1 574.63 745.75"/><use href="#ow-cult-seg3" transform="rotate(90 512 512)"/><use href="#ow-cult-seg3" transform="rotate(180 512 512)"/><use href="#ow-cult-seg3" transform="rotate(270 512 512)"/></g></svg>',
        4: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g fill="#62B5FF"><circle cx="512" cy="446" r="40"/><path d="M 478.4 504.2 C 494.4 499.4 529.6 499.4 545.6 504.2 C 556.8 533 564.8 585.8 568 630.6 C 550.4 637 473.6 637 456 630.6 C 459.2 585.8 467.2 533 478.4 504.2 Z"/></g><path d="M 392 683 C 410 699 430 707 452 709 C 462 687 484 669 512 661 C 540 669 562 687 572 709 C 594 707 614 699 632 683 C 638 713 622 739 596 751 L 428 751 C 402 739 386 713 392 683 Z" fill="#62B5FF" stroke="#62B5FF" stroke-width="16" stroke-linejoin="round"/><g fill="none" stroke="#62B5FF" stroke-width="56" stroke-linecap="round"><path d="M 452.8 520.2 C 420.8 534.6 408 569.8 408 622.6"/><path d="M 571.2 520.2 C 603.2 534.6 616 569.8 616 622.6"/><path d="M 701.1 680.7 A 240 240 0 1 0 322.9 680.7"/></g></svg>',
        5: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g fill="#9B7BFF"><circle cx="512" cy="360" r="100"/><circle cx="512" cy="508" r="17"/><circle cx="464" cy="508" r="17"/><circle cx="560" cy="508" r="17"/><circle cx="416" cy="508" r="17"/><circle cx="608" cy="508" r="17"/><circle cx="368" cy="508" r="17"/><circle cx="656" cy="508" r="17"/><circle cx="272" cy="556" r="17"/><circle cx="320" cy="556" r="17"/><circle cx="368" cy="556" r="17"/><circle cx="416" cy="556" r="17"/><circle cx="464" cy="556" r="17"/><circle cx="512" cy="556" r="17"/><circle cx="560" cy="556" r="17"/><circle cx="608" cy="556" r="17"/><circle cx="656" cy="556" r="17"/><circle cx="704" cy="556" r="17"/><circle cx="752" cy="556" r="17"/><circle cx="272" cy="604" r="16"/><circle cx="320" cy="604" r="16"/><circle cx="368" cy="604" r="16"/><circle cx="416" cy="604" r="16"/><circle cx="464" cy="604" r="16"/><circle cx="512" cy="604" r="16"/><circle cx="560" cy="604" r="16"/><circle cx="608" cy="604" r="16"/><circle cx="656" cy="604" r="16"/><circle cx="704" cy="604" r="16"/><circle cx="752" cy="604" r="16"/><circle cx="272" cy="652" r="16"/><circle cx="320" cy="652" r="16"/><circle cx="368" cy="652" r="16"/><circle cx="416" cy="652" r="16"/><circle cx="464" cy="652" r="16"/><circle cx="512" cy="652" r="16"/><circle cx="560" cy="652" r="16"/><circle cx="608" cy="652" r="16"/><circle cx="656" cy="652" r="16"/><circle cx="704" cy="652" r="16"/><circle cx="752" cy="652" r="16"/><circle cx="320" cy="700" r="15"/><circle cx="368" cy="700" r="15"/><circle cx="416" cy="700" r="15"/><circle cx="464" cy="700" r="15"/><circle cx="512" cy="700" r="15"/><circle cx="560" cy="700" r="15"/><circle cx="608" cy="700" r="15"/><circle cx="656" cy="700" r="15"/><circle cx="704" cy="700" r="15"/><circle cx="368" cy="748" r="14"/><circle cx="416" cy="748" r="14"/><circle cx="464" cy="748" r="14"/><circle cx="512" cy="748" r="14"/><circle cx="560" cy="748" r="14"/><circle cx="608" cy="748" r="14"/><circle cx="656" cy="748" r="14"/></g></svg>',
        6: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><mask id="ow-cult-seam6"><circle cx="512" cy="512" r="268" fill="#fff"/><path d="M 512 292 A 110 110 0 0 1 512 512 A 110 110 0 0 0 512 732" fill="none" stroke="#000" stroke-width="56" stroke-linecap="round" transform="rotate(90 512 512)"/></mask><circle cx="512" cy="512" r="268" fill="#E27AFF" mask="url(#ow-cult-seam6)"/></svg>',
        7: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><mask id="ow-cult-bolt7" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect x="0" y="0" width="1024" height="1024" fill="#fff"/><polygon points="548,392 440,560 500,560 464,712 600,480 536,480" fill="#000" stroke="#000" stroke-width="16" stroke-linejoin="round"/></mask></defs><g mask="url(#ow-cult-bolt7)" fill="#526DFF"><circle cx="512" cy="250" r="24"/><circle cx="512" cy="326" r="64"/><path d="M 512 398 C 444 398 400 434 386 494 C 370 566 354 648 334 712 C 324 746 334 766 360 766 L 664 766 C 690 766 700 746 690 712 C 670 648 654 566 638 494 C 624 434 580 398 512 398 Z"/></g></svg>',
        8: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><circle cx="512" cy="366" r="84" fill="none" stroke="#FFB347" stroke-width="56"/><g fill="#FFB347"><rect x="452" y="506" width="120" height="48" rx="24"/><rect x="392" y="578" width="240" height="48" rx="24"/><rect x="332" y="650" width="360" height="48" rx="24"/><rect x="262" y="722" width="500" height="48" rx="24"/></g></svg>',
        9: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g fill="#FFF1A8"><path d="M 292 348 Q 292 396 340 396 Q 292 396 292 444 Q 292 396 244 396 Q 292 396 292 348 Z"/><path d="M 732 348 Q 732 396 780 396 Q 732 396 732 444 Q 732 396 684 396 Q 732 396 732 348 Z"/><path d="M 512 216 Q 512 256 552 256 Q 512 256 512 296 Q 512 256 472 256 Q 512 256 512 216 Z"/><circle cx="410" cy="724" r="52"/><circle cx="512" cy="708" r="64"/><circle cx="614" cy="724" r="52"/><rect x="322" y="740" width="380" height="68" rx="34"/></g><circle cx="512" cy="472" r="112" fill="none" stroke="#FFF1A8" stroke-width="56"/></svg>',
        10: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g fill="#D7B5FF"><path fill-rule="evenodd" d="M 512 362 A 150 150 0 0 1 512 662 A 75 75 0 0 1 512 512 A 75 75 0 0 0 512 362 Z M 512 557 A 30 30 0 1 0 512 617 A 30 30 0 1 0 512 557 Z"/><circle cx="512" cy="437" r="30"/><path d="M 683.6 324 Q 683.6 368 727.6 368 Q 683.6 368 683.6 412 Q 683.6 368 639.6 368 Q 683.6 368 683.6 324 Z"/><path d="M 736 468 L 780 512 L 736 556 L 692 512 Z"/><path d="M 512 692 L 556 736 L 512 780 L 468 736 Z"/><path d="M 288 468 L 332 512 L 288 556 L 244 512 Z"/><path d="M 512 244 L 556 288 L 512 332 L 468 288 Z"/></g><path d="M 728.4 454 A 224 224 0 1 1 606.7 309" fill="none" stroke="#D7B5FF" stroke-width="56" stroke-linecap="round"/></svg>',
        11: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><polygon points="356,340 372,258 442,324 512,228 582,324 652,258 668,340" fill="#FFD700"/><path d="M 512 484 Q 512 540 568 540 Q 512 540 512 596 Q 512 540 456 540 Q 512 540 512 484 Z" fill="#FFD700"/><circle cx="512" cy="540" r="140" fill="none" stroke="#FFD700" stroke-width="56"/><circle cx="512" cy="540" r="224" fill="none" stroke="#FFD700" stroke-width="56"/></svg>'
    };

    /* 境界中文名 */
    var REALMS = {
        1: '练气', 2: '筑基', 3: '金丹', 4: '元婴', 5: '化神',
        6: '合体', 7: '渡劫', 8: '大乘', 9: '真仙', 10: '玄仙', 11: '金仙'
    };

    /* ---------- 等级 → 境界图标编号（每境界4级） ---------- */
    function levelToIcon(lv) {
        lv = parseInt(lv, 10) || 1;
        if (lv >= 41) return 11;  // 金仙
        if (lv >= 37) return 10;  // 玄仙
        if (lv >= 33) return 9;   // 真仙
        if (lv >= 29) return 8;   // 大乘
        if (lv >= 25) return 7;   // 渡劫
        if (lv >= 21) return 6;   // 合体
        if (lv >= 17) return 5;   // 化神
        if (lv >= 13) return 4;   // 元婴
        if (lv >= 9) return 3;    // 金丹
        if (lv >= 5) return 2;    // 筑基
        return 1;                 // 练气
    }

    /* 境界起始等级 */
    function realmStart(icon) {
        return (icon - 1) * 4 + 1;
    }

    /* 当前境界内的位置（1-4），决定显示几个图标；金仙无上限 */
    function realmIconCount(lv, icon) {
        var start = realmStart(icon);
        return ((lv - start) % 4) + 1;
    }

    /* 从徽章文本里解析等级："Lv.42" → 42 */
    function parseLevel(text) {
        var m = String(text || '').match(/Lv\.(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
    }

    /* ---------- 替换单个徽章 ---------- */
    function replaceBadge(el) {
        try {
            if (!el || el.getAttribute('data-ow-cult') === '1') return;
            var lv = parseLevel(el.textContent || '');
            if (!lv) return;
            var icon = levelToIcon(lv);
            var count = realmIconCount(lv, icon);
            var svg = ICONS[icon] || ICONS[1];
            el.setAttribute('data-ow-cult', '1');
            el.setAttribute('title', 'Lv.' + lv + ' · ' + (REALMS[icon] || '') + ' ×' + count);
            // 所有境界都加发光，按境界编号递增强度（1=练气最弱，11=金仙最强）
            el.classList.add('ow-cult-glow', 'ow-cult-tier-' + icon);
            // 仿 QQ：当前境界内显示 1-4 个图标
            var html = '';
            for (var i = 0; i < count; i++) {
                html += svg;
            }
            el.innerHTML = html;
            var svgEls = el.querySelectorAll('svg');
            for (var j = 0; j < svgEls.length; j++) {
                svgEls[j].setAttribute('width', '100%');
                svgEls[j].setAttribute('height', '100%');
            }
        } catch (e) {
            // 单个徽章替换失败不影响其它
        }
    }

    /* ---------- 扫描全部徽章 ---------- */
    function scanAll(root) {
        root = root || d;
        var badges = root.querySelectorAll ? root.querySelectorAll('.ow-lt-badge') : [];
        for (var i = 0; i < badges.length; i++) {
            replaceBadge(badges[i]);
        }
    }

    /* ---------- 监听 DOM 变化（新增徽章时即时替换） ---------- */
    function observe() {
        if (!d.body) return;
        var MutationObserver = w.MutationObserver || w.WebKitMutationObserver;
        if (!MutationObserver) {
            // 老浏览器没有 MutationObserver，退化为定时器（见下方 scanAll）
            return;
        }
        var mo = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var nodes = mutations[i].addedNodes;
                if (!nodes) continue;
                for (var j = 0; j < nodes.length; j++) {
                    var n = nodes[j];
                    if (!n || n.nodeType !== 1) continue;
                    if (n.classList && n.classList.contains && n.classList.contains('ow-lt-badge')) {
                        replaceBadge(n);
                    }
                    if (n.querySelectorAll) {
                        scanAll(n);
                    }
                }
            }
        });
        mo.observe(d.body, { childList: true, subtree: true });
    }

    /* ---------- 启动 ---------- */
    function start() {
        // 延迟到下一帧再扫，确保服务端渲染的徽章已在 DOM 中
        setTimeout(function () {
            scanAll();
            observe();
        }, 0);
        // 兜底：每 1.5s 扫一次，防止 MutationObserver 漏掉（如跨 iframe / 极端时序）
        setInterval(function () { scanAll(); }, 1500);
    }

    if (d.readyState === 'loading') {
        d.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    /* 对外暴露（供调试 / 其它插件复用） */
    w.OwCult = {
        levelToIcon: levelToIcon,
        REALMS: REALMS,
        ICONS: ICONS,
        scanAll: scanAll,
        replaceBadge: replaceBadge
    };
})(window, document);
