# 由使用者提供的參考圖(scripts/assets/seal-reference.png)1:1 還原像素海豹與場景。
# 原圖是約 3 倍放大的像素畫:先找出像素格的大小與位置,逐格取色,得到原生 192 × 108 的格子,
# 再拆成場景(色帶 + 外框)、影子、海豹身體、眼睛,合併成長方形寫進 src/data/seal-pixels.json;
# 調色盤寫進 src/styles/global.css 的 /* seal-palette */ 區塊(token 只能定義在 global.css)。
# 用法:python scripts/seal-sprite.py   (需要 Pillow)
import json, re
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'scripts' / 'assets' / 'seal-reference.png'
OUT = ROOT / 'src' / 'data' / 'seal-pixels.json'
CSS = ROOT / 'src' / 'styles' / 'global.css'

im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()
hexc = lambda c: '#%02x%02x%02x' % c
diff = lambda a, b: sum(abs(i - j) for i, j in zip(a, b))

# 1. 找像素格:相鄰像素顏色差很大的位置就是格線,找最吻合的間距與起點
col_e = [0] * (W + 1); row_e = [0] * (H + 1)
for y in range(H - 1):
    for x in range(W - 1):
        if diff(px[x, y], px[x + 1, y]) > 30: col_e[x + 1] += 1
        if diff(px[x, y], px[x, y + 1]) > 30: row_e[y + 1] += 1
def fit(edges, n):
    best = None
    for si in range(2850, 3250):
        s = si / 1000
        for oi in range(int(s * 20)):
            o = oi / 20
            score = sum(edges[int(round(o + k * s))] for k in range(int((n - o) / s) + 1) if int(round(o + k * s)) <= n)
            if best is None or score > best[0]: best = (score, s, o)
    return best[1], best[2]
sx, ox = fit(col_e, W)
sy, oy = fit(row_e, H)

# 2. 逐格取色(取格子內部最常見的顏色,避開邊緣的縮放模糊)
nx, ny = int((W - ox) // sx), int((H - oy) // sy)
grid = []
for j in range(ny):
    row = []
    for i in range(nx):
        x0, x1, y0, y1 = ox + i * sx, ox + (i + 1) * sx, oy + j * sy, oy + (j + 1) * sy
        pts = [px[x, y] for x in range(int(x0 + 0.8), int(x1 - 0.3) + 1) for y in range(int(y0 + 0.8), int(y1 - 0.3) + 1) if x < W and y < H]
        row.append(hexc(Counter(pts).most_common(1)[0][0]))
    grid.append(row)

# 3. 拆圖層:從邊緣往內灌水,碰得到的場景色是背景;其餘是海豹(含頭上的白色反光)
# 場景色 = 白色與淺藍(含縮放時邊界混出來的中間色);只在畫面中央、外框以內找海豹
def scene_like(c):
    r, g, b = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
    return b >= 0xf0 and g >= 0xe0 and r >= 0xbf
SHADOW = {'#97bad1', '#aac8dd', '#c6dceb', '#b2d0e6', '#b9d2e5', '#c5dff1', '#bbc7d4'}
WX0, WY0, WX1, WY1 = nx // 4, ny // 5, nx * 3 // 4, ny * 6 // 7
outside = set(); stack = [(i, WY0) for i in range(WX0, WX1)] + [(WX0, j) for j in range(WY0, WY1)] + [(WX1 - 1, j) for j in range(WY0, WY1)] + [(i, WY1 - 1) for i in range(WX0, WX1)]
while stack:
    i, j = stack.pop()
    if (i, j) in outside or not (WX0 <= i < WX1 and WY0 <= j < WY1) or not scene_like(grid[j][i]): continue
    outside.add((i, j)); stack += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
seal = {(i, j) for j in range(WY0, WY1) for i in range(WX0, WX1) if (i, j) not in outside}
xs = [i for i, _ in seal]; ys = [j for _, j in seal]
box = (min(xs), min(ys), max(xs), max(ys))
body_bottom = max(j for i, j in seal if grid[j][i] not in SHADOW)
shadow = {(i, j) for i, j in seal if grid[j][i] in SHADOW and j >= body_bottom - 4}
body = seal - shadow
# 眼睛:頭部最深色的兩團(連同裡面的反光),眨眼時整塊換掉
DARK = {'#323c4a', '#404a55', '#161b22', '#222c36'}
dark = {(i, j) for i, j in body if grid[j][i] in DARK and j <= box[1] + 18}
comps = []
left = set(dark)
while left:
    start = left.pop(); comp = {start}; st = [start]
    while st:
        i, j = st.pop()
        for n in [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1), (i + 1, j + 1), (i - 1, j - 1), (i + 1, j - 1), (i - 1, j + 1)]:
            if n in left: left.remove(n); comp.add(n); st.append(n)
    comps.append(comp)
eye_comps = sorted(comps, key=len, reverse=True)[:2]
eye_boxes = []
for c in sorted(eye_comps, key=lambda c: min(i for i, _ in c)):
    cx = [i for i, _ in c]; cy = [j for _, j in c]
    eye_boxes.append((min(cx), min(cy), max(cx), max(cy)))
eyes = {(i, j) for (x0, y0, x1, y1) in eye_boxes for i in range(x0, x1 + 1) for j in range(y0, y1 + 1) if (i, j) in body and grid[j][i] != '#e1e1e1'}
body_only = body - eyes

# 4. 調色盤與合併長方形(先橫向、再把上下一樣的段落接起來)
palette = [c for c, _ in Counter(grid[j][i] for j in range(ny) for i in range(nx)).most_common()]
idx = {c: k for k, c in enumerate(palette)}
def rects(cells):
    runs = {}
    for j in range(ny):
        i = 0
        while i < nx:
            if (i, j) not in cells: i += 1; continue
            c = grid[j][i]; n = 1
            while (i + n, j) in cells and grid[j][i + n] == c: n += 1
            runs.setdefault(j, []).append([i, j, n, 1, idx[c]]); i += n
    merged = []; open_ = {}
    for j in range(ny):
        nxt = {}
        for r in runs.get(j, []):
            key = (r[0], r[2], r[4])
            if key in open_: open_[key][3] += 1; nxt[key] = open_[key]
            else: merged.append(r); nxt[key] = r
        open_ = nxt
    return merged

scene_cells = {(i, j) for j in range(ny) for i in range(nx)} - seal
data = {
    'source': 'scripts/assets/seal-reference.png', 'grid': [round(sx, 3), round(ox, 2), round(sy, 3), round(oy, 2)],
    'w': nx, 'h': ny, 'box': box, 'eyeBoxes': eye_boxes,
    'palette': palette,
    'roles': {k: idx[v] for k, v in {'body': '#e1e1e1', 'line': '#5d738b', 'eye': '#323c4a', 'shine': '#ffffff', 'shade': '#c3ced9',
                                       'muzzle': '#94a2b0', 'dot': '#5b646d', 'nose': '#222c36'}.items()},
    'scene': rects(scene_cells), 'shadow': rects(shadow), 'body': rects(body_only), 'eyes': rects(eyes),
}
OUT.write_text(json.dumps(data, separators=(',', ':')) + '\n', encoding='utf-8')

css = CSS.read_text(encoding='utf-8')
block = '/* seal-palette:start(scripts/seal-sprite.py 產生,勿手改) */\n:root {\n' + ''.join(f'  --sp-{k}: {c};\n' for k, c in enumerate(palette)) + '}\n/* seal-palette:end */'
css = re.sub(r'/\* seal-palette:start[\s\S]*?seal-palette:end \*/', block, css) if 'seal-palette:start' in css else css.rstrip() + '\n\n' + block + '\n'
CSS.write_text(css, encoding='utf-8')
print('grid', nx, ny, 'box', box, 'eyes', eye_boxes, 'colors', len(palette),
      'rects', {k: len(data[k]) for k in ('scene', 'shadow', 'body', 'eyes')})
