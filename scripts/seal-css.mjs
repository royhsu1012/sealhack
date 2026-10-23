// 把像素海豹轉成純 CSS:每一層是一個空的 <i>,用一列一列的 linear-gradient 背景畫出像素。
// 輸入:src/data/seal-pixels.json(參考圖 1:1 還原,只用海豹本體與眼睛)、src/data/seal-accessories.js(人格配件)
// 輸出:src/styles/seal.css(global.css 匯入)。像素大小由 --p 控制(預設 3px),顏色用 global.css 的 --sp-* token。
// 用法:npm run seal
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCESSORIES } from '../src/data/seal-accessories.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = JSON.parse(readFileSync(join(ROOT, 'src/data/seal-pixels.json'), 'utf8'));
const OUT = join(ROOT, 'src/styles/seal.css');

// 畫布:海豹本體加上所有配件的範圍(各人格的海豹位置一致)
const X0 = 56, Y0 = 26, W = 78, H = 53;
const sp = (i) => `var(--sp-${i})`;
const R = P.roles;
const CHAR = { O: sp(R.line), C: sp(R.body), E: sp(R.eye), W: sp(R.shine), S: sp(R.shade), G: 'var(--gold)', A: 'var(--seal-acorn)', R: 'var(--warn)' };
const u = (n) => (n === 0 ? '0' : `calc(var(--p) * ${n})`);
// 漸層裡的位置用百分比(相對整張畫布),CSS 比較短;三位小數在 3–4px 一格時誤差不到 0.01px
const pc = (n, total) => (n === 0 ? '0' : n === total ? '100%' : `${+(n / total * 100).toFixed(3)}%`);

/** 格子(Map "x,y" → 顏色)→ background 簡寫:每一列一個水平漸層,上下相同的列合併 */
function background(cells) {
  const rows = new Map();
  for (const [key, color] of cells) {
    const [x, y] = key.split(',').map(Number);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)[x - X0] = color;
  }
  const grads = [];
  [...rows.keys()].sort((a, b) => a - b).forEach((y) => {
    const row = rows.get(y);
    const stops = [];
    let x = 0, last = 0;
    while (x < W) {
      const c = row[x];
      if (!c) { x++; continue; }
      let n = 1;
      while (row[x + n] === c) n++;
      if (x > last) stops.push(`transparent ${pc(last, W)} ${pc(x, W)}`);
      stops.push(`${c} ${pc(x, W)} ${pc(x + n, W)}`);
      x += n; last = x;
    }
    if (last < W) stops.push(`transparent ${pc(last, W)}`);
    const g = `linear-gradient(90deg, ${stops.join(', ')})`;
    const prev = grads.at(-1);
    if (prev && prev.g === g && prev.y + prev.n === y - Y0) prev.n++;
    else grads.push({ g, y: y - Y0, n: 1 });
  });
  // 每一列往下多畫 0.5px 疊住下一列:螢幕縮放(例如 150%)時,列與列之間才不會露出細縫(上面的列先畫、蓋在上層)
  return grads.map(({ g, y, n }) => `${g} 0 ${u(y)} / 100% calc(var(--p) * ${n} + 0.5px) no-repeat`).join(',\n    ');
}
const fromRects = (list) => {
  const m = new Map();
  for (const [x, y, w, h, c] of list) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) m.set(`${xx},${yy}`, sp(c));
  return m;
};
const fromArt = (parts) => {
  const m = new Map();
  for (const { x, y, rows } of parts) rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') m.set(`${x + i},${y + j}`, CHAR[ch]); }));
  return m;
};
/** 閉眼(眨眼)與瞇眼笑:身體色蓋掉眼睛,再畫一條弧線 */
function eyeLine(kind) {
  const m = new Map();
  for (const [x0, y0, x1, y1] of P.eyeBoxes) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(`${x},${y}`, CHAR.C);
    if (kind === 'cover') continue;
    const mid = kind === 'shut' ? y1 - 1 : y0 + 2, ends = kind === 'shut' ? mid - 1 : mid + 1;
    for (let x = x0 + 1; x < x1; x++) m.set(`${x},${mid}`, CHAR.E);
    m.set(`${x0},${ends}`, CHAR.E); m.set(`${x1},${ends}`, CHAR.E);
  }
  return m;
}

const layers = {
  // 身體層把眼睛的位置也鋪上身體色,眼睛層蓋上去時不會有縫
  'px-body': new Map([...eyeLine('cover'), ...fromRects(P.body)]),
  'px-eyes': fromRects(P.eyes),
  'px-shut': eyeLine('shut'),
  'px-happy': eyeLine('happy'),
  ...Object.fromEntries(Object.entries(ACCESSORIES).map(([k, parts]) => [`px-acc-${k}`, fromArt(parts)])),
};
const css = `/* 像素海豹(純 CSS):由 scripts/seal-css.mjs 產生,勿手改。來源:參考圖 1:1 還原的 seal-pixels.json 與 seal-accessories.js */
.px-seal { --p: 3px; position: relative; width: ${u(W)}; height: ${u(H)}; margin: 0 auto; }
.px-seal .px-hop, .px-seal .px-l { position: absolute; inset: 0; }
${Object.entries(layers).map(([name, cells]) => `.px-seal .${name} {\n  background:\n    ${background(cells)};\n}`).join('\n')}
`;
writeFileSync(OUT, css);
console.log(`seal.css ${(css.length / 1024).toFixed(1)} KB, layers:`, Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.size])));
