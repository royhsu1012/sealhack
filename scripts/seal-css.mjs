// 把像素海豹轉成純 CSS:每一層是一個空的 <i>,用一列一列的 linear-gradient 背景畫出像素。
// 輸入:src/data/seal-pixels.json(參考圖 1:1 還原,只用海豹本體與眼睛)、src/data/seal-accessories.js(人格配件)
// 輸出:src/styles/seal.css(global.css 匯入)。像素大小由 --p 控制(預設 3px),顏色用 global.css 的 --sp-* token。
// 用法:npm run seal
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEAL_BOX, bodyCells, eyeCells, eyeLineCells, accessoryCells, iconRects, ICON_SIZE } from '../src/scripts/seal-cells.js';
import { ACCESSORIES } from '../src/data/seal-accessories.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = JSON.parse(readFileSync(join(ROOT, 'src/data/seal-pixels.json'), 'utf8'));
const OUT = join(ROOT, 'src/styles/seal.css');

// 畫布:海豹本體加上所有配件的範圍(各人格的海豹位置一致)
const { x: X0, y: Y0, w: W, h: H } = SEAL_BOX;
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
const layers = {
  'px-body': bodyCells(P),
  'px-eyes': eyeCells(P),
  'px-shut': eyeLineCells(P, 'shut'),
  'px-happy': eyeLineCells(P, 'happy'),
  ...Object.fromEntries(Object.keys(ACCESSORIES).map((k) => [`px-acc-${k}`, accessoryCells(P, k)])),
};
const css = `/* 像素海豹(純 CSS):由 scripts/seal-css.mjs 產生,勿手改。來源:參考圖 1:1 還原的 seal-pixels.json 與 seal-accessories.js */
.px-seal { --p: 3px; position: relative; width: ${u(W)}; height: ${u(H)}; margin: 0 auto; }
.px-seal .px-hop, .px-seal .px-l { position: absolute; inset: 0; }
${Object.entries(layers).map(([name, cells]) => `.px-seal .${name} {\n  background:\n    ${background(cells)};\n}`).join('\n')}
`;
writeFileSync(OUT, css);
console.log(`seal.css ${(css.length / 1024).toFixed(1)} KB, layers:`, Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.size])));

// favicon:同一顆小海豹頭(靜態檔案沒辦法用 CSS 變數,直接寫色碼)
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1.5 18 18" shape-rendering="crispEdges">${iconRects(P).map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${P.palette[c]}"/>`).join('')}</svg>
`;
writeFileSync(join(ROOT, 'public/favicon.svg'), favicon);
console.log('favicon.svg', ICON_SIZE);
