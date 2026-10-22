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
反推「想在幾歲退休 → 需要準備多少錢、年化報酬率至少多少」。分兩個版本:
- **簡單版**(`/`,預設入口):目前年齡、想幾歲退休、退休後每月生活費、目前存款與投資、每月能存下;通膨 2%、提領率 4% 固定,不計貸款與年金。
- **完整版**(`/full/`):FIRE 年份、今日生活費、通膨、正職薪資(含成長率與上限)、多筆貸款、勞保 / 勞退年金與其他被動收入、
  一次性財務目標,算出目標資金、一次累積 / 分期累積 / 兩者併用所需報酬率、逐年可投入金額、資產累積路徑、
  負債與現金流檢核、敏感度分析,以及在預期報酬率下最早可 FIRE 的年份。
公式與範例數字的來源是《FIRE 財務規劃計畫書》(Claude Docs),網站的「計算方法」頁是它的公開版。

## 結構
```text
src/lib/fire.js            計算引擎(純函式,無 DOM;唯一事實來源;simpleInputs = 簡單版的固定假設)
src/scripts/shared.js      兩版共用:localStorage 狀態、格式化、滑桿、報酬率量表、底部結果列
src/scripts/simple-app.js  簡單版互動層:5 個滑桿 → 答案 + 「怎麼存到目標」圖
src/scripts/fire-app.js    完整版互動層:讀表單 → 呼叫引擎 → 渲染結果與 SVG 圖表
src/pages/index.astro      簡單版:版本切換 → 答案(需要準備 + 報酬率)→ 5 個滑桿 → 一張圖 → 前往完整版
src/pages/full.astro       完整版:版本切換 → 答案 → 情境 + 6 個滑桿 → 進階設定(收合)→ 圖表
src/pages/method.astro     計算方法:公式、假設與限制(含簡單版)
src/layouts/Base.astro     shell + Nav + Footer
src/components/            Nav / Footer / ModeSwitch / Answer / Knobs / MiniBar
src/styles/global.css    Tailwind v4 + 設計 tokens(淺色預設,可切深色)
tests/fire.test.mjs      引擎測試,數字對齊計畫書範例情境
public/_redirects        舊站網址 301 → 首頁
```
指令:`npm run dev`(localhost:4321)、`npm run build`、`npm test`。

## 不可違反約束
- **靜態網站、純前端計算**:不做登入、資料庫、後端、追蹤;使用者輸入只存在其瀏覽器 localStorage。
- **計算只寫在 `src/lib/fire.js`**:頁面不得另寫公式。改公式 = 同步改 `tests/fire.test.mjs`、`method.astro` 與計畫書。
- 金額單位一律新台幣萬元;比率在引擎內為小數、介面以 % 顯示。
- 結果文案不得出現投資建議或保證語氣;頁尾保留「不構成投資建議」聲明。
- Astro + Tailwind v4,zh-TW,淺色預設;tokens 只在 global.css 定義(見 DESIGN.md)。

## 部署
Cloudflare Workers 靜態資產(Worker 名 `sealhack`):push `astro-site` → Workers Builds 自動建置上線。
**push 到 astro-site = 立刻上線**;改版先在分支驗證,合併前先跑 `npm run build && npm test`。
Workers Builds 的 build 指令若仍是舊的(含 pagefind / copy-validation),需改為 `npm run build`。

## 驗收
- `npm run build` 零錯誤零警告;`npm test` 全過。
- 320 / 375 / 768 / 1280px 無橫向捲動;淺 / 深色都可讀(淺色預設)。
- 簡單版預設(35 歲、50 歲退休、月花 6 萬、資產 300 萬、每月存 5 萬)顯示:需要準備 2,423 萬、報酬率至少 6.4%。
- 完整版預設情境「單身有房」顯示:50 歲退休需 1,937 萬、報酬率至少 4.0%、最早 49 歲(2040)財務自由、資金撐到 95 歲。

## 介面原則(2026-10 第三版)
- 反推優先:兩版首屏都是「想在 N 歲退休 → 需要準備多少、報酬率至少多少」。
- 簡單版是預設入口,只放 5 個滑桿和 1 張圖;複雜的東西(情境、貸款、年金、大額支出、預期報酬、其餘圖表)只在完整版。
- 完整版結果以圖為主:報酬率量表、一生資產曲線、退休所需瀑布圖、每年存款柱狀圖、影響退休年齡龍捲風圖、財務體檢;不放大型表格。
