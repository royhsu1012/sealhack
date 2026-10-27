// 測驗題目:頁面用來產生卡片,quiz-app.js 用來套用答案。
// slider:主滑桿;choices:點了就選(multi 可複選);more:「細項」裡的欄位(不填就用預設值);list:細項裡的清單編輯器。

export const QUESTIONS = [
  {
    id: 'age', title: '你現在幾歲?', hint: '用來算還要工作幾年;退休後的生活費預設算到 95 歲,細項可以改。',
    slider: { key: 'age', min: 20, max: 65, step: 1, unit: '歲' },
    more: [{ key: 'endAge', label: '預計活到', unit: '歲', min: 80, max: 110, step: 1, hint: '退休後的生活費算到這一年;家族長壽或想保守一點,就設高一些。' }],
  },
  {
    id: 'dream', title: '理想中,你想幾歲退休?', hint: '挑一個理想退休年齡,結果會告訴你來不來得及。',
    key: 'fireAge', choices: [45, 50, 55, 60, 65].map((v) => ({ v, label: `${v} 歲` })),
    more: [{ key: 'fireAge', label: '自己填', unit: '歲', min: 30, max: 75, step: 1 }],
  },
  {
    id: 'spend', title: '你每個月大概花多少?', hint: '不含貸款;退休後也照這個水準生活。',
    key: 'monthlyExpense',
    choices: [
      { v: 4, label: '簡約', sub: '每月 4 萬' },
      { v: 6, label: '舒適', sub: '每月 6 萬' },
      { v: 9, label: '寬裕', sub: '每月 9 萬' },
      { v: 12, label: '享受', sub: '每月 12 萬' },
    ],
    more: [
      { key: 'monthlyExpense', label: '每月生活費', unit: '萬', min: 1, max: 20, step: 0.5 },
      { key: 'inflation', label: '通膨率', unit: '%', min: 0, max: 5, step: 0.1, pct: true },
    ],
  },
  {
    id: 'income', title: '每個月稅後收入多少?', hint: '年終獎金平均攤進每個月。',
    slider: { key: 'monthlyIncome', min: 2, max: 50, step: 0.5, unit: '萬' }, feedback: true,
    more: [
      { key: 'salaryGrowth', label: '每年加薪', unit: '%', min: 0, max: 10, step: 0.5, pct: true },
      { field: 'salaryCap', label: '每月收入上限', unit: '萬', scale: 12, placeholder: '不設上限', hint: '加薪到這裡就停;留空代表不設上限。' },
    ],
  },
  {
    id: 'assets', title: '現在有多少存款與投資?', hint: '銀行存款、股票、基金都算;不含自住的房子。',
    slider: { key: 'assets', min: 0, max: 10000, step: 10, unit: '萬' },
    more: [{ key: 'emergencyMonths', label: '緊急預備金', unit: '個月', hint: '先從存款撥出這幾個月的生活費放定存,不拿去投資;之後每年隨生活費調高。', min: 0, max: 24, step: 1 }],
  },
  {
    id: 'loans', title: '有房貸或其他貸款嗎?', hint: '退休時還沒還完的,會算進需要準備的錢。',
    choices: [
      { v: 'none', label: '沒有' },
      { v: 'home', label: '有房貸' },
      { v: 'other', label: '車貸或信貸' },
      { v: 'both', label: '都有' },
    ],
    list: 'loans',
  },
  {
    id: 'goals', title: '未來有大額支出嗎?', hint: '可以複選;支出前 3 年會先平均存好。金額和年份在細項裡改。', multi: true,
    choices: [
      { v: 'wedding', label: '結婚' },
      { v: 'kids', label: '小孩教育' },
      { v: 'car', label: '換車' },
      { v: 'house', label: '買房頭期款' },
      { v: 'none', label: '都沒有' },
    ],
    list: 'goals',
  },
  {
    id: 'pension', title: '勞保、勞退要算進去嗎?', hint: '退休後每月領的錢,可以少準備一些。',
    choices: [
      { v: 'yes', label: '要', sub: '先用估計值' },
      { v: 'no', label: '先不算', sub: '保守一點' },
    ],
    list: 'incomes',
  },
  {
    id: 'style', title: '你的投資風格比較像?', hint: '只是假設的年化報酬率,不是保證;結果頁還能再拉。',
    key: 'assumedReturn',
    choices: [
      { v: 0.04, label: '保守', sub: '報酬率約 4%,起伏小' },
      { v: 0.06, label: '穩健', sub: '報酬率約 6%' },
      { v: 0.08, label: '積極', sub: '報酬率約 8%,起伏大' },
    ],
    more: [{ key: 'assumedReturn', label: '自己填', unit: '%', min: 0, max: 20, step: 0.5, pct: true }],
  },
  {
    id: 'start', title: '每月存下的錢,什麼時候開始定期定額?', hint: '越早投入,複利跑得越久;開始之前存下的錢先算放定存。金額在細項裡設定。',
    key: 'investDelay', delayFeedback: true, stay: true,
    choices: [
      { v: 0, label: '已經在做', sub: '或這個月就開始' },
      { v: 1, label: '1 年後' },
      { v: 3, label: '3 年後' },
      { v: 5, label: '5 年後' },
      { v: 10, label: '10 年後' },
    ],
    more: [
      { field: 'dcaMonthly', label: '每月定期定額金額', unit: '萬', placeholder: '全部投入', hint: '留空代表每月存下的錢全部投入;填了金額,沒投入的部分放定存。' },
      { key: 'cashRate', label: '定存利率', unit: '%', min: 0, max: 4, step: 0.1, pct: true, hint: '還沒投入的錢放銀行的年利率。' },
    ],
  },
];

// 選項帶入的預設值(今日幣值;年份以今年為 0 的相對值)
export const LOAN_DEFAULTS = {
  home: { name: '房貸', principal: 800, years: 30, rate: 0.023, grace: 0 },
  other: { name: '車貸', principal: 50, years: 4, rate: 0.03 },
};
export const GOAL_DEFAULTS = {
  wedding: { name: '結婚', amount: 60, yearOffset: 2 },
  kids: { name: '小孩教育', amount: 200, yearOffset: 8 },
  car: { name: '換車', amount: 80, yearOffset: 3 },
  house: { name: '買房頭期款', amount: 300, yearOffset: 5 },
};
export const PENSION_DEFAULTS = [
  { name: '勞退月退休金', monthly: 1, startAge: 60 },
  { name: '勞保老年年金', monthly: 2, startAge: 65 },
];
