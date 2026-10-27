# 網站圖示:把 public/favicon.svg(小海豹頭,scripts/seal-css.mjs 產生)畫成點陣圖,給不支援 SVG 圖示的地方用
# (Safari、搜尋結果、加到主畫面)。像素畫用整數倍放大,邊緣保持銳利。
# 輸出:public/favicon.ico(16 / 32 / 48)、public/favicon-32.png、public/favicon-48.png、public/apple-touch-icon.png(180,白底)
# 用法:npm run seal 之後執行 python scripts/seal-icons.py(需要 Pillow)
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
svg = (ROOT / 'public' / 'favicon.svg').read_text(encoding='utf-8')
rects = [(int(x), int(y), int(w), c) for x, y, w, c in re.findall(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1" fill="(#[0-9a-f]{6})"', svg)]
W = max(x + w for x, _, w, _ in rects)
H = max(y for _, y, _, _ in rects) + 1
rgb = lambda c: tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))

def render(scale, size, bg=None):
    """把格子放大 scale 倍,置中在 size × size 的畫布上"""
    img = Image.new('RGBA', (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    ox, oy = (size - W * scale) // 2, (size - H * scale) // 2
    for x, y, w, c in rects:
        for i in range(w):
            for dx in range(scale):
                for dy in range(scale):
                    img.putpixel((ox + (x + i) * scale + dx, oy + y * scale + dy), rgb(c) + (255,))
    return img

pub = ROOT / 'public'
icons = {16: render(1, 16), 32: render(2, 32), 48: render(3, 48)}
icons[32].save(pub / 'favicon-32.png')
icons[48].save(pub / 'favicon-48.png')
icons[48].save(pub / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[icons[16], icons[32]])
render(10, 180, bg=(255, 255, 255)).save(pub / 'apple-touch-icon.png')
print('grid', W, H, 'written: favicon.ico, favicon-32.png, favicon-48.png, apple-touch-icon.png')
