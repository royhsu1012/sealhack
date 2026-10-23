# CLAUDE.md — sealhack.com(FIRE 財務規劃試算器)專案憲法

> 2026-10-22 改版:sealhack.com 由 Kaggle 方法論教學站整站改為 FIRE 試算器(使用者決定)。
> 舊站內容保留在 git 歷史(`astro-site` 分支改版前的 commit),不再維護。

## 文件地圖
| 文件 | 職責 |
|---|---|
| CLAUDE.md(本檔) | 定位、結構、不可違反約束 |
| README.md | 對外門面:是什麼、怎麼跑 |
| DESIGN.md | 設計系統(tokens / 元件 / 驗收) |

## 專案是什麼
一個像 MBTI 的退休測驗(2026-10-23 起取代簡單版 / 完整版,`/full/` 301 回首頁):
開場 → 9 張題目卡(點選項就跳下一題;「細項」可不填、用預設值)→ 結果。
結果:退休人格(存錢力 × 投資風格 → 6 種海豹)、照報酬率 r 最快幾年幾月退休、理想退休年齡來不來得及(撐到 95 歲需要準備多少 vs 存得到多少)、
「想再快一點」、報酬率滑桿(標出理想退休年齡的最低報酬率,下方連到投資方法頁)、一生資產的機率範圍(1,000 次蒙地卡羅:中位數、P25–P75、P10–P90、
撐到 95 歲的機率、九成把握的最快退休時間);
其餘圖表收在「更多分析」。

**投資方法頁 `/invest/`**(2026-10-23 起):從最低報酬率出發(讀 localStorage,算歷史上持有 10 / 20 年達到的比例)→ 結論五原則 → 每月做法 →
個股檢查表 → 8 段歷史數據檢驗(台股報酬指數 2003 起、美股含息 1928 起、Shiller CAPE)→ 六本書摘要與方法
(馬朱利《持續買進》、柏格、巴菲特股東信、蒙格、馬克斯《掌握市場週期》、李錄)。只講原則與數據,不推薦標的。
《持續買進》是主軸(使用者決定),有自己的分頁 `/invest/keep-buying/`;兩頁上方用分頁切換(InvestTabs)。
退休前後都用同一個 r。生活費算到「預計活到幾歲」(`inputs.endAge`,預設 95,第 1 題細項 80–110;引擎用 `endAgeOf(inp)`)。
原始公式來自《FIRE 財務規劃計畫書》(Claude Docs)。2026-10-23 起網站改用「需要準備 = 以 r 撐到 95 歲」取代 4% 提領率(使用者決定),
計畫書尚未同步;`computePlan` 仍保留計畫書的 4% 模型與範例數字(測試用)。網站的「計算方法」頁是目前的公開版。

## 結構
```text
src/lib/fire.js            計算引擎(純函式,無 DOM;唯一事實來源):needBreakdown / fundNeeded / fundAtFire /
                           breakEvenReturn / earliestFireTime / personaOf / levers /
                           monteCarlo / successRate / earliestFireTimeAt / volatilityOf(固定種子的蒙地卡羅)
src/scripts/quiz-config.js 題目卡內容與選項預設值(貸款、大額支出、年金)
src/scripts/quiz-app.js    測驗互動層:開場 / 題目卡 / 結果三階段(<html data-phase>)
src/scripts/charts.js      結果頁 SVG 圖表(一生資產機率範圍、交叉圖、瀑布圖、每年存款、影響因素)
src/scripts/seal.js        海豹吉祥物 SVG 與 6 種退休人格
src/scripts/shared.js      localStorage 狀態、格式化、滑桿、圖表小工具、底部結果列
src/pages/index.astro      測驗頁(開場 → 題目卡 → 結果)
src/pages/method.astro     計算方法:公式、假設、題目預設值與退休人格
src/pages/invest.astro     投資方法・總覽:你的報酬率 vs 歷史、五原則、數據檢驗、六本書(圖表是 HTML 長條,建置時產生)
src/pages/invest/keep-buying.astro 投資方法・持續買進:你該專心存錢還是投資(saveVsInvest)、書中 17 個觀點、6 段數據、8 個做法
src/data/keep-buying.js    《持續買進》的觀點與做法(自己的話)
src/components/Formula.astro 方法頁的公式框:一行一式、上下標,手機不在式子中間折行
src/data/books.js          六本書的摘要與方法(自己的話,不引用原文)
src/data/evidence.json     歷史數據統計結果(由 scripts/evidence.mjs 產生,勿手改)
scripts/evidence.mjs       抓 FinMind / multpl 公開資料 → 算統計 → 寫 evidence.json(`npm run evidence`;原始資料快取在 scripts/evidence-raw/,不進 git)
src/layouts/Base.astro     shell + Nav + Footer
src/components/            Nav / Footer / MiniBar
src/styles/global.css    Tailwind v4 + 設計 tokens(淺色預設,可切深色)
tests/fire.test.mjs      引擎測試,數字對齊計畫書範例情境
public/_redirects        舊站網址 301 → 首頁
```
指令:`npm run dev`(localhost:4321)、`npm run build`、`npm test`。

## 不可違反約束
- **靜態網站、純前端計算**:不做登入、資料庫、後端、追蹤;使用者輸入只存在其瀏覽器 localStorage。
- **計算只寫在 `src/lib/fire.js`**:頁面不得另寫公式。改公式 = 同步改 `tests/fire.test.mjs`、`method.astro` 與計畫書。
  歷史數據的統計只寫在 `scripts/evidence.mjs`(離線跑,結果存成 JSON);頁面只做顯示格式。
- **文字依 DESIGN.md 第六節「文字規範」**:用詞表(最快、理想退休年齡、需要準備、撐到 95 歲、大額支出……)、數字格式、標點。
- 金額單位一律新台幣萬元;比率在引擎內為小數、介面以 % 顯示。
- 結果文案不得出現投資建議或保證語氣;頁尾保留「不構成投資建議」聲明。投資方法頁只講書中原則與歷史數據,不點名任何特定標的。
- Astro + Tailwind v4,zh-TW,淺色預設;tokens 只在 global.css 定義(見 DESIGN.md)。

## 部署
Cloudflare Workers 靜態資產(Worker 名 `sealhack`):push `astro-site` → Workers Builds 自動建置上線。
**push 到 astro-site = 立刻上線**;改版先在分支驗證,合併前先跑 `npm run build && npm test`。
Workers Builds 的 build 指令若仍是舊的(含 pagefind / copy-validation),需改為 `npm run build`。

## 驗收
- `npm run build` 零錯誤零警告;`npm test` 全過。
- 320 / 375 / 768 / 1280px 無橫向捲動;淺 / 深色都可讀(淺色預設)。
- 「先看範例結果」(單身有房:35 歲、50 歲退休、月花 6 萬、月收 15 萬、加薪 3%、資產 300 萬、房貸 + 車貸、報酬 6%)顯示:
  悠哉海豹、最快 13 年 1 個月後(約 48 歲)、50 歲來得及且多出 557 萬(需要 1,716 萬・存得到 2,273 萬)、最低報酬率 4.6%。
  一生資產:50 歲退休撐到 95 歲的機率 79%、最差一成 78 歲用完;九成把握最快約 16 年 4 個月後(約 51 歲)。
- 投資方法頁(範例情境):最低報酬率 4.6%、你選的 6%;台股任 10 年達到 100% / 92%,美股任 20 年 97% / 95%。
  (「幾年幾月」從今天起算,日期會隨時間變。)
- 一路按「下一題」不改答案(沒有貸款、沒有大額支出)→ 勤勞海豹。

## 介面原則(2026-10 第五版:退休測驗)
- 一次只問一題;選擇題點了就跳下一題;細項可不填。不分簡單 / 完整版,複雜度靠「細項」與「更多分析」收起來。
- 結果頁一個主答案(最快幾年幾月退休),其餘依序是理想退休年齡、想再快一點、報酬率滑桿、一生資產;其他圖表只在「更多分析」。
- 可愛有趣但不幼稚:海豹吉祥物、粉彩卡片、圓角、輕微彈跳動效(尊重 reduced motion);文字不給投資建議。
