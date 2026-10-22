// 計算引擎測試:數字對齊《FIRE 財務規劃計畫書》範例情境(由獨立 Python 試算得出)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INPUTS as D, pmt, loanBalance, computePlan, earliestFireYear, solveRate, futureValue,
  lifePath, fireAgeDrivers, presetInputs, PRESETS, simpleInputs, SIMPLE,
  fundNeeded, fundAtFire, breakEvenReturn, needBreakdown, earliestFireTime,
} from '../src/lib/fire.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b} ± ${tol}`);

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
  assert.equal(lifePath({ ...D, fireYear: 2039 }, 0.06).depletionAge, 92, '早一年退休 92 歲用完');
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
  const p = computePlan(D);
  // 以所需報酬率累積,FIRE 時還清貸款後剩下的正好是生活費本金扣年金
  const atReq = lifePath(D, p.rCombined);
  near(atReq.balanceAtFire, p.target - p.loans.balanceAtFire, 0.5, 'FIRE 時資產(還清貸款後)');
  assert.equal(lifePath(D, 0.06).depletionAge, null, '預期 6% 到 95 歲都不會用完');
  assert.equal(lifePath(D, 0.04).depletionAge, 84, '名目 4% 時 84 歲用完');
  assert.equal(lifePath(D, 0.0).depletionAge != null, true, '零報酬會用完');
  assert.equal(lifePath(D).rows.at(-1).age, 95);
});

test('最早多久後可以退休(到月)', () => {
  const t = earliestFireTime(D, 0.06);
  near(t, 13.11, 0.01, '6% 時約 13 年 1 個月後');
  assert.ok(t > 13 && t <= 14, '落在最早年份(第 14 年)之前一年內');
  near(earliestFireTime(D, 0.08), 11.05, 0.01, '8% 時約 11 年');
  near(earliestFireTime(simpleInputs({ ...D, monthlySaving: 5 }), 0.06), 13.36, 0.01, '簡單版');
  assert.equal(earliestFireTime({ ...D, assets: 20000 }, 0.06), 0, '資產已經夠:現在就能退休');
  assert.equal(earliestFireTime(simpleInputs({ ...D, assets: 0, monthlySaving: 0 }), 0.06), null, '永遠不夠');
});

test('需要準備的拆解', () => {
  const b = needBreakdown(D, 0.06);
  near(b.expenses, 2033.37, 1e-2, '到 95 歲的生活費');
  near(b.pensions, 553.20, 1e-2, '年金折抵');
  near(b.loans, 235.67, 1e-2, '退休時貸款餘額');
  near(b.total, b.expenses - b.pensions + b.loans, 1e-9, '合計');
  near(b.incomes.reduce((s, q) => s + q.pv, 0), b.pensions, 1e-9, '各項年金加總');
  near(fundNeeded(D, 0.06), 1715.84, 1e-2, '完整版 6% 時需要');
  near(fundAtFire(D, 0.06), 2273.06, 1e-2, '完整版 6% 時存得到');
  near(breakEvenReturn(D), 0.046, 5e-4, '完整版最低報酬率');
});

test('退休年齡驅動因子', () => {
  const d = fireAgeDrivers(D);
  assert.equal(d.base, 48);
  const exp = d.rows.find((r) => r.key === 'monthlyExpense');
  assert.deepEqual([exp.low, exp.high], [45, 50], '生活費 ±1 萬');
  assert.ok(!d.rows.some((r) => r.key === 'swr'), '不再用提領率');
});

test('簡單版', () => {
  const s = computePlan(simpleInputs({ ...D, monthlySaving: 5 }));
  near(s.target, 2422.563, 1e-2, '只算生活費本金,不扣年金、不加貸款');
  near(s.start, 300, 1e-9, '不扣緊急預備金');
  near(s.flows[0].invest, 60 * 1.02, 1e-9, '第一年存款隨通膨');
  near(s.flows.at(-1).invest, 60 * 1.02 ** 15, 1e-9, '最後一年存款');
  near(s.rCombined, 0.0643, 5e-4, '所需報酬率');
  near(s.trajectory.at(-1).principal, 1358.36, 1e-2, '累計存進的本金');
  assert.equal(simpleInputs(D).salary, 12 * (D.monthlyExpense + SIMPLE.monthlySaving), '未填存款時用預設值');
  assert.equal(computePlan(simpleInputs({ ...D, assets: 0, monthlySaving: 0 })).rCombined, null, '沒資產也不存錢:無解');
  assert.ok(computePlan(simpleInputs({ ...D, assets: 3000 })).rCombined <= 0, '資產已足夠:不需要報酬');
});

test('報酬率與資金互相影響', () => {
  const s = simpleInputs({ ...D, monthlySaving: 5 });
  near(fundNeeded(s, 0.06), 2033.37, 1e-2, '6% 時撐到 95 歲需要');
  near(fundAtFire(s, 0.06), 2326.52, 1e-2, '6% 時 50 歲存得到');
  near(fundNeeded(s, 0.04), 2879.44, 1e-2, '報酬越低,需要越多');
  near(fundAtFire(s, 0.04), 1932.81, 1e-2, '報酬越低,存得越少');
  const be = breakEvenReturn(s);
  near(be, 0.0547, 5e-4, '兩者相等的報酬率');
  near(fundNeeded(s, be), fundAtFire(s, be), 1e-3, '交叉點');
  assert.equal(lifePath(s, be + 0.001).depletionAge, null, '高於交叉點:撐得到 95 歲');
  assert.equal(lifePath(s, be - 0.001).depletionAge, 93, '低於交叉點:提早用完');
  assert.equal(breakEvenReturn(simpleInputs({ ...D, assets: 8000 })), 0, '不靠報酬也夠');
  assert.equal(breakEvenReturn(simpleInputs({ ...D, assets: 0, monthlySaving: 0 })), null, '沒資產也不存錢');
  const full = breakEvenReturn(D);
  assert.equal(lifePath(D, full + 0.001).depletionAge, null, '完整版(含年金、貸款)也與資產路徑一致');
  assert.ok(lifePath(D, full - 0.001).depletionAge != null);
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
