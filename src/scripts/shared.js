// 共用工具:輸入保存、格式化、滑桿、圖表小工具、底部結果列。
// 不連網、不送出資料;輸入值存在瀏覽器 localStorage(失敗時照常運作)。
import { presetInputs } from '../lib/fire.js';

export const BASE_YEAR = new Date().getFullYear();
export const R_MAX = 0.2;
const STORAGE_KEY = 'fire-inputs-v2';

// ---------- 狀態:inputs 給引擎;answers 記住測驗選了哪張卡;done = 做完測驗 ----------
export const freshState = () => ({ inputs: presetInputs('example', BASE_YEAR), answers: {}, done: false });
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const base = freshState();
      return {
        inputs: { ...base.inputs, ...saved.inputs, baseYear: BASE_YEAR },
        answers: saved.answers ?? {},
        done: !!saved.done,
      };
    }
  } catch { /* 讀不到就用範例 */ }
  return freshState();
}
/** 清除這台裝置上的答案(開場的「清除我的答案」) */
export function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* 隱私模式等:本來就沒存 */ }
}
export function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* 隱私模式等:不保存 */ }
}

// ---------- 格式化 ----------
export const nf = (d) => new Intl.NumberFormat('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
export const wan = (v, d = 0) => `${nf(d).format(v)} 萬`;
export const big = (v) => (Math.abs(v) >= 10000 ? `${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(v / 10000)} 億` : wan(v));
/** 百分比:最多一位小數、整數不寫 .0(6%、6.4%) */
export const pct = (r) => (r == null ? '無解' : r <= 0 ? '0%' : `${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 }).format(r * 100)}%`);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
export const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
export const $ = (id) => document.getElementById(id);

/** 年數(含小數)→「1 年 2 個月」 */
export function spanText(years) {
  const months = Math.round(years * 12);
  const y = Math.floor(months / 12), m = months % 12;
  if (!y && !m) return '不到 1 個月';
  return `${y ? `${y} 年` : ''}${y && m ? ' ' : ''}${m ? `${m} 個月` : ''}`;
}

/** 距今 t 年 → 從今天起算的年、月,以及當時約幾歲 */
export function whenParts(t, age) {
  const months = Math.round(t * 12);
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return { now: months === 0, span: spanText(t), year: d.getFullYear(), month: d.getMonth() + 1, age: Math.floor(age + months / 12) };
}

// ---------- 滑桿(fireAge、monthlyIncome 是換算後的欄位) ----------
export function knobGet(inp, key) {
  if (key === 'fireAge') return inp.age + inp.fireYear - inp.baseYear;
  if (key === 'monthlyIncome') return round(inp.salary / 12, 2);
  return inp[key];
}
export function knobSet(inp, key, v) {
  if (key === 'fireAge') inp.fireYear = inp.baseYear + Math.round(v) - inp.age;
  else if (key === 'monthlyIncome') inp.salary = v * 12;
  else if (key === 'age') {
    const fireAge = knobGet(inp, 'fireAge');
    inp.age = Math.round(v);
    inp.fireYear = inp.baseYear + fireAge - inp.age; // 改年齡時保持想退休的年齡不變
  } else if (key === 'endAge') inp.endAge = Math.min(110, Math.max(80, Math.round(v)));
  else inp[key] = v;
}
export function writeKnobs(inp) {
  document.querySelectorAll('[data-knob]').forEach((el) => {
    const raw = knobGet(inp, el.dataset.knob);
    const v = el.dataset.pct ? round(raw * 100, 2) : raw;
    if (el.type === 'range') {
      const min = +el.min, max = +el.max;
      el.value = String(Math.min(max, Math.max(min, v)));
      el.style.setProperty('--fill', `${((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100}%`);
    } else if (el.tagName === 'OUTPUT') {
      // 金額滑桿(data-wan):一億以上換成「億」
      if (el.dataset.wan) el.innerHTML = v >= 10000
        ? `${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(v / 10000)}<small>億</small>`
        : `${nf(Number.isInteger(v) ? 0 : 1).format(v)}<small>萬</small>`;
      else el.textContent = nf(Number.isInteger(v) ? 0 : 1).format(v);
    }
    else if (document.activeElement !== el) el.value = String(v);
  });
}

// ---------- 圖表小工具 ----------
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

// ---------- 版面 ----------
export function onResize(fn) {
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 120); });
}

export function setMiniBar(main, sub) {
  $('mini-main').textContent = main;
  $('mini-sub').textContent = sub;
}

/** 底部結果列:答案區與頁尾都不在畫面時才出現(只在結果頁;CSS 另外擋掉測驗頁) */
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
