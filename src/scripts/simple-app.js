// 簡單版試算:5 個數字 → 反推需要準備多少錢、年化報酬率至少要多少。
import { computePlan, simpleInputs, SIMPLE } from '../lib/fire.js';
import {
  loadState, saveState, wan, big, pct, num, $, moneyHTML, rateHTML, knobSet, writeKnobs,
  niceStep, T, widthOf, legend, gauge, onResize, setMiniBar, watchMiniBar,
} from './shared.js';

// 怎麼存到目標:每年資產 = 存進去的錢 + 投資賺的錢
function savingsChart(plan, age, W) {
  const rows = plan.trajectory.map((p, t) => {
    const principal = Math.max(0, p.principal);
    return { age: age + t, year: p.year, principal, growth: Math.max(0, p.balance - principal) };
  });
  const H = W < 560 ? 260 : 300, L = 48, R = W - 12, top = 30, B = H - 30;
  const peak = Math.max(plan.target, ...rows.map((r) => r.principal + r.growth));
  const step = niceStep(peak, 4);
  const vmax = Math.ceil((peak * 1.05) / step) * step || 1;
  const y = (v) => top + ((vmax - v) / vmax) * (B - top);
  const band = (R - L) / rows.length, bw = Math.max(2, band * 0.7);
  const ticks = [];
  for (let v = 0; v <= vmax + 1e-9; v += step) ticks.push(v);
  const every = Math.ceil(rows.length / Math.max(2, Math.floor((R - L) / 40)));
  const lastI = rows.length - 1;
  const labelled = (i) => (i === lastI ? lastI % every === 0 || lastI % every >= every * 0.6 : i % every === 0);
  const end = rows[lastI];
  const tY = y(plan.target);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${end.age} 歲時累積 ${big(plan.target)}:存進 ${big(end.principal)},投資賺 ${big(end.growth)}">
    ${ticks.map((v) => `<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/>${T(L - 8, y(v) + 4, v === 0 ? '0' : big(v).replace(' 萬', ''), { anchor: 'end', size: 11 })}`).join('')}
    ${T(L - 8, top - 14, '萬元', { anchor: 'end', size: 11 })}
    ${rows.map((r, i) => {
      const x = L + i * band + (band - bw) / 2;
      const tip = `<title>${r.age} 歲(${r.year}):存進 ${wan(r.principal)} + 投資賺 ${wan(r.growth)} = ${wan(r.principal + r.growth)}</title>`;
      return `<rect x="${x}" y="${y(r.principal)}" width="${bw}" height="${Math.max(0, B - y(r.principal))}" rx="1.5" fill="var(--work)" fill-opacity="0.8">${tip}</rect>
        ${r.growth > 0 ? `<rect x="${x}" y="${y(r.principal + r.growth)}" width="${bw}" height="${Math.max(0, y(r.principal) - y(r.principal + r.growth))}" rx="1.5" fill="var(--free)" fill-opacity="0.85">${tip}</rect>` : ''}
        ${labelled(i) ? (i === 0 ? T(x, B + 18, `${r.age} 歲`, { size: 11 }) : T(x + bw / 2, B + 18, `${r.age}`, { anchor: 'middle', size: 11 })) : ''}`;
    }).join('')}
    <line x1="${L}" x2="${R}" y1="${tY}" y2="${tY}" stroke="var(--ink)" stroke-dasharray="4 4"/>
    ${T(L + 4, tY - 7, `目標 ${big(plan.target)}`, { size: 12, fill: 'var(--ink)', weight: 700, halo: true })}
    <line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="var(--line)"/>
  </svg>
  ${legend([['var(--work)', '你存進去的錢'], ['var(--free)', '投資賺的錢']])}`;
}

let last = null;
function draw() {
  if (!last) return;
  $('gauge').innerHTML = gauge(last.plan.rCombined, null, widthOf('gauge'));
  $('chart-save').innerHTML = last.plan.rCombined == null
    ? '<p class="text-sm muted">以目前的存款速度,在合理報酬率下存不到目標。</p>'
    : savingsChart(last.plan, last.age, widthOf('chart-save'));
}

function render(stored) {
  const inp = simpleInputs(stored);
  const n = inp.fireYear - inp.baseYear;
  if (n < 1) {
    $('hero-kicker').textContent = '想退休的年齡要大於目前年齡';
    $('hero-target').textContent = '—';
    $('hero-rate').textContent = '—';
    $('hero-sub').textContent = '';
    setMiniBar('想退休的年齡要大於目前年齡', '');
    last = null;
    ['gauge', 'chart-save'].forEach((id) => { $(id).innerHTML = ''; });
    return;
  }
  const plan = computePlan(inp);
  const r = plan.rCombined;
  const principal = plan.trajectory.at(-1).principal;
  const fireAge = plan.fireAge;
  last = { plan, age: inp.age };

  $('hero-kicker').textContent = `想在 ${fireAge} 歲退休(${n} 年後)`;
  $('hero-target').innerHTML = moneyHTML(plan.target);
  $('hero-rate').innerHTML = rateHTML(r);
  const why = `退休時一年生活費約 ${wan(plan.annualAtFire)}(今天的 ${wan(plan.annualToday)},以通膨 ${pct(SIMPLE.inflation, 0)} 算 ${n} 年),除以 ${pct(SIMPLE.swr, 0)} 提領率就是要準備的錢。`;
  const how = r == null
    ? '以目前的存款速度,在合理的報酬率下都存不到;試著晚幾年退休、每月多存一點,或降低退休後的生活費。'
    : r <= 0
      ? '光靠每月存款就存得到,不需要投資報酬。'
      : `你會存進 ${big(principal)},其餘 ${big(plan.target - principal)}要靠投資賺。`;
  $('hero-sub').textContent = why + how;
  $('save-title').textContent = `怎麼存到 ${big(plan.target)}`;
  $('save-note').textContent = r == null || r <= 0 ? '' : `以每年 ${pct(r)} 報酬推算`;
  setMiniBar(`${fireAge} 歲退休需 ${big(plan.target)}`, r == null ? '報酬率:無解' : r <= 0 ? '存款就夠' : `報酬率 ${pct(r)}`);
  draw();
}

export function mount() {
  const s = loadState();
  const form = $('fire-form');
  let timer = 0;
  const refresh = () => { writeKnobs(s.inputs); render(s.inputs); saveState(s); };
  refresh();
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !el.dataset.knob) return;
    const x = num(el.value);
    if (x == null) return;
    knobSet(s.inputs, el.dataset.knob, el.dataset.pct ? x / 100 : x);
    if (el.dataset.knob !== 'monthlySaving') s.preset = null;
    clearTimeout(timer);
    timer = setTimeout(refresh, 40);
  });
  onResize(draw);
  watchMiniBar();
}
