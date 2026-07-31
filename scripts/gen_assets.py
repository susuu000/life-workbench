"""生成生活工作台占位图标：秘色背景 + 月亮造型（金/土/滇红点缀）。"""
from PIL import Image, ImageDraw, ImageFilter

MI_SE = (46, 111, 126)      # 秘色 #2E6F7E
GOLD = (201, 162, 39)       # 金
TU = (176, 125, 60)         # 土
DIAN_HONG = (140, 34, 48)   # 滇红


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make_icon(size, out_path):
    img = Image.new("RGBA", (size, size), MI_SE)
    d = ImageDraw.Draw(img)

    cx, cy = size * 0.5, size * 0.48
    r = size * 0.30

    # 月亮主体（金），带柔光
    glow = img.copy()
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - r - size*0.02, cy - r - size*0.02,
                cx + r + size*0.02, cy + r + size*0.02], fill=GOLD)
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.03))
    img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)

    # 月亮实心
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)

    # 用土色圆偏移“咬”出月牙
    offset = r * 0.55
    d.ellipse([cx - r + offset, cy - r + offset*0.5,
               cx + r + offset, cy + r + offset*0.5], fill=MI_SE)

    # 滇红小星点（点缀）
    sx, sy, sr = cx - r*0.15, cy - r*0.85, max(2, size*0.018)
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=DIAN_HONG)

    # 土色细弧（云气感）
    d.arc([cx - r*1.05, cy - r*0.2, cx + r*1.05, cy + r*0.9],
          start=20, end=120, fill=TU, width=max(2, int(size*0.012)))

    img.save(out_path)
    print("saved", out_path, img.size)


def make_splash(size, out_path):
    img = Image.new("RGBA", (size, size), MI_SE)
    d = ImageDraw.Draw(img)
    cx, cy = size * 0.5, size * 0.5
    r = size * 0.16
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)
    offset = r * 0.55
    d.ellipse([cx - r + offset, cy - r + offset*0.5,
               cx + r + offset, cy + r + offset*0.5], fill=MI_SE)
    img.save(out_path)
    print("saved", out_path, img.size)


if __name__ == "__main__":
    import os
    os.makedirs("/workspace/life-workbench/assets", exist_ok=True)
    base = "/workspace/life-workbench/assets"
    make_icon(1024, f"{base}/icon.png")
    make_icon(1024, f"{base}/adaptive-icon.png")
    make_icon(192, f"{base}/favicon.png")
    make_splash(1242, f"{base}/splash.png")
