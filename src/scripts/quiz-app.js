// 退休測驗:開場 → 一題一張卡 → 退休人格與結果。所有計算交給 src/lib/fire.js。
import {
  computePlan, lifePath, annualCashflow, cashPlan, autoPensions, incomesOf, fireAgeDrivers, needBreakdown, fundNeeded,
  breakEvenReturn, personaOf, levers, monteCarlo, earliestFireTimeAt, successRate, pmt, endAgeOf,
  fireTimeScenarios, SCENARIOS, netReturn, extraSavingFor, toToday, rowToday, fireYearsLimit,
} from '../lib/fire.js';
import {
  BASE_YEAR, R_MAX, freshState, loadState, saveState, clearState, nf, wan, big, pct, pctUp, esc, num, round, $,
  spanText, whenParts, knobGet, knobSet, writeKnobs, widthOf, legend, onResize, setMiniBar, watchMiniBar,
} from './shared.js';
import { fanChart, BAND_LIGHT, targetChart, allocChart, loanChart, driversChart, tradeoffChart } from './charts.js';
import { QUESTIONS, LOAN_DEFAULTS, GOAL_DEFAULTS } from './quiz-config.js';
import { seal, PERSONAS } from './seal.js';

let s = loadState();
let step = 0;
// 做過測驗的人從首頁重新開始時,先記住上一次的結果;新測驗還沒做完前,「看我上次的結果」還能回去
let prevDone = null;
const N = QUESTIONS.length;
const save = () => saveState(s);
const phase = () => document.documentElement.dataset.phase;
function setPhase(p) {
  document.documentElement.dataset.phase = p;
  window.scrollTo(0, 0);
}

// ---------- 細項裡的清單(貸款、大額支出、年金) ----------
/** 貸款月付:寬限期內只繳利息,之後本息攤還 */
function loanText(l) {
  const months = Math.round((l.years ?? 0) * 12), g = Math.min(Math.round((l.grace ?? 0) * 12), Math.max(months - 1, 0));
  const after = pmt(l.principal, l.rate / 12, months - g);
  return g > 0
    ? `寬限期每月約 ${nf(2).format(l.principal * l.rate / 12)} 萬(只繳利息),之後每月約 ${nf(2).format(after)} 萬`
    : `每月約 ${nf(2).format(after)} 萬`;
}
const LISTS = {
  loans: {
    blank: () => ({ name: '貸款', principal: 100, years: 5, rate: 0.03, grace: 0 }),
    fields: [
      { key: 'principal', label: '剩餘本金', unit: '萬', step: 10 },
      { key: 'years', label: '剩餘年限', unit: '年', step: 1 },
      { key: 'rate', label: '年利率', unit: '%', step: 0.1, pct: true },
      { key: 'grace', label: '寬限期', unit: '年', step: 1, placeholder: '0' },
    ],
  },
  incomes: {
    blank: () => ({ name: '被動收入', monthly: 1, startAge: null }),
    fields: [
      { key: 'monthly', label: '每月金額', unit: '萬', step: 0.1 },
      { key: 'startAge', label: '開始領取', unit: '歲', step: 1, nullable: true },
    ],
  },
  goals: {
    blank: () => ({ year: BASE_YEAR + 5, name: '大額支出', amount: 50 }),
    fields: [
      { key: 'year', label: '年份', unit: '年', step: 1 },
      { key: 'amount', label: '金額(今日幣值)', unit: '萬', step: 10 },
    ],
  },
};
function renderList(kind) {
  const spec = LISTS[kind];
  const items = s.inputs[kind];
  $(`list-${kind}`).innerHTML = items.map((item, idx) => `
    <div class="rounded-xl border p-3 space-y-2" style="border-color:var(--line)">
      <div class="flex gap-2">
        <input class="inp font-semibold" aria-label="名稱" data-list="${kind}" data-idx="${idx}" data-field="name" type="text" value="${esc(item.name)}" />
        <button type="button" class="btn-x" aria-label="刪除 ${esc(item.name)}" data-remove="${kind}" data-idx="${idx}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="grid gap-2" style="grid-template-columns:repeat(${spec.fields.length},minmax(0,1fr))">
        ${spec.fields.map((f) => `<div class="field"><span class="label">${f.label}</span><div class="inp-unit">
          <input class="inp" aria-label="${esc(item.name)} ${f.label}" data-list="${kind}" data-idx="${idx}" data-field="${f.key}"
            ${f.pct ? 'data-pct="1"' : ''} ${f.nullable ? 'data-nullable="1"' : ''} type="number" inputmode="decimal" step="${f.step}"
            value="${item[f.key] == null ? '' : f.pct ? round(item[f.key] * 100, 4) : item[f.key]}" placeholder="${f.nullable ? '退休時' : f.placeholder ?? ''}" />
          <span>${f.unit}</span></div></div>`).join('')}
      </div>
      ${kind === 'loans' ? `<p class="text-xs muted num">${loanText(item)}</p>` : ''}
    </div>`).join('') || '<p class="text-sm muted">目前沒有項目。</p>';
}
function readListInput(el) {
  const { list, idx, field } = el.dataset;
  const item = s.inputs[list][Number(idx)];
  if (!item) return;
  if (list === 'incomes') delete item.auto;   // 自己改過就照填的算,不再自動估算
  const raw = el.value.trim();
  if (el.type === 'text') { item[field] = raw; return; }
  if (raw === '' && el.dataset.nullable) { item[field] = null; return; }
  const x = num(raw);
  if (x != null) item[field] = el.dataset.pct ? x / 100 : x;
}
function writeFields() {
  document.querySelectorAll('input[data-key]').forEach((el) => {
    if (document.activeElement === el) return;
    const v = s.inputs[el.dataset.key];
    el.value = v == null ? '' : round(v / Number(el.dataset.scale || 1), 2);
  });
}

// ---------- 答案 ↔ 輸入 ----------
// 第一次做測驗:數字沿用範例,選擇題從中性答案開始(沒有貸款、沒有大額支出、勞保勞退算進去)
function quizStart() {
  const base = freshState();
  base.inputs = { ...base.inputs, loans: [], goals: [] };
  base.inputs.incomes = autoPensions(base.inputs);
  base.answers = { loans: 'none', goals: ['none'], pension: 'yes' };
  return base;
}
function deriveAnswers(inp) {
  const names = inp.loans.filter((l) => l.principal > 0).map((l) => l.name);
  const home = names.some((n) => n.includes('房')), other = names.some((n) => !n.includes('房'));
  const goals = Object.entries(GOAL_DEFAULTS).filter(([, g]) => inp.goals.some((x) => x.name === g.name)).map(([k]) => k);
  return {
    loans: home && other ? 'both' : home ? 'home' : other ? 'other' : 'none',
    goals: goals.length ? goals : inp.goals.length ? [] : ['none'],
    pension: inp.incomes.some((q) => q.monthly > 0) ? 'yes' : 'no',
  };
}
function applyChoice(q, raw) {
  const inp = s.inputs;
  if (q.key) { knobSet(inp, q.key, Number(raw)); return; }
  if (q.id === 'loans') {
    if (s.answers.loans === raw) return;
    s.answers.loans = raw;
    const pick = { none: [], home: ['home'], other: ['other'], both: ['home', 'other'] }[raw];
    inp.loans = pick.map((k) => ({ ...LOAN_DEFAULTS[k] }));
  } else if (q.id === 'goals') {
    let sel = new Set(s.answers.goals ?? []);
    if (raw === 'none') {
      sel = new Set(['none']);
      inp.goals = [];
    } else {
      sel.delete('none');
      const g = GOAL_DEFAULTS[raw];
      if (sel.has(raw)) {
        sel.delete(raw);
        inp.goals = inp.goals.filter((x) => x.name !== g.name);
      } else {
        sel.add(raw);
        inp.goals.push({ name: g.name, amount: g.amount, year: BASE_YEAR + g.yearOffset });
      }
      if (!sel.size) sel.add('none');
    }
    s.answers.goals = [...sel];
  } else if (q.id === 'pension') {
    if (s.answers.pension === raw) return;
    s.answers.pension = raw;
    inp.incomes = raw === 'yes' ? autoPensions(inp) : [];
  }
}
function isPicked(q, raw) {
  if (q.key) return Math.abs(knobGet(s.inputs, q.key) - Number(raw)) < 1e-9;
  if (q.id === 'goals') return (s.answers.goals ?? []).includes(raw);
  return s.answers[q.id] === raw;
}

// ---------- 題目卡 ----------
function markChoices() {
  document.querySelectorAll('.q-card').forEach((card) => {
    const q = QUESTIONS[Number(card.dataset.i)];
    card.querySelectorAll('.q-choice').forEach((b) => {
      b.setAttribute('aria-pressed', String(isPicked(q, b.dataset.v)));
      if (q.id === 'dream') b.disabled = Number(b.dataset.v) <= s.inputs.age;
    });
  });
}
function feedback() {
  delayFeedback();
  const el = $('q-feedback');
  if (!el) return;
  const left = s.inputs.salary / 12 - s.inputs.monthlyExpense;
  el.textContent = left > 0
    ? `扣掉每月生活費,大約還能存 ${nf(1).format(left)} 萬`
    : `收入比生活費少 ${nf(1).format(-left)} 萬,目前存不到錢`;
}
/** 定期定額卡:選了晚幾年開始,馬上算出最快退休會延後多久 */
function delayFeedback() {
  const el = $('q-delay');
  if (!el) return;
  const inp = s.inputs, d = inp.investDelay ?? 0, cap = inp.dcaMonthly;
  const first = inp.fireYear > inp.baseYear ? annualCashflow(inp)[0].invest / 12 : null;
  const n1 = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 });
  const saving = first != null && first > 0 ? `你現在每月大約存下 ${n1.format(first)} 萬。` : '';
  const now = earliestFireTimeAt({ ...inp, investDelay: 0, dcaMonthly: null }, inp.assumedReturn, 0.9);
  const late = inp.age + fireYearsLimit(inp);
  if (now == null) { el.textContent = `${saving}照目前的條件,工作到 ${late} 歲都還不到九成把握;越早開始越重要。`; return; }
  const w = whenParts(now, inp.age);
  if (!d && cap == null) { el.textContent = `${saving}${w.now ? '現在就可以退休了。' : `現在開始、存下的全部投入:九成把握最快 ${w.year} 年 ${w.month} 月可以退休。`}`; return; }
  const what = [d ? `晚 ${d} 年才開始` : '', cap != null ? `每月只投 ${n1.format(cap)} 萬` : ''].filter(Boolean).join('、');
  const t = earliestFireTimeAt(inp, inp.assumedReturn, 0.9);
  const lag = t == null ? null : t - now;
  el.textContent = saving + (lag == null ? `${what},工作到 ${late} 歲都還不到九成把握。`
    : lag < 1 / 24 ? `${what},最快退休時間差不到 1 個月。`
    : `${what},最快退休會延後約 ${spanText(lag)}。`);
}
/** 自動估算的勞保 / 勞退跟著年齡、收入、理想退休年齡更新 */
const refreshPensions = () => { s.inputs.incomes = incomesOf(s.inputs); };
function renderQuiz(focus = false) {
  refreshPensions();
  document.querySelectorAll('.q-card').forEach((c, i) => { c.hidden = i !== step; });
  $('q-count').textContent = `${step + 1} / ${N}`;
  $('q-bar').style.width = `${((step + 1) / N) * 100}%`;
  $('q-next').textContent = step === N - 1 ? '看結果' : '下一題';
  writeKnobs(s.inputs);
  writeFields();
  Object.keys(LISTS).forEach(renderList);
  markChoices();
  feedback();
  if (focus) document.querySelector(`.q-card[data-i="${step}"] .q-title`)?.focus({ preventScroll: true });
}
function next() {
  if (step < N - 1) {
    step += 1;
    renderQuiz(true);
    window.scrollTo(0, 0);
  } else {
    s.done = true;
    save();
    showResult();
  }
}
function back() {
  if (step > 0) {
    step -= 1;
    renderQuiz(true);
  } else if (s.done) setPhase('result');
  else showIntro();
}

/** 回到開場:做過測驗的人看到「重新測驗」與「看我上次的結果」 */
function showIntro() {
  const hasResult = s.done || !!prevDone;
  $('to-result').hidden = !hasResult;
  $('start').textContent = hasResult ? '重新測驗' : '開始測驗';
  setPhase('intro');
}

// ---------- 結果 ----------
let last = null;
const STYLE = { safe: '保守', steady: '穩健', bold: '積極' };
const LEVER = { saveMore: '每月多存 1 萬', spendLess: '每月少花 5 千', returnUp: '報酬率多 1%', startNow: '現在就開始定期定額' };
/** 「想再快一點」第四列:依第 10 題的設定換說法 */
const startNowLabel = (inp) => ((inp.investDelay ?? 0) > 0 && inp.dcaMonthly != null ? '現在就開始、存下的全部投入'
  : inp.dcaMonthly != null ? '存下的錢全部定期定額' : '現在就開始定期定額');


function placeMark(be) {
  const mark = $('ret-mark');
  if (be == null) { mark.hidden = true; return; }
  const f = Math.min(be, R_MAX) / R_MAX;
  mark.hidden = false;
  mark.style.setProperty('--f', String(f));
  mark.dataset.edge = f < 0.15 ? 'start' : f > 0.85 ? 'end' : '';
  $('ret-mark-label').textContent = be === 0 ? '0% 就夠' : `至少 ${pctUp(be)}`;
}

function check(level, title, body) {
  return `<li class="flex gap-3"><span class="dot dot-${level}" aria-hidden="true"></span><div><p class="font-semibold">${title}</p><p class="text-sm muted mt-0.5">${body}</p></div></li>`;
}

// 一生資產的機率範圍 + 撐得住的機率 + 每年報酬剛好 r 的樂觀時間
function drawLife() {
  if (!last) return;
  const { inp, r, n, fireAge } = last;
  if (n < 1) {
    $('chart-life').innerHTML = '<p class="text-sm muted">理想退休年齡要大於現在的年齡。</p>';
    $('r-odds').innerHTML = '';
    $('r-fate').innerHTML = '';
    return;
  }
  // 圖上金額都換成今日幣值(除以通膨),不然 60 年後的錢看起來會大得嚇人
  const raw = monteCarlo(inp, r);
  const mc = { ...raw, rows: raw.rows.map((x) => rowToday(inp, x)) };
  $('chart-life').innerHTML = fanChart(mc, toToday(inp, fundNeeded(inp, r), inp.fireYear), widthOf('chart-life'))
    + legend([...SCENARIOS.map((x) => [`var(--sc-${x.key})`, `${x.name}:${x.sub}`]), [BAND_LIGHT, '悲觀到樂觀之間']]);
  $('life-note').textContent = `${fireAge} 歲退休,模擬 1,000 種市場走勢(扣掉費用與稅,年報酬率中位數 ${pct(netReturn(inp, r))}、上下波動約 ${pct(mc.sigma)}),畫出三種情況。金額都是今天的錢(已扣掉通膨)。`;
  const p = Math.round(mc.success * 100);
  const lvl = mc.success >= 0.9 ? 'ok' : mc.success >= 0.7 ? 'warn' : 'bad';
  const end = endAgeOf(inp);
  const endRow = mc.rows.at(-1);
  $('r-odds').innerHTML = `<li><span class="dot dot-${lvl}" aria-hidden="true"></span><span>${fireAge} 歲退休,撐到 ${end} 歲的機率</span><b class="num">${p}%</b></li>`;
  // 三種情況各自撐到幾歲:跟圖上三條線一一對應
  $('r-fate').innerHTML = SCENARIOS.map((x) => {
    const zero = mc[`${x.line}Zero`];
    return `<li class="scen-${x.key}"><span>${x.name}</span><b class="num">${zero != null ? `${zero} 歲用完` : `撐到 ${end} 歲`}</b><small>${zero != null ? x.sub : `還剩 ${big(endRow[x.line])}`}</small></li>`;
  }).join('');
}

function drawMore() {
  if (!last || !$('more').open) return;
  const { inp, r, n, be, fireAge } = last;
  if (n < 1) {
    ['chart-trade', 'chart-target', 'chart-cashflow', 'chart-loans', 'loan-list', 'chart-drivers', 'checks'].forEach((id) => { $(id).innerHTML = ''; });
    return;
  }
  const plan = computePlan(inp);
  const life = lifePath(inp, r);
  $('chart-trade').innerHTML = tradeoffChart(inp, r, be, widthOf('chart-trade'));
  $('chart-target').innerHTML = targetChart(rowToday(inp, { ...needBreakdown(inp, r), year: inp.fireYear }), r, endAgeOf(inp), widthOf('chart-target'));
  const money = cashPlan(inp);
  $('chart-cashflow').innerHTML = allocChart(money.rows.map((x) => rowToday(inp, x)), widthOf('chart-cashflow'));
  // 貸款每年還多少
  const sched = plan.loans;
  $('loan-sec').hidden = !sched.rows.length;
  if (sched.rows.length) {
    $('chart-loans').innerHTML = loanChart(sched, n, inp.baseYear, widthOf('chart-loans'));
    $('loan-list').innerHTML = sched.rows.map((l) => {
      const now = l.grace > 0 && l.payment < l.paymentAfterGrace - 1e-9
        ? `寬限期每月 ${nf(2).format(l.payment)} 萬,之後每月 ${nf(2).format(l.paymentAfterGrace)} 萬`
        : `每月 ${nf(2).format(l.paymentAfterGrace)} 萬`;
      const early = l.balanceAtFire > 0.5;
      const end = early ? `${fireAge} 歲退休時還欠 ${wan(l.balanceAtFire)},那年一次還清` : `${l.payoffYear} 年還清`;
      const interest = early ? `退休前繳的利息約 ${wan(l.interestToFire)}` : `總利息約 ${wan(l.totalInterest)}`;
      return `<li><b>${esc(l.name)}</b><span>${now};${end};${interest}。</span></li>`;
    }).join('');
  }
  $('chart-drivers').innerHTML = driversChart(fireAgeDrivers({ ...inp, assumedReturn: r }, 0.9), widthOf('chart-drivers'));
  const c = plan.checks;
  const items = [];
  if (c.dti != null && plan.loans.monthlyPayment > 0) {
    const lvl = c.dti <= 0.33 ? 'ok' : c.dti <= 0.4 ? 'warn' : 'bad';
    items.push(check(lvl, `貸款占收入 ${nf(0).format(c.dti * 100)}%`, lvl === 'ok' ? '在 1/3 以內,負擔合理。' : '超過 1/3,收入中斷時壓力大;優先還清高利率的那筆。'));
  }
  // 緊急預備金:現有存款先撥;不夠的話看第幾年補足
  const target = plan.emergency;
  const filled = money.rows.find((x, i) => x.reserveBal >= inp.emergencyMonths * inp.monthlyExpense * (1 + inp.inflation) ** (i + 1) - 0.01);
  const reserveNote = money.reserveStart >= target - 0.01
    ? `先從存款撥出 ${wan(target)} 放定存,不拿去投資;之後每年隨生活費調高。`
    : `現有存款只夠撥 ${wan(money.reserveStart)},${filled ? `${filled.year} 年前會用每年的存款補足` : '還要好幾年才能補足'};補足前不投資。`;
  items.push(check(inp.emergencyMonths >= 6 ? (money.reserveStart >= target - 0.01 ? 'ok' : 'warn') : inp.emergencyMonths >= 3 ? 'warn' : 'bad',
    `緊急預備金 ${nf(0).format(inp.emergencyMonths)} 個月`, inp.emergencyMonths >= 3 ? reserveNote : `建議至少 6 個月生活費。${reserveNote}`));
  // 每年付不付得出來:大額支出提前 3 年存好後,還有沒有收入不夠的年份
  const shortYears = money.rows.filter((x) => x.short > 0.05).map((x) => x.year);
  // 連續的年份縮成「2027–2037」
  const ranges = shortYears.reduce((acc, yv) => { const last = acc.at(-1); if (last && yv === last[1] + 1) last[1] = yv; else acc.push([yv, yv]); return acc; }, [])
    .map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join('、');
  items.push(shortYears.length
    ? check('warn', `${ranges} 年收入不夠支出`, '那幾年要動用存款或投資;可以把大額支出往後挪、拉長貸款年限或降低生活費。')
    : check('ok', '每年都付得出來', inp.goals.length ? '大額支出都在前 3 年平均存好,支出那年不用賣投資。' : '沒有需要動用存款的年份。'));
  items.push(life.depletionAge
    ? check('bad', `${life.depletionAge} 歲資金用完`, `照 ${fireAge} 歲退休、報酬率 ${pct(r)} 推算;晚一點退休或降低生活費,才能撐到 ${endAgeOf(inp)} 歲。`)
    : check('ok', `資金撐到 ${endAgeOf(inp)} 歲`, `照 ${fireAge} 歲退休、報酬率 ${pct(r)} 推算,資產沒有用完。`));
  $('checks').innerHTML = items.join('');
}

function renderResult() {
  refreshPensions();
  const inp = s.inputs;
  const r = Math.max(0, inp.assumedReturn);
  const p = personaOf(inp);
  const P = PERSONAS[`${p.saver ? 'saver' : 'spender'}-${p.style}`];
  $('persona').style.setProperty('--tint', P.tint);
  $('r-art').innerHTML = seal(P.variant, P.name);
  $('r-name').textContent = P.name;
  $('r-tag').textContent = P.tag;
  $('r-save').textContent = p.savingRate > 0 ? `每月存下收入的 ${Math.round(p.savingRate * 100)}%`
    : p.savingRate > -0.05 ? '目前收支差不多打平' : '目前每月要動用存款';
  $('r-style').textContent = `投資風格:${STYLE[p.style]}`;

  // 最快何時退休:樂觀 / 中性 / 悲觀三種情況;主答案用悲觀(最差一成的市場也撐得住 = 九成把握)
  const sc = fireTimeScenarios(inp, r);
  const t = sc.bad;
  const w = t == null ? null : whenParts(t, inp.age);
  // 試到這個年齡都還不夠時寫「X 歲以後」,跟其他格子一樣用年齡
  const late = inp.age + fireYearsLimit(inp);
  // 做不到九成時不說「不夠」,改說最後那年有幾成把握、每月多存多少就到九成
  const lateInp = { ...inp, fireYear: inp.baseYear + fireYearsLimit(inp) };
  const pLate = t == null ? Math.round((successRate(lateInp, r) ?? 0) * 100) : null;
  $('r-scen').innerHTML = SCENARIOS.map((x) => {
    const tt = sc[x.key], ww = tt == null ? null : whenParts(tt, inp.age);
    const v = tt == null ? `${late} 歲後` : ww.now ? '現在' : `${ww.age} 歲`;
    return `<li class="scen-${x.key}"><span>${x.name}</span><b class="num">${v}</b><small>${tt == null ? (pLate < 10 ? '多存一點就有' : `把握 ${pLate}%`) : ww.now ? x.sub : `${ww.year} 年 ${ww.month} 月`}</small></li>`;
  }).join('');
  $('r-kicker').textContent = `報酬率 ${pct(r)} 時,九成把握最快`;
  $('r-scen-note').hidden = t == null; // 悲觀做不到時,大字下面那行已經說明了
  if (t == null) {
    $('r-date').textContent = `${late} 歲以後`;
    const wm = sc.mid == null ? null : whenParts(sc.mid, inp.age);
    const mLate = extraSavingFor(lateInp, r, 0.9);
    // 把握很低(多半是每月花得比賺得多)時,先講補法,不寫「0% 把握」
    $('r-span').textContent = pLate < 10
      ? (mLate != null ? `每月多存 ${round(mLate, 1)} 萬,${late} 歲前就能有九成把握` : '先讓每月有結餘,再看看下面怎麼調')
      : `工作到 ${late} 歲有 ${pLate}% 把握`
        + (mLate != null ? `,每月多存 ${round(mLate, 1)} 萬就到九成` : '')
        + (wm ? `;一半的情況約 ${wm.age} 歲` : '');
  } else if (w.now) {
    $('r-date').textContent = '現在';
    $('r-span').textContent = `就可以退休,資產已經撐到 ${endAgeOf(inp)} 歲`;
  } else {
    $('r-date').innerHTML = `${w.year}<small>年</small>${w.month}<small>月</small>`;
    $('r-span').textContent = `就可以退休(${w.span}後,約 ${w.age} 歲)`;
  }

  // 理想退休年齡來不來得及
  const fireAge = knobGet(inp, 'fireAge');
  const n = inp.fireYear - inp.baseYear;
  let be = null;
  if (n < 1) {
    $('r-dream').innerHTML = `<p class="dream-q">理想退休年齡 ${fireAge} 歲已經到了</p><p class="dream-sub">點「修改答案」改一個比現在大的年齡。</p>`;
  } else {
    const odds = successRate(inp, r);
    const pc = Math.round(odds * 100);
    be = breakEvenReturn(inp);
    // 九成把握才算來得及;不到九成就直接說怎麼補:每月多存多少,或晚到悲觀情況的年齡再退休
    let verdict, how;
    if (odds >= 0.9) {
      verdict = ['ok', '✓', `來得及,九成把握(${pc}%)`];
      how = `就算碰上最差的一成市場,也撐得到 ${endAgeOf(inp)} 歲`;
    } else {
      verdict = [odds >= 0.5 ? 'warn' : 'bad', '!', `把握 ${pc}%,還不到九成`];
      const m = extraSavingFor(inp, r, 0.9);
      const ways = [];
      if (m != null) ways.push(`每月多存 <b>${round(m, 1)} 萬</b>`);
      if (t != null) ways.push(w.age > fireAge ? `等到 <b>${w.age} 歲</b>再退休` : `晚 <b>${spanText(t - n)}</b>退休`);
      how = ways.length ? `想要九成把握:${ways.join(',或')}` : '就算每月多存 30 萬也不到九成,試試降低生活費或晚一點退休';
    }
    $('r-dream').innerHTML = `
      <p class="dream-q">你理想的 <b>${fireAge} 歲</b>退休</p>
      <p class="dream-a ${verdict[0]}"><span aria-hidden="true">${verdict[1]}</span>${verdict[2]}</p>
      <p class="dream-sub">${how}</p>`;
  }

  // 想再快一點
  const L = levers(inp, r, endAgeOf(inp), 0.9);
  $('r-levers').innerHTML = L.rows.map((x) => {
    const v = x.gain != null
      ? (x.gain > 1 / 24 ? `提早 ${spanText(x.gain)}` : '差不多')
      : x.t != null ? `${spanText(x.t)}後就可以退休` : '還不到九成把握';
    return `<li><span>${x.key === 'startNow' ? startNowLabel(inp) : LEVER[x.key]}</span><b>${v}</b></li>`;
  }).join('');

  placeMark(be);
  $('ret-note').textContent = be == null ? '拉拉看,最快退休的時間會跟著變。' : `三角形是 ${fireAge} 歲退休平均每年至少要有的報酬率(還沒算起伏,九成把握要再高一些);拉拉看,最快退休的時間會跟著變。`;

  last = { inp, r, n, fireAge, be, name: P.name, persona: P, w, t };
  drawLife();
  drawMore();
  setMiniBar(
    t == null ? `九成把握要 ${late} 歲以後` : w.now ? '現在就可以退休' : `九成把握 ${w.year} 年 ${w.month} 月退休`,
    `${P.name}・報酬率 ${pct(r)}`,
  );
}

function showResult() {
  setPhase('result');
  writeKnobs(s.inputs);
  renderResult();
}

function toast(msg) {
  const el = $('r-toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}
async function share() {
  if (!last) return;
  const { name, r, w, t } = last;
  const when = t == null ? '還要再努力一下' : w.now ? '現在就可以退休' : `九成把握 ${w.year} 年 ${w.month} 月就可以退休`;
  const text = `我是「${name}」!報酬率 ${pct(r)} 時,我${when}。你是哪一型的退休海豹?`;
  const url = `${location.origin}/`;
  if (navigator.share) {
    try { await navigator.share({ title: 'SealHack FIRE 退休測驗', text, url }); } catch { /* 使用者取消 */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('已複製,貼給朋友看看吧');
  } catch {
    toast(text);
  }
}

// ---------- 下載圖卡 ----------
let card = null;
async function openCard() {
  if (!last) return;
  const { persona: P, r, w, t, n, fireAge } = last;
  // 圖卡的狀態:已經可以退休 / 比理想早 / 剛好 / 比理想晚 / 試到最後都還不夠
  const diff = t == null || w.now || n < 1 ? 0 : fireAge - w.age;
  const late = last.inp.age + fireYearsLimit(last.inp);
  const state = t == null ? { key: 'far', label: '還在努力中' }
    : w.now ? { key: 'now', label: '已經可以退休了' }
    : n < 1 ? { key: 'ahead', label: `最快 ${w.age} 歲退休` }
    : diff > 0 ? { key: 'ahead', label: `比理想早 ${diff} 年退休` }
    : diff === 0 ? { key: 'ahead', label: '理想退休年齡來得及' }
    : { key: 'behind', label: `比理想晚 ${-diff} 年` };
  const btn = $('r-card');
  btn.disabled = true;
  try {
    const { makeCard } = await import('./share-card.js');
    const blob = await makeCard({
      variant: P.variant, name: P.name, tag: P.tag, tint: P.tint,
      kicker: `報酬率 ${pct(r)}・九成把握,我最快`,
      when: t == null ? `${late} 歲以後` : w.now ? '現在' : `${w.year} 年 ${w.month} 月`,
      sub: t == null ? '一步一步存,目標九成把握' : w.now ? '就可以退休' : `就可以退休(${w.span}後,約 ${w.age} 歲)`,
      state,
    });
    if (card) URL.revokeObjectURL(card.url);
    card = { blob, url: URL.createObjectURL(blob), file: `sealhack-${P.name}.png` };
    $('card-img').src = card.url;
    $('card-dialog').showModal();
  } catch {
    toast('圖卡產生失敗,請再試一次');
  } finally {
    btn.disabled = false;
  }
}
/** 手機上用分享選單(可以存到相簿);不支援時直接下載檔案 */
async function saveCard() {
  if (!card) return;
  const file = new File([card.blob], card.file, { type: 'image/png' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'SealHack FIRE 退休測驗' }); return; } catch { /* 使用者取消 */ return; }
  }
  const a = document.createElement('a');
  a.href = card.url; a.download = card.file;
  document.body.append(a); a.click(); a.remove();
  toast('圖卡已下載');
}

// ---------- 掛載 ----------
export function mount() {
  if (!Object.keys(s.answers).length) {
    if (s.done) s.answers = deriveAnswers(s.inputs);
    else s = quizStart();
  }
  $('to-result').hidden = !s.done;
  if (s.done) $('start').textContent = '重新測驗';
  if (phase() === 'result') showResult();
  else renderQuiz();
  // 已經在測驗頁時,按左上角圖案不重新載入,直接回開場
  document.querySelectorAll('[data-home]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); showIntro(); }));

  let timer = 0;
  const refreshResult = () => { clearTimeout(timer); timer = setTimeout(() => { writeKnobs(s.inputs); renderResult(); }, 40); };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.classList.contains('q-choice')) {
      const card = t.closest('.q-card');
      const q = QUESTIONS[Number(card.dataset.i)];
      applyChoice(q, t.dataset.v);
      save();
      writeKnobs(s.inputs);
      Object.keys(LISTS).forEach(renderList);
      markChoices();
      feedback();
      // 點選項只會選起來,不會自動跳下一題(避免手滑、滑動時誤觸就跳走);按「下一題」才前進
      return;
    }
    if (t.dataset.add) {
      s.inputs[t.dataset.add].push(LISTS[t.dataset.add].blank());
      renderList(t.dataset.add);
      save();
      return;
    }
    if (t.dataset.remove) {
      s.inputs[t.dataset.remove].splice(Number(t.dataset.idx), 1);
      renderList(t.dataset.remove);
      save();
      return;
    }
    switch (t.id) {
      case 'start': case 'r-home':
        // 做過測驗的人重新開始:從中性答案開始,上一次的結果先記著
        if (s.done) { prevDone = s; s = quizStart(); writeKnobs(s.inputs); Object.keys(LISTS).forEach(renderList); }
        step = 0; setPhase('quiz'); renderQuiz(true); break;
      case 'to-result':
        if (!s.done && prevDone) { s = prevDone; save(); }
        prevDone = null; showResult(); break;
      case 'demo': s = freshState(); s.answers = deriveAnswers(s.inputs); s.done = true; save(); showResult(); break;
      case 'q-next': next(); break;
      case 'q-back': back(); break;
      case 'r-edit': case 'tune-edit': step = 0; setPhase('quiz'); renderQuiz(true); break;
      case 'r-share': share(); break;
      case 'clear-data':
        clearState(); s = quizStart(); prevDone = null; step = 0;
        writeKnobs(s.inputs); Object.keys(LISTS).forEach(renderList); showIntro();
        $('trust-note').firstChild.textContent = '已清除:這台裝置上沒有你的答案了。';
        break;
      case 'r-card': openCard(); break;
      case 'card-save': saveCard(); break;
      case 'card-close': $('card-dialog').close(); break;
      default: break;
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.dataset.knob) {
      const x = num(el.value);
      if (x == null) return;
      knobSet(s.inputs, el.dataset.knob, el.dataset.pct ? x / 100 : x);
    } else if (el.dataset.key) {
      const raw = el.value.trim();
      const x = num(raw);
      if (raw === '') s.inputs[el.dataset.key] = null;
      else if (x == null) return;
      else s.inputs[el.dataset.key] = x * Number(el.dataset.scale || 1);
    } else if (el.dataset.list) {
      readListInput(el);
      if (el.dataset.list === 'loans' && el.type !== 'text') {
        const card = el.closest('.rounded-xl');
        const item = s.inputs.loans[Number(el.dataset.idx)];
        const out = card?.querySelector('p.num');
        if (out && item) out.textContent = loanText(item);
      }
    } else return;
    save();
    if (phase() === 'result') refreshResult();
    else { writeKnobs(s.inputs); markChoices(); feedback(); }
  });

  $('quiz-form').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'text') { e.preventDefault(); next(); }
  });
  $('more').addEventListener('toggle', drawMore);
  onResize(() => { drawLife(); drawMore(); });
  watchMiniBar();
}
