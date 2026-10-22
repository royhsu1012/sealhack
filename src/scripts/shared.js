// 簡單版與完整版共用:輸入保存、格式化、主滑桿、答案區(需要 vs 存得到 + 最早何時退休)、報酬率交叉圖、底部結果列。
// 不連網、不送出資料;輸入值存在瀏覽器 localStorage(失敗時照常運作)。
import { presetInputs, SIMPLE, fundNeeded, fundAtFire, breakEvenReturn, earliestFireTime } from '../lib/fire.js';

export const BASE_YEAR = new Date().getFullYear();
export const END_AGE = 95;
export const R_MAX = 0.12;
const STORAGE_KEY = 'fire-inputs-v2';

// ---------- 狀態:兩個版本共用同一份輸入,換版本時年齡、生活費、資產、報酬率會帶過去 ----------
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

/** 距今 t 年(含小數)→「13 年 1 個月後」、從今天起算的年月、當時約幾歲 */
export function whenParts(t, age) {
  const months = Math.round(t * 12);
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const y = Math.floor(months / 12), m = months % 12;
  return {
    now: months === 0,
    span: `${y ? `${y} 年` : ''}${y && m ? ' ' : ''}${m ? `${m} 個月` : ''}後`,
    date: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`,
    age: Math.floor(age + months / 12),
  };
}

// ---------- 主滑桿(monthlyIncome 是 salary 的月數字) ----------
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

/** 報酬率(橫軸)對「撐到 95 歲需要的錢」與「退休時存得到的錢」:兩條線交叉處就是最低報酬率 */
export function tradeoffChart(inp, rSel, be, W) {
  const xMax = Math.max(R_MAX, rSel, be != null ? be + 0.01 : 0);
  const H = W < 560 ? 270 : 320, L = 48, R = W - 14, top = 30, B = H - 32;
  const N = 48;
  const rs = Array.from({ length: N + 1 }, (_, k) => (xMax * k) / N);
  const need = rs.map((r) => fundNeeded(inp, r, END_AGE));
  const have = rs.map((r) => fundAtFire(inp, r));
  const needSel = fundNeeded(inp, rSel, END_AGE), haveSel = fundAtFire(inp, rSel);
  const needBe = be != null ? fundNeeded(inp, be, END_AGE) : 0;
  const peak = Math.max(have.at(-1), need.at(-1), needSel, haveSel, needBe, 1) * 1.2;
  const step = niceStep(peak, 4);
  const vmax = Math.ceil(peak / step) * step;
  const x = (r) => L + (r / xMax) * (R - L);
  const y = (v) => top + ((vmax - v) / vmax) * (B - top);
  const line = (vals) => vals.map((v, k) => `${k ? 'L' : 'M'}${x(rs[k]).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const band = `${line(have)} ${need.map((v, k) => `L${x(rs[k]).toFixed(1)},${y(v).toFixed(1)}`).reverse().join(' ')} Z`;
  const bx = be == null ? R : x(Math.min(be, xMax));
  const yTicks = [];
  for (let v = 0; v <= vmax + 1e-9; v += step) yTicks.push(v);
  const xStep = [0.01, 0.02, 0.05, 0.1, 0.2].find((s) => ((R - L) * s) / xMax >= 34) ?? 0.2;
  const xTicks = [];
  for (let k = 0; k * xStep <= xMax + 1e-9; k++) xTicks.push(k * xStep);
  const sx = x(rSel);
  // 交叉點標籤:放在「你選的」虛線另一側;都放不下就放在點的正上方
  const beLabel = be != null ? `至少 ${pct(be)}` : '';
  const beX = be != null ? x(Math.min(be, xMax)) : 0;
  const lw = textW(beLabel, 13);
  const spanOf = ([px, anchor]) => (anchor === 'start' ? [px, px + lw] : [px - lw, px]);
  const fits = ([a, b]) => a >= L + 2 && b <= R - 2 && !(sx > a - 4 && sx < b + 4);
  const away = rSel < (be ?? 0) ? [[beX + 10, 'start'], [beX - 10, 'end']] : [[beX - 10, 'end'], [beX + 10, 'start']];
  const bePos = [...away, [sx + 6, 'start'], [sx - 6, 'end']].find((c) => fits(spanOf(c)));
  const selW = textW(`你選的 ${pct(rSel)}`, 12);
  const selX = Math.min(Math.max(sx, L + selW / 2 + 2), R - selW / 2);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="報酬率 ${pct(rSel)} 時需要 ${big(needSel)}、存得到 ${big(haveSel)}${be != null && be > 0 ? `;報酬率至少 ${pct(be)} 才夠` : ''}">
    <defs>
      <clipPath id="to-plot"><rect x="${L}" y="${top}" width="${R - L}" height="${B - top}"/></clipPath>
      <clipPath id="to-ok"><rect x="${bx}" y="${top}" width="${Math.max(0, R - bx)}" height="${B - top}"/></clipPath>
      <clipPath id="to-bad"><rect x="${L}" y="${top}" width="${Math.max(0, bx - L)}" height="${B - top}"/></clipPath>
    </defs>
    ${yTicks.map((v) => `<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/>${T(L - 8, y(v) + 4, v === 0 ? '0' : big(v).replace(' 萬', ''), { anchor: 'end', size: 11 })}`).join('')}
    ${T(L - 8, top - 14, '萬元', { anchor: 'end', size: 11 })}
    ${xTicks.map((r) => T(x(r), B + 18, `${Math.round(r * 100)}%`, { anchor: 'middle', size: 11 })).join('')}
    <path d="${band}" fill="var(--free)" fill-opacity="0.16" clip-path="url(#to-ok)"/>
    <path d="${band}" fill="var(--warn)" fill-opacity="0.14" clip-path="url(#to-bad)"/>
    <g clip-path="url(#to-plot)">
      <path d="${line(need)}" fill="none" stroke="var(--ink)" stroke-width="2.2"/>
      <path d="${line(have)}" fill="none" stroke="var(--free)" stroke-width="2.6"/>
    </g>
    <line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="var(--line)"/>
    <line x1="${sx}" x2="${sx}" y1="${top - 4}" y2="${B}" stroke="var(--ink-2)" stroke-dasharray="4 4"/>
    ${T(selX, top - 10, `你選的 ${pct(rSel)}`, { anchor: 'middle', size: 12, fill: 'var(--ink)', weight: 700 })}
    ${needSel <= vmax ? `<circle cx="${sx}" cy="${y(needSel)}" r="5" fill="var(--ink)"><title>報酬率 ${pct(rSel)}:撐到 ${END_AGE} 歲需要 ${big(needSel)}</title></circle>` : ''}
    <circle cx="${sx}" cy="${y(haveSel)}" r="5" fill="var(--free)"><title>報酬率 ${pct(rSel)}:退休時存得到 ${big(haveSel)}</title></circle>
    ${be != null && be > 0 && be <= xMax ? `<circle cx="${beX}" cy="${y(needBe)}" r="6" fill="var(--gold)" stroke="var(--surface)" stroke-width="2"/>
      ${bePos
        ? T(bePos[0], y(needBe) - 10, beLabel, { anchor: bePos[1], size: 13, fill: 'var(--ink)', weight: 800, halo: true })
        : T(beX, y(needBe) - 16, beLabel, { anchor: 'middle', size: 13, fill: 'var(--ink)', weight: 800, halo: true })}` : ''}
  </svg>
  ${legend([['var(--ink)', `撐到 ${END_AGE} 歲需要的錢`], ['var(--free)', '退休時存得到的錢'], ['var(--gold)', '交叉點:最低報酬率']])}`;
}

// ---------- 答案區 ----------
function placeMark(be) {
  const mark = $('ret-mark');
  if (be == null) { mark.hidden = true; return; }
  const f = Math.min(be, R_MAX) / R_MAX;
  mark.hidden = false;
  mark.style.setProperty('--f', String(f));
  mark.dataset.edge = f < 0.15 ? 'start' : f > 0.85 ? 'end' : '';
  $('ret-mark-label').textContent = be === 0 ? '0% 就夠' : `至少 ${pct(be)}`;
}

export function setMiniBar(main, sub) {
  $('mini-main').textContent = main;
  $('mini-sub').textContent = sub;
}

/**
 * 以報酬率 r 填答案區:需要準備 vs 退休時存得到、夠不夠、最早幾年幾個月後能退休、最低報酬率。
 * 回傳算好的數字給頁面畫圖;退休年齡不大於目前年齡時回傳 null。
 */
export function renderAnswer(inp, r) {
  const n = inp.fireYear - inp.baseYear;
  if (n < 1) {
    $('hero-kicker').textContent = '想退休的年齡要大於目前年齡';
    ['hero-need', 'hero-have'].forEach((id) => { $(id).textContent = '—'; });
    ['hero-status', 'hero-when', 'hero-sub'].forEach((id) => { $(id).innerHTML = ''; });
    $('ret-mark').hidden = true;
    setMiniBar('想退休的年齡要大於目前年齡', '');
    return null;
  }
  const fireAge = inp.age + n;
  const need = fundNeeded(inp, r, END_AGE);
  const have = fundAtFire(inp, r);
  const principal = fundAtFire(inp, 0);
  const be = breakEvenReturn(inp, END_AGE);
  const t = earliestFireTime(inp, r, 45, END_AGE);
  const enough = have >= need;

  $('hero-kicker').textContent = `想在 ${fireAge} 歲退休(${n} 年後)`;
  $('hero-need').innerHTML = moneyHTML(need);
  $('hero-have-label').textContent = `${fireAge} 歲時存得到`;
  $('hero-have').innerHTML = moneyHTML(have);
  $('hero-status').innerHTML = enough
    ? `<span class="status ok"><b aria-hidden="true">✓</b>夠了,多出 ${big(have - need)}</span>`
    : `<span class="status bad"><b aria-hidden="true">!</b>還差 ${big(need - have)}</span>`;

  const w = t == null ? null : whenParts(t, inp.age);
  $('hero-when').innerHTML = t == null
    ? `照每年 ${pct(r)} 報酬,<b>45 年內都存不夠</b>退休`
    : w.now
      ? '<b>現在就能退休</b>:資產已經撐得到 95 歲'
      : `照每年 ${pct(r)} 報酬,最早 <b>${w.span}</b>就能退休(${w.date},約 ${w.age} 歲)`;

  let sub = enough
    ? `你自己存進 ${big(principal)},投資賺 ${big(Math.max(0, have - principal))};${fireAge} 歲退休後資金撐得到 ${END_AGE} 歲以後。`
    : `${fireAge} 歲退休的話,資金不夠撐到 ${END_AGE} 歲。`;
  sub += be == null
    ? '以目前的存款速度,報酬率再高也不夠;試著晚點退休、多存一點,或降低生活費。'
    : be === 0
      ? '不靠投資報酬也夠用。'
      : `報酬率至少要 ${pct(be)},存得到的錢才追得上需要的錢。`;
  $('hero-sub').textContent = sub;
  placeMark(be);
  setMiniBar(
    t == null ? '45 年內存不夠退休' : w.now ? '現在就能退休' : `最早 ${w.span}退休`,
    `${pct(r)} 報酬 · ${enough ? '夠用 ✓' : `還差 ${big(need - have)}`}`,
  );
  return { n, fireAge, need, have, be, t, enough };
}

// ---------- 版面 ----------
export function onResize(fn) {
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 120); });
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
