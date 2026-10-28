// 下載圖卡:把退休人格、像素海豹與「最快幾年幾月可以退休」畫成 1080 × 1350 的 PNG(IG / LINE 直式)。
// 海豹格子跟網站的 CSS 版共用 seal-cells.js;顏色從 CSS 變數讀(圖卡固定用淺色主題)。按下按鈕時才載入這支檔案。
import P from '../data/seal-pixels.json';
import { SEAL_BOX, sealCells } from './seal-cells.js';

const W = 1080, H = 1350;
const STATES = {
  now: { color: '--gold', happy: true, sparkle: true },
  ahead: { color: '--free', happy: true },
  behind: { color: '--warn' },
  far: { color: '--ink-2', sweat: true },
};
const FONT = 'Manrope, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

/** 一次讀完需要的 CSS 變數(暫時拿掉深色模式,讀完馬上還原) */
function readColors(names) {
  const root = document.documentElement;
  const dark = root.classList.contains('dark');
  if (dark) root.classList.remove('dark');
  const cs = getComputedStyle(root);
  const out = Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()]));
  if (dark) root.classList.add('dark');
  return out;
}
const varName = (v) => v.match(/var\((--[\w-]+)\)/)?.[1];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * @param {{ variant: string, name: string, tag: string, tint: string, kicker: string, when: string, sub: string,
 *   state: { key: 'now' | 'ahead' | 'behind' | 'far', label: string } }} c
 * 狀態決定圖卡的樣子:now 金色標籤 + 笑眼 + 星星、ahead 綠色標籤 + 笑眼、behind 橘色標籤、far 灰色標籤 + 汗滴
 * @returns {Promise<Blob>}
 */
export async function makeCard(c) {
  const mood = STATES[c.state?.key] ?? STATES.ahead;
  const cells = sealCells(P, c.variant, { happy: mood.happy });
  const tokens = ['--ink', '--ink-2', '--surface', '--free', '--gold', '--warn', `--sp-${P.roles.line}`, '--sp-8', varName(c.tint), ...new Set([...cells.values()].map(varName))];
  const col = readColors([...new Set(tokens)]);
  await Promise.all(['800 96px', '700 40px', '600 34px'].map((f) => document.fonts.load(`${f} ${FONT}`, '退休海豹2039')).concat(document.fonts.ready));

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const text = (s, x, y, size, weight, color, align = 'center') => {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
  };

  // 底色:人格的粉彩色
  ctx.fillStyle = col[varName(c.tint)] || col['--surface'];
  ctx.fillRect(0, 0, W, H);
  // 狀態標籤(取代原本的網站名稱;網址在底部)
  if (c.state?.label) {
    ctx.font = `800 36px ${FONT}`;
    const bw = ctx.measureText(c.state.label).width + 96, bh = 76, bx = (W - bw) / 2, by = 52;
    ctx.fillStyle = col[mood.color];
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    text(c.state.label, W / 2, by + 51, 36, 800, col['--surface']);
  }
  text('我是', W / 2, 190, 40, 600, col['--ink-2']);
  text(c.name, W / 2, 300, 104, 800, col['--ink']);
  text(c.tag, W / 2, 372, 36, 600, col['--ink-2']);

  // 像素海豹:一格 11px,置中
  const s = 11, ox = (W - SEAL_BOX.w * s) / 2, oy = 400;
  const px = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(ox + (x - SEAL_BOX.x) * s, oy + (y - SEAL_BOX.y) * s, s, s); };
  for (const [key, v] of cells) {
    const [x, y] = key.split(',').map(Number);
    px(x, y, col[varName(v)]);
  }
  // 已經可以退休:海豹旁邊的金色星星;試到最後都還不夠:頭上的汗滴
  if (mood.sparkle) for (const [cx, cy] of [[63, 33], [127, 38], [60, 62], [130, 66]]) {
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([dx, dy], i) => px(cx + dx, cy + dy, i === 0 ? col['--surface'] : col['--gold']));
  }
  if (mood.sweat) {
    const drop = ['..O..', '.OBO.', 'OBBBO', 'OBBBO', '.OOO.'];
    drop.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') px(113 + i, 33 + j, ch === 'O' ? col[`--sp-${P.roles.line}`] : col['--sp-8']); }));
  }

  // 主答案
  const py = 990, ph = 250;
  ctx.fillStyle = col['--surface'];
  roundRect(ctx, 80, py, W - 160, ph, 44);
  ctx.fill();
  text(c.kicker, W / 2, py + 66, 36, 600, col['--ink-2']);
  text(c.when, W / 2, py + 160, 88, 800, col['--ink']);
  text(c.sub, W / 2, py + 216, 34, 600, col[mood.color === '--gold' ? '--free' : mood.color]);

  text('sealhack.com', 80, H - 44, 32, 800, col['--ink'], 'left');
  text('試算結果,不構成投資建議', W - 80, H - 44, 26, 600, col['--ink-2'], 'right');

  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}
