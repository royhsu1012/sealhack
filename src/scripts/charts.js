// 結果頁的 SVG 圖表(純字串;寬度跟隨容器,由呼叫端傳入 W)
import { fundNeeded, fundAtFire, endAgeOf } from '../lib/fire.js';
import { nf, wan, big, pct, niceStep, T, textW, legend } from './shared.js';

// 交叉圖的橫軸預設畫到 12%;選得更高或最低報酬率更高時才往右延伸,避免高報酬把常用的範圍壓扁
const CHART_R = 0.12;

// 一生資產的機率範圍(monteCarlo 的結果):中位數一條線,中間一半的情況(P25–P75)深色帶、八成的情況(P10–P90)淺色帶
// need = 以選的報酬率算出、在理想退休年齡退休需要準備的錢
export const BAND_DARK = 'color-mix(in srgb, var(--free) 38%, transparent)';
export const BAND_LIGHT = 'color-mix(in srgb, var(--free) 16%, transparent)';
export function fanChart(mc, need, W) {
  const { rows, fireAge } = mc;
  const H = W < 560 ? 300 : 380, L = 48, R = W - 16, top = 34, B = H - 62;
  const a0 = rows[0].age, a1 = rows.at(-1).age;
  const x = (a) => L + ((a - a0) / (a1 - a0)) * (R - L);
  // 縱軸聚焦退休前後:以退休時的 P90 與需要準備的錢為準,退休後一路長高的部分從上方裁掉
  const atFire = rows.find((r) => r.age === fireAge) ?? rows.at(-1);
  const allMax = Math.max(need, ...rows.map((r) => r.p90));
  const peak = Math.max(1, Math.min(allMax, Math.max(need, atFire.p90) * 1.6));
  const step = niceStep(peak, 4);
  const vmax = Math.ceil((peak * 1.05) / step) * step;
  const y = (v) => top + ((vmax - Math.max(0, v)) / vmax) * (B - top);
  const line = (k) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.age).toFixed(1)},${y(r[k]).toFixed(1)}`).join(' ');
  const band = (lo, hi) => `${line(hi)} ${[...rows].reverse().map((r) => `L${x(r.age).toFixed(1)},${y(r[lo]).toFixed(1)}`).join(' ')} Z`;
  const fx = x(Math.min(fireAge, a1));
  const ticks = [];
  for (let v = 0; v <= vmax + 1e-9; v += step) ticks.push(v);
  const ageTicks = [];
  const ageStep = W < 560 ? 10 : 5;
  for (let a = Math.ceil(a0 / ageStep) * ageStep; a <= a1; a += ageStep) ageTicks.push(a);
  const tY = y(need);

  // 「用完」的點:最差一成、一半的情況各一個,標籤由下往上疊
  const zeros = [['p10Zero', '最差一成'], ['p50Zero', '一半的情況']]
    .filter(([k]) => mc[k] != null)
    .map(([k, label], i) => {
      const a = mc[k], dx = x(a);
      const text = `${label} ${a} 歲用完`, w = textW(text, 12), ly = B - 12 - i * 17;
      // 右邊放得下就放右邊,否則放左邊;兩邊都不夠就在點的上方、夾在圖內
      const lx = dx + 10 + w <= R ? dx + 10 : dx - 10 - w >= L ? dx - 10 - w : Math.min(Math.max(dx - w / 2, L + 2), R - w);
      return { a, dx, text, ly, lx, box: [lx, lx + w, ly - 12, ly + 3] };
    });
  // 「需要準備 X 萬」標籤:依序試幾個位置,挑第一個不壓到其他標籤的
  const retireEnd = fx > R - 120;
  const retireW = textW(`${fireAge} 歲退休`, 13);
  const boxes = [retireEnd ? [fx - 8 - retireW, fx - 8, top - 14, top + 1] : [fx + 8, fx + 8 + retireW, top - 14, top + 1], ...zeros.map((m) => m.box)];
  const tWide = fx - x(a0) >= 140;
  const tSize = tWide ? 12 : 11;
  const tText = `${tWide ? '需要準備' : '需要'} ${big(need)}`;
  const tw = textW(tText, tSize);
  const tFree = ([x1, yy]) => {
    const b = [x1 - 2, x1 + tw + 2, yy - tSize - 2, yy + 5];
    return b[1] <= R && b[2] >= top - 4 && b[3] <= B - 2 && !boxes.some((o) => b[0] < o[1] && b[1] > o[0] && b[2] < o[3] && b[3] > o[2]);
  };
  const tPos = [[x(a0) + 4, tY - 7], [x(a0) + 4, tY + tSize + 5], [fx + 8, tY - 7], [fx + 8, tY + tSize + 5], [x(a0) + 4, tY - 25], [x(a0) + 4, tY - 43]]
    .find(tFree) ?? [x(a0) + 4, tY - 7];
  const freeLabel = `自由 ${fireAge} 歲之後`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="一生資產的機率範圍:${fireAge} 歲退休,撐到 ${a1} 歲的機率 ${Math.round(mc.success * 100)}%">
    <defs><clipPath id="fan-plot"><rect x="${L}" y="${top - 2}" width="${R - L}" height="${B - top + 2}"/></clipPath></defs>
    ${ticks.map((v) => `<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/>${T(L - 8, y(v) + 4, v === 0 ? '0' : big(v).replace(' 萬', ''), { anchor: 'end', size: 11 })}`).join('')}
    ${T(L - 8, top - 16, '萬元', { anchor: 'end', size: 11 })}
    <g clip-path="url(#fan-plot)">
      <path d="${band('p10', 'p90')}" fill="${BAND_LIGHT}"/>
      <path d="${band('p25', 'p75')}" fill="${BAND_DARK}"/>
      <path d="${line('p50')}" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/>
    </g>
    <line x1="${x(a0)}" x2="${fx}" y1="${tY}" y2="${tY}" stroke="var(--ink-2)" stroke-dasharray="3 4"/>
    <line x1="${fx}" x2="${fx}" y1="${top - 10}" y2="${B}" stroke="var(--gold)" stroke-width="2"/>
    <circle cx="${fx}" cy="${y(atFire.p50)}" r="5" fill="var(--gold)"/>
    ${T(tPos[0], tPos[1], tText, { size: tSize, halo: true })}
    ${T(fx + (retireEnd ? -8 : 8), top - 2, `${fireAge} 歲退休`, { anchor: retireEnd ? 'end' : 'start', fill: 'var(--ink)', weight: 800, size: 13 })}
    ${zeros.map((m) => `<circle cx="${m.dx}" cy="${B}" r="5" fill="var(--warn)"/>${T(m.lx, m.ly, m.text, { fill: 'var(--ink)', weight: 700, size: 12, halo: true })}`).join('')}
    <line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="var(--line)"/>
    ${ageTicks.map((a) => T(x(a), B + 16, `${a}`, { anchor: 'middle', size: 11 })).join('')}
    <rect x="${x(a0)}" y="${B + 26}" width="${Math.max(0, fx - x(a0) - 2)}" height="22" rx="5" fill="var(--work)" fill-opacity="0.35"/>
    <rect x="${fx + 2}" y="${B + 26}" width="${Math.max(0, R - fx - 2)}" height="22" rx="5" fill="var(--free)" fill-opacity="0.3"/>
    ${fx - x(a0) > 34 ? T((x(a0) + fx) / 2, B + 41, fx - x(a0) > 90 ? `工作 ${a0}–${fireAge} 歲` : '工作', { anchor: 'middle', size: 12, fill: 'var(--ink)', weight: 600 }) : ''}
    ${R - fx > 34 ? T((fx + R) / 2, B + 41, R - fx > 90 ? freeLabel : '自由', { anchor: 'middle', size: 12, fill: 'var(--ink)', weight: 600 }) : ''}
    ${rows.map((r) => `<rect x="${x(r.age) - (R - L) / rows.length / 2}" y="${top}" width="${(R - L) / rows.length}" height="${B - top}" fill="transparent"><title>${r.age} 歲(${r.year}):中位數 ${big(r.p50)};一半的情況 ${big(r.p25)}–${big(r.p75)};八成 ${big(r.p10)}–${big(r.p90)}</title></rect>`).join('')}
  </svg>`;
}

// 需要準備多少:瀑布圖(b = needBreakdown,以報酬率 r 折回退休時)
export function targetChart(b, r, endAge, W) {
  const H = 260, L = 10, R = W - 10, top = 30, B = H - 44;
  const steps = [
    { label: '生活費', sub: `到 ${endAge} 歲,以 ${pct(r)} 折算`, from: 0, to: b.expenses, color: 'var(--ink)' },
    { label: '年金折抵', sub: '勞保、勞退等', from: b.expenses, to: b.expenses - b.pensions, color: 'var(--free)' },
    { label: '貸款餘額', sub: '退休時還清', from: b.expenses - b.pensions, to: b.total, color: 'var(--work)' },
    { label: '需要準備', sub: '', from: 0, to: b.total, color: 'var(--ink)', total: true },
  ];
  const vmax = Math.max(...steps.map((s) => Math.max(s.from, s.to))) * 1.08 || 1;
  const y = (v) => top + ((vmax - Math.max(v, 0)) / vmax) * (B - top);
  const band = (R - L) / steps.length, bw = Math.min(70, band * 0.56);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="需要準備 ${wan(b.total)}">
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
        ${s.sub && band >= textW(s.sub, 10.5) + 6 ? T(cx, B + 34, s.sub, { anchor: 'middle', size: 10.5 }) : ''}`;
    }).join('')}
  </svg>`;
}

// 每年能存下多少
export function cashflowChart(flows, W) {
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
        ${i % every === 0 || (i === flows.length - 1 && i % every >= every / 2 + 0.5) || (i === flows.length - 1 && every === 1)
          ? (i === 0 ? T(xx, B + 18, f.year, { size: 11 }) : T(xx + bw / 2, B + 18, f.year, { anchor: 'middle', size: 11 })) : ''}`;
    }).join('')}
  </svg>`;
}

// 影響退休年齡的因素:龍捲風圖
export function driversChart(d, W) {
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
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="影響退休年齡的因素,目前最快 ${d.base} 歲">
    ${T(bx, 14, `目前 ${d.base} 歲`, { anchor: 'middle', size: 12, fill: 'var(--ink)', weight: 700 })}
    <line x1="${bx}" x2="${bx}" y1="${top - 4}" y2="${H - 6}" stroke="var(--ink)" stroke-width="1.5"/>
    ${rows.map((r, i) => {
      const cy = top + i * rowH + rowH / 2;
      const earlier = Math.min(r.a, d.base), later = Math.max(r.b, d.base);
      const tip = `${r.label}:調低 ${r.lo == null ? '無法退休' : `${r.lo} 歲`}・調高 ${r.hi == null ? '無法退休' : `${r.hi} 歲`}`;
      return `${T(0, cy + 4, r.label, { size: 12.5, fill: 'var(--ink)' })}
        <line x1="${L}" x2="${R}" y1="${cy}" y2="${cy}" stroke="var(--grid)"/>
        ${earlier < d.base ? `<rect x="${x(earlier)}" y="${cy - 9}" width="${bx - x(earlier)}" height="18" rx="4" fill="var(--free)" fill-opacity="0.8"><title>${tip}</title></rect>${T(x(earlier) - 5, cy + 4, `${earlier}`, { anchor: 'end', size: 11 })}` : ''}
        ${later > d.base ? `<rect x="${bx}" y="${cy - 9}" width="${x(later) - bx}" height="18" rx="4" fill="var(--warn)" fill-opacity="0.75"><title>${tip}</title></rect>${T(x(later) + 5, cy + 4, (r.low == null || r.high == null) && later === d.base + 15 ? '無法' : `${later}`, { size: 11 })}` : ''}
        ${earlier === d.base && later === d.base ? T(bx + 6, cy + 4, '影響不到 1 歲', { size: 11 }) : ''}`;
    }).join('')}
  </svg>
  ${legend([['var(--free)', '往好的方向調,可提早退休'], ['var(--warn)', '往壞的方向調,要延後']])}`;
}


/** 報酬率(橫軸)對「撐到預計活到的年齡需要的錢」與「退休時存得到的錢」:兩條線交叉處就是最低報酬率 */
export function tradeoffChart(inp, rSel, be, W) {
  const xMax = Math.max(CHART_R, rSel + 0.01, be != null ? be + 0.01 : 0);
  const H = W < 560 ? 270 : 320, L = 48, R = W - 14, top = 30, B = H - 32;
  const N = 48;
  const rs = Array.from({ length: N + 1 }, (_, k) => (xMax * k) / N);
  const need = rs.map((r) => fundNeeded(inp, r));
  const have = rs.map((r) => fundAtFire(inp, r));
  const needSel = fundNeeded(inp, rSel), haveSel = fundAtFire(inp, rSel);
  const needBe = be != null ? fundNeeded(inp, be) : 0;
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
    ${needSel <= vmax ? `<circle cx="${sx}" cy="${y(needSel)}" r="5" fill="var(--ink)"><title>報酬率 ${pct(rSel)}:撐到 ${endAgeOf(inp)} 歲需要 ${big(needSel)}</title></circle>` : ''}
    <circle cx="${sx}" cy="${y(haveSel)}" r="5" fill="var(--free)"><title>報酬率 ${pct(rSel)}:退休時存得到 ${big(haveSel)}</title></circle>
    ${be != null && be > 0 && be <= xMax ? `<circle cx="${beX}" cy="${y(needBe)}" r="6" fill="var(--gold)" stroke="var(--surface)" stroke-width="2"/>
      ${bePos
        ? T(bePos[0], y(needBe) - 10, beLabel, { anchor: bePos[1], size: 13, fill: 'var(--ink)', weight: 800, halo: true })
        : T(beX, y(needBe) - 16, beLabel, { anchor: 'middle', size: 13, fill: 'var(--ink)', weight: 800, halo: true })}` : ''}
  </svg>
  ${legend([['var(--ink)', `撐到 ${endAgeOf(inp)} 歲需要的錢`], ['var(--free)', '退休時存得到的錢'], ['var(--gold)', '交叉點:最低報酬率']])}`;
}
