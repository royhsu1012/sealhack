// 像素海豹的格子:CSS 產生器(scripts/seal-css.mjs)與下載圖卡(share-card.js)共用,確保兩邊畫出來一模一樣。
// P = src/data/seal-pixels.json(參考圖 1:1 還原);顏色是 CSS 變數字串,圖卡會再換成實際色碼。
import { ACCESSORIES } from '../data/seal-accessories.js';

/** 畫布範圍:海豹本體加上所有配件(各人格的海豹位置一致) */
export const SEAL_BOX = { x: 56, y: 26, w: 78, h: 53 };

const sp = (i) => `var(--sp-${i})`;
export const charColors = (P) => ({
  O: sp(P.roles.line), C: sp(P.roles.body), E: sp(P.roles.eye), W: sp(P.roles.shine), S: sp(P.roles.shade),
  G: 'var(--gold)', A: 'var(--seal-acorn)', R: 'var(--warn)',
});

const fromRects = (list) => {
  const m = new Map();
  for (const [x, y, w, h, c] of list) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) m.set(`${xx},${yy}`, sp(c));
  return m;
};

/** 身體(眼睛的位置鋪身體色,眼睛層蓋上去時不會有縫) */
export const bodyCells = (P) => new Map([...eyeLineCells(P, 'cover'), ...fromRects(P.body)]);
/** 睜開的眼睛 */
export const eyeCells = (P) => fromRects(P.eyes);
/** 閉眼(眨眼用)、瞇眼笑(happy),或只鋪身體色(cover) */
export function eyeLineCells(P, kind) {
  const C = charColors(P), m = new Map();
  for (const [x0, y0, x1, y1] of P.eyeBoxes) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(`${x},${y}`, C.C);
    if (kind === 'cover') continue;
    const mid = kind === 'shut' ? y1 - 1 : y0 + 2, ends = kind === 'shut' ? mid - 1 : mid + 1;
    for (let x = x0 + 1; x < x1; x++) m.set(`${x},${mid}`, C.E);
    m.set(`${x0},${ends}`, C.E); m.set(`${x1},${ends}`, C.E);
  }
  return m;
}
/** 人格配件 */
export function accessoryCells(P, variant) {
  const C = charColors(P), m = new Map();
  for (const { x, y, rows } of ACCESSORIES[variant] ?? []) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') m.set(`${x + i},${y + j}`, C[ch]); }));
  }
  return m;
}
/** 一隻完整的海豹(身體 + 眼睛 + 配件),給圖卡用 */
export function sealCells(P, variant) {
  const eyes = variant === 'slow' ? eyeLineCells(P, 'happy') : eyeCells(P);
  return new Map([...bodyCells(P), ...eyes, ...accessoryCells(P, variant)]);
}
