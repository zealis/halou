<?php
/**
 * 上传与媒体：头像 / 贴纸 / 图片消息一律本地存储、不走图床。
 * 贴纸与图片消息原图直存（不做任何压缩）；头像会居中裁剪缩放为正方形。
 */
class Upload
{
    private static array $cfg = [];

    /**
     * 头像统一尺寸（正方形边长 px）：居中裁剪 + 缩放后输出。
     * 前端已提供滑块手动缩放裁剪并按此尺寸导出；服务端再裁一次作为兜底
     * （直接调用接口、或前端裁剪失败时仍保证方形）。
     * 目的：① 长方形原图在圆形容器里会被拉成椭圆（老浏览器不支持 object-fit，
     * 靠 CSS 修不住）→ 直接在服务端裁成方形，任何浏览器下都是正圆；
     * ② 避免几 MB 的大图当头像反复传输。
     * 仅作用于头像；贴纸与图片消息仍按 v1.0.35 约定原图直存，不做任何压缩。
     */
    private const AVATAR_SIZE = 100;


    public static function init(array $cfg): void
    {
        self::$cfg = $cfg['upload'];
        @mkdir(self::$cfg['dir'], 0775, true);
        foreach (['avatar', 'sticker', 'image'] as $d) @mkdir(self::$cfg['dir'] . '/' . $d, 0775, true);
    }

    private static function checkImage(array $f): array
    {
        if ($f['error'] !== UPLOAD_ERR_OK) return [false, '上传失败（错误码 ' . $f['error'] . '）'];
        if ($f['size'] > self::$cfg['max_size']) return [false, '文件超过大小限制'];
        $info = @getimagesize($f['tmp_name']);
        if (!$info) return [false, '仅支持图片文件'];
        $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'][$info[2]] ?? null;
        if (!$ext) return [false, '仅支持 jpg/png/gif/webp'];
        return [true, $ext];
    }

    /** 本地存储：头像 / 贴纸 / 图片消息（原图直存，不压缩） */
    public static function local(array $f, string $kind): array
    {
        [$ok, $extOrMsg] = self::checkImage($f);
        if (!$ok) return [false, $extOrMsg];
        if (!in_array($kind, ['avatar', 'sticker', 'image'], true)) return [false, '非法类型'];
        $name = date('Ymd') . '_' . bin2hex(random_bytes(8)) . '.' . $extOrMsg;
        $dest = self::$cfg['dir'] . '/' . $kind . '/' . $name;
        if (!move_uploaded_file($f['tmp_name'], $dest)) return [false, '保存失败'];
        // 头像：居中裁剪 + 缩放为正方形（失败则退回原图，不影响可用性）
        if ($kind === 'avatar') $name = self::squareAvatar($dest, $name) ?: $name;
        $rel = self::$cfg['url'] . '/' . $kind . '/' . $name;
        // 手动配置了「固定网站地址」才返回绝对 URL（自动识别不参与，避免误判）
        return [true, ow_abs_url($rel, true)];
    }

    /**
     * 头像裁剪缩放：居中裁成正方形 → 缩放至 AVATAR_SIZE → 统一输出 jpg。
     *
     * @param string $dest 已落盘的原始文件路径
     * @param string $name 原始文件名
     * @return string|null 成功返回最终文件名（.jpg），失败（无 GD / 非图片）返回 null
     */
    private static function squareAvatar(string $dest, string $name): ?string
    {
        if (!function_exists('imagecreatefromstring')) return null;
        $src = @imagecreatefromstring((string)file_get_contents($dest));
        if (!$src) return null;

        $w = imagesx($src); $h = imagesy($src);
        $side = min($w, $h);                                  // 以短边为正方形边长
        $sx = (int)(($w - $side) / 2);                         // 居中裁剪起点
        $sy = (int)(($h - $side) / 2);
        $size = self::AVATAR_SIZE;

        $dst = imagecreatetruecolor($size, $size);
        // 白底填充：PNG/WebP 透明区域转 jpg 时不会变黑
        imagefilledrectangle($dst, 0, 0, $size, $size, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, $sx, $sy, $size, $size, $side, $side);
        imagedestroy($src);

        // 统一 jpg（头像无需透明通道，体积可控）；原为 jpg 时直接覆盖同名文件
        $outName = preg_replace('/\.(png|gif|webp)$/i', '.jpg', $name) ?: $name;
        $ok = imagejpeg($dst, self::$cfg['dir'] . '/avatar/' . $outName, 90);
        imagedestroy($dst);
        if (!$ok) return null;
        if ($outName !== $name) @unlink($dest);                // 清掉转换前的原图
        return $outName;
    }

    /**
     * 统一上传入口：全部走本地原样存储（不压缩、不转码、不转发图床）
     * 例外：头像会居中裁剪缩放为正方形（见 squareAvatar）
     */
    public static function handle(array $f, string $kind): array
    {
        return self::local($f, $kind);
    }


    /**
     * 由消息里的相对路径解析出可下载的绝对路径（阻断路径穿越）
     * @return string|null
     */
    public static function fileAbs(string $rel): ?string
    {
        $rel = str_replace('\\', '/', $rel);
        if ($rel === '' || strpos($rel, '..') !== false) return null;
        if (!preg_match('#^file/[A-Za-z0-9_\-./]+$#', $rel)) return null;
        $abs = realpath(self::$cfg['dir'] . '/' . $rel);
        $base = realpath(self::$cfg['dir']);
        if ($abs === false || $base === false || strpos($abs, $base) !== 0) return null;
        return is_file($abs) ? $abs : null;
    }
    public static function addSticker(array $actor, string $url): array
    {
        if ($actor['kind'] === 'none') return [false, '请先登录'];
        // v1.0.100：仅允许收藏本站上传的图片（uploads/ 下的随机文件名），
        // 杜绝收藏任意外站 URL 引入追踪图片 / 不可控内容
        $base = rtrim(ow_site_url(true), '/');
        $rel = ltrim($url);
        if ($base !== '' && stripos($rel, $base . '/') === 0) $rel = ltrim(substr($rel, strlen($base) + 1));
        if (!preg_match('#^uploads/(avatar|sticker|image)/[A-Za-z0-9_\-]+\.(jpg|jpeg|png|gif|webp)$#i', $rel)) {
            return [false, '仅支持收藏本站上传的图片'];
        }
        $owner = $actor['kind'] . $actor['id'];
        if ((int)DB::val('SELECT COUNT(*) FROM stickers WHERE owner_key=?', [$owner]) >= 100) {
            return [false, '贴纸收藏已满（100 张）'];
        }
        DB::insert('stickers', ['owner_key' => $owner, 'url' => $url, 'created_at' => time()]);
        return [true, '已收藏'];
    }

    public static function stickers(array $actor): array
    {
        if ($actor['kind'] === 'none') return [];
        return array_map(
            fn($r) => ['id' => (int)$r['id'], 'url' => $r['url']],
            DB::all('SELECT * FROM stickers WHERE owner_key=? ORDER BY id DESC LIMIT 100', [$actor['kind'] . $actor['id']])
        );
    }

    public static function delSticker(array $actor, int $id): array
    {
        DB::run('DELETE FROM stickers WHERE id=? AND owner_key=?', [$id, $actor['kind'] . $actor['id']]);
        return [true, '已删除'];
    }
}
