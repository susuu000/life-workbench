"""生成 Susu 国风月亮图标 v2：秘色底 + 满月 + 祥云 + 金边 + 滇红星点。"""
from PIL import Image, ImageDraw
from math import sqrt

MI_SE = (46, 111, 126)
MI_SE_DARK = (31, 77, 90)
GOLD = (201, 162, 39)
MOON_TOP = (243, 226, 176)   # 月顶 浅金奶白
MOON_BOT = (217, 182, 90)    # 月底 金
CLOUD = (240, 239, 233)
DIAN_HONG = (140, 34, 48)
TU = (176, 125, 60)
GLOW = (245, 245, 240)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def radial_glow(img, cx, cy, maxr, max_alpha, steps=140):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for i in range(steps):
        rr = maxr * (1 - i / steps)
        a = int(max_alpha * (i / steps))
        ld.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=GLOW + (a,))
    return Image.alpha_composite(img, layer)


def moon_with_gradient(img, cx, cy, r):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    y0, y1 = int(cy - r), int(cy + r)
    for y in range(y0, y1):
        t = (y - y0) / (2 * r)
        ld.line([(int(cx - r), y), (int(cx + r), y)], fill=lerp(MOON_TOP, MOON_BOT, t))
    layer.putalpha(mask)
    return Image.alpha_composite(img, layer)


def draw_cloud(img, x, y, s, alpha):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    puffs = [(0, 0, 1.0), (-0.95, 0.12, 0.7), (0.95, 0.12, 0.7),
             (-0.45, -0.45, 0.62), (0.45, -0.45, 0.62)]
    for px, py, pr in puffs:
        rr = s * pr
        ld.ellipse([x + px * s - rr, y + py * s - rr, x + px * s + rr, y + py * s + rr],
                   fill=CLOUD + (alpha,))
    ld.arc([x - s * 1.15, y - s * 0.25, x + s * 1.15, y + s * 0.95],
           start=195, end=345, fill=CLOUD + (alpha,), width=max(2, int(s * 0.14)))
    # 金边细线
    ld.arc([x - s * 1.15, y - s * 0.25, x + s * 1.15, y + s * 0.95],
           start=195, end=345, fill=GOLD + (int(alpha * 0.6),), width=max(1, int(s * 0.05)))
    return Image.alpha_composite(img, layer)


def draw_mountain(img, base_y, peak_x, w, h, color, alpha):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.polygon([(peak_x - w, base_y), (peak_x, base_y - h), (peak_x + w, base_y)],
               fill=color + (alpha,))
    return Image.alpha_composite(img, layer)


def make_icon(size):
    img = Image.new('RGBA', (size, size), MI_SE)
    cx, cy = size * 0.52, size * 0.44
    r = size * 0.26

    # 背景光晕
    img = radial_glow(img, cx, cy, r * 2.1, 70)

    # 远山（土色，底部，低透明）
    img = draw_mountain(img, size * 0.99, size * 0.30, size * 0.34, size * 0.16, TU, 90)
    img = draw_mountain(img, size * 1.0, size * 0.72, size * 0.40, size * 0.20, MI_SE_DARK, 120)

    # 祥云（两朵，金边）
    img = draw_cloud(img, size * 0.28, size * 0.74, size * 0.10, 210)
    img = draw_cloud(img, size * 0.80, size * 0.80, size * 0.085, 170)

    # 月亮
    img = moon_with_gradient(img, cx, cy, r)
    # 金边
    ImageDraw.Draw(img).ellipse([cx - r, cy - r, cx + r, cy + r],
                                 outline=GOLD, width=max(2, int(size * 0.012)))
    # 月面细微环形山（低透明）
    d = ImageDraw.Draw(img)
    crater = [(0.18, -0.12, 0.10), (-0.22, 0.18, 0.08), (0.05, 0.28, 0.06)]
    for cxp, cyp, cr in crater:
        rr = r * cr
        cx0, cy0 = cx + cxp * r, cy + cyp * r
        d.ellipse([cx0 - rr, cy0 - rr, cx0 + rr, cy0 + rr],
                  outline=(120, 95, 40, 60), width=max(1, int(size * 0.004)))

    # 滇红星点（右上）
    sx, sy, sr = cx + r * 0.95, cy - r * 0.9, max(3, size * 0.022)
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=DIAN_HONG)

    return img


def make_splash(size):
    img = Image.new('RGBA', (size, size), MI_SE)
    cx, cy = size * 0.5, size * 0.5
    r = size * 0.16
    img = moon_with_gradient(img, cx, cy, r)
    ImageDraw.Draw(img).ellipse([cx - r, cy - r, cx + r, cy + r],
                                 outline=GOLD, width=max(2, int(size * 0.01)))
    return img


if __name__ == '__main__':
    import os
    base = '/workspace/life-workbench/assets'
    os.makedirs(base, exist_ok=True)
    make_icon(1024).save(f'{base}/icon.png')
    make_icon(1024).save(f'{base}/adaptive-icon.png')
    make_icon(192).save(f'{base}/favicon.png')
    make_splash(1242).save(f'{base}/splash.png')
    print('icons generated (v2 国风)')
