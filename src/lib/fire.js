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

/** 預設情境:一鍵切換(年份以基準年為 0 的相對值表示,載入時換算成實際年份) */
export const PRESETS = [
  { id: 'example', label: '單身有房', note: '35 歲、月收 15 萬、房貸 800 萬', inputs: {} },
  {
    id: 'renter', label: '小資租屋', note: '28 歲、月收 6 萬、無貸款',
    inputs: {
      fireYearOffset: 15, age: 28, monthlyExpense: 3.5, salary: 72, salaryGrowth: 0.03, assets: 80,
      loans: [],
      incomes: [
        { name: '勞退月退休金', monthly: 0.6, startAge: 60 },
        { name: '勞保老年年金', monthly: 1.5, startAge: 65 },
      ],
      goals: [],
    },
  },
  {
    id: 'family', label: '雙薪家庭', note: '38 歲、家庭月收 23 萬、房貸 1,200 萬、子女教育',
    inputs: {
      fireYearOffset: 10, age: 38, monthlyExpense: 9, salary: 276, salaryGrowth: 0.025, assets: 600,
      loans: [{ name: '房貸', principal: 1200, years: 25, rate: 0.022 }],
      incomes: [
        { name: '勞退月退休金(兩人)', monthly: 2, startAge: 60 },
        { name: '勞保老年年金(兩人)', monthly: 3.5, startAge: 65 },
      ],
      goals: [{ yearOffset: 8, name: '子女教育', amount: 200 }],
    },
  },
];

/** 以基準年套用預設情境 */
export function presetInputs(id, baseYear) {
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0];
  const shift = baseYear - DEFAULT_INPUTS.baseYear;
  const base = structuredClone({
    ...DEFAULT_INPUTS,
    baseYear,
    fireYear: DEFAULT_INPUTS.fireYear + shift,
    goals: DEFAULT_INPUTS.goals.map((g) => ({ ...g, year: g.year + shift })),
  });
  const { fireYearOffset, goals, ...rest } = structuredClone(preset.inputs);
  const out = { ...base, ...rest };
  if (fireYearOffset != null) out.fireYear = baseYear + fireYearOffset;
  if (goals) out.goals = goals.map((g) => ({ year: baseYear + g.yearOffset, name: g.name, amount: g.amount }));
  return out;
}

/** 簡單版的固定假設與預設每月存款 */
export const SIMPLE = { inflation: 0.02, swr: 0.04, monthlySaving: 5 };

/**
 * 簡單版:只用年齡、退休年齡、每月生活費、目前資產與每月存款(今日幣值,之後隨通膨成長)。
 * 不計貸款、年金、大額支出與緊急預備金;年收入以「生活費 + 存款」表示,與生活費同步成長。
 */
export function simpleInputs(inp, monthlySaving = inp.monthlySaving ?? SIMPLE.monthlySaving) {
  return {
    ...inp,
    inflation: SIMPLE.inflation,
    swr: SIMPLE.swr,
    salary: 12 * (inp.monthlyExpense + monthlySaving),
    salaryGrowth: SIMPLE.inflation,
    salaryCap: null,
    emergencyMonths: 0,
    loans: [],
    incomes: [],
    goals: [],
  };
}

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

/**
 * 以報酬率 r 最早可 FIRE 的年份:退休時存得到的錢 ≥ 撐到 endAge 需要的錢(往後最多找 maxYears 年);
 * 等同「照 r 的資產路徑到 endAge 都不會用完」。找不到回傳 null。
 */
export function earliestFireYear(inp, r = inp.assumedReturn, maxYears = 45, endAge = 95) {
  for (let y = inp.baseYear + 1; y <= inp.baseYear + maxYears && inp.age + y - inp.baseYear < endAge; y++) {
    const x = { ...inp, fireYear: y };
    if (fundAtFire(x, r) >= fundNeeded(x, r, endAge)) return y;
  }
  return null;
}

/**
 * 以報酬率 r 最早多久後可以 FIRE(單位:年,含小數;現在就夠回傳 0,找不到回傳 null)。
 * 模型以年為單位,先找第一個夠用的年份,再用前後兩年的「存得到 − 需要」差額線性內插出月份。
 */
export function earliestFireTime(inp, r = inp.assumedReturn, maxYears = 45, endAge = 95) {
  const gap = (y) => {
    const x = { ...inp, fireYear: y };
    return fundAtFire(x, r) - fundNeeded(x, r, endAge);
  };
  if (gap(inp.baseYear) >= 0) return 0;
  const y = earliestFireYear(inp, r, maxYears, endAge);
  if (y == null) return null;
  const g0 = gap(y - 1);
  const g1 = gap(y);
  return y - 1 - inp.baseYear + (g1 > g0 ? -g0 / (g1 - g0) : 1);
}

/**
 * 一生資產路徑(以報酬率 r 推算,預設為預期報酬率):
 * 工作期:每年 bal = bal × (1+r) + A_t;FIRE 當年年底一次還清貸款餘額。
 * 自由期:每年 bal = bal × (1+r) − (生活費_t − 已開始領取的年金_t),直到 endAge。
 * 回傳逐年資料與錢用完的年齡(未用完為 null)。
 */
export function lifePath(inp, r = inp.assumedReturn, endAge = 95) {
  const n = inp.fireYear - inp.baseYear;
  const fireAge = inp.age + n;
  const flows = n > 0 ? annualCashflow(inp) : [];
  const loans = loanSchedule(inp.loans, Math.max(n, 0), inp.baseYear);
  let bal = inp.assets - inp.emergencyMonths * inp.monthlyExpense;
  const rows = [{ age: inp.age, year: inp.baseYear, balance: bal, phase: 'work' }];
  let depletionAge = null;
  for (let t = 1; inp.age + t <= endAge; t++) {
    const age = inp.age + t;
    if (t <= n) {
      bal = bal * (1 + r) + flows[t - 1].invest;
      if (t === n) bal -= loans.balanceAtFire;
      rows.push({ age, year: inp.baseYear + t, balance: bal, phase: 'work' });
    } else {
      const expense = 12 * inp.monthlyExpense * (1 + inp.inflation) ** t;
      const pension = inp.incomes
        .filter((q) => q.monthly > 0 && age >= (q.startAge == null ? fireAge : q.startAge))
        .reduce((s, q) => s + 12 * q.monthly * (1 + inp.inflation) ** t, 0);
      bal = bal * (1 + r) - (expense - pension);
      if (bal < 0 && depletionAge == null) depletionAge = age;
      rows.push({ age, year: inp.baseYear + t, balance: Math.max(bal, 0), phase: 'free', withdraw: expense - pension });
      if (bal < 0) bal = 0;
    }
  }
  return { rows, fireAge, depletionAge, balanceAtFire: rows.find((x) => x.age === fireAge)?.balance ?? null };
}

/**
 * 退休時(第 n 年底)要準備的錢,拆成三塊:以報酬率 r 折回退休那年的「到 endAge 的生活費」,
 * 減去同樣折回的年金與被動收入(incomes 為各項明細),再加上退休時一次還清的貸款餘額。
 * 每年年底提領「生活費 − 已開始領的年金」,與 lifePath 的退休期算法一致。
 */
export function needBreakdown(inp, r, endAge = 95) {
  const n = inp.fireYear - inp.baseYear;
  const fireAge = inp.age + n;
  const active = inp.incomes.filter((q) => q.monthly > 0);
  const incomes = active.map((q) => ({ name: q.name, pv: 0 }));
  let expenses = 0;
  for (let k = 1; fireAge + k <= endAge; k++) {
    const t = n + k;
    const age = fireAge + k;
    const disc = (1 + r) ** k;
    expenses += (12 * inp.monthlyExpense * (1 + inp.inflation) ** t) / disc;
    active.forEach((q, j) => {
      if (age >= (q.startAge ?? fireAge)) incomes[j].pv += (12 * q.monthly * (1 + inp.inflation) ** t) / disc;
    });
  }
  const pensions = incomes.reduce((s, q) => s + q.pv, 0);
  const loans = loanSchedule(inp.loans, Math.max(n, 0), inp.baseYear).balanceAtFire;
  return { expenses, pensions, loans, incomes, total: expenses - pensions + loans };
}

/** 退休時要有多少錢,才能以報酬率 r 撐到 endAge(含退休時還清的貸款) */
export function fundNeeded(inp, r, endAge = 95) {
  return needBreakdown(inp, r, endAge).total;
}

/** 以報酬率 r 累積到退休時(第 n 年底)的資產:扣緊急預備金後的現有資產 + 每年可投入 */
export function fundAtFire(inp, r) {
  const n = inp.fireYear - inp.baseYear;
  const flows = n > 0 ? annualCashflow(inp).map((f) => f.invest) : [];
  return futureValue(inp.assets - inp.emergencyMonths * inp.monthlyExpense, flows, r);
}

/** 存得到的錢 = 需要的錢 時的報酬率(找 0–50%);0% 就夠回傳 0,50% 都不夠回傳 null */
export function breakEvenReturn(inp, endAge = 95) {
  if (inp.fireYear - inp.baseYear < 1) return null;
  const gap = (r) => fundAtFire(inp, r) - fundNeeded(inp, r, endAge);
  if (gap(0) >= 0) return 0;
  let lo = 0;
  let hi = 0.5;
  if (gap(hi) < 0) return null;
  for (let it = 0; it < 100 && hi - lo > 1e-9; it++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * 什麼最影響退休年齡:每個參數上下調整,比較「最早可 FIRE 年齡」的變化(以預期報酬率計)。
 * 找不到可 FIRE 的年份時以 null 表示。
 */
export function fireAgeDrivers(inp) {
  const ageOf = (x) => { const t = earliestFireTime(x); return t == null ? null : Math.floor(x.age + t); };
  const base = ageOf(inp);
  const spec = [
    { key: 'monthlyExpense', label: '每月生活費 ±1 萬', lo: { monthlyExpense: inp.monthlyExpense - 1 }, hi: { monthlyExpense: inp.monthlyExpense + 1 } },
    { key: 'salary', label: '月收入 ±10%', lo: { salary: inp.salary * 0.9 }, hi: { salary: inp.salary * 1.1 } },
    { key: 'assumedReturn', label: '投資報酬率 ±1%', lo: { assumedReturn: inp.assumedReturn - 0.01 }, hi: { assumedReturn: inp.assumedReturn + 0.01 } },
    { key: 'salaryGrowth', label: '每年加薪 ±1%', lo: { salaryGrowth: inp.salaryGrowth - 0.01 }, hi: { salaryGrowth: inp.salaryGrowth + 0.01 } },
    { key: 'inflation', label: '通膨率 ±0.5%', lo: { inflation: inp.inflation - 0.005 }, hi: { inflation: inp.inflation + 0.005 } },
  ];
  const rows = spec
    .filter((s) => Object.values(s.lo).every((v) => v > 0) || s.key === 'salaryGrowth' || s.key === 'assumedReturn')
    .map((s) => ({ key: s.key, label: s.label, low: ageOf({ ...inp, ...s.lo }), high: ageOf({ ...inp, ...s.hi }) }));
  return { base, rows };
}

/** 敏感度:變動單一參數,回傳各值下的目標資金與所需報酬率 */
export function sensitivity(inp, key, values) {
  return values.map((v) => {
    const p = computePlan({ ...inp, [key]: v });
    return { value: v, target: p.target, rCombined: p.rCombined, rLump: p.rLump, fireAge: p.fireAge };
  });
}
