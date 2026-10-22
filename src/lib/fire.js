// FIRE 財務規劃計算引擎 —— 純函式、無 DOM 依賴(頁面與測試共用)
// 金額單位:新台幣「萬元」;比率一律以小數表示(2% = 0.02)。
// 時間慣例:基準年 B 為今年,t = 1…n 對應 B+1…Y,每年現金流於年底入帳;FIRE 於第 n 年年底開始。

/** @typedef {{ name: string, principal: number, years: number, rate: number }} Loan */
/** @typedef {{ name: string, monthly: number, startAge: number | null }} Income */
/** @typedef {{ year: number, name: string, amount: number }} Goal */
/**
 * @typedef {Object} Inputs
 * @property {number} baseYear      基準年 B
 * @property {number} fireYear      FIRE 年份 Y
 * @property {number} age           目前年齡 A0
 * @property {number} monthlyExpense 今日每月生活費 C(萬元/月)
 * @property {number} inflation     通膨 i
 * @property {number} swr           安全提領率
 * @property {number} salary        稅後年收入 S(萬元/年)
 * @property {number} salaryGrowth  薪資成長率 g
 * @property {number | null} salaryCap 稅後年收入上限 S_max;null = 不設上限
 * @property {number} assets        目前可投資資產 P0
 * @property {number} emergencyMonths 緊急預備金(月生活費倍數)
 * @property {number} assumedReturn 假設報酬率(用於最早 FIRE 年份)
 * @property {Loan[]} loans
 * @property {Income[]} incomes
 * @property {Goal[]} goals
 */

/** @type {Inputs} 計畫書的範例情境 */
export const DEFAULT_INPUTS = {
  baseYear: 2026,
  fireYear: 2041,
  age: 35,
  monthlyExpense: 6,
  inflation: 0.02,
  swr: 0.04,
  salary: 180,
  salaryGrowth: 0.03,
  salaryCap: null,
  assets: 300,
  emergencyMonths: 6,
  assumedReturn: 0.06,
  loans: [
    { name: '房貸', principal: 800, years: 20, rate: 0.023 },
    { name: '車貸', principal: 50, years: 4, rate: 0.03 },
  ],
  incomes: [
    { name: '勞退月退休金', monthly: 1, startAge: 60 },
    { name: '勞保老年年金', monthly: 2, startAge: 65 },
    { name: '其他被動收入(租金等)', monthly: 0, startAge: null },
  ],
  goals: [
    { year: 2029, name: '換車', amount: 80 },
    { year: 2035, name: '大額支出(例:子女教育)', amount: 100 },
  ],
};

/** 本息平均攤還月付金 */
export function pmt(principal, monthlyRate, months) {
  if (months <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months);
}

/** 繳完 k 期後的剩餘本金 */
export function loanBalance(principal, monthlyRate, months, k) {
  if (months <= 0 || principal <= 0 || k >= months) return 0;
  const a = pmt(principal, monthlyRate, months);
  if (monthlyRate === 0) return principal - a * k;
  const f = (1 + monthlyRate) ** k;
  return principal * f - (a * (f - 1)) / monthlyRate;
}

/** 每筆貸款的月付金、FIRE 時餘額與還清年份 */
export function loanSchedule(loans, n, baseYear) {
  const rows = loans
    .filter((l) => l.principal > 0 && l.years > 0)
    .map((l) => {
      const rm = l.rate / 12;
      const months = Math.round(l.years * 12);
      return {
        name: l.name,
        principal: l.principal,
        years: l.years,
        rate: l.rate,
        months,
        payment: pmt(l.principal, rm, months),
        balanceAtFire: loanBalance(l.principal, rm, months, Math.min(12 * n, months)),
        payoffYear: baseYear + Math.ceil(months / 12),
      };
    });
  return {
    rows,
    monthlyPayment: rows.reduce((s, r) => s + r.payment, 0),
    balanceAtFire: rows.reduce((s, r) => s + r.balanceAtFire, 0),
  };
}

/**
 * 年金與被動收入折算到 FIRE 當年的本金。
 * 晚 k 年才開始領的收入,以 SWR 作為退休後實質折現率折回:Q_F / SWR × (1+SWR)^-k
 */
export function passiveIncomePV(incomes, age, n, inflation, swr) {
  const fireAge = age + n;
  const rows = incomes
    .filter((q) => q.monthly > 0)
    .map((q) => {
      const start = q.startAge == null ? fireAge : q.startAge;
      const delay = Math.max(0, start - fireAge);
      const annualAtFire = 12 * q.monthly * (1 + inflation) ** n;
      return { name: q.name, delay, annualAtFire, pv: (annualAtFire / swr) * (1 + swr) ** -delay };
    });
  return { rows, total: rows.reduce((s, r) => s + r.pv, 0) };
}

/** 逐年可投入金額 A_t(含薪資上限、貸款、一次性財務目標) */
export function annualCashflow(inp) {
  const n = inp.fireYear - inp.baseYear;
  const cap = inp.salaryCap == null ? Infinity : inp.salaryCap;
  const rows = [];
  for (let t = 1; t <= n; t++) {
    const year = inp.baseYear + t;
    const income = Math.min(inp.salary * (1 + inp.salaryGrowth) ** t, cap);
    const expense = 12 * inp.monthlyExpense * (1 + inp.inflation) ** t;
    let loan = 0;
    for (const l of inp.loans) {
      const months = Math.round(l.years * 12);
      if (l.principal > 0 && months > 0 && 12 * t <= months) loan += 12 * pmt(l.principal, l.rate / 12, months);
    }
    const goalToday = inp.goals.filter((g) => g.year === year).reduce((s, g) => s + g.amount, 0);
    const goal = goalToday * (1 + inp.inflation) ** t;
    rows.push({ year, income, expense, loan, goal, invest: income - expense - loan - goal });
  }
  return rows;
}

/** 期末資產:P(1+r)^n + Σ A_t (1+r)^(n-t) */
export function futureValue(start, flows, r) {
  const n = flows.length;
  let v = start * (1 + r) ** n;
  flows.forEach((a, k) => { v += a * (1 + r) ** (n - k - 1); });
  return v;
}

/** 以二分法解出使期末資產 = 目標的報酬率;區間 [-50%, 100%] 內無解回傳 null */
export function solveRate(start, flows, target, lo = -0.5, hi = 1.0) {
  if (flows.length === 0) return null;
  const f = (r) => futureValue(start, flows, r) - target;
  let flo = f(lo);
  const fhi = f(hi);
  if (flo * fhi > 0) return null;
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (flo * fm <= 0) hi = mid;
    else { lo = mid; flo = fm; }
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}

/** 完整試算 */
export function computePlan(inp) {
  const n = inp.fireYear - inp.baseYear;
  const fireAge = inp.age + n;
  const annualToday = 12 * inp.monthlyExpense;
  const annualAtFire = annualToday * (1 + inp.inflation) ** n;
  const baseFund = annualAtFire / inp.swr;
  const income = passiveIncomePV(inp.incomes, inp.age, n, inp.inflation, inp.swr);
  const loans = loanSchedule(inp.loans, n, inp.baseYear);
  const target = baseFund - income.total + loans.balanceAtFire;
  const emergency = inp.emergencyMonths * inp.monthlyExpense;
  const start = inp.assets - emergency;
  const flows = n > 0 ? annualCashflow(inp) : [];
  const A = flows.map((f) => f.invest);

  const rCombined = n > 0 ? solveRate(start, A, target) : null;
  const rLump = n > 0 && start > 0 && target > 0 ? (target / start) ** (1 / n) - 1 : null;
  const rCashflow = n > 0 ? solveRate(0, A, target) : null;

  // 資產軌跡:以併用所需報酬率(無解時用假設報酬率)推算
  const rPath = rCombined ?? inp.assumedReturn;
  const trajectory = [{ year: inp.baseYear, balance: start, principal: start }];
  let bal = start;
  let principal = start;
  for (const f of flows) {
    bal = bal * (1 + rPath) + f.invest;
    principal += f.invest;
    trajectory.push({ year: f.year, balance: bal, principal });
  }

  const monthlyIncome = inp.salary / 12;
  const minFlow = flows.length ? flows.reduce((m, f) => (f.invest < m.invest ? f : m), flows[0]) : null;
  return {
    n,
    fireAge,
    annualToday,
    annualAtFire,
    baseFund,
    income,
    loans,
    target,
    emergency,
    start,
    flows,
    rCombined,
    rLump,
    rCashflow,
    rPath,
    trajectory,
    checks: {
      dti: monthlyIncome > 0 ? loans.monthlyPayment / monthlyIncome : null,
      minFlow,
      negativeYears: flows.filter((f) => f.invest < 0).map((f) => f.year),
    },
  };
}

/** 在假設報酬率下最早可 FIRE 的年份(往後最多找 maxYears 年);找不到回傳 null */
export function earliestFireYear(inp, assumedReturn = inp.assumedReturn, maxYears = 45) {
  for (let y = inp.baseYear + 1; y <= inp.baseYear + maxYears; y++) {
    const r = computePlan({ ...inp, fireYear: y }).rCombined;
    if (r != null && r <= assumedReturn) return y;
  }
  return null;
}

/** 敏感度:變動單一參數,回傳各值下的目標資金與所需報酬率 */
export function sensitivity(inp, key, values) {
  return values.map((v) => {
    const p = computePlan({ ...inp, [key]: v });
    return { value: v, target: p.target, rCombined: p.rCombined, rLump: p.rLump, fireAge: p.fireAge };
  });
}
