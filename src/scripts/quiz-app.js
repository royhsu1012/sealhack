// 退休測驗:開場 → 一題一張卡 → 退休人格與結果。所有計算交給 src/lib/fire.js。
import {
  computePlan, lifePath, annualCashflow, fireAgeDrivers, needBreakdown, fundNeeded, fundAtFire,
  breakEvenReturn, earliestFireTime, personaOf, levers, monteCarlo, earliestFireTimeAt, pmt, endAgeOf,
} from '../lib/fire.js';
import {
  BASE_YEAR, R_MAX, freshState, loadState, saveState, nf, wan, big, pct, esc, num, round, $,
  spanText, whenParts, knobGet, knobSet, writeKnobs, widthOf, legend, onResize, setMiniBar, watchMiniBar,
} from './shared.js';
import { fanChart, BAND_DARK, BAND_LIGHT, targetChart, cashflowChart, driversChart, tradeoffChart } from './charts.js';
import { QUESTIONS, LOAN_DEFAULTS, GOAL_DEFAULTS, PENSION_DEFAULTS } from './quiz-config.js';
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
const LISTS = {
  loans: {
    blank: () => ({ name: '貸款', principal: 100, years: 5, rate: 0.03 }),
    fields: [
      { key: 'principal', label: '剩餘本金', unit: '萬', step: 10 },
      { key: 'years', label: '剩餘年限', unit: '年', step: 1 },
      { key: 'rate', label: '年利率', unit: '%', step: 0.1, pct: true },
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
            value="${item[f.key] == null ? '' : f.pct ? round(item[f.key] * 100, 4) : item[f.key]}" placeholder="${f.nullable ? '退休時' : ''}" />
          <span>${f.unit}</span></div></div>`).join('')}
      </div>
      ${kind === 'loans' ? `<p class="text-xs muted num">每月約 ${nf(2).format(pmt(item.principal, item.rate / 12, Math.round(item.years * 12)))} 萬</p>` : ''}
    </div>`).join('') || '<p class="text-sm muted">目前沒有項目。</p>';
}
function readListInput(el) {
  const { list, idx, field } = el.dataset;
  const item = s.inputs[list][Number(idx)];
  if (!item) return;
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
  base.inputs = { ...base.inputs, loans: [], goals: [], incomes: PENSION_DEFAULTS.map((p) => ({ ...p })) };
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
    inp.incomes = raw === 'yes' ? PENSION_DEFAULTS.map((p) => ({ ...p })) : [];
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
  const now = earliestFireTime({ ...inp, investDelay: 0, dcaMonthly: null });
  if (now == null) { el.textContent = `${saving}照目前的條件,45 年內都存不夠退休;越早開始越重要。`; return; }
  const w = whenParts(now, inp.age);
  if (!d && cap == null) { el.textContent = `${saving}${w.now ? '現在就可以退休了。' : `現在開始、存下的全部投入:最快 ${w.year} 年 ${w.month} 月可以退休。`}`; return; }
  const what = [d ? `晚 ${d} 年才開始` : '', cap != null ? `每月只投 ${n1.format(cap)} 萬` : ''].filter(Boolean).join('、');
  const t = earliestFireTime(inp);
  const lag = t == null ? null : t - now;
  el.textContent = saving + (lag == null ? `${what},45 年內就存不夠退休了。`
    : lag < 1 / 24 ? `${what},最快退休時間差不到 1 個月。`
    : `${what},最快退休會延後約 ${spanText(lag)}。`);
}
function renderQuiz(focus = false) {
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
  $('ret-mark-label').textContent = be === 0 ? '0% 就夠' : `至少 ${pct(be)}`;
}

function check(level, title, body) {
  return `<li class="flex gap-3"><span class="dot dot-${level}" aria-hidden="true"></span><div><p class="font-semibold">${title}</p><p class="text-sm muted mt-0.5">${body}</p></div></li>`;
}

// 一生資產的機率範圍 + 撐得住的機率 + 九成把握的最快退休時間
function drawLife() {
  if (!last) return;
  const { inp, r, n, fireAge } = last;
  if (n < 1) {
    $('chart-life').innerHTML = '<p class="text-sm muted">理想退休年齡要大於現在的年齡。</p>';
    $('r-odds').innerHTML = '';
    return;
  }
  const mc = monteCarlo(inp, r);
  $('chart-life').innerHTML = fanChart(mc, fundNeeded(inp, r), widthOf('chart-life'))
    + legend([['var(--ink)', '中位數'], [BAND_DARK, '中間一半的情況'], [BAND_LIGHT, '八成的情況']]);
  $('life-note').textContent = `${fireAge} 歲退休,模擬 1,000 種市場走勢:年報酬率中位數 ${pct(r)}、上下波動約 ${pct(mc.sigma)}。`;
  const p = Math.round(mc.success * 100);
  const lvl = mc.success >= 0.9 ? 'ok' : mc.success >= 0.7 ? 'warn' : 'bad';
  const t90 = earliestFireTimeAt(inp, r, 0.9);
  const w90 = t90 == null ? null : whenParts(t90, inp.age);
  $('r-odds').innerHTML = `
    <li><span class="dot dot-${lvl}" aria-hidden="true"></span><span>${fireAge} 歲退休,撐到 ${endAgeOf(inp)} 歲的機率</span><b class="num">${p}%</b></li>
    <li><span class="dot dot-ok" aria-hidden="true"></span><span>九成把握,最快退休</span>
      <b class="num">${t90 == null ? '45 年內做不到' : w90.now ? '現在' : `${w90.year} 年 ${w90.month} 月<small>約 ${w90.age} 歲</small>`}</b></li>`;
}

function drawMore() {
  if (!last || !$('more').open) return;
  const { inp, r, n, be, fireAge } = last;
  if (n < 1) {
    ['chart-trade', 'chart-target', 'chart-cashflow', 'chart-drivers', 'checks'].forEach((id) => { $(id).innerHTML = ''; });
    return;
  }
  const plan = computePlan(inp);
  const life = lifePath(inp, r);
  $('chart-trade').innerHTML = tradeoffChart(inp, r, be, widthOf('chart-trade'));
  $('chart-target').innerHTML = targetChart(needBreakdown(inp, r), r, endAgeOf(inp), widthOf('chart-target'));
  $('chart-cashflow').innerHTML = cashflowChart(plan.flows, widthOf('chart-cashflow'));
  $('chart-drivers').innerHTML = driversChart(fireAgeDrivers({ ...inp, assumedReturn: r }), widthOf('chart-drivers'));
  const c = plan.checks;
  const items = [];
  if (c.dti != null && plan.loans.monthlyPayment > 0) {
    const lvl = c.dti <= 0.33 ? 'ok' : c.dti <= 0.4 ? 'warn' : 'bad';
    items.push(check(lvl, `貸款占收入 ${nf(0).format(c.dti * 100)}%`, lvl === 'ok' ? '在 1/3 以內,負擔合理。' : '超過 1/3,收入中斷時壓力大;優先還清高利率的那筆。'));
  }
  items.push(check(inp.emergencyMonths >= 6 ? 'ok' : inp.emergencyMonths >= 3 ? 'warn' : 'bad', `緊急預備金 ${nf(0).format(inp.emergencyMonths)} 個月`, inp.emergencyMonths >= 6 ? `保留 ${wan(plan.emergency)},不拿去投資。` : '建議至少 6 個月生活費。'));
  items.push(c.negativeYears.length
    ? check('warn', `${c.negativeYears.join('、')} 年存款不夠`, '大額支出那年要動用存款;提前 2–3 年把錢準備好。')
    : check('ok', '每年都有存到錢', '沒有需要動用存款的年份。'));
  items.push(life.depletionAge
    ? check('bad', `${life.depletionAge} 歲資金用完`, `照 ${fireAge} 歲退休、報酬率 ${pct(r)} 推算;晚一點退休或降低生活費,才能撐到 ${endAgeOf(inp)} 歲。`)
    : check('ok', `資金撐到 ${endAgeOf(inp)} 歲`, `照 ${fireAge} 歲退休、報酬率 ${pct(r)} 推算,資產沒有用完。`));
  $('checks').innerHTML = items.join('');
}

function renderResult() {
  const inp = s.inputs;
  const r = Math.max(0, inp.assumedReturn);
  const p = personaOf(inp);
  const P = PERSONAS[`${p.saver ? 'saver' : 'spender'}-${p.style}`];
  $('persona').style.setProperty('--tint', P.tint);
  $('r-art').innerHTML = seal(P.variant, P.name);
  $('r-name').textContent = P.name;
  $('r-tag').textContent = P.tag;
  $('r-save').textContent = p.savingRate > 0 ? `每月存下收入的 ${Math.round(p.savingRate * 100)}%` : '目前存不太到錢';
  $('r-style').textContent = `投資風格:${STYLE[p.style]}`;

  // 最快何時退休
  const t = earliestFireTime(inp, r);
  const w = t == null ? null : whenParts(t, inp.age);
  $('r-kicker').textContent = `報酬率 ${pct(r)} 時,你最快`;
  if (t == null) {
    $('r-date').textContent = '還要很久';
    $('r-span').textContent = '45 年內都存不夠退休,看看下面怎麼再快一點';
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
    const need = fundNeeded(inp, r), have = fundAtFire(inp, r);
    const ok = have >= need;
    be = breakEvenReturn(inp);
    $('r-dream').innerHTML = `
      <p class="dream-q">你理想的 <b>${fireAge} 歲</b>退休</p>
      <p class="dream-a ${ok ? 'ok' : 'bad'}"><span aria-hidden="true">${ok ? '✓' : '!'}</span>${ok ? `來得及,還多出 ${big(have - need)}` : `還差 ${big(need - have)}`}</p>
      <p class="dream-sub">那時需要 ${big(need)}・存得到 ${big(have)}</p>`;
  }

  // 想再快一點
  const L = levers(inp, r);
  $('r-levers').innerHTML = L.rows.map((x) => {
    const v = x.gain != null
      ? (x.gain > 1 / 24 ? `提早 ${spanText(x.gain)}` : '差不多')
      : x.t != null ? `${spanText(x.t)}後就可以退休` : '還是存不夠';
    return `<li><span>${x.key === 'startNow' ? startNowLabel(inp) : LEVER[x.key]}</span><b>${v}</b></li>`;
  }).join('');

  placeMark(be);
  $('ret-note').textContent = be == null ? '拉拉看,最快退休的時間會跟著變。' : `三角形是 ${fireAge} 歲退休的最低報酬率;拉拉看,最快退休的時間會跟著變。`;

  last = { inp, r, n, fireAge, be, name: P.name, persona: P, w, t };
  drawLife();
  drawMore();
  setMiniBar(
    t == null ? '45 年內存不夠退休' : w.now ? '現在就可以退休' : `最快 ${w.year} 年 ${w.month} 月退休`,
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
  const when = t == null ? '還要再努力一下' : w.now ? '現在就可以退休' : `最快 ${w.year} 年 ${w.month} 月就可以退休`;
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
  const { persona: P, r, w, t } = last;
  const btn = $('r-card');
  btn.disabled = true;
  try {
    const { makeCard } = await import('./share-card.js');
    const blob = await makeCard({
      variant: P.variant, name: P.name, tag: P.tag, tint: P.tint,
      kicker: `報酬率 ${pct(r)} 時,我最快`,
      when: t == null ? '還要很久' : w.now ? '現在' : `${w.year} 年 ${w.month} 月`,
      sub: t == null ? '45 年內都存不夠退休' : w.now ? '就可以退休' : `就可以退休(${w.span}後,約 ${w.age} 歲)`,
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
      if (!q.multi && !q.stay && !card.querySelector('.q-more')?.open) setTimeout(() => { if (Number(card.dataset.i) === step) next(); }, 280);
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
      case 'r-edit': step = 0; setPhase('quiz'); renderQuiz(true); break;
      case 'r-share': share(); break;
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
        if (out && item) out.textContent = `每月約 ${nf(2).format(pmt(item.principal, item.rate / 12, Math.round(item.years * 12)))} 萬`;
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
