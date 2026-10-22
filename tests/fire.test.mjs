// 計算引擎測試:數字對齊《FIRE 財務規劃計畫書》範例情境(由獨立 Python 試算得出)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INPUTS as D, pmt, loanBalance, computePlan, earliestFireYear, solveRate, futureValue,
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
  assert.equal(earliestFireYear(D, 0.06), 2040);
  assert.equal(earliestFireYear(D, 0.08), 2039);
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
