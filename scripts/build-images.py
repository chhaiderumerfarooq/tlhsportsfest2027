#!/usr/bin/env python3
"""Build optimized site images from the reference logo and poster colors.

Run from the repo root: python3 scripts/build-images.py
Requires Pillow. The generated files are committed, so this is optional.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'reference', 'TLH_SportsFest_3_0_-_logo__white_.png')
OUT = os.path.join(ROOT, 'assets', 'img')
FONT = '/tmp/Anton-Regular.ttf'
os.makedirs(OUT, exist_ok=True)

logo = Image.open(REF).convert('RGBA')

# ---- site logo, 640 px wide -------------------------------------------------
w = 640
h = round(logo.height * w / logo.width)
small = logo.resize((w, h), Image.LANCZOS)
small.save(os.path.join(OUT, 'logo-640.png'), optimize=True)
small.save(os.path.join(OUT, 'logo-640.webp'), quality=86, method=6)

# ---- favicons: white logo on an orange rounded square -----------------------
def rounded(size, radius_ratio=0.22):
    scale = 4
    big = size * scale
    layer = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # subtle vertical gradient
    top = (200, 56, 6, 255)
    bottom = (228, 92, 6, 255)
    for y in range(big):
        t = y / (big - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        d.line([(0, y), (big, y)], fill=color)
    mask = Image.new('L', (big, big), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * radius_ratio), fill=255)
    layer.putalpha(mask)
    return layer.resize((size, size), Image.LANCZOS)

for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (32, 'favicon-32.png')]:
    square = rounded(size)
    target_w = int(size * 0.72)
    target_h = round(logo.height * target_w / logo.width)
    mark = logo.resize((target_w, target_h), Image.LANCZOS)
    square.alpha_composite(mark, ((size - target_w) // 2, (size - target_h) // 2))
    square.save(os.path.join(OUT, name), optimize=True)

# .ico for older browsers
rounded(64).save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])

# ---- Open Graph 1200 x 630 --------------------------------------------------
W, H = 1200, 630
stops = [
    (0.00, (160, 5, 9)),
    (0.22, (196, 51, 7)),
    (0.36, (211, 69, 7)),
    (0.50, (228, 92, 6)),
    (0.65, (160, 66, 2)),
    (0.79, (92, 38, 0)),
    (0.93, (45, 12, 3)),
    (1.00, (22, 16, 18)),
]
og = Image.new('RGB', (W, H))
px = og.load()
for y in range(H):
    t = y / (H - 1)
    for i in range(len(stops) - 1):
        a, ca = stops[i]
        b, cb = stops[i + 1]
        if a <= t <= b:
            k = (t - a) / (b - a)
            color = tuple(round(ca[j] * (1 - k) + cb[j] * k) for j in range(3))
            break
    else:
        color = stops[-1][1]
    for x in range(W):
        px[x, y] = color

# embers
random.seed(7)
ember_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ed = ImageDraw.Draw(ember_layer)
for _ in range(70):
    x = random.randint(0, W)
    y = random.randint(0, H)
    r = random.choice([1, 1, 2, 2, 3, 4])
    alpha = random.randint(40, 130)
    ed.ellipse([x - r, y - r, x + r, y + r], fill=(255, 190, 60, alpha))
ember_layer = ember_layer.filter(ImageFilter.GaussianBlur(0.6))
og = Image.alpha_composite(og.convert('RGBA'), ember_layer)

# logo at top centre
mark_w = 210
mark_h = round(logo.height * mark_w / logo.width)
mark = logo.resize((mark_w, mark_h), Image.LANCZOS)
og.alpha_composite(mark, ((W - mark_w) // 2, 34))

font_path = FONT if os.path.exists(FONT) else '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
title_font = ImageFont.truetype(font_path, 108)
edition_font = ImageFont.truetype(font_path, 46)
date_font = ImageFont.truetype(font_path, 30)
small_font = ImageFont.truetype(font_path, 20)

def skewed_text(base, text, font, center_x, y, fill, shadow=(45, 12, 3, 255), shear=0.14, offset=6):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = d.textbbox((0, 0), text, font=font)
    tw = box[2] - box[0]
    th = box[3] - box[1]
    x = center_x - tw // 2 - box[0]
    d.text((x + offset, y + offset), text, font=font, fill=shadow)
    d.text((x, y), text, font=font, fill=fill)
    # shear around the text baseline
    layer = layer.transform((W, H), Image.AFFINE, (1, shear, -shear * y, 0, 1, 0), resample=Image.BICUBIC)
    base.alpha_composite(layer)
    return th

skewed_text(og, 'TLH SPORTS FEST 3.0', title_font, W // 2, 220, (255, 255, 255, 255))
skewed_text(og, 'III EDITION', edition_font, W // 2, 356, (255, 206, 64, 255), shadow=(92, 38, 0, 255), offset=4)
skewed_text(og, 'SAT 30 & SUN 31 JANUARY 2027', date_font, W // 2, 438, (255, 248, 240, 255), shadow=(45, 12, 3, 220), offset=3, shear=0.06)
skewed_text(og, 'TLH CANAL CAMPUS', small_font, W // 2, 490, (255, 206, 64, 255), shadow=(45, 12, 3, 200), offset=2, shear=0.04)

og.convert('RGB').save(os.path.join(OUT, 'og-image.png'), optimize=True)
print('Wrote', len(os.listdir(OUT)), 'image files to assets/img')
