// 簡單版與完整版共用:輸入保存、格式化、主滑桿、報酬率量表、底部結果列。
// 不連網、不送出資料;輸入值存在瀏覽器 localStorage(失敗時照常運作)。
import { presetInputs, SIMPLE } from '../lib/fire.js';

export const BASE_YEAR = new Date().getFullYear();
export const END_AGE = 95;
const STORAGE_KEY = 'fire-inputs-v2';

// ---------- 狀態:兩個版本共用同一份輸入,換版本時年齡、生活費、資產會帶過去 ----------
export function freshInputs(presetId = 'example', monthlySaving = SIMPLE.monthlySaving) {
  return { ...presetInputs(presetId, BASE_YEAR), monthlySaving };
}
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { inputs: { ...freshInputs(), ...saved.inputs, baseYear: BASE_YEAR }, preset: saved.preset ?? null };
    }
  } catch { /* 讀不到就用預設情境 */ }
  return { inputs: freshInputs(), preset: 'example' };
}
export function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* 隱私模式等:不保存 */ }
}

// ---------- 格式化 ----------
export const nf = (d) => new Intl.NumberFormat('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
export const wan = (v, d = 0) => `${nf(d).format(v)} 萬`;
export const big = (v) => (Math.abs(v) >= 10000 ? `${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(v / 10000)} 億` : wan(v));
export const pct = (r, d = 1) => (r == null ? '無解' : r <= 0 ? '0%' : `${nf(d).format(r * 100)}%`);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
export const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
export const $ = (id) => document.getElementById(id);

// 答案區的大數字:數字大、單位小
export const moneyHTML = (v) => {
  const [n, u] = Math.abs(v) >= 10000
    ? [new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(v / 10000), '億']
    : [nf(0).format(v), '萬'];
  return `${n}<small>${u}</small>`;
};
export const rateHTML = (r) => (r == null ? '—' : `${r <= 0 ? '0' : nf(1).format(r * 100)}<small>%</small>`);

// ---------- 主滑桿 ----------
export function knobGet(inp, key) {
  return key === 'fireAge' ? inp.age + inp.fireYear - inp.baseYear : inp[key];
}
export function knobSet(inp, key, v) {
  if (key === 'fireAge') inp.fireYear = inp.baseYear + Math.round(v) - inp.age;
  else if (key === 'age') {
    const fireAge = knobGet(inp, 'fireAge');
    inp.age = Math.round(v);
    inp.fireYear = inp.baseYear + fireAge - inp.age; // 改年齡時保持想退休的年齡不變
  } else inp[key] = v;
}
export function writeKnobs(inp) {
  document.querySelectorAll('[data-knob]').forEach((el) => {
    const raw = knobGet(inp, el.dataset.knob);
    const v = el.dataset.pct ? round(raw * 100, 2) : raw;
    if (el.type === 'range') {
      const min = +el.min, max = +el.max;
      el.value = String(Math.min(max, Math.max(min, v)));
      el.style.setProperty('--fill', `${((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100}%`);
    } else if (document.activeElement !== el) el.value = String(v);
  });
}

// ---------- 圖表共用 ----------
export function niceStep(range, target = 4) {
  const raw = Math.max(range, 1e-9) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
}
export const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size ?? 12}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.weight ? `font-weight="${o.weight}"` : ''} ${o.halo ? 'stroke="var(--surface)" stroke-width="4" stroke-linejoin="round" paint-order="stroke"' : ''} fill="${o.fill ?? 'var(--ink-2)'}">${s}</text>`;
export const widthOf = (id) => Math.max(240, Math.round($(id).clientWidth || 700));
export const textW = (s, size) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? size : size * 0.6), 0);
export const legend = (items) => `<p class="legend">${items.map(([c, s]) => `<span><span style="color:${c}">■</span> ${s}</span>`).join('')}</p>`;

/** 量表:需要的報酬率落在哪個區間;exp 為預期報酬率(簡單版不顯示) */
export function gauge(req, exp, W) {
  const L = 10, R = W - 10, y = 52;
  const tickY = exp == null ? y + 30 : y + 62, H = tickY + 4;
  const max = Math.max(0.12, (req ?? 0) + 0.02, (exp ?? 0) + 0.02);
  const x = (v) => L + (Math.max(0, Math.min(v, max)) / max) * (R - L);
  const clampX = (v, pad) => Math.min(Math.max(v, L + pad), R - pad);
  const zones = [[0, 0.04, 'var(--free)'], [0.04, 0.07, 'var(--gold)'], [0.07, max, 'var(--warn)']];
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += 0.02) ticks.push(v);
  const reqX = req == null ? null : x(Math.max(req, 0));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="需要的報酬率 ${pct(req)}${exp == null ? '' : `,你預期 ${pct(exp)}`}">
    ${zones.map(([a, b, c]) => `<rect x="${x(a)}" y="${y - 8}" width="${Math.max(0, x(b) - x(a))}" height="16" fill="${c}" fill-opacity="0.25"/>`).join('')}
    ${ticks.map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${y + 8}" y2="${y + 12}" stroke="var(--ink-2)"/>${T(x(v), tickY, `${Math.round(v * 100)}%`, { anchor: 'middle', size: 10 })}`).join('')}
    ${exp == null ? '' : `<path d="M${x(exp)},${y + 12} l-7,11 h14 z" fill="var(--ink-2)"/>
      ${T(clampX(x(exp), 34), y + 40, `你預期 ${pct(exp)}`, { anchor: 'middle', size: 12, fill: 'var(--ink-2)', weight: 600 })}`}
    ${req == null
      ? T(W / 2, y - 20, '在合理報酬率下達不到', { anchor: 'middle', fill: 'var(--warn)', weight: 800, size: 15 })
      : `<rect x="${reqX - 2.5}" y="${y - 16}" width="5" height="32" rx="2.5" fill="var(--ink)"/>
         ${T(clampX(reqX, 44), y - 24, `需要 ${pct(req)}`, { anchor: 'middle', fill: 'var(--ink)', weight: 800, size: 16 })}`}
  </svg>
  ${legend([['var(--free)', '4% 以下:保守配置即可'], ['var(--gold)', '4–7%:需要股票部位'], ['var(--warn)', '7% 以上:偏積極']])}`;
}

// ---------- 版面 ----------
export function onResize(fn) {
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 120); });
}

export function setMiniBar(main, sub) {
  $('mini-main').textContent = main;
  $('mini-sub').textContent = sub;
}

/** 底部結果列:答案區與頁尾都不在畫面時才出現 */
export function watchMiniBar() {
  const bar = $('mini-bar');
  const watched = [$('answer'), document.querySelector('footer')].filter(Boolean);
  if (!bar || !('IntersectionObserver' in window)) return;
  const visible = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => visible.set(e.target, e.isIntersecting));
    bar.classList.toggle('show', ![...visible.values()].some(Boolean));
  });
  watched.forEach((el) => io.observe(el));
}
