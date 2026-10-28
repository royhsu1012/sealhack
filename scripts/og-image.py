# 分享預覽圖:LINE / FB / X 貼連結時顯示的 1200 × 630 圖(og:image)。
# 左邊標題、右邊像素海豹(跟網站同一份 seal-pixels.json 與 --sp-* 色票,睜眼、只有本體)。
# 字型用 Noto Sans TC(跟網站一樣,OFL 授權);Windows 內建在 C:/Windows/Fonts,其他系統用 FONT 環境變數指定。
# 輸出:public/og.png
# 用法:python scripts/og-image.py(需要 Pillow)
import json
import os
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
P = json.loads((ROOT / 'src' / 'data' / 'seal-pixels.json').read_text(encoding='utf-8'))
css = (ROOT / 'src' / 'styles' / 'global.css').read_text(encoding='utf-8')

# 淺色主題的 tokens(每個名字取第一次出現的值 = :root)
tok = {}
for name, val in re.findall(r'(--[\w-]+):\s*(#[0-9a-fA-F]{6})', css):
    tok.setdefault(name, val)
rgb = lambda c: tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
sp = lambda i: rgb(tok[f'--sp-{i}'])

W, H = 1200, 630
img = Image.new('RGB', (W, H), rgb(tok['--pastel-sky']))
d = ImageDraw.Draw(img)

FONT = os.environ.get('FONT', 'C:/Windows/Fonts/NotoSansTC-VF.ttf')
def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([weight])
    except OSError:
        pass  # 不是可變字型就用預設字重
    return f

# ---- 海豹:眼睛位置先鋪身體色,再畫身體、睜開的眼睛 ----
cells = {}
for x0, y0, x1, y1 in P['eyeBoxes']:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            cells[(x, y)] = P['roles']['body']
for layer in ('body', 'eyes'):
    for x, y, w, h, c in P[layer]:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                cells[(xx, yy)] = c
xs = [x for x, _ in cells]
ys = [y for _, y in cells]
gx0, gy0 = min(xs), min(ys)
gw, gh = max(xs) - gx0 + 1, max(ys) - gy0 + 1
s = 420 // gw  # 一格幾 px(整數倍,邊緣銳利)
ox = 1200 - 60 - gw * s
oy = (H - gh * s) // 2 + 10
for (x, y), c in cells.items():
    px, py = ox + (x - gx0) * s, oy + (y - gy0) * s
    d.rectangle([px, py, px + s - 1, py + s - 1], fill=sp(c))

# ---- 文字 ----
ink, ink2, free = rgb(tok['--ink']), rgb(tok['--ink-2']), rgb(tok['--free'])
L = 72
d.text((L, 70), 'SealHack FIRE', font=font(32, 800), fill=free)
title = font(80, 800)
d.text((L, 140), '你最快什麼時候', font=title, fill=ink)
d.text((L, 240), '可以退休?', font=title, fill=ink)
d.text((L, 364), '回答 10 個小問題,', font=font(34, 600), fill=ink2)
d.text((L, 412), '看看你是哪一型的退休海豹', font=font(34, 600), fill=ink2)

# 隱私標籤(跟開場一樣):白底圓角
x = L
pill = font(26, 700)
for label in ('不記名', '免註冊', '答案不上傳'):
    w = d.textlength(label, font=pill)
    d.rounded_rectangle([x, 492, x + w + 40, 540], radius=24, fill=(255, 255, 255))
    d.text((x + 20, 499), label, font=pill, fill=ink)
    x += w + 40 + 12

out = ROOT / 'public' / 'og.png'
img.save(out, optimize=True)
print('written', out, f'{out.stat().st_size // 1024} KB', 'seal grid', gw, gh, 'scale', s)
