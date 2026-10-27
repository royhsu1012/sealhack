// 計算引擎測試:數字對齊《FIRE 財務規劃計畫書》範例情境(由獨立 Python 試算得出)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INPUTS as D, pmt, loanBalance, computePlan, earliestFireYear, solveRate, futureValue,
  lifePath, fireAgeDrivers, presetInputs, PRESETS,
  fundNeeded, fundAtFire, breakEvenReturn, needBreakdown, earliestFireTime, personaOf, levers, monteCarlo, successRate, earliestFireTimeAt, volatilityOf,
  historyHitRate, saveVsInvest, startLater, annualCashflow, loanYears, loanSchedule, cashPlan,
  netReturn, pensionEstimate, incomesOf, autoPensions, fireTimeScenarios, SCENARIOS,
} from '../src/lib/fire.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b} ± ${tol}`);
// 只看存款的情境:沒有貸款、年金、大額支出與預備金;每月存 s 萬,收入與生活費都隨 2% 通膨成長
const plain = (s, extra = {}) => ({
  ...D, inflation: 0.02, salary: 12 * (D.monthlyExpense + s), salaryGrowth: 0.02, salaryCap: null,
  emergencyMonths: 0, loans: [], incomes: [], goals: [], ...extra,
});

test('貸款月付金與餘額', () => {
  near(pmt(800, 0.023 / 12, 240), 4.1617, 1e-3, '房貸月付金');
  near(loanBalance(800, 0.023 / 12, 240, 180), 235.6665, 1e-3, '房貸 15 年後餘額');
  assert.equal(loanBalance(50, 0.03 / 12, 48, 60), 0, '還清後餘額為 0');
  near(pmt(120, 0, 12), 10, 1e-9, '零利率');
});

test('範例情境:目標資金拆解', () => {
  const p = computePlan(D);
  assert.equal(p.n, 15);
  assert.equal(p.fireAge, 50);
  near(p.annualAtFire, 96.9025, 1e-3, '2041 年年生活費');
  near(p.baseFund, 2422.563, 1e-2, '生活費本金');
  near(p.income.total, 721.1539, 1e-2, '年金折算');
  near(p.loans.balanceAtFire, 235.6665, 1e-3, '貸款餘額');
  near(p.target, 1937.0757, 1e-2, '目標資金');
  near(p.start, 264, 1e-9, '扣緊急預備金後資產');
});

test('範例情境:所需報酬率', () => {
  const p = computePlan(D);
  near(p.rCombined, 0.0401, 5e-4, '併用');
  near(p.rLump, 0.1421, 5e-4, '一次累積');
  near(p.rCashflow, 0.0873, 5e-4, '分期累積');
  near(p.trajectory.at(-1).balance, p.target, 1e-3, '軌跡期末等於目標');
  near(p.trajectory.at(-1).principal, 1436, 1, '累計投入本金');
});

test('範例情境:現金流與檢核', () => {
  const p = computePlan(D);
  near(p.flows[0].invest, 48.7, 0.05, '2027 可投入');
  near(p.flows.at(-1).invest, 133.6, 0.05, '2041 可投入');
  near(p.loans.monthlyPayment, 5.2684, 1e-3, '貸款月付合計');
  near(p.checks.dti, 0.3512, 1e-3, '負債比');
  assert.equal(p.checks.minFlow.year, 2029);
  near(p.checks.minFlow.invest, -27.83, 0.05, '最低年度可投入');
  assert.deepEqual(p.checks.negativeYears, [2029, 2035]);
});

test('最早 FIRE 年份與敏感度', () => {
  // 最早年份 = 存得到 ≥ 撐到 95 歲需要(同一報酬率)
  assert.equal(earliestFireYear(D, 0.06), 2040);
  assert.equal(earliestFireYear(D, 0.08), 2038);
  assert.equal(lifePath({ ...D, fireYear: 2040 }, 0.06).depletionAge, null, '2040 退休撐得到 95 歲');
  assert.equal(lifePath({ ...D, fireYear: 2039 }, 0.06).depletionAge, 89, '早一年退休 89 歲用完');
  near(computePlan({ ...D, fireYear: 2036 }).rCombined, 0.1492, 5e-4, '2036 FIRE');
  near(computePlan({ ...D, salaryCap: 250 }).rCombined, 0.0450, 5e-4, '收入上限 250');
  near(computePlan({ ...D, salaryCap: 200 }).rCombined, 0.0740, 5e-4, '收入上限 200');
  const noPension = computePlan({ ...D, incomes: [] });
  near(noPension.target, 2658.23, 1e-2, '不計年金目標');
  near(noPension.rCombined, 0.0787, 5e-4, '不計年金報酬率');
});

test('邊界情況', () => {
  assert.equal(solveRate(0, [], 100), null, '無現金流');
  assert.equal(solveRate(0, [-10, -10], 100), null, '無解');
  near(futureValue(100, [0, 0], 0.1), 121, 1e-9, '單純複利');
  const zeroYear = computePlan({ ...D, fireYear: D.baseYear });
  assert.equal(zeroYear.rCombined, null);
  assert.equal(computePlan({ ...D, assets: 30 }).rLump, null, '資產不足緊急預備金時一次累積無解');
});

test('一生資產路徑', () => {
  // 資產路徑與「存得到」同一套金流:退休時資產 = 存得到 − 還清的貸款餘額
  const p = computePlan(D);
  near(lifePath(D, 0.06).balanceAtFire, fundAtFire(D, 0.06) - p.loans.balanceAtFire, 1e-6, 'FIRE 時資產(還清貸款後)');
  assert.equal(lifePath(D, 0.06).depletionAge, null, '預期 6% 到 95 歲都不會用完');
  assert.equal(lifePath(D, 0.04).depletionAge, 83, '名目 4% 時 83 歲用完');
  assert.equal(lifePath(D, 0.0).depletionAge != null, true, '零報酬會用完');
  assert.equal(lifePath(D).rows.at(-1).age, 95);
});

test('最早多久後可以退休(到月)', () => {
  const t = earliestFireTime(D, 0.06);
  near(t, 13.18, 0.01, '6% 時約 13 年 2 個月後');
  assert.ok(t > 13 && t <= 14, '落在最早年份(第 14 年)之前一年內');
  near(earliestFireTime(D, 0.08), 11.14, 0.01, '8% 時約 11 年 2 個月');
  near(earliestFireTime(plain(5), 0.06), 13.36, 0.01, '簡單版');
  assert.equal(earliestFireTime({ ...D, assets: 20000 }, 0.06), 0, '資產已經夠:現在就能退休');
  assert.equal(earliestFireTime(plain(0, { assets: 0 }), 0.06), null, '永遠不夠');
});

test('需要準備的拆解', () => {
  const b = needBreakdown(D, 0.06);
  near(b.expenses, 2033.37, 1e-2, '到 95 歲的生活費');
  near(b.pensions, 553.20, 1e-2, '年金折抵');
  near(b.loans, 235.67, 1e-2, '退休時貸款餘額');
  near(b.total, b.expenses - b.pensions + b.loans, 1e-9, '合計');
  near(b.incomes.reduce((s, q) => s + q.pv, 0), b.pensions, 1e-9, '各項年金加總');
  near(fundNeeded(D, 0.06), 1715.84, 1e-2, '完整版 6% 時需要');
  near(fundAtFire(D, 0.06), 2251.00, 1e-2, '完整版 6% 時存得到(預備金與大額支出先留好)');
  near(breakEvenReturn(D), 0.046, 5e-4, '完整版最低報酬率');
});

test('退休年齡驅動因子', () => {
  const d = fireAgeDrivers(D);
  assert.equal(d.base, 48);
  const exp = d.rows.find((r) => r.key === 'monthlyExpense');
  assert.deepEqual([exp.low, exp.high], [46, 50], '生活費 ±1 萬');
  assert.ok(!d.rows.some((r) => r.key === 'swr'), '不再用提領率');
});

test('只看存款的情境', () => {
  const s = computePlan(plain(5));
  near(s.target, 2422.563, 1e-2, '只算生活費本金,不扣年金、不加貸款');
  near(s.start, 300, 1e-9, '不扣緊急預備金');
  near(s.flows[0].invest, 60 * 1.02, 1e-9, '第一年存款隨通膨');
  near(s.flows.at(-1).invest, 60 * 1.02 ** 15, 1e-9, '最後一年存款');
  near(s.rCombined, 0.0643, 5e-4, '所需報酬率');
  near(s.trajectory.at(-1).principal, 1358.36, 1e-2, '累計存進的本金');
  assert.equal(computePlan(plain(0, { assets: 0 })).rCombined, null, '沒資產也不存錢:無解');
  assert.ok(computePlan(plain(5, { assets: 3000 })).rCombined <= 0, '資產已足夠:不需要報酬');
});

test('報酬率與資金互相影響', () => {
  const s = plain(5);
  near(fundNeeded(s, 0.06), 2033.37, 1e-2, '6% 時撐到 95 歲需要');
  near(fundAtFire(s, 0.06), 2326.52, 1e-2, '6% 時 50 歲存得到');
  near(fundNeeded(s, 0.04), 2879.44, 1e-2, '報酬越低,需要越多');
  near(fundAtFire(s, 0.04), 1932.81, 1e-2, '報酬越低,存得越少');
  const be = breakEvenReturn(s);
  near(be, 0.0547, 5e-4, '兩者相等的報酬率');
  near(fundNeeded(s, be), fundAtFire(s, be), 1e-3, '交叉點');
  assert.equal(lifePath(s, be + 0.001).depletionAge, null, '高於交叉點:撐得到 95 歲');
  assert.equal(lifePath(s, be - 0.001).depletionAge, 93, '低於交叉點:提早用完');
  assert.equal(breakEvenReturn(plain(5, { assets: 8000 })), 0, '不靠報酬也夠');
  assert.equal(breakEvenReturn(plain(0, { assets: 0 })), null, '沒資產也不存錢');
  const full = breakEvenReturn(D);
  assert.equal(lifePath(D, full + 0.001).depletionAge, null, '完整版(含年金、貸款)也與資產路徑一致');
  assert.ok(lifePath(D, full - 0.001).depletionAge != null);
});

test('退休人格與想再快一點', () => {
  const p = personaOf(D);
  near(p.savingRate, 0.2629, 1e-3, '第一年存下收入的 26%');
  assert.equal(p.saver, false);
  assert.equal(p.style, 'steady');
  assert.equal(personaOf({ ...D, salary: 300 }).saver, true, '收入高、存得多');
  assert.equal(personaOf({ ...D, assumedReturn: 0.04 }).style, 'safe');
  assert.equal(personaOf({ ...D, assumedReturn: 0.08 }).style, 'bold');
  const l = levers(D, 0.06);
  near(l.base, 13.18, 0.01, '原本 13 年 2 個月');
  const g = Object.fromEntries(l.rows.map((x) => [x.key, x.gain]));
  near(g.saveMore, 0.95, 0.01, '每月多存 1 萬');
  near(g.spendLess, 1.08, 0.01, '每月少花 5 千');
  near(g.returnUp, 1.10, 0.01, '報酬率多 1%');
  assert.ok(Object.values(g).every((v) => v > 0), '都會提早');
});

test('機率範圍(蒙地卡羅)', () => {
  near(volatilityOf(0.04), 0.0625, 1e-9, '保守 4%:波動約 6%');
  near(volatilityOf(0.06), 0.1125, 1e-9, '穩健 6%:波動約 11%');
  assert.equal(volatilityOf(0.15), 0.2, '波動上限 20%');
  const mc = monteCarlo(D, 0.06);
  assert.deepEqual(monteCarlo(D, 0.06).rows, mc.rows, '固定種子:同樣輸入結果一樣');
  const at50 = mc.rows.find((x) => x.age === 50);
  const det50 = lifePath(D, 0.06).rows.find((x) => x.age === 50).balance;
  assert.ok(at50.p10 < at50.p25 && at50.p25 < at50.p50 && at50.p50 < at50.p75 && at50.p75 < at50.p90, '分位數由小到大');
  assert.ok(Math.abs(at50.p50 / det50 - 1) < 0.05, '中位數貼近固定報酬的路徑');
  near(mc.success, 0.779, 0.001, '50 歲退休撐到 95 歲的機率');
  assert.equal(mc.p50Zero, null, '中位數撐得到 95 歲');
  assert.equal(mc.p10Zero, 78, '最差一成的情況 78 歲用完');
  near(earliestFireTimeAt(D, 0.06, 0.5), earliestFireTime(D, 0.06), 0.2, '五成把握 ≈ 固定報酬的最快時間');
  near(earliestFireTimeAt(D, 0.06, 0.9), 16.41, 0.01, '九成把握約 16 年 5 個月');
  monteCarlo({ ...D, age: 20, fireYear: 2050, endAge: 110 }, 0.06);
  near(monteCarlo(D, 0.06).success, mc.success, 1e-12, '先算過更長的期間,結果也一樣');
  const later = [2038, 2040, 2042, 2045].map((y) => successRate({ ...D, fireYear: y }, 0.06));
  assert.ok(later.every((v, i) => i === 0 || v >= later[i - 1]), '越晚退休,撐得住的機率越高');
  assert.ok(successRate(D, 0.06, { sigma: 0.03 }) > mc.success, '波動越小,機率越高');
});

test('預設情境', () => {
  assert.deepEqual(presetInputs('example', 2026), { ...D, goals: D.goals }, '範例情境等於 DEFAULT_INPUTS');
  const shifted = presetInputs('example', 2028);
  assert.equal(shifted.fireYear, 2043);
  assert.equal(shifted.goals[0].year, 2031);
  for (const p of PRESETS) {
    const inp = presetInputs(p.id, 2026);
    assert.ok(computePlan(inp).target > 0, `${p.id} 目標資金為正`);
  }
  const fam = presetInputs('family', 2026);
  assert.equal(fam.goals[0].year, 2034);
});

test('歷史數據對照:持有期間年化報酬率至少 r 的比例', () => {
  const a = [-0.02, 0.01, 0.03, 0.05, 0.08];
  assert.equal(historyHitRate(a, 0.03), 0.6, '3% 以上有 3 / 5');
  assert.equal(historyHitRate(a, -0.5), 1, '門檻很低時全部達到');
  assert.equal(historyHitRate(a, 0.1), 0, '門檻高於最大值時都沒達到');
  assert.equal(historyHitRate([], 0.03), null, '沒有資料');
});

test('預計活到幾歲:預設 95,調高要準備更多、機率更低', () => {
  assert.equal(D.endAge, 95, '預設活到 95 歲');
  near(fundNeeded(D, 0.06), fundNeeded(D, 0.06, 95), 1e-9, '沒有指定時用 inp.endAge');
  const old = { ...D }; delete old.endAge;
  near(fundNeeded(old, 0.06), fundNeeded(D, 0.06), 1e-9, '舊資料沒有 endAge 時當作 95');
  const long = { ...D, endAge: 100 };
  assert.ok(fundNeeded(long, 0.06) > fundNeeded(D, 0.06), '活到 100 歲要準備更多');
  assert.ok(breakEvenReturn(long) > breakEvenReturn(D), '最低報酬率變高');
  assert.ok(earliestFireTime(long, 0.06) > earliestFireTime(D, 0.06), '最快退休時間變晚');
  assert.equal(lifePath(long, 0.06).rows.at(-1).age, 100, '資產路徑畫到 100 歲');
  assert.ok(successRate(long, 0.06) < successRate(D, 0.06), '撐到 100 歲的機率比較低');
  assert.equal(monteCarlo(long, 0.06).rows.at(-1).age, 100, '機率範圍畫到 100 歲');
});

test('存錢 vs 投資:投資賺的追上存進去的那一年', () => {
  const ex = saveVsInvest(D, 0.06);
  assert.equal(ex.rows.length, D.fireYear - D.baseYear, '每個工作年一筆');
  near(ex.rows[0].gain, (D.assets - D.emergencyMonths * D.monthlyExpense) * 0.06, 1e-9, '第一年投資賺的 = 期初資產 × r');
  assert.equal(ex.cross, null, '範例:退休前每年都是存進去的比較多');
  const rich = { ...D, assets: 800 };
  const sv = saveVsInvest(rich, 0.06);
  assert.ok(sv.cross, '資產多時,退休前就會追上');
  const before = sv.rows.filter((x) => x.year < sv.cross.year && x.save > 0);
  assert.ok(before.every((x) => x.gain < x.save), '追上之前,每年都是存進去的比較多');
  const later = saveVsInvest(rich, 0.03).cross;
  assert.ok(!later || later.year > sv.cross.year, '報酬率低,追上得比較晚');
  assert.equal(saveVsInvest({ ...D, fireYear: D.baseYear }, 0.06).rows.length, 0, '已經到退休年份');
});

test('早點開始定期定額:晚幾年才投資會延後多久', () => {
  near(fundAtFire({ ...D, investDelay: 0 }, 0.06), fundAtFire(D, 0.06), 1e-9, '晚 0 年等於馬上投資');
  near(fundAtFire({ ...D, investDelay: 3, cashRate: 0.06 }, 0.06), fundAtFire({ ...D, cashRate: 0.06 }, 0.06), 1e-6, '定存利率跟報酬率一樣時,晚投資沒有差');
  assert.ok(fundAtFire({ ...D, investDelay: 3 }, 0.06) < fundAtFire(D, 0.06), '晚 3 年投資,退休時存得到的比較少');
  const later = startLater(D, 0.06);
  near(later.base, earliestFireTime(D, 0.06), 1e-9, '基準是現在就開始');
  assert.ok(later.rows.every((x, i) => x.lag >= 0 && (i === 0 || x.lag > later.rows[i - 1].lag)), '越晚開始,延後越久');
  assert.ok(later.rows[0].lag < 1 / 12, '晚 1 年:今年存的錢年底才投入,跟每年年底投入幾乎一樣');
  const late = { ...D, investDelay: 3 };
  const lp = lifePath(late, 0.06);
  near(lp.rows.find((x) => x.age === 38).balance, lifePath(late, 0.06).rows[3].balance, 1e-9, '資產路徑含定存');
  assert.ok(lp.rows[2].balance < lifePath(D, 0.06).rows[2].balance, '等待期間資產比較少');
  assert.ok(successRate(late, 0.06) <= successRate(D, 0.06), '晚開始,撐得住的機率不會比較高');
  const lv = levers(late, 0.06);
  assert.ok(lv.rows.find((x) => x.key === 'startNow').gain > 0, '想再快一點:現在就開始定期定額');
  assert.equal(levers(D, 0.06).rows.find((x) => x.key === 'startNow'), undefined, '已經在做就不顯示');
  const young = { ...D, age: 25, fireYear: D.baseYear + 25, assets: 50 };
  const l5 = startLater(young, 0.06, [5]).rows[0].lag;
  assert.ok(l5 > later.rows[2].lag, '離退休越遠、現有資產越少,晚開始的代價越大');
});

test('每月定期定額金額:只投入固定金額,其餘放定存', () => {
  const base = fundAtFire(D, 0.06);
  near(fundAtFire({ ...D, dcaMonthly: 100 }, 0.06), base, 1e-6, '金額比存下的錢多:等於全部投入');
  const small = fundAtFire({ ...D, dcaMonthly: 1 }, 0.06);
  assert.ok(small < base, '每月只投 1 萬,其餘放定存,退休時存得到的比較少');
  near(fundAtFire({ ...D, dcaMonthly: 1, cashRate: 0.06 }, 0.06), fundAtFire({ ...D, cashRate: 0.06 }, 0.06), 1e-6, '定存利率跟報酬率一樣時沒有差');
  const none = fundAtFire({ ...D, dcaMonthly: 0, cashRate: 0 }, 0.06);
  const flows = annualCashflow(D).map((f) => f.invest);
  const start = D.assets - D.emergencyMonths * D.monthlyExpense;
  const cp = cashPlan({ ...D, dcaMonthly: 0, cashRate: 0 });
  near(none, start * 1.06 ** flows.length + flows.reduce((s, a) => s + a, 0) - (cp.reserveEnd - cp.reserveStart), 1e-6, '完全不投入、定存 0%:存款原封不動(扣掉補進預備金的錢)');
  assert.ok(earliestFireTime({ ...D, dcaMonthly: 1 }, 0.06) > earliestFireTime(D, 0.06), '投得少,退休得晚');
  assert.ok(levers({ ...D, dcaMonthly: 1 }, 0.06).rows.find((x) => x.key === 'startNow').gain > 0, '想再快一點:存下的全部投入');
});

test('貸款逐年還款表:本息攤還、最後不滿一年、寬限期', () => {
  const home = { principal: 800, years: 20, rate: 0.023 };
  const ys = loanYears(home);
  assert.equal(ys.length, 20, '20 年 = 20 列');
  near(ys[0].payment, 12 * pmt(800, 0.023 / 12, 240), 1e-6, '每年繳 12 期');
  near(ys[14].balance, loanBalance(800, 0.023 / 12, 240, 180), 1e-6, '第 15 年底餘額與公式一致');
  near(ys.reduce((s, y) => s + y.principal, 0), 800, 1e-6, '本金全部還清');
  assert.ok(ys[0].interest > ys[19].interest, '前期利息多、後期少');
  const odd = loanYears({ principal: 100, years: 7.5, rate: 0.03 });
  assert.equal(odd.length, 8, '7.5 年 = 8 列');
  assert.equal(odd[7].months, 6, '最後一年只繳 6 個月');
  near(annualCashflow({ ...D, loans: [{ name: 'x', principal: 100, years: 7.5, rate: 0.03 }] })[7].loan, odd[7].payment, 1e-9, '現金流照實際月數扣');
  const grace = loanYears({ principal: 800, years: 30, rate: 0.023, grace: 3 });
  near(grace[0].payment, grace[0].interest, 1e-9, '寬限期只繳利息');
  near(grace[2].balance, 800, 1e-9, '寬限期內本金不變');
  assert.ok(grace[3].payment > loanYears({ principal: 800, years: 30, rate: 0.023 })[3].payment, '寬限期後月付比較高');
  const sch = loanSchedule([{ name: '房貸', principal: 800, years: 30, rate: 0.023, grace: 3 }], 10, 2026).rows[0];
  near(sch.payment, 800 * 0.023 / 12, 1e-6, '現在的月付 = 利息');
  near(sch.balanceAtFire, grace[9].balance, 1e-9, '退休時餘額取逐年表');
  assert.equal(sch.payoffYear, 2056, '30 年後還清');
});

test('每年的錢怎麼分:預備金、大額支出準備金、定期定額', () => {
  const p = cashPlan(D);
  near(p.reserveStart, D.emergencyMonths * D.monthlyExpense, 1e-9, '現有存款先撥 6 個月預備金');
  assert.ok(p.reserveEnd > p.reserveStart, '預備金隨生活費(通膨)調高');
  const car = D.goals.find((g) => g.name === '換車');
  const t = car.year - D.baseYear;
  const amount = car.amount * (1 + D.inflation) ** t;
  near(p.rows.slice(t - 3, t).reduce((s, r) => s + r.goalSave, 0), amount, 1e-6, '換車的錢在前 3 年平均存好');
  assert.ok(p.rows.every((r) => Math.abs(r.income - r.expense - r.loan - r.reserve - r.goalSave - r.invest - r.toCash) < 1e-6), '收入 = 生活費 + 貸款 + 預備金 + 準備金 + 投資 + 定存(大額支出從準備金付)');
  const poor = cashPlan({ ...D, assets: 10 });
  near(poor.reserveStart, 10, 1e-9, '存款不夠預備金:全部先當預備金');
  near(poor.investStart, 0, 1e-9, '投資部位從 0 開始');
  assert.ok(poor.rows[0].reserve > 0, '第一年先補預備金');
  const deficit = cashPlan({ ...D, salary: 60 });
  assert.ok(deficit.rows[0].short > 0, '收入不夠生活費:記為短缺,從投資部位拿');
});

// 網站的保守預設(shared.js 的 SITE_DEFAULTS):加薪 2%、費用與稅 0.5%、勞保勞退依收入與年資估算
const site = (base = presetInputs('example', 2026)) => {
  const inp = { ...base, salaryGrowth: 0.02, costRate: 0.005 };
  inp.incomes = [...autoPensions(inp), ...inp.incomes.filter((q) => !['勞退月退休金', '勞保老年年金'].includes(q.name))];
  return inp;
};

test('費用與稅:報酬率先扣 c 再複利', () => {
  const inp = { ...D, costRate: 0.005 };
  assert.equal(netReturn(inp, 0.06), 0.055);
  assert.equal(netReturn(D, 0.06), 0.06, '沒設 costRate 就不扣');
  near(fundAtFire(inp, 0.06), fundAtFire(D, 0.055), 1e-9, '存得到 = 用 r − c 算');
  near(fundNeeded(inp, 0.06), fundNeeded(D, 0.055), 1e-9, '需要準備 = 用 r − c 折現');
  assert.ok(breakEvenReturn(inp) > breakEvenReturn(D), '扣費用後最低報酬率變高');
});

test('勞保、勞退依收入與年資估算', () => {
  const inp = site();
  // 月收 15 萬、50 歲退休:勞保年資 25 年(投保上限 4.58 萬)、勞退提繳 25 年、1% 滾到 60 歲
  const est = pensionEstimate(inp);
  near(est['勞保老年年金'].monthly, 1.77, 1e-9, '勞保 = 4.58 × 25 × 1.55%');
  assert.equal(est['勞保老年年金'].startAge, 65);
  near(est['勞退月退休金'].monthly, 1.17, 1e-9, '勞退 = 專戶 ÷ 288');
  assert.equal(est['勞退月退休金'].startAge, 60);
  // 退休越早,年資越短、領得越少;年資未滿 15 年不能領勞保年金
  const early = pensionEstimate({ ...inp, fireYear: inp.baseYear + 4 });
  assert.equal(early['勞保老年年金'].monthly, 0, '39 歲退休:勞保年資 14 年');
  assert.ok(early['勞退月退休金'].monthly < est['勞退月退休金'].monthly);
  // auto 的年金跟著退休年份重算,自己填的不動
  const moved = incomesOf({ ...inp, fireYear: inp.baseYear + 4, incomes: [...inp.incomes, { name: '租金', monthly: 1, startAge: null }] });
  assert.equal(moved.find((q) => q.name === '勞保老年年金').monthly, 0);
  assert.equal(moved.find((q) => q.name === '租金').monthly, 1);
});

test('三種情況:樂觀 ≤ 中性 ≤ 悲觀,悲觀 = 九成把握', () => {
  const inp = site();
  const sc = fireTimeScenarios(inp, 0.06);
  assert.deepEqual(SCENARIOS.map((x) => x.confidence), [0.1, 0.5, 0.9]);
  assert.ok(sc.good < sc.mid && sc.mid < sc.bad, `${sc.good} < ${sc.mid} < ${sc.bad}`);
  near(sc.bad, earliestFireTimeAt(inp, 0.06, 0.9), 1e-9, '悲觀 = 九成把握');
  near(sc.mid, earliestFireTime(inp, 0.06), 0.5, '中性 ≈ 每年報酬剛好 r − c');
  // 範例情境(保守預設)的數字:樂觀約 47 歲、中性約 49 歲、悲觀約 53 歲
  near(sc.good, 12.03, 0.01, '樂觀');
  near(sc.mid, 14.85, 0.01, '中性');
  near(sc.bad, 18.30, 0.01, '悲觀');
  near(successRate(inp, 0.06), 0.523, 1e-9, '50 歲退休撐到 95 歲的機率');
  near(fundNeeded(inp, 0.06), 1818, 1, '需要準備');
  near(fundAtFire(inp, 0.06), 1811, 1, '存得到');
  const mc = monteCarlo(inp, 0.06);
  assert.equal(mc.p10Zero, 64, '悲觀 64 歲用完');
  assert.equal(mc.p50Zero, null, '中性撐到 95 歲');
  assert.equal(mc.p90Zero, null, '樂觀撐到 95 歲');
});

test('想再快一點與影響因素:用九成把握重算', () => {
  const inp = site();
  const L = levers(inp, 0.06, 95, 0.9);
  near(L.base, earliestFireTimeAt(inp, 0.06, 0.9), 1e-9, '基準 = 九成把握');
  for (const x of L.rows) assert.ok(x.gain > 0, `${x.key} 要能提早`);
  const save = L.rows.find((x) => x.key === 'saveMore');
  near(save.t, L.base - save.gain, 1e-9, 'gain = 原本 − 調整後');
  const d = fireAgeDrivers({ ...inp, assumedReturn: 0.06 }, 0.9);
  assert.equal(d.base, 53, '目前最快 53 歲');
});
