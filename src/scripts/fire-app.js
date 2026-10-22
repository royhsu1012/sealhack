// 試算器頁面的互動層:讀輸入 → 呼叫 src/lib/fire.js → 畫出答案與圖表。
// 不連網、不送出資料;輸入值存在瀏覽器 localStorage(失敗時照常運作)。
import {
  presetInputs, computePlan, earliestFireYear, lifePath, fireAgeDrivers,
} from '../lib/fire.js';

const STORAGE_KEY = 'fire-inputs-v2';
const BASE_YEAR = new Date().getFullYear();
const END_AGE = 95;

// ---------- 狀態 ----------
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { inputs: { ...presetInputs('example', BASE_YEAR), ...saved.inputs, baseYear: BASE_YEAR }, preset: saved.preset ?? null };
    }
  } catch { /* 讀不到就用預設情境 */ }
  return { inputs: presetInputs('example', BASE_YEAR), preset: 'example' };
}
function save(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* 隱私模式等:不保存 */ }
}

// ---------- 格式化 ----------
const nf = (d) => new Intl.NumberFormat('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
const wan = (v, d = 0) => `${nf(d).format(v)} 萬`;
const big = (v) => (Math.abs(v) >= 10000 ? `${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(v / 10000)} 億` : wan(v));
const pct = (r, d = 1) => (r == null ? '無解' : r <= 0 ? '0%' : `${nf(d).format(r * 100)}%`);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const $ = (id) => document.getElementById(id);

// ---------- 主滑桿 ----------
function knobGet(inp, key) {
  return key === 'fireAge' ? inp.age + inp.fireYear - inp.baseYear : inp[key];
}
function knobSet(inp, key, v) {
  if (key === 'fireAge') inp.fireYear = inp.baseYear + Math.round(v) - inp.age;
  else if (key === 'age') {
    const fireAge = knobGet(inp, 'fireAge');
    inp.age = Math.round(v);
    inp.fireYear = inp.baseYear + fireAge - inp.age; // 改年齡時保持想退休的年齡不變
  } else inp[key] = v;
}
function writeKnobs(inp) {
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
function writeAssumptions(inp) {
  document.querySelectorAll('#fire-form input[data-key]').forEach((el) => {
    if (document.activeElement === el) return;
    const v = inp[el.dataset.key];
    el.value = v == null ? '' : el.dataset.pct ? round(v * 100, 4) : v;
  });
}

// ---------- 進階清單 ----------
const LISTS = {
  loans: {
    blank: () => ({ name: '貸款', principal: 100, years: 5, rate: 0.03 }),
    fields: [
      { key: 'principal', label: '剩餘本金', unit: '萬', step: 10 },
      { key: 'years', label: '剩餘年限', unit: '年', step: 1 },
      { key: 'rate', label: '年利率', unit: '%', step: 0.1, pct: true },
    ],
  },
  incomes: {
    blank: () => ({ name: '被動收入', monthly: 1, startAge: null }),
    fields: [
      { key: 'monthly', label: '每月金額', unit: '萬', step: 0.1 },
      { key: 'startAge', label: '開始領取', unit: '歲', step: 1, nullable: true },
    ],
  },
  goals: {
    blank: () => ({ year: BASE_YEAR + 5, name: '大額支出', amount: 50 }),
    fields: [
      { key: 'year', label: '年份', unit: '年', step: 1 },
      { key: 'amount', label: '金額', unit: '萬', step: 10 },
    ],
  },
};
function renderList(kind, inp) {
  const spec = LISTS[kind];
  $(`list-${kind}`).innerHTML = inp[kind].map((item, idx) => `
    <div class="rounded-xl border p-3 space-y-2" style="border-color:var(--line)">
      <div class="flex gap-2">
        <input class="inp font-semibold" aria-label="名稱" data-list="${kind}" data-idx="${idx}" data-field="name" type="text" value="${esc(item.name)}" />
        <button type="button" class="btn-x" aria-label="刪除 ${esc(item.name)}" data-remove="${kind}" data-idx="${idx}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="grid gap-2" style="grid-template-columns:repeat(${spec.fields.length},minmax(0,1fr))">
        ${spec.fields.map((f) => `<div class="field"><span class="label">${f.label}</span><div class="inp-unit">
          <input class="inp" aria-label="${esc(item.name)} ${f.label}" data-list="${kind}" data-idx="${idx}" data-field="${f.key}"
            ${f.pct ? 'data-pct="1"' : ''} ${f.nullable ? 'data-nullable="1"' : ''} type="number" inputmode="decimal" step="${f.step}"
            value="${item[f.key] == null ? '' : f.pct ? round(item[f.key] * 100, 4) : item[f.key]}" placeholder="${f.nullable ? '退休時' : ''}" />
          <span>${f.unit}</span></div></div>`).join('')}
      </div>
      <p class="text-xs muted num" data-derived="${kind}-${idx}"></p>
    </div>`).join('') || '<p class="text-sm muted">目前沒有項目。</p>';
}
function readListInput(el, inp) {
  const { list, idx, field } = el.dataset;
  const item = inp[list][Number(idx)];
  if (!item) return;
  const raw = el.value.trim();
  if (el.type === 'text') { item[field] = raw; return; }
  if (raw === '' && el.dataset.nullable) { item[field] = null; return; }
  const x = num(raw);
  if (x != null) item[field] = el.dataset.pct ? x / 100 : x;
}

// ---------- 圖表共用 ----------
function niceStep(range, target = 4) {
  const raw = Math.max(range, 1e-9) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
}
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size ?? 12}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.weight ? `font-weight="${o.weight}"` : ''} fill="${o.fill ?? 'var(--ink-2)'}">${s}</text>`;
const widthOf = (id) => Math.max(300, Math.round($(id).clientWidth || 700));

// 量表:需要的報酬率 vs 預期報酬率
function gauge(req, exp, W) {
  const H = 118, L = 10, R = W - 10, y = 52;
  const max = Math.max(0.12, (req ?? 0) + 0.02, exp + 0.02);
  const x = (v) => L + (Math.max(0, Math.min(v, max)) / max) * (R - L);
  const clampX = (v, pad) => Math.min(Math.max(v, L + pad), R - pad);
  const zones = [[0, 0.04, 'var(--free)'], [0.04, 0.07, 'var(--gold)'], [0.07, max, 'var(--warn)']];
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += 0.02) ticks.push(v);
  const reqX = req == null ? null : x(Math.max(req, 0));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="需要的報酬率 ${pct(req)},你預期 ${pct(exp)}">
    ${zones.map(([a, b, c]) => `<rect x="${x(a)}" y="${y - 8}" width="${Math.max(0, x(b) - x(a))}" height="16" fill="${c}" fill-opacity="0.25"/>`).join('')}
    ${ticks.map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${y + 8}" y2="${y + 12}" stroke="var(--ink-2)"/>${T(x(v), y + 62, `${Math.round(v * 100)}%`, { anchor: 'middle', size: 10 })}`).join('')}
    <path d="M${x(exp)},${y + 12} l-7,11 h14 z" fill="var(--ink-2)"/>
    ${T(clampX(x(exp), 34), y + 40, `你預期 ${pct(exp)}`, { anchor: 'middle', size: 12, fill: 'var(--ink-2)', weight: 600 })}
    ${req == null
      ? T(W / 2, y - 20, '45 年內無法達成', { anchor: 'middle', fill: 'var(--warn)', weight: 800, size: 15 })
      : `<rect x="${reqX - 2.5}" y="${y - 16}" width="5" height="32" rx="2.5" fill="var(--ink)"/>
         ${T(clampX(reqX, 44), y - 24, `需要 ${pct(req)}`, { anchor: 'middle', fill: 'var(--ink)', weight: 800, size: 16 })}`}
  </svg>
  <p class="text-xs muted mt-1"><span style="color:var(--free)">■</span> 4% 以下:保守配置即可 <span class="ml-2" style="color:var(--gold)">■</span> 4–7%:需要股票部位 <span class="ml-2" style="color:var(--warn)">■</span> 7% 以上:偏積極</p>`;
}

// 一生資產曲線
function lifeChart(life, plan, inp, W) {
  const rows = life.rows;
  const H = W < 560 ? 300 : 380, L = 48, R = W - 16, top = 34, B = H - 62;
  const fireAge = life.fireAge;
  const pre = plan.loans.balanceAtFire;
  const ages = rows.map((r) => r.age);
  const a0 = ages[0], a1 = ages.at(-1);
  const peak = Math.max(plan.target, ...rows.map((r) => r.balance), (life.balanceAtFire ?? 0) + pre);
  const step = niceStep(peak, 4);
  const vmax = Math.ceil((peak * 1.05) / step) * step;
  const x = (a) => L + ((a - a0) / (a1 - a0)) * (R - L);
  const y = (v) => top + ((vmax - Math.max(0, v)) / vmax) * (B - top);
  // 路徑:FIRE 那年先到「還清貸款前」再垂直落下
  const pts = [];
  rows.forEach((r) => {
    if (r.age === fireAge && pre > 0) pts.push([x(r.age), y(r.balance + pre)]);
    pts.push([x(r.age), y(r.balance)]);
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const fx = x(Math.min(fireAge, a1));
  const area = `${line} L${x(a1)},${B} L${x(a0)},${B} Z`;
  const ticks = [];
  for (let v = 0; v <= vmax + 1e-9; v += step) ticks.push(v);
  const ageTicks = [];
  const ageStep = W < 560 ? 10 : 5;
  for (let a = Math.ceil(a0 / ageStep) * ageStep; a <= a1; a += ageStep) ageTicks.push(a);
  const pensions = inp.incomes.filter((q) => q.monthly > 0 && q.startAge != null && q.startAge > fireAge && q.startAge <= a1);
  const depl = life.depletionAge;
  const freeLabel = depl ? `自由 ${fireAge}–${depl} 歲` : `自由 ${fireAge} 歲之後`;
  const tY = y(plan.target);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="一生資產曲線:${fireAge} 歲退休${depl ? `,${depl} 歲資金用完` : ',到 95 歲資金仍有餘'}">
    <defs>
      <clipPath id="clip-work"><rect x="0" y="0" width="${fx}" height="${H}"/></clipPath>
      <clipPath id="clip-free"><rect x="${fx}" y="0" width="${W - fx}" height="${H}"/></clipPath>
    </defs>
    ${ticks.map((v) => `<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/>${T(L - 8, y(v) + 4, v === 0 ? '0' : big(v).replace(' 萬', ''), { anchor: 'end', size: 11 })}`).join('')}
    ${T(L - 8, top - 16, '萬元', { anchor: 'end', size: 11 })}
    <path d="${area}" fill="var(--work)" fill-opacity="0.28" clip-path="url(#clip-work)"/>
    <path d="${area}" fill="var(--free)" fill-opacity="0.22" clip-path="url(#clip-free)"/>
    <path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="round"/>
    <line x1="${x(a0)}" x2="${fx}" y1="${tY}" y2="${tY}" stroke="var(--ink-2)" stroke-dasharray="4 4"/>
    ${fx - x(a0) >= 140 ? T(x(a0) + 4, tY - 7, `退休所需 ${big(plan.target)}`, { size: 12 }) : T(fx - 8, tY - 8, `目標 ${big(plan.target)}`, { size: 11, anchor: 'end' })}
    <line x1="${fx}" x2="${fx}" y1="${top - 10}" y2="${B}" stroke="var(--gold)" stroke-width="2"/>
    <circle cx="${fx}" cy="${y((life.balanceAtFire ?? 0) + pre)}" r="5" fill="var(--gold)"/>
    ${T(fx + (fx > R - 120 ? -8 : 8), top - 2, `${fireAge} 歲退休`, { anchor: fx > R - 120 ? 'end' : 'start', fill: 'var(--ink)', weight: 800, size: 13 })}
    ${pensions.sort((p1, p2) => p1.startAge - p2.startAge).map((q, i, arr) => {
      const lift = i > 0 && x(q.startAge) - x(arr[i - 1].startAge) < 44 && i % 2 === 1 ? 13 : 0;
      return `<line x1="${x(q.startAge)}" x2="${x(q.startAge)}" y1="${B - 10 - lift}" y2="${B}" stroke="var(--free)" stroke-width="2"/>
      ${T(x(q.startAge), B - 14 - lift, `${esc(q.name.replace(/(月退休金|老年年金|\(.*\))/g, ''))} ${q.startAge}`, { anchor: 'middle', size: 10, fill: 'var(--free)' })}`;
    }).join('')}
    ${depl ? `<circle cx="${x(depl)}" cy="${B}" r="6" fill="var(--warn)"/>${T(x(depl) + (x(depl) > R - 90 ? -10 : 10), B - 12, `${depl} 歲用完`, { anchor: x(depl) > R - 90 ? 'end' : 'start', fill: 'var(--warn)', weight: 800, size: 13 })}` : ''}
    <line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="var(--line)"/>
    ${ageTicks.map((a) => T(x(a), B + 16, `${a}`, { anchor: 'middle', size: 11 })).join('')}
    <rect x="${x(a0)}" y="${B + 26}" width="${Math.max(0, fx - x(a0) - 2)}" height="22" rx="5" fill="var(--work)" fill-opacity="0.35"/>
    <rect x="${fx + 2}" y="${B + 26}" width="${Math.max(0, (depl ? x(depl) : R) - fx - 2)}" height="22" rx="5" fill="var(--free)" fill-opacity="0.3"/>
    ${depl ? `<rect x="${x(depl) + 2}" y="${B + 26}" width="${Math.max(0, R - x(depl) - 2)}" height="22" rx="5" fill="var(--warn)" fill-opacity="0.25"/>` : ''}
    ${fx - x(a0) > 70 ? T((x(a0) + fx) / 2, B + 41, `工作 ${a0}–${fireAge} 歲`, { anchor: 'middle', size: 12, fill: 'var(--ink)', weight: 600 }) : ''}
    ${((depl ? x(depl) : R) - fx) > 90 ? T((fx + (depl ? x(depl) : R)) / 2, B + 41, freeLabel, { anchor: 'middle', size: 12, fill: 'var(--ink)', weight: 600 }) : ''}
    ${rows.map((r) => `<rect x="${x(r.age) - (R - L) / rows.length / 2}" y="${top}" width="${(R - L) / rows.length}" height="${B - top}" fill="transparent"><title>${r.age} 歲(${r.year}):資產 ${big(r.balance)}${r.phase === 'free' ? `,當年提領 ${wan(r.withdraw)}` : ''}</title></rect>`).join('')}
  </svg>`;
}

// 退休所需資金:瀑布圖
function targetChart(plan, inp, W) {
  const H = 260, L = 10, R = W - 10, top = 30, B = H - 44;
  const steps = [
    { label: '生活費本金', sub: `年支出 ÷ ${pct(inp.swr)}`, from: 0, to: plan.baseFund, color: 'var(--ink)' },
    { label: '年金折抵', sub: '勞保、勞退等', from: plan.baseFund, to: plan.baseFund - plan.income.total, color: 'var(--free)' },
    { label: '貸款餘額', sub: '退休時還清', from: plan.baseFund - plan.income.total, to: plan.target, color: 'var(--work)' },
    { label: '退休所需', sub: '', from: 0, to: plan.target, color: 'var(--ink)', total: true },
  ];
  const vmax = Math.max(...steps.map((s) => Math.max(s.from, s.to))) * 1.08 || 1;
  const y = (v) => top + ((vmax - v) / vmax) * (B - top);
  const band = (R - L) / steps.length, bw = Math.min(70, band * 0.56);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="退休所需資金 ${wan(plan.target)}">
    <line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="var(--line)"/>
    ${steps.map((s, i) => {
      const cx = L + band * i + band / 2;
      const y1 = y(Math.max(s.from, s.to)), y2 = y(Math.min(s.from, s.to));
      const delta = s.total || i === 0 ? s.to : s.to - s.from;
      const sign = s.total || i === 0 ? '' : delta < 0 ? '−' : '+';
      const conn = i < steps.length - 1 ? `<line x1="${cx + bw / 2}" x2="${cx + band - bw / 2}" y1="${y(s.to)}" y2="${y(s.to)}" stroke="var(--ink-2)" stroke-dasharray="2 3"/>` : '';
      return `<rect x="${cx - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(1.5, y2 - y1)}" rx="4" fill="${s.color}" fill-opacity="${s.total ? 1 : i === 0 ? 0.85 : 0.75}"><title>${s.label}:${sign}${wan(Math.abs(delta), 1)}</title></rect>${conn}
        ${T(cx, y1 - 8, `${sign}${nf(0).format(Math.abs(delta))}`, { anchor: 'middle', size: s.total ? 15 : 13, weight: 800, fill: 'var(--ink)' })}
        ${T(cx, B + 18, s.label, { anchor: 'middle', size: 12, fill: 'var(--ink)', weight: 600 })}
        ${s.sub ? T(cx, B + 34, s.sub, { anchor: 'middle', size: 10.5 }) : ''}`;
    }).join('')}
  </svg>`;
}

// 每年能存下多少
function cashflowChart(flows, W) {
  if (!flows.length) return '<p class="text-sm muted">退休年份需晚於今年。</p>';
  const H = 260, L = 40, R = W - 6, top = 16, B = H - 30;
  const vals = flows.map((f) => f.invest);
  const step = niceStep(Math.max(...vals, 0) - Math.min(...vals, 0), 4);
  const vmax = Math.ceil(Math.max(...vals, 0) / step) * step || step;
  const vmin = Math.floor(Math.min(...vals, 0) / step) * step;
  const y = (v) => top + ((vmax - v) / (vmax - vmin)) * (B - top);
  const band = (R - L) / flows.length, bw = Math.max(2, band * 0.68);
  const ticks = [];
  for (let v = vmin; v <= vmax + 1e-9; v += step) ticks.push(v);
  const every = Math.ceil(flows.length / Math.max(2, Math.floor((R - L) / 52)));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="每年能存下的金額">
    ${ticks.map((t) => `<line x1="${L}" x2="${R}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? 'var(--ink-2)' : 'var(--grid)'}"/>${T(L - 6, y(t) + 4, nf(0).format(t), { anchor: 'end', size: 11 })}`).join('')}
    ${flows.map((f, i) => {
      const xx = L + i * band + (band - bw) / 2, neg = f.invest < 0, h = Math.abs(y(f.invest) - y(0));
      return `<rect x="${xx}" y="${neg ? y(0) : y(f.invest)}" width="${bw}" height="${Math.max(h, 0.5)}" rx="2" fill="${neg ? 'var(--warn)' : 'var(--work)'}" fill-opacity="${neg ? 0.85 : 0.75}">
        <title>${f.year}:收入 ${nf(1).format(f.income)} − 生活費 ${nf(1).format(f.expense)} − 貸款 ${nf(1).format(f.loan)} − 大額支出 ${nf(1).format(f.goal)} = ${nf(1).format(f.invest)} 萬</title></rect>
        ${i % every === 0 || (i === flows.length - 1 && i % every >= every / 2 + 0.5) || (i === flows.length - 1 && every === 1) ? T(xx + bw / 2, B + 18, f.year, { anchor: 'middle', size: 11 }) : ''}`;
    }).join('')}
  </svg>`;
}

// 什麼最影響退休年齡:龍捲風圖
function driversChart(d, W) {
  if (d.base == null) return '<p class="text-sm muted">以目前條件 45 年內無法退休,先調整生活費或收入。</p>';
  const rows = d.rows.map((r) => {
    const cap = d.base + 15;
    const lo = r.low ?? cap, hi = r.high ?? cap;
    return { ...r, a: Math.min(lo, hi), b: Math.max(lo, hi), lo, hi, spread: Math.abs(hi - lo) };
  }).sort((p, q) => q.spread - p.spread);
  const rowH = 38, labelW = W < 500 ? 118 : 150, top = 26, H = top + rows.length * rowH + 10;
  const L = labelW, R = W - 30;
  const minA = Math.min(d.base - 1, ...rows.map((r) => r.a)), maxA = Math.max(d.base + 1, ...rows.map((r) => r.b));
  const x = (a) => L + ((a - minA) / (maxA - minA)) * (R - L);
  const bx = x(d.base);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="影響退休年齡的因素,目前最早 ${d.base} 歲">
    ${T(bx, 14, `目前 ${d.base} 歲`, { anchor: 'middle', size: 12, fill: 'var(--ink)', weight: 700 })}
    <line x1="${bx}" x2="${bx}" y1="${top - 4}" y2="${H - 6}" stroke="var(--ink)" stroke-width="1.5"/>
    ${rows.map((r, i) => {
      const cy = top + i * rowH + rowH / 2;
      const earlier = Math.min(r.a, d.base), later = Math.max(r.b, d.base);
      const tip = `${r.label}:${r.lo == null ? '無法' : `${r.lo} 歲`} ~ ${r.hi == null ? '無法' : `${r.hi} 歲`}`;
      return `${T(0, cy + 4, r.label, { size: 12.5, fill: 'var(--ink)' })}
        <line x1="${L}" x2="${R}" y1="${cy}" y2="${cy}" stroke="var(--grid)"/>
        ${earlier < d.base ? `<rect x="${x(earlier)}" y="${cy - 9}" width="${bx - x(earlier)}" height="18" rx="4" fill="var(--free)" fill-opacity="0.8"><title>${tip}</title></rect>${T(x(earlier) - 5, cy + 4, `${earlier}`, { anchor: 'end', size: 11 })}` : ''}
        ${later > d.base ? `<rect x="${bx}" y="${cy - 9}" width="${x(later) - bx}" height="18" rx="4" fill="var(--warn)" fill-opacity="0.75"><title>${tip}</title></rect>${T(x(later) + 5, cy + 4, (r.low == null || r.high == null) && later === d.base + 15 ? '無法' : `${later}`, { size: 11 })}` : ''}
        ${earlier === d.base && later === d.base ? T(bx + 6, cy + 4, '影響不到 1 歲', { size: 11 }) : ''}`;
    }).join('')}
  </svg>
  <p class="mt-2 text-xs muted"><span style="color:var(--free)">■</span> 往好的方向調,可提早退休 <span class="ml-3" style="color:var(--warn)">■</span> 往壞的方向調,要延後</p>`;
}

// ---------- 渲染 ----------
let last = null;
function drawCharts() {
  if (!last) return;
  const { plan, life, drivers, inp } = last;
  $('gauge').innerHTML = gauge(plan.rCombined, inp.assumedReturn, widthOf('gauge'));
  $('chart-life').innerHTML = lifeChart(life, plan, inp, widthOf('chart-life'));
  $('chart-target').innerHTML = targetChart(plan, inp, widthOf('chart-target'));
  $('chart-cashflow').innerHTML = cashflowChart(plan.flows, widthOf('chart-cashflow'));
  $('chart-drivers').innerHTML = driversChart(drivers, widthOf('chart-drivers'));
}

function check(level, title, body) {
  return `<li class="flex gap-3"><span class="dot dot-${level}" aria-hidden="true"></span><div><p class="font-semibold">${title}</p><p class="text-sm muted mt-0.5">${body}</p></div></li>`;
}

function render(inp) {
  const n = inp.fireYear - inp.baseYear;
  if (n < 1 || !(inp.swr > 0)) {
    $('hero-kicker').textContent = '';
    $('hero-age').textContent = '—';
    $('hero-line').textContent = '想退休的年齡要大於目前年齡';
    $('hero-sub').textContent = '';
    last = null;
    ['gauge', 'chart-life', 'chart-target', 'chart-cashflow', 'chart-drivers', 'checks'].forEach((id) => { $(id).innerHTML = ''; });
    return;
  }
  const plan = computePlan(inp);
  const life = lifePath(inp, inp.assumedReturn, END_AGE);
  const earliestYear = earliestFireYear(inp);
  const earliestAge = earliestYear == null ? null : inp.age + earliestYear - inp.baseYear;
  const drivers = fireAgeDrivers(inp);
  last = { plan, life, drivers, inp };

  // 答案
  $('hero-kicker').textContent = `照你預期的 ${pct(inp.assumedReturn)} 年化報酬,最早`;
  if (earliestAge == null) {
    $('hero-age').textContent = '很難';
    $('hero-line').textContent = '45 年內都還存不到退休所需';
  } else {
    $('hero-age').innerHTML = `${earliestAge}<span style="font-size:.38em;font-weight:800"> 歲</span>`;
    $('hero-line').textContent = `就能財務自由(${earliestYear} 年)`;
  }
  const fireAge = plan.fireAge;
  const rTxt = plan.rCombined == null ? '在任何合理報酬率下都達不到' : plan.rCombined <= 0 ? '光靠存款就夠,不需要投資收益' : `年化報酬率至少要 ${pct(plan.rCombined)}`;
  let sub = `想在 ${fireAge} 歲退休,要準備 ${big(plan.target)},${rTxt}。`;
  if (life.depletionAge) sub += `照你預期的報酬,${fireAge} 歲退休的話資金會在 ${life.depletionAge} 歲用完。`;
  else sub += `照你預期的報酬,${fireAge} 歲退休後資金能撐到 ${END_AGE} 歲以後。`;
  $('hero-sub').textContent = sub;
  $('gauge-title').textContent = `想在 ${fireAge} 歲退休,需要多少報酬率`;
  $('life-note').textContent = `以預期報酬 ${pct(inp.assumedReturn)} 推算,退休後每年提領生活費(扣除年金)`;

  // 進階設定摘要
  const loanTotal = inp.loans.reduce((s, l) => s + (l.principal > 0 ? l.principal : 0), 0);
  $('adv-summary').textContent = `通膨 ${pct(inp.inflation)}、提領率 ${pct(inp.swr)}、貸款 ${inp.loans.length} 筆${loanTotal ? `(${wan(loanTotal)})` : ''}、年金 ${inp.incomes.filter((q) => q.monthly > 0).length} 項、大額支出 ${inp.goals.length} 筆`;

  // 清單旁的衍生數字
  inp.loans.forEach((l, i) => {
    const el = document.querySelector(`[data-derived="loans-${i}"]`);
    const row = plan.loans.rows.find((r) => r.name === l.name && r.principal === l.principal && r.years === l.years);
    if (el) el.textContent = row ? `每月 ${nf(2).format(row.payment)} 萬,${row.balanceAtFire > 0.05 ? `退休時還剩 ${wan(row.balanceAtFire, 1)}` : `${row.payoffYear} 年還清`}` : '';
  });
  inp.incomes.forEach((q, i) => {
    const el = document.querySelector(`[data-derived="incomes-${i}"]`);
    const row = plan.income.rows.find((r) => r.name === q.name);
    if (el) el.textContent = row ? `可抵退休所需 ${wan(row.pv, 1)}` : '';
  });
  inp.goals.forEach((g, i) => {
    const el = document.querySelector(`[data-derived="goals-${i}"]`);
    if (!el) return;
    const t = g.year - inp.baseYear;
    el.textContent = t >= 1 && t <= n ? `到時約 ${wan(g.amount * (1 + inp.inflation) ** t, 1)}` : '不在退休前,不計入';
  });

  // 體檢
  const c = plan.checks;
  const items = [];
  if (c.dti != null) {
    const lvl = c.dti <= 0.33 ? 'ok' : c.dti <= 0.4 ? 'warn' : 'bad';
    items.push(check(lvl, `貸款占收入 ${nf(0).format(c.dti * 100)}%`, lvl === 'ok' ? '在 1/3 以內,負擔合理。' : '超過 1/3,收入中斷時壓力大;優先還清高利率的那筆。'));
  }
  items.push(check(inp.emergencyMonths >= 6 ? 'ok' : inp.emergencyMonths >= 3 ? 'warn' : 'bad', `緊急預備金 ${nf(0).format(inp.emergencyMonths)} 個月`, inp.emergencyMonths >= 6 ? `保留 ${wan(plan.emergency)},不投入市場。` : '建議至少 6 個月生活費。'));
  items.push(c.negativeYears.length
    ? check('warn', `${c.negativeYears.join('、')} 年存款不夠`, '大額支出那年要動用投資部位;提前 2–3 年把錢放進定存或短債。')
    : check('ok', '每年都有存款', '沒有需要動用投資的年份。'));
  items.push(life.depletionAge
    ? check('bad', `${life.depletionAge} 歲資金用完`, `以預期報酬 ${pct(inp.assumedReturn)} 推算;延後退休、降低生活費,或提高報酬才撐得到 ${END_AGE} 歲。`)
    : check('ok', `資金撐得到 ${END_AGE} 歲`, `以預期報酬 ${pct(inp.assumedReturn)} 推算,退休後資產沒有用完。`));
  $('checks').innerHTML = items.join('');

  drawCharts();
}

// ---------- 掛載 ----------
export function mount() {
  let s = load();
  const form = $('fire-form');
  const renderLists = () => Object.keys(LISTS).forEach((k) => renderList(k, s.inputs));
  const markPreset = () => document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === s.preset)));
  let timer = 0;
  const update = (delay = 40) => {
    clearTimeout(timer);
    timer = setTimeout(() => { writeKnobs(s.inputs); render(s.inputs); save(s); }, delay);
  };
  const refreshAll = () => { writeKnobs(s.inputs); writeAssumptions(s.inputs); renderLists(); markPreset(); render(s.inputs); save(s); };

  refreshAll();

  form.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.dataset.knob) {
      const x = num(el.value);
      if (x == null) return;
      knobSet(s.inputs, el.dataset.knob, el.dataset.pct ? x / 100 : x);
    } else if (el.dataset.key) {
      const raw = el.value.trim();
      if (el.dataset.key === 'salaryCap') s.inputs.salaryCap = raw === '' ? null : num(raw);
      else { const x = num(raw); if (x == null) return; s.inputs[el.dataset.key] = el.dataset.pct ? x / 100 : x; }
    } else if (el.dataset.list) readListInput(el, s.inputs);
    s.preset = null;
    markPreset();
    update();
  });
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.add) {
      s.inputs[btn.dataset.add].push(LISTS[btn.dataset.add].blank());
      renderList(btn.dataset.add, s.inputs);
    } else if (btn.dataset.remove) {
      s.inputs[btn.dataset.remove].splice(Number(btn.dataset.idx), 1);
      renderList(btn.dataset.remove, s.inputs);
    } else if (btn.dataset.tab) {
      document.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t === btn)));
      document.querySelectorAll('[role=tabpanel]').forEach((p) => { p.hidden = p.id !== `panel-${btn.dataset.tab}`; });
      return;
    } else return;
    s.preset = null;
    markPreset();
    update(0);
  });
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    s = { inputs: presetInputs(b.dataset.preset, BASE_YEAR), preset: b.dataset.preset };
    refreshAll();
  }));
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCharts, 120); });
}
