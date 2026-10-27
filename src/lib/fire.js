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
 * @property {number} [endAge]    預計活到幾歲:退休後的生活費算到這一年(未設定 = 95)
 * @property {number} [investDelay] 每年存下的錢晚幾年才開始投資(未設定 = 0,馬上投入)
 * @property {number | null} [dcaMonthly] 每月定期定額金額(萬);null = 每月存下的錢全部投入
 * @property {number} [cashRate]  沒投入的錢放定存的利率(未設定 = CASH_RATE)
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
  endAge: 95,
  investDelay: 0,
  dcaMonthly: null,
  cashRate: 0.015,
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
    { year: 2035, name: '小孩教育', amount: 100 },
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
/** 預計活到幾歲(舊的儲存資料沒有這個欄位時用 95) */
export const endAgeOf = (inp) => inp.endAge ?? 95;

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
/**
 * 一筆貸款的逐年還款表:按月本息平均攤還;寬限期(l.grace 年)內只繳利息,之後在剩下的期數攤還。
 * 回傳 [{ t, months, payment, interest, principal, balance }]:t = 從今年起第幾年,balance = 那年年底的剩餘本金;
 * 最後一年不滿 12 個月時只算實際繳的月數。
 */
const loanCache = new Map();
export function loanYears(l) {
  const months = Math.round(l.years * 12);
  if (!(l.principal > 0) || months <= 0) return [];
  const key = `${l.principal}|${months}|${l.rate}|${l.grace ?? 0}`;
  if (loanCache.has(key)) return loanCache.get(key);
  const rm = l.rate / 12;
  const gm = Math.min(Math.max(0, Math.round((l.grace ?? 0) * 12)), months - 1);
  const pay = pmt(l.principal, rm, months - gm);
  const rows = [];
  let bal = l.principal, yr = { payment: 0, interest: 0, principal: 0, months: 0 };
  for (let m = 1; m <= months; m++) {
    const interest = bal * rm;
    const payment = m <= gm ? interest : Math.min(pay, bal + interest);
    bal = Math.max(0, bal - (payment - interest));
    yr.payment += payment; yr.interest += interest; yr.principal += payment - interest; yr.months += 1;
    if (m % 12 === 0 || m === months) {
      rows.push({ t: rows.length + 1, ...yr, balance: m === months ? 0 : bal });
      yr = { payment: 0, interest: 0, principal: 0, months: 0 };
    }
  }
  if (loanCache.size > 200) loanCache.clear();
  loanCache.set(key, rows);
  return rows;
}

export function loanSchedule(loans, n, baseYear) {
  const rows = loans
    .filter((l) => l.principal > 0 && l.years > 0)
    .map((l) => {
      const years = loanYears(l);
      const months = Math.round(l.years * 12);
      const graceMonths = Math.min(Math.round((l.grace ?? 0) * 12), months - 1);
      return {
        name: l.name,
        principal: l.principal,
        years: l.years,
        rate: l.rate,
        grace: l.grace ?? 0,
        months,
        // 現在的月付(寬限期內只繳利息)與寬限期後的月付
        payment: years[0].payment / years[0].months,
        paymentAfterGrace: pmt(l.principal, l.rate / 12, months - graceMonths),
        totalInterest: years.reduce((sum, y) => sum + y.interest, 0),
        // 退休那年一次還清時,實際只繳到退休前的利息
        interestToFire: years.slice(0, Math.max(n, 0)).reduce((sum, y) => sum + y.interest, 0),
        schedule: years,
        balanceAtFire: n <= 0 ? l.principal : n >= years.length ? 0 : years[n - 1].balance,
        payoffYear: baseYear + years.length,
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
    // 每筆貸款當年實際繳的錢(寬限期只繳利息;最後一年不滿 12 個月照實際月數)
    let loan = 0;
    for (const l of inp.loans) loan += loanYears(l)[t - 1]?.payment ?? 0;
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
export function earliestFireYear(inp, r = inp.assumedReturn, maxYears = 45, endAge = endAgeOf(inp)) {
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
export function earliestFireTime(inp, r = inp.assumedReturn, maxYears = 45, endAge = endAgeOf(inp)) {
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
export function lifePath(inp, r = inp.assumedReturn, endAge = endAgeOf(inp)) {
  const n = inp.fireYear - inp.baseYear;
  const fireAge = inp.age + n;
  const flows = cashPlan(inp);
  const loans = loanSchedule(inp.loans, Math.max(n, 0), inp.baseYear);
  let bal = flows.investStart;
  const rows = [{ age: inp.age, year: inp.baseYear, balance: bal, phase: 'work' }];
  let depletionAge = null;
  for (let t = 1; inp.age + t <= endAge; t++) {
    const age = inp.age + t;
    if (t <= n) {
      bal = bal * (1 + r) + flows.invest[t - 1];
      if (t === n) bal -= loans.balanceAtFire;
      rows.push({ age, year: inp.baseYear + t, balance: bal + flows.cash[t - 1], phase: 'work' });
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
export function needBreakdown(inp, r, endAge = endAgeOf(inp)) {
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
export function fundNeeded(inp, r, endAge = endAgeOf(inp)) {
  return needBreakdown(inp, r, endAge).total;
}

/** 以報酬率 r 累積到退休時(第 n 年底)的資產:扣緊急預備金後的現有資產 + 每年可投入 */
export function fundAtFire(inp, r) {
  const plan = cashPlan(inp);
  return futureValue(plan.investStart, plan.invest, r);
}

/**
 * 每年的錢怎麼分(工作期第 1…n 年),所有「存得到多少」的計算都從這裡來。
 * 收入 − 生活費 − 貸款(逐年還款表)= 可支配,依序:
 *   1. 緊急預備金補到目標(月生活費 × 月數,隨通膨調高),放定存,不拿去投資;
 *   2. 大額支出的準備金:每筆在支出前 3 年(不足 3 年就從明年起)平均存進定存,支出那年從準備金付;
 *   3. 其餘照第 10 題定期定額(晚 d 年才開始、每月上限 dcaMonthly),沒投入的放定存。
 * 錢不夠(可支配為負,或大額支出超過準備金)時先用定存,再從投資部位拿;預備金不動。
 * 起點:現有存款先撥給預備金(最多到目標),其餘是投資部位;退休那年定存與準備金併入投資部位,預備金照樣保留。
 * 回傳 { investStart, invest[], cash[](每年底定存 + 準備金), rows[](每年的分配明細), reserveStart, reserveEnd }。
 */
export function cashPlan(inp) {
  const n = Math.max(0, inp.fireYear - inp.baseYear);
  const c = inp.cashRate ?? CASH_RATE;
  const months = inp.emergencyMonths ?? 0;
  const d = Math.max(0, Math.round(inp.investDelay ?? 0));
  const cap = inp.dcaMonthly == null ? Infinity : Math.max(0, 12 * inp.dcaMonthly);
  const salaryCap = inp.salaryCap == null ? Infinity : inp.salaryCap;
  const reserveStart = Math.min(Math.max(inp.assets, 0), months * inp.monthlyExpense);
  // 大額支出:今日幣值換成當年金額,分 3 年先存
  const deposit = new Array(n + 1).fill(0), due = new Array(n + 1).fill(0);
  for (const g of inp.goals) {
    const t = g.year - inp.baseYear;
    if (t < 1 || t > n || !(g.amount > 0)) continue;
    const amount = g.amount * (1 + inp.inflation) ** t, k = Math.min(3, t);
    for (let u = t - k + 1; u <= t; u++) deposit[u] += amount / k;
    due[t] += amount;
  }
  let reserve = reserveStart, cash = 0, sink = 0;
  const invest = [], cashEnd = [], rows = [];
  for (let t = 1; t <= n; t++) {
    const income = Math.min(inp.salary * (1 + inp.salaryGrowth) ** t, salaryCap);
    const expense = 12 * inp.monthlyExpense * (1 + inp.inflation) ** t;
    const loan = inp.loans.reduce((sum, l) => sum + (loanYears(l)[t - 1]?.payment ?? 0), 0);
    reserve *= 1 + c; cash *= 1 + c; sink *= 1 + c;
    let free = income - expense - loan;
    // 1. 緊急預備金
    const toReserve = free > 0 ? Math.min(free, Math.max(0, months * inp.monthlyExpense * (1 + inp.inflation) ** t - reserve)) : 0;
    reserve += toReserve; free -= toReserve;
    // 2. 大額支出準備金;支出那年先從準備金付,不夠的從今年的錢付
    const toSink = free > 0 ? Math.min(free, deposit[t]) : 0;
    sink += toSink; free -= toSink;
    const fromSink = Math.min(sink, due[t]);
    sink -= fromSink; free -= due[t] - fromSink;
    // 3. 定期定額;錢不夠時先用定存,再從投資部位拿
    let inv;
    if (free >= 0) {
      const avail = cash + free;
      inv = t < d ? 0 : Math.min(avail, cap);
      cash = avail - inv;
    } else {
      const fromCash = Math.min(cash, -free);
      cash -= fromCash;
      inv = free + fromCash;
    }
    const toCash = free >= 0 ? free - Math.max(0, Math.min(inv, free)) : 0;
    rows.push({
      year: inp.baseYear + t, income, expense, loan, reserve: toReserve, goalSave: toSink, goalPay: due[t],
      invest: Math.max(0, Math.min(inv, Math.max(free, 0))), toCash, short: free < 0 ? -free : 0,
      reserveBal: reserve, cashBal: cash + sink,
    });
    if (t === n) { inv += cash + sink; cash = 0; sink = 0; }
    invest.push(inv); cashEnd.push(cash + sink);
  }
  return { investStart: inp.assets - reserveStart, invest, cash: cashEnd, rows, reserveStart, reserveEnd: reserve };
}

/** 定存利率:晚點開始投資時,等待期間存款的利率 */
export const CASH_RATE = 0.015;

/**
 * 早點開始定期定額差多少:每年存下的錢晚 d 年才開始投資(之前放定存),最快退休時間會延後多久。
 * 回傳 { base, rows: [{ delay, t, lag }] },t 與 base 是距今幾年(含小數),lag = t − base。
 */
export function startLater(inp, r = inp.assumedReturn, delays = [1, 3, 5], endAge = endAgeOf(inp)) {
  const base = earliestFireTime(inp, r, 45, endAge);
  return {
    base,
    rows: delays.map((delay) => {
      const t = earliestFireTime({ ...inp, investDelay: delay }, r, 45, endAge);
      return { delay, t, lag: base != null && t != null ? t - base : null };
    }),
  };
}

/** 存得到的錢 = 需要的錢 時的報酬率(找 0–50%);0% 就夠回傳 0,50% 都不夠回傳 null */
export function breakEvenReturn(inp, endAge = endAgeOf(inp)) {
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
    { key: 'assumedReturn', label: '報酬率 ±1%', lo: { assumedReturn: inp.assumedReturn - 0.01 }, hi: { assumedReturn: inp.assumedReturn + 0.01 } },
    { key: 'salaryGrowth', label: '每年加薪 ±1%', lo: { salaryGrowth: inp.salaryGrowth - 0.01 }, hi: { salaryGrowth: inp.salaryGrowth + 0.01 } },
    { key: 'inflation', label: '通膨率 ±0.5%', lo: { inflation: inp.inflation - 0.005 }, hi: { inflation: inp.inflation + 0.005 } },
  ];
  const rows = spec
    .filter((s) => Object.values(s.lo).every((v) => v > 0) || s.key === 'salaryGrowth' || s.key === 'assumedReturn')
    .map((s) => ({ key: s.key, label: s.label, low: ageOf({ ...inp, ...s.lo }), high: ageOf({ ...inp, ...s.hi }) }));
  return { base, rows };
}

/**
 * 退休人格的兩個軸:存錢力(第一年存下的錢 ÷ 當年收入,≥ 30% 算存很多)× 投資風格(報酬率 < 5% 保守、< 7% 穩健、其餘積極)。
 */
export function personaOf(inp) {
  const first = annualCashflow({ ...inp, fireYear: Math.max(inp.fireYear, inp.baseYear + 1) })[0];
  const savingRate = first && first.income > 0 ? first.invest / first.income : 0;
  const style = inp.assumedReturn < 0.05 ? 'safe' : inp.assumedReturn < 0.07 ? 'steady' : 'bold';
  return { savingRate, saver: savingRate >= 0.3, style };
}

/**
 * 想再快一點:每月多存 1 萬、每月少花 5 千、報酬率多 1%,各自讓「最早多久後能退休」提早幾年(含小數)。
 * base 為原本的時間;任一方無解時 gain 為 null。
 */
export function levers(inp, r = inp.assumedReturn, endAge = endAgeOf(inp)) {
  const base = earliestFireTime(inp, r, 45, endAge);
  const cases = [
    ['saveMore', { ...inp, salary: inp.salary + 12 }, r],
    ['spendLess', { ...inp, monthlyExpense: Math.max(0, inp.monthlyExpense - 0.5) }, r],
    ['returnUp', inp, r + 0.01],
    ...((inp.investDelay ?? 0) > 0 || inp.dcaMonthly != null ? [['startNow', { ...inp, investDelay: 0, dcaMonthly: null }, r]] : []),
  ];
  return {
    base,
    rows: cases.map(([key, x, rr]) => {
      const t = earliestFireTime(x, rr, 45, endAge);
      return { key, t, gain: base != null && t != null ? base - t : null };
    }),
  };
}

// ---------- 機率範圍(蒙地卡羅) ----------
// 每年報酬率隨機:ln(1 + R) ~ 常態,中位數 = 選的報酬率 r,波動依 r 估計;通膨固定。
// 固定種子 → 同樣的輸入每次結果一樣,拉滑桿時數字不會跳動;所有年份共用同一組亂數,比較不同退休年齡才公平。
export const MC = { paths: 1000, seed: 20261023, years: 100 };

/** 報酬率的年波動(標準差):σ = 2.5 × (r − 1.5%),介於 3%–20%(保守約 6%、穩健約 11%、積極約 16%) */
export function volatilityOf(r) {
  return Math.min(0.2, Math.max(0.03, 2.5 * (r - 0.015)));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let shockCache = null;
/**
 * 標準常態亂數表:paths 條路徑 × 固定 MC.years 年(Box–Muller,快取重用)。
 * 每條路徑的長度固定,不隨「預計活到幾歲」改變,所以同樣的輸入不論先算過什麼,結果都一樣。
 */
function shocks(paths, years) {
  if (shockCache && shockCache.paths >= paths && shockCache.years >= years) return shockCache;
  years = Math.max(years, MC.years);
  const rnd = mulberry32(MC.seed);
  const z = new Float64Array(paths * years);
  for (let i = 0; i < z.length; i += 2) {
    const m = Math.sqrt(-2 * Math.log(1 - rnd())), v = 2 * Math.PI * rnd();
    z[i] = m * Math.cos(v);
    if (i + 1 < z.length) z[i + 1] = m * Math.sin(v);
  }
  shockCache = { paths, years, z };
  return shockCache;
}

let growthCache = null;
/** 每條路徑每年的成長倍數 exp(μ + s·z);同一個報酬率在一次畫面更新裡會重複用到,快取起來 */
function growth(r, sigma, paths, years) {
  if (growthCache && growthCache.r === r && growthCache.sigma === sigma && growthCache.paths >= paths && growthCache.years >= years) return growthCache;
  const { z, years: stride } = shocks(paths, years);
  const mu = Math.log(1 + r), s = sigma / (1 + r);
  const g = new Float64Array(z.length);
  for (let i = 0; i < z.length; i++) g[i] = Math.exp(mu + s * z[i]);
  growthCache = { r, sigma, paths: shockCache.paths, years: stride, g };
  return growthCache;
}

/**
 * 模擬 paths 條一生資產路徑(算法同 lifePath,只是每年報酬率隨機)。
 * 回傳 balances[t][p](第 t 年底、第 p 條路徑,用完後為 0;keep = false 時不存)、每條路徑幾歲用完(0 = 撐到 endAge)。
 */
function simulate(inp, r, sigma, endAge, paths, keep = true) {
  const n = inp.fireYear - inp.baseYear;
  const T = endAge - inp.age;
  if (n < 0 || T < 1) return null;
  const { invest: flows, cash, investStart } = cashPlan(inp);
  const loanAtFire = loanSchedule(inp.loans, n, inp.baseYear).balanceAtFire;
  const fireAge = inp.age + n;
  const withdraw = new Float64Array(T + 1);
  for (let t = n + 1; t <= T; t++) {
    const age = inp.age + t;
    const expense = 12 * inp.monthlyExpense * (1 + inp.inflation) ** t;
    const pension = inp.incomes
      .filter((q) => q.monthly > 0 && age >= (q.startAge ?? fireAge))
      .reduce((s, q) => s + 12 * q.monthly * (1 + inp.inflation) ** t, 0);
    withdraw[t] = expense - pension;
  }
  const { g: G, years: stride } = growth(r, sigma, paths, Math.max(T, 80));
  const start = investStart - (n === 0 ? loanAtFire : 0);
  const balances = keep ? Array.from({ length: T + 1 }, () => new Float64Array(paths)) : null;
  const depletedAt = new Int16Array(paths);
  for (let p = 0; p < paths; p++) {
    let bal = start;
    if (keep) balances[0][p] = bal;
    for (let t = 1; t <= T; t++) {
      const g = G[p * stride + t - 1];
      if (t <= n) {
        bal = bal * g + flows[t - 1];
        if (t === n) bal -= loanAtFire;
      } else {
        bal = bal * g - withdraw[t];
        if (bal < 0) {
          if (!depletedAt[p]) depletedAt[p] = inp.age + t;
          bal = 0;
        }
      }
      if (keep) balances[t][p] = t <= n ? bal + cash[t - 1] : bal;
    }
  }
  return { balances, depletedAt, T, fireAge };
}

/** 在理想退休年齡(fireYear)退休、撐到 endAge 的機率 */
export function successRate(inp, r = inp.assumedReturn, opts = {}) {
  const { paths = MC.paths, sigma = volatilityOf(r), endAge = endAgeOf(inp) } = opts;
  const sim = simulate(inp, r, sigma, endAge, paths, false);
  if (!sim) return null;
  let ok = 0;
  for (let p = 0; p < paths; p++) if (!sim.depletedAt[p]) ok++;
  return ok / paths;
}

/**
 * 一生資產的機率範圍:每一歲的 P10 / P25 / P50(中位數)/ P75 / P90,以及撐到 endAge 的機率。
 * 退休那年的值是還清貸款之後。
 */
export function monteCarlo(inp, r = inp.assumedReturn, opts = {}) {
  const { paths = MC.paths, sigma = volatilityOf(r), endAge = endAgeOf(inp) } = opts;
  const sim = simulate(inp, r, sigma, endAge, paths);
  if (!sim) return null;
  const q = (arr, k) => arr[Math.min(arr.length - 1, Math.floor(k * (arr.length - 1)))];
  const rows = sim.balances.map((col, t) => {
    const v = Float64Array.from(col).sort();
    return { age: inp.age + t, year: inp.baseYear + t, p10: q(v, 0.1), p25: q(v, 0.25), p50: q(v, 0.5), p75: q(v, 0.75), p90: q(v, 0.9) };
  });
  let ok = 0;
  for (let p = 0; p < paths; p++) if (!sim.depletedAt[p]) ok++;
  const firstZero = (key) => rows.find((x) => x.age > sim.fireAge && x[key] <= 0)?.age ?? null;
  return { rows, fireAge: sim.fireAge, sigma, success: ok / paths, p10Zero: firstZero('p10'), p50Zero: firstZero('p50') };
}

/**
 * 有 confidence 把握(撐到 endAge 的機率 ≥ confidence)的最快退休時間(年,含小數;找不到回傳 null)。
 * 越晚退休機率越高(同一組亂數),所以用二分法找第一個夠的年份,再用前後兩年的機率線性內插出月份。
 */
export function earliestFireTimeAt(inp, r = inp.assumedReturn, confidence = 0.9, opts = {}) {
  const { maxYears = 45, endAge = endAgeOf(inp) } = opts;
  const memo = new Map();
  const rate = (y) => {
    if (!memo.has(y)) memo.set(y, successRate({ ...inp, fireYear: y }, r, opts) ?? 0);
    return memo.get(y);
  };
  let lo = inp.baseYear;
  let hi = Math.min(inp.baseYear + maxYears, inp.baseYear + endAge - inp.age - 1);
  if (rate(lo) >= confidence) return 0;
  if (hi <= lo || rate(hi) < confidence) return null;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rate(mid) >= confidence) hi = mid;
    else lo = mid;
  }
  const p0 = rate(hi - 1), p1 = rate(hi);
  return hi - 1 - inp.baseYear + (p1 > p0 ? (confidence - p0) / (p1 - p0) : 1);
}

/** 敏感度:變動單一參數,回傳各值下的目標資金與所需報酬率 */
export function sensitivity(inp, key, values) {
  return values.map((v) => {
    const p = computePlan({ ...inp, [key]: v });
    return { value: v, target: p.target, rCombined: p.rCombined, rLump: p.rLump, fireAge: p.fireAge };
  });
}

/**
 * 存錢 vs 投資(《持續買進》的觀點):工作期每年「存進去的錢」和「投資預期賺的錢」(上一年底資產 × r)。
 * cross = 投資賺的第一次追上存進去的那一年(跳過存款為負的年份);退休前都沒追上回傳 null。
 */
export function saveVsInvest(inp, r = inp.assumedReturn) {
  const n = inp.fireYear - inp.baseYear;
  if (n < 1) return { rows: [], cross: null };
  const path = lifePath(inp, r);
  const rows = annualCashflow(inp).map((f, i) => ({
    year: f.year, age: inp.age + i + 1, save: f.invest, gain: Math.max(path.rows[i].balance, 0) * r,
  }));
  const hit = rows.find((x) => x.save > 0 && x.gain >= x.save);
  return { rows, cross: hit ? { year: hit.year, age: hit.age } : null };
}

// ---------- 歷史數據對照(投資方法頁) ----------
/**
 * 歷史上持有一段期間、年化報酬率至少 r 的比例。
 * sorted = 由小到大排好的歷史年化報酬率(src/data/evidence.json 的 hit.*,由 scripts/evidence.mjs 產生)。
 */
export function historyHitRate(sorted, r) {
  if (!sorted.length) return null;
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < r) lo = mid + 1; else hi = mid; }
  return (sorted.length - lo) / sorted.length;
}
