// 下載圖卡:把退休人格、像素海豹與「最快幾年幾月可以退休」畫成 1080 × 1350 的 PNG(IG / LINE 直式)。
// 海豹格子跟網站的 CSS 版共用 seal-cells.js;顏色從 CSS 變數讀(圖卡固定用淺色主題)。按下按鈕時才載入這支檔案。
import P from '../data/seal-pixels.json';
import { SEAL_BOX, sealCells } from './seal-cells.js';

const W = 1080, H = 1350;
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
 * @param {{ variant: string, name: string, tag: string, tint: string, kicker: string, when: string, sub: string }} c
 * @returns {Promise<Blob>}
 */
export async function makeCard(c) {
  const cells = sealCells(P, c.variant);
  const tokens = ['--ink', '--ink-2', '--surface', '--free', varName(c.tint), ...new Set([...cells.values()].map(varName))];
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
  text('SealHack FIRE 退休測驗', W / 2, 96, 32, 700, col['--ink-2']);
  text('我是', W / 2, 190, 40, 600, col['--ink-2']);
  text(c.name, W / 2, 300, 104, 800, col['--ink']);
  text(c.tag, W / 2, 372, 36, 600, col['--ink-2']);

  // 像素海豹:一格 11px,置中
  const s = 11, ox = (W - SEAL_BOX.w * s) / 2, oy = 400;
  for (const [key, v] of cells) {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = col[varName(v)];
    ctx.fillRect(ox + (x - SEAL_BOX.x) * s, oy + (y - SEAL_BOX.y) * s, s, s);
  }

  // 主答案
  const py = 990, ph = 250;
  ctx.fillStyle = col['--surface'];
  roundRect(ctx, 80, py, W - 160, ph, 44);
  ctx.fill();
  text(c.kicker, W / 2, py + 66, 36, 600, col['--ink-2']);
  text(c.when, W / 2, py + 160, 88, 800, col['--ink']);
  text(c.sub, W / 2, py + 216, 34, 600, col['--free']);

  text('sealhack.com', 80, H - 44, 32, 800, col['--ink'], 'left');
  text('試算結果,不構成投資建議', W - 80, H - 44, 26, 600, col['--ink-2'], 'right');

  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}
