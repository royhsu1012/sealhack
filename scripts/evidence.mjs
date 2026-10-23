// 投資方法頁的歷史數據佐證:抓公開資料 → 算統計 → 寫 src/data/evidence.json(建置前離線執行,網頁只讀結果)。
// 用法:node scripts/evidence.mjs        (原始資料快取在 scripts/evidence-raw/,已 gitignore;加 --refresh 重抓)
// 資料:台股加權報酬指數、加權指數(FinMind,台灣證交所);S&P 500 日收盤(FinMind)+ 月股息殖利率與 Shiller CAPE(multpl.com,源自 Robert Shiller)。
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'scripts', 'evidence-raw');
const OUT = join(ROOT, 'src', 'data', 'evidence.json');
const REFRESH = process.argv.includes('--refresh');
mkdirSync(RAW, { recursive: true });

async function cached(name, fetcher) {
  const file = join(RAW, name);
  if (!REFRESH && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const data = await fetcher();
  writeFileSync(file, JSON.stringify(data));
  return data;
}
async function finmind(dataset, id) {
  const q = new URLSearchParams({ dataset, data_id: id, start_date: '1900-01-01', end_date: new Date().toISOString().slice(0, 10) });
  const res = await fetch(`https://api.finmindtrade.com/api/v4/data?${q}`);
  const d = await res.json();
  if (d.status !== 200) throw new Error(`${dataset} ${id}: ${d.msg}`);
  return d.data;
}
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
async function multpl(slug) {
  const res = await fetch(`https://www.multpl.com/${slug}/table/by-month`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const rows = [...html.matchAll(/<td>(\w{3}) (\d+), (\d{4})<\/td>\s*<td>[\s\S]*?([\d.]+)%?\s*<\/td>/g)];
  return rows.map(([, m, , y, v]) => ({ ym: `${y}-${String(MON[m]).padStart(2, '0')}`, v: +v }));
}

// ---------- 原始資料 ----------
const twTR = await cached('taiex-tr.json', () => finmind('TaiwanStockTotalReturnIndex', 'TAIEX'));
const twPx = await cached('taiex.json', () => finmind('TaiwanStockPrice', 'TAIEX'));
const spx = await cached('gspc.json', () => finmind('USStockPrice', '^GSPC'));
const dy = await cached('sp500-dividend-yield.json', () => multpl('s-p-500-dividend-yield'));
const cape = await cached('shiller-pe.json', () => multpl('shiller-pe'));

// ---------- 工具 ----------
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r3 = (v) => Math.round(v * 1e3) / 1e3;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const share = (a, f) => a.filter(f).length / a.length;
/** 日資料 → 月底值 [{ym, v}] */
function monthEnd(rows, dateKey, valKey) {
  const m = new Map();
  for (const r of rows) m.set(r[dateKey].slice(0, 7), r[valKey]);
  return [...m].map(([ym, v]) => ({ ym, v }));
}
const cagr = (a, b, years) => (b / a) ** (1 / years) - 1;

// 台股:加權報酬指數月底值(2003-01 起)
const twDaily = twTR.map((r) => ({ d: r.date, v: r.price }));
const tw = monthEnd(twTR, 'date', 'price');
// 美股:S&P 500 月底收盤 + 當月股息殖利率 ÷ 12 → 含息報酬指數(1928 起)
const dyMap = new Map(dy.map((r) => [r.ym, r.v / 100]));
const spxM = monthEnd(spx, 'date', 'Close');
const us = [{ ym: spxM[0].ym, v: 1 }];
for (let i = 1; i < spxM.length; i++) {
  const y = dyMap.get(spxM[i].ym) ?? dyMap.get(spxM[i - 1].ym) ?? 0.03;
  us.push({ ym: spxM[i].ym, v: us[i - 1].v * (spxM[i].v / spxM[i - 1].v + y / 12) });
}

// ---------- 1. 持有越久,賠錢的機率越低 ----------
function rolling(series, years) {
  const h = years * 12, out = [];
  for (let i = 0; i + h < series.length; i++) out.push(cagr(series[i].v, series[i + h].v, years));
  return out;
}
function holdStats(series, years) {
  const a = rolling(series, years);
  return { years, windows: a.length, loss: r3(share(a, (v) => v < 0)), min: r4(Math.min(...a)), median: r4(median(a)), max: r4(Math.max(...a)) };
}

// ---------- 2. 一筆錢:一次投入 vs 分 12 個月投入 ----------
function lumpVsDca(series, months = 12) {
  const diff = [];
  for (let i = 0; i + months < series.length; i++) {
    const end = series[i + months].v;
    const lump = months * (end / series[i].v);
    let dca = 0;
    for (let k = 0; k < months; k++) dca += end / series[i + k].v;
    diff.push(lump / dca - 1);
  }
  return { windows: diff.length, lumpWins: r3(share(diff, (v) => v > 0)), medianEdge: r4(median(diff)) };
}

// ---------- 3. 每月照買 vs 全知抄底(知道每個低點,只在兩個歷史高點之間的最低點買) ----------
// lag = 晚幾個月才買到(0 = 剛好買在最低點)
function dcaVsPerfectDip(series, months, lag = 0) {
  const v = series.map((s) => s.v);
  const ath = []; let peak = -Infinity;
  v.forEach((x, i) => { if (x >= peak) { peak = x; ath.push(i); } });
  const isAth = new Set(ath);
  const wins = [], edges = [];
  for (let s = 0; s + months <= v.length; s++) {
    const e = s + months - 1;
    let dcaUnits = 0;
    for (let t = s; t <= e; t++) dcaUnits += 1 / v[t];
    const dca = dcaUnits * v[e];
    // 視窗內的高點把時間切段;每段(兩個高點之間,或最後一個高點到視窗結束)在最低點把手上現金全買
    const marks = [];
    for (let t = s + 1; t <= e; t++) if (isAth.has(t)) marks.push(t);
    const segs = []; let a = s;
    for (const b of marks) { segs.push([a, b - 1]); a = b; }
    segs.push([a, e]);
    let units = 0, cash = 0, t = s;
    for (const [lo, hi] of segs) {
      const from = isAth.has(lo) && lo !== s ? lo + 1 : lo;
      if (from > hi) continue;
      let bottom = from;
      for (let k = from; k <= hi; k++) if (v[k] < v[bottom]) bottom = k;
      const buy = Math.min(bottom + lag, e);
      if (buy < t) continue;
      for (; t <= buy; t++) cash += 1;
      units += cash / v[buy]; cash = 0;
    }
    for (; t <= e; t++) cash += 1;
    const god = units * v[e] + cash;
    wins.push(dca >= god); edges.push(dca / god - 1);
  }
  return { windows: wins.length, dcaWins: r3(share(wins, Boolean)), medianEdge: r4(median(edges)) };
}

// ---------- 4. 錯過最好的幾天 ----------
function missBest(daily) {
  const rets = [];
  for (let i = 1; i < daily.length; i++) rets.push(daily[i].v / daily[i - 1].v - 1);
  const years = (new Date(daily.at(-1).d) - new Date(daily[0].d)) / (365.25 * 864e5);
  const sorted = [...rets].sort((a, b) => b - a);
  const grow = (skip) => {
    const cut = skip ? sorted[skip - 1] : Infinity;
    let left = skip, g = 1;
    for (const r of rets) { if (left && r >= cut) { left--; continue; } g *= 1 + r; }
    return g ** (1 / years) - 1;
  };
  return { from: daily[0].d, to: daily.at(-1).d, rows: [0, 10, 20, 30].map((k) => ({ missed: k, cagr: r4(grow(k)) })) };
}

// ---------- 5. 每年都有大跌,多數年份仍是正報酬(市場先生的情緒) ----------
function calendarYears(daily) {
  const byYear = new Map();
  for (const r of daily) { const y = +r.d.slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(r.v); }
  const out = []; let prevEnd = null;
  for (const [y, vals] of byYear) {
    const base = prevEnd ?? vals[0];
    let peak = base, dd = 0;
    for (const x of vals) { peak = Math.max(peak, x); dd = Math.min(dd, x / peak - 1); }
    const complete = y < new Date(daily.at(-1).d).getFullYear();
    if (complete) out.push({ year: y, ret: r4(vals.at(-1) / base - 1), drop: r4(dd) });
    prevEnd = vals.at(-1);
  }
  return out;
}

// ---------- 6. 買進時的估值(Shiller CAPE)與之後 10 年的年化報酬 ----------
function capeStudy() {
  const capeMap = new Map(cape.map((r) => [r.ym, r.v]));
  const pts = [];
  for (let i = 0; i + 120 < us.length; i++) {
    const c = capeMap.get(us[i].ym);
    if (c) pts.push({ ym: us[i].ym, cape: c, next10: cagr(us[i].v, us[i + 120].v, 10) });
  }
  const bands = [[0, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, 99]].map(([lo, hi]) => {
    const a = pts.filter((p) => p.cape >= lo && p.cape < hi).map((p) => p.next10);
    return { lo, hi, n: a.length, mean: r4(mean(a)), min: r4(Math.min(...a)), max: r4(Math.max(...a)) };
  });
  const yearly = pts.filter((p) => p.ym.endsWith('-01')).map((p) => ({ year: +p.ym.slice(0, 4), cape: r3(p.cape), next10: r4(p.next10) }));
  const latest = cape[0];
  return { bands, yearly, latest: { ym: latest.ym, cape: latest.v }, from: pts[0].ym, to: pts.at(-1).ym };
}

// ---------- 7. 大跌 20% 以上時買進,之後 3 年的年化報酬 ----------
function afterDrawdown(series, depth = -0.2, months = 36) {
  let peak = -Infinity;
  const all = [], deep = [];
  for (let i = 0; i < series.length; i++) {
    peak = Math.max(peak, series[i].v);
    if (i + months >= series.length) continue;
    const fwd = cagr(series[i].v, series[i + months].v, months / 12);
    all.push(fwd);
    if (series[i].v / peak - 1 <= depth) deep.push(fwd);
  }
  return { months, all: { n: all.length, mean: r4(mean(all)), loss: r3(share(all, (v) => v < 0)) }, deep: { n: deep.length, mean: r4(mean(deep)), loss: r3(share(deep, (v) => v < 0)) } };
}
/** 跌幅超過 20% 的空頭:高點、低點、跌幅、幾個月回到高點(月底值) */
function bearMarkets(series, depth = -0.2) {
  const out = []; let pk = 0, tr = 0, inBear = false;
  for (let i = 1; i < series.length; i++) {
    if (series[i].v >= series[pk].v) {
      if (inBear) out.push({ peak: series[pk].ym, trough: series[tr].ym, drop: r4(series[tr].v / series[pk].v - 1), recover: i - pk });
      pk = i; tr = i; inBear = false;
    } else {
      if (series[i].v < series[tr].v) tr = i;
      if (series[tr].v / series[pk].v - 1 <= depth) inBear = true;
    }
  }
  if (inBear) out.push({ peak: series[pk].ym, trough: series[tr].ym, drop: r4(series[tr].v / series[pk].v - 1), recover: null });
  return out;
}

// ---------- 8. 成本的複利:每月投入 1 萬、30 年、毛報酬 6% ----------
function feeDrag(gross = 0.06, years = 30, fees = [0.002, 0.01, 0.015]) {
  const fv = (fee) => { const m = (1 + gross - fee) ** (1 / 12) - 1; let b = 0; for (let k = 0; k < years * 12; k++) b = b * (1 + m) + 1; return b; };
  const base = fv(0);
  return { gross, years, monthly: 1, rows: [0, ...fees].map((f) => ({ fee: f, value: Math.round(fv(f)), keep: r3(fv(f) / base) })) };
}

// ---------- 輸出 ----------
const twPxM = monthEnd(twPx.filter((r) => r.date >= twTR[0].date), 'date', 'close');
const twYears = (new Date(twTR.at(-1).date) - new Date(twTR[0].date)) / (365.25 * 864e5);
const usYears = (us.length - 1) / 12;
const evidence = {
  generated: new Date().toISOString().slice(0, 10),
  sources: {
    tw: `台灣加權股價報酬指數(含息)${tw[0].ym}–${tw.at(-1).ym},FinMind / 臺灣證券交易所`,
    us: `S&P 500 收盤 + 每月股息殖利率重建的含息指數 ${us[0].ym}–${us.at(-1).ym},FinMind / multpl.com(Robert Shiller 資料)`,
    cape: 'Shiller CAPE(經景氣循環調整本益比),multpl.com',
  },
  growth: {
    tw: { from: tw[0].ym, to: tw.at(-1).ym, cagr: r4(cagr(twTR[0].price, twTR.at(-1).price, twYears)), priceCagr: r4(cagr(twPxM[0].v, twPxM.at(-1).v, (twPxM.length - 1) / 12)) },
    us: { from: us[0].ym, to: us.at(-1).ym, cagr: r4(cagr(us[0].v, us.at(-1).v, usYears)), priceCagr: r4(cagr(spxM[0].v, spxM.at(-1).v, usYears)) },
  },
  holding: { tw: [1, 3, 5, 10, 15].map((y) => holdStats(tw, y)), us: [1, 3, 5, 10, 15, 20].map((y) => holdStats(us, y)) },
  // 你需要的報酬率,歷史上持有 10 / 20 年達到的比例:網頁用排序好的年化報酬率陣列查
  hit: { tw10: rolling(tw, 10).map(r4).sort((a, b) => a - b), us10: rolling(us, 10).map(r4).sort((a, b) => a - b), us20: rolling(us, 20).map(r4).sort((a, b) => a - b) },
  lumpVsDca: { tw: lumpVsDca(tw), us: lumpVsDca(us) },
  perfectDip: {
    tw: { years: 10, ...dcaVsPerfectDip(tw, 120), late2: dcaVsPerfectDip(tw, 120, 2).dcaWins },
    us: { years: 40, ...dcaVsPerfectDip(us, 480), late2: dcaVsPerfectDip(us, 480, 2).dcaWins },
  },
  missBest: missBest(twDaily),
  years: calendarYears(twDaily),
  cape: capeStudy(),
  drawdown: { tw: afterDrawdown(tw), us: afterDrawdown(us), twBears: bearMarkets(tw), usBears: bearMarkets(us).filter((b) => b.drop <= -0.3) },
  fees: feeDrag(),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(evidence, null, 1)}\n`);
const { hit, years: _y, cape: { yearly: _c, ...capeRest }, ...summary } = evidence;
console.log(JSON.stringify({ ...summary, cape: capeRest, hitSizes: Object.fromEntries(Object.entries(hit).map(([k, a]) => [k, a.length])) }, null, 1));
