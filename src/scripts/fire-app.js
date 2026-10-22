// 試算器頁面的互動層:讀表單 → 呼叫 src/lib/fire.js → 渲染結果與 SVG 圖表。
// 不連網、不送出資料;輸入值存在瀏覽器 localStorage(失敗時照常運作)。
import { DEFAULT_INPUTS, computePlan, earliestFireYear, sensitivity } from '../lib/fire.js';

const STORAGE_KEY = 'fire-inputs-v1';
const BASE_YEAR = new Date().getFullYear();

/** 以今年為基準的範例值(年份欄位隨基準年平移) */
function defaults() {
  const shift = BASE_YEAR - DEFAULT_INPUTS.baseYear;
  return structuredClone({
    ...DEFAULT_INPUTS,
    baseYear: BASE_YEAR,
    fireYear: DEFAULT_INPUTS.fireYear + shift,
    goals: DEFAULT_INPUTS.goals.map((g) => ({ ...g, year: g.year + shift })),
  });
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const saved = JSON.parse(raw);
    return { ...defaults(), ...saved, baseYear: BASE_YEAR };
  } catch {
    return defaults();
  }
}
function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* 隱私模式等情況:不保存 */ }
}

// ---------- 格式化 ----------
const nf = (d) => new Intl.NumberFormat('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
const wan = (v, d = 0) => `${nf(d).format(v)} 萬`;
const pct = (r, d = 1) => (r == null ? '無解' : r <= 0 ? '≤ 0%' : `${nf(d).format(r * 100)}%`);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

// ---------- 動態清單 ----------
const LISTS = {
  loans: {
    blank: () => ({ name: '貸款', principal: 0, years: 0, rate: 0.02 }),
    fields: [
      { key: 'name', type: 'text', label: '名稱' },
      { key: 'principal', label: '剩餘本金', unit: '萬', step: 10 },
      { key: 'years', label: '剩餘年限', unit: '年', step: 1 },
      { key: 'rate', label: '年利率', unit: '%', step: 0.1, pct: true },
    ],
  },
  incomes: {
    blank: () => ({ name: '被動收入', monthly: 0, startAge: null }),
    fields: [
      { key: 'name', type: 'text', label: '名稱' },
      { key: 'monthly', label: '每月金額', unit: '萬/月', step: 0.1 },
      { key: 'startAge', label: '開始領取年齡', unit: '歲', step: 1, nullable: true },
    ],
  },
  goals: {
    blank: () => ({ year: BASE_YEAR + 5, name: '財務目標', amount: 0 }),
    fields: [
      { key: 'name', type: 'text', label: '名稱' },
      { key: 'year', label: '年份', unit: '年', step: 1 },
      { key: 'amount', label: '金額(今日幣值)', unit: '萬', step: 10 },
    ],
  },
};

function fieldValue(f, item) {
  const v = item[f.key];
  if (v == null) return '';
  return f.pct ? round(v * 100, 4) : v;
}

function inputHtml(kind, idx, f, item) {
  return `<input class="inp" aria-label="${esc(f.label)}" data-list="${kind}" data-idx="${idx}" data-field="${f.key}"
    ${f.pct ? 'data-pct="1"' : ''} ${f.nullable ? 'data-nullable="1"' : ''}
    type="${f.type || 'number'}" ${f.type === 'text' ? '' : `inputmode="decimal" step="${f.step}"`}
    value="${esc(fieldValue(f, item))}" placeholder="${f.nullable ? 'FIRE 時' : ''}" />`;
}

function renderList(kind, state) {
  const spec = LISTS[kind];
  const box = document.getElementById(`list-${kind}`);
  const nameField = spec.fields.find((f) => f.key === 'name');
  const numFields = spec.fields.filter((f) => f.key !== 'name');
  box.innerHTML = state[kind]
    .map((item, idx) => `
      <div class="space-y-1.5 rounded-lg border p-2.5" style="border-color:var(--border)" data-row="${kind}" data-idx="${idx}">
        <div class="flex gap-2 items-center">
          ${inputHtml(kind, idx, nameField, item)}
          <button type="button" class="btn-x" aria-label="刪除這一列" data-remove="${kind}" data-idx="${idx}">×</button>
        </div>
        <div class="grid gap-2" style="grid-template-columns:repeat(${numFields.length},minmax(0,1fr))">
          ${numFields.map((f) => `<div class="field"><span class="label" style="font-size:.7rem">${esc(f.label)}</span>
            <div class="inp-unit compact">${inputHtml(kind, idx, f, item)}<span>${esc(f.unit)}</span></div></div>`).join('')}
        </div>
        <div class="text-xs tabular-nums" style="color:var(--fg-muted)" data-derived="${kind}-${idx}"></div>
      </div>`)
    .join('') || '<div class="text-sm" style="color:var(--fg-muted)">尚無資料</div>';
}

// ---------- 表單 ↔ 狀態 ----------
function writeBasic(state) {
  document.querySelectorAll('#fire-form input[data-key]').forEach((el) => {
    const v = state[el.dataset.key];
    el.value = v == null ? '' : el.dataset.pct ? round(v * 100, 4) : v;
  });
}

function readInput(el, state) {
  const raw = el.value.trim();
  if (el.dataset.key) {
    const key = el.dataset.key;
    if (key === 'salaryCap') { state.salaryCap = raw === '' ? null : num(raw); return; }
    const x = num(raw);
    if (x == null) return; // 輸入中途(空白、單一負號)先不更新
    state[key] = el.dataset.pct ? x / 100 : x;
    return;
  }
  const { list, idx, field } = el.dataset;
  const item = state[list][Number(idx)];
  if (!item) return;
  if (el.type === 'text') { item[field] = raw; return; }
  if (raw === '' && el.dataset.nullable) { item[field] = null; return; }
  const x = num(raw);
  if (x == null) return;
  item[field] = el.dataset.pct ? x / 100 : x;
}

// ---------- 圖表 ----------
function niceStep(range, target = 5) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
}

function cashflowChart(flows, W = 760) {
  if (!flows.length) return '';
  const H = W < 500 ? 240 : 300, L = 44, R = W - 10, T = 20, B = H - 40;
  const vals = flows.map((f) => f.invest);
  const step = niceStep(Math.max(...vals, 0) - Math.min(...vals, 0) || 10, 5);
  const vmax = Math.ceil(Math.max(...vals, 0) / step) * step || step;
  const vmin = Math.floor(Math.min(...vals, 0) / step) * step;
  const y = (v) => T + ((vmax - v) / (vmax - vmin)) * (B - T);
  const band = (R - L) / flows.length, bw = Math.max(2, band * 0.64);
  const ticks = [];
  for (let v = vmin; v <= vmax + 1e-9; v += step) ticks.push(v);
  const every = Math.ceil(flows.length / Math.max(2, Math.floor((R - L) / 56)));
  const showVals = band >= 26;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="逐年可投入金額">
    ${ticks.map((t) => `<line x1="${L}" x2="${R}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}"/>
      <text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="var(--fg-muted)">${nf(0).format(t)}</text>`).join('')}
    ${flows.map((f, i) => {
      const x = L + i * band + (band - bw) / 2;
      const neg = f.invest < 0;
      const h = Math.abs(y(f.invest) - y(0));
      const tip = `${f.year}:收入 ${nf(1).format(f.income)} − 生活費 ${nf(1).format(f.expense)} − 貸款 ${nf(1).format(f.loan)} − 目標 ${nf(1).format(f.goal)} = ${nf(1).format(f.invest)} 萬`;
      return `<rect x="${x}" y="${neg ? y(0) : y(f.invest)}" width="${bw}" height="${Math.max(h, 0.5)}" rx="2"
        fill="${neg ? 'var(--status-fail)' : 'var(--chart-muted)'}" fill-opacity="${neg ? 0.75 : 1}"><title>${tip}</title></rect>
        ${showVals ? `<text x="${x + bw / 2}" y="${neg ? y(f.invest) + 14 : y(f.invest) - 5}" text-anchor="middle" font-size="11" fill="var(--fg-muted)">${nf(0).format(f.invest)}</text>` : ''}
        ${i % every === 0 || i === flows.length - 1 ? `<text x="${x + bw / 2}" y="${B + 20}" text-anchor="middle" font-size="12" fill="var(--fg-muted)">${f.year}</text>` : ''}`;
    }).join('')}
    <text x="${R}" y="${H - 6}" text-anchor="end" font-size="11" fill="var(--fg-muted)">萬元(名目)</text>
  </svg>`;
}

function assetChart(traj, target, W = 760) {
  if (traj.length < 2) return '';
  const H = W < 500 ? 260 : 320, L = 52, R = W - 78, T = 24, B = H - 40;
  const top = Math.max(target, ...traj.map((p) => p.balance)) * 1.08;
  const step = niceStep(top, 4);
  const vmax = Math.ceil(top / step) * step;
  const minV = Math.min(0, ...traj.map((p) => Math.min(p.balance, p.principal)));
  const vmin = minV < 0 ? Math.floor(minV / step) * step : 0;
  const x = (i) => L + (i * (R - L)) / (traj.length - 1);
  const y = (v) => T + ((vmax - v) / (vmax - vmin)) * (B - T);
  const path = (k) => traj.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const ticks = [];
  for (let v = vmin; v <= vmax + 1e-9; v += step) ticks.push(v);
  const every = Math.ceil(traj.length / Math.max(2, Math.floor((R - L) / 60)));
  const last = traj.at(-1);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="資產累積路徑">
    ${ticks.map((t) => `<line x1="${L}" x2="${R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/>
      <text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="var(--fg-muted)">${nf(0).format(t)}</text>`).join('')}
    <line x1="${L}" x2="${R}" y1="${y(target)}" y2="${y(target)}" stroke="var(--chart-ref)" stroke-dasharray="5 4"/>
    <text x="${L + 6}" y="${y(target) - 7}" font-size="12" fill="var(--fg-muted)">目標資金 ${wan(target)}</text>
    <path d="${path('principal')}" fill="none" stroke="var(--chart-muted)" stroke-width="2"/>
    <path d="${path('balance')}" fill="none" stroke="var(--brand)" stroke-width="2.5"/>
    ${traj.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.balance)}" r="${traj.length <= 25 ? 3 : 0}" fill="var(--brand)"/>
      <rect x="${x(i) - (R - L) / traj.length / 2}" y="${T}" width="${(R - L) / traj.length}" height="${B - T}" fill="transparent">
        <title>${p.year}:資產 ${wan(p.balance)} · 累計投入 ${wan(p.principal)}</title></rect>
      ${i % every === 0 || i === traj.length - 1 ? `<text x="${x(i)}" y="${B + 20}" text-anchor="middle" font-size="12" fill="var(--fg-muted)">${p.year}</text>` : ''}`).join('')}
    <text x="${R + 8}" y="${y(last.balance) + 4}" font-size="12" fill="var(--brand)" font-weight="600">資產</text>
    <text x="${R + 8}" y="${y(last.principal) - 2}" font-size="12" fill="var(--fg-muted)"><tspan x="${R + 8}">投入本金</tspan><tspan x="${R + 8}" dy="15">${wan(last.principal)}</tspan></text>
  </svg>`;
}

// ---------- 結果 ----------
function tag(kind, text) { return `<span class="tag tag-${kind}">${esc(text)}</span>`; }
function rateTag(r) {
  if (r == null) return tag('fail', '無法達成');
  if (r <= 0.04) return tag('pass', '保守即可');
  if (r <= 0.07) return tag('pending', '需股票部位');
  return tag('fail', '偏高');
}

function stat(label, value, sub, extra = '') {
  return `<div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--bg-soft)">
    <div class="text-xs font-semibold" style="color:var(--fg-muted)">${label}</div>
    <div class="stat-value mt-1">${value}</div>
    <div class="text-xs mt-1.5 flex flex-wrap items-center gap-1.5" style="color:var(--fg-muted)">${extra}${sub}</div>
  </div>`;
}

function table(head, rows, highlight = -1) {
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r, i) => `<tr${i === highlight ? ' style="background:color-mix(in srgb, var(--brand) 9%, transparent)"' : ''}>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
  </tbody></table>`;
}

function sensValues(state, key) {
  const uniq = (a) => [...new Set(a.map((v) => (v == null ? 'null' : round(v, 6))))].map((v) => (v === 'null' ? null : v));
  switch (key) {
    case 'fireYear': return uniq([-5, -3, -1, 0, 2, 5].map((d) => state.fireYear + d)).filter((y) => y > state.baseYear && y - state.baseYear <= 60);
    case 'salary': return uniq([0.8, 0.9, 1, 1.1, 1.2].map((m) => round(state.salary * m, 1)));
    case 'monthlyExpense': return uniq([-2, -1, 0, 1, 2].map((d) => state.monthlyExpense + d)).filter((v) => v > 0);
    case 'salaryGrowth': return uniq([0, 0.01, 0.02, 0.03, 0.04, state.salaryGrowth]).sort((a, b) => a - b);
    case 'salaryCap': return uniq([null, 1.6, 1.4, 1.2, 1.1].map((m) => (m == null ? null : round(state.salary * m, 0))).concat(state.salaryCap == null ? [] : [state.salaryCap]));
    case 'inflation': return uniq([0.01, 0.015, 0.02, 0.025, 0.03, state.inflation]).sort((a, b) => a - b);
    case 'swr': return uniq([0.03, 0.035, 0.04, 0.045, state.swr]).filter((v) => v > 0).sort((a, b) => a - b);
    default: return [];
  }
}
function sensLabel(key, v, state) {
  switch (key) {
    case 'fireYear': return `${v}(${state.age + v - state.baseYear} 歲)`;
    case 'salary': return `${nf(0).format(v)} 萬/年`;
    case 'monthlyExpense': return `${nf(1).format(v)} 萬/月`;
    case 'salaryCap': return v == null ? '不設上限' : `${nf(0).format(v)} 萬/年`;
    default: return `${nf(1).format(v * 100)}%`;
  }
}

let lastPlan = null;
function drawCharts(p = lastPlan) {
  if (!p) return;
  lastPlan = p;
  const w = (id) => Math.max(320, Math.round(document.getElementById(id).clientWidth || 760));
  document.getElementById('chart-cashflow').innerHTML = cashflowChart(p.flows, w('chart-cashflow'));
  document.getElementById('chart-assets').innerHTML = assetChart(p.trajectory, p.target, w('chart-assets'));
}

function render(state) {
  const lead = document.getElementById('lead');
  const n = state.fireYear - state.baseYear;
  const errors = [];
  if (!(n >= 1)) errors.push(`FIRE 年份需晚於今年(${state.baseYear})`);
  if (!(state.swr > 0)) errors.push('安全提領率需大於 0');
  if (n > 60) errors.push('FIRE 年份距今超過 60 年,請確認輸入');
  if (errors.length) {
    lead.innerHTML = `<span style="color:var(--status-fail)">${esc(errors.join(';'))}</span>`;
    ['stats', 'breakdown', 'chart-cashflow', 'chart-assets', 'checks', 'sens'].forEach((id) => { document.getElementById(id).innerHTML = '';});
    document.getElementById('traj-note').textContent = '';
    lastPlan = null;
    return;
  }

  const p = computePlan(state);
  const earliest = earliestFireYear(state, state.assumedReturn);

  // 一句話結論
  const rTxt = p.rCombined == null ? '在合理報酬率下無法達成(請延後 FIRE 年份或調整支出)'
    : p.rCombined <= 0 ? '不需投資收益,光靠存款就能達標'
    : `年化報酬率需 ${pct(p.rCombined)}`;
  lead.innerHTML = `要在 ${state.fireYear} 年(${p.fireAge} 歲)FIRE,需累積 <span style="color:var(--brand)">${wan(p.target)}</span>;以目前資產加上每年正職現金流投入,${rTxt}。`;

  document.getElementById('stats').innerHTML = [
    stat('目標資金', wan(p.target), `FIRE 時年支出 ${wan(p.annualAtFire, 1)}`),
    stat('併用所需報酬率', pct(p.rCombined), '現有資產 + 每年現金流', rateTag(p.rCombined)),
    stat('一次累積 / 分期累積', `<span style="font-size:1.2rem;white-space:nowrap">${pct(p.rLump)} / ${pct(p.rCashflow)}</span>`, '只靠現有資產 / 只靠每年現金流'),
    stat(`以 ${pct(state.assumedReturn)} 報酬最早可 FIRE`, earliest == null ? '45 年內無法' : `${earliest} 年`,
      earliest == null ? '請調整支出或收入' : `${state.age + earliest - state.baseYear} 歲,${earliest <= state.fireYear ? `比目標早 ${state.fireYear - earliest} 年` : `比目標晚 ${earliest - state.fireYear} 年`}`),
  ].join('');

  // 拆解
  const incomeDetail = p.income.rows.map((r) => `${esc(r.name)} ${nf(1).format(r.pv)}`).join(' + ') || '無';
  const loanDetail = p.loans.rows.filter((r) => r.balanceAtFire > 0.05).map((r) => esc(r.name)).join('、');
  document.getElementById('breakdown').innerHTML = table(['項目', '金額', '說明'], [
    ['今日年生活費', wan(p.annualToday, 1), `${nf(1).format(state.monthlyExpense)} × 12`],
    [`${state.fireYear} 年年生活費`, wan(p.annualAtFire, 1), `依通膨 ${pct(state.inflation)} 推算 ${n} 年`],
    ['支撐生活費所需本金', wan(p.baseFund, 1), `÷ 提領率 ${pct(state.swr)}`],
    ['減:年金與被動收入折算', `−${wan(p.income.total, 1)}`, incomeDetail],
    [`加:${state.fireYear} 年貸款餘額`, wan(p.loans.balanceAtFire, 1), loanDetail ? `${loanDetail}尚未還清` : 'FIRE 前全部還清'],
    ['<strong>目標資金</strong>', `<strong>${wan(p.target, 1)}</strong>`, ''],
  ]);

  // 清單旁的衍生數字
  state.loans.forEach((l, i) => {
    const el = document.querySelector(`[data-derived="loans-${i}"]`);
    const row = p.loans.rows.find((r) => r.name === l.name && r.principal === l.principal && r.years === l.years);
    if (el) el.textContent = row ? `月付 ${nf(2).format(row.payment)} 萬 · ${row.balanceAtFire > 0.05 ? `FIRE 時餘額 ${wan(row.balanceAtFire, 1)}` : `${row.payoffYear} 年還清`}` : '';
  });
  state.incomes.forEach((q, i) => {
    const el = document.querySelector(`[data-derived="incomes-${i}"]`);
    const row = p.income.rows.find((r) => r.name === q.name);
    if (el) el.textContent = row ? `FIRE 時折算本金 ${wan(row.pv, 1)}${row.delay ? `(FIRE 後 ${row.delay} 年開始領)` : ''}` : '';
  });
  state.goals.forEach((g, i) => {
    const el = document.querySelector(`[data-derived="goals-${i}"]`);
    if (!el) return;
    const t = g.year - state.baseYear;
    el.textContent = t >= 1 && t <= n ? `當年金額 ${wan(g.amount * (1 + state.inflation) ** t, 1)}` : '不在 FIRE 前的年份內,不計入';
  });

  // 圖表
  drawCharts(p);
  const last = p.trajectory.at(-1);
  document.getElementById('traj-note').textContent = p.rCombined == null
    ? `所需報酬率無解,以你預期的 ${pct(state.assumedReturn)} 推算:期末 ${wan(last.balance)},距目標 ${wan(p.target - last.balance)}。`
    : `以所需報酬率 ${pct(p.rCombined)} 推算;期末 ${wan(last.balance)} 中,投入本金 ${wan(last.principal)},投資收益 ${wan(last.balance - last.principal)}。`;

  // 檢核
  const c = p.checks;
  const dti = c.dti;
  const loanRateMax = Math.max(0, ...state.loans.filter((l) => l.principal > 0).map((l) => l.rate));
  document.getElementById('checks').innerHTML = table(['檢核項目', '結果', '標準', '判斷'], [
    ['貸款月付金占稅後月收入', dti == null ? '—' : `${nf(1).format(dti * 100)}%(${nf(2).format(p.loans.monthlyPayment)} ÷ ${nf(1).format(state.salary / 12)})`, '≤ 33%',
      dti == null ? tag('neutral', '無收入') : dti <= 0.33 ? tag('pass', '符合') : dti <= 0.4 ? tag('pending', '略超標') : tag('fail', '偏高')],
    ['緊急預備金', `${wan(p.emergency, 1)}(${nf(0).format(state.emergencyMonths)} 個月)`, '≥ 6 個月生活費',
      state.emergencyMonths >= 6 ? tag('pass', '符合') : state.emergencyMonths >= 3 ? tag('pending', '偏少') : tag('fail', '不足')],
    ['最低年度可投入', c.minFlow ? `${wan(c.minFlow.invest, 1)}(${c.minFlow.year})` : '—', '≥ 0',
      !c.minFlow || c.minFlow.invest >= 0 ? tag('pass', '符合') : tag('pending', `${c.negativeYears.join('、')} 需提領`)],
    ['最高貸款利率 vs 所需報酬率', `${pct(loanRateMax)} vs ${pct(p.rCombined)}`, '報酬率明顯高於利率才值得不提前還',
      p.rCombined == null ? tag('neutral', '—') : p.rCombined - loanRateMax >= 0.02 ? tag('pass', '投資優先') : tag('pending', '可考慮提前還款')],
    ['扣除緊急預備金後資產', wan(p.start, 1), '> 0', p.start > 0 ? tag('pass', '符合') : tag('fail', '資產不足預備金')],
  ]);

  renderSens(state);
}

function renderSens(state) {
  const key = document.getElementById('sens-key').value;
  const vals = sensValues(state, key);
  const rows = sensitivity(state, key, vals);
  const cur = vals.findIndex((v) => (v == null ? state[key] == null : state[key] != null && Math.abs(v - state[key]) < 1e-9));
  document.getElementById('sens').innerHTML = table(['情境', '目標資金', '一次累積所需報酬率', '併用所需報酬率'],
    rows.map((r) => [sensLabel(key, r.value, state), wan(r.target), pct(r.rLump), pct(r.rCombined)]), cur);
}

// ---------- 掛載 ----------
export function mount() {
  let state = load();
  const form = document.getElementById('fire-form');
  const renderLists = () => Object.keys(LISTS).forEach((k) => renderList(k, state));
  let timer = 0;
  const update = () => { clearTimeout(timer); timer = setTimeout(() => { render(state); save(state); }, 60); };

  writeBasic(state);
  renderLists();
  render(state);

  form.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    readInput(el, state);
    update();
  });
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.add) {
      state[btn.dataset.add].push(LISTS[btn.dataset.add].blank());
      renderList(btn.dataset.add, state);
      update();
    } else if (btn.dataset.remove) {
      state[btn.dataset.remove].splice(Number(btn.dataset.idx), 1);
      renderList(btn.dataset.remove, state);
      update();
    } else if (btn.id === 'reset') {
      state = defaults();
      writeBasic(state);
      renderLists();
      render(state);
      save(state);
    }
  });
  document.getElementById('sens-key').addEventListener('change', () => renderSens(state));
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => drawCharts(), 120); });
}
