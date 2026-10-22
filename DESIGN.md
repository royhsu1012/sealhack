# DESIGN.md — sealhack.com(FIRE 試算器)設計系統憲法

> 目的:**防漂移**。任何前端改動都對照本文件;本文件與實作不符時,修其中之一並記錄(審計輪 S10 會抓)。
> Token 的唯一事實來源是 `src/styles/global.css`;本文件是它的「為什麼」與驗收標準。

## 一、設計原則(改版不可violate)

1. **數字是主角**:深色預設;結論卡片、拆解表、圖表承載答案,文案只做一句話結論。
2. **引擎與介面分離**:所有數字來自 `src/lib/fire.js`;介面只負責讀輸入、呈現結果,不在頁面裡另寫公式。
3. **語意色系統**(v3,2026-09,使用者核准放寬):品牌橘仍是**唯一的品牌/CTA 強調色**;
   狀態語意色(綠 pass / 橘 pending / 紅 fail)可用於**資料狀態標籤**(`.tag`,見§二/§六),
   用於檢核表與報酬率判讀。
   鐵律不變:語意色只表**狀態**(驗證等級、通過/進行中/反例),不可拿來裝飾或替代品牌色當 CTA。
4. **克制動效**:只有 `.lift`(hover 上浮 2px + 邊框染色)與透明度過渡;禁止進場動畫、視差、輪播。

## 二、Design Tokens(唯一來源:global.css 的 `:root` / `:root.light`)

| Token | 深色(預設) | 淺色 | 用途 |
|---|---|---|---|
| `--bg` | `#0b0c0e` | `#ffffff` | 頁面底 |
| `--bg-soft` | `#14161a` | `#f6f7f9` | 區塊底、th |
| `--bg-card` | `#16181d` | `#ffffff` | 卡片、modal |
| `--border` | `#262a31` | `#e5e7eb` | 所有邊框 |
| `--fg` | `#e8eaed` | `#16181d` | 主文字 |
| `--fg-muted` | `#9aa3ad` | `#5b6470` | 次要文字(淺色下對白 5.6:1,AA) |
| `--brand` | `#ff5a2c` | `#e8481f` | 強調、CTA、行銷數字 |
| `--aside-note/tip/caution` | 藍 `#3b82f6` / 綠 `#22c55e` / 琥珀 `#f59e0b` | 深一階(`#2563eb`/`#16a34a`/`#d97706`) | Aside 語意色 + `.tag-pass`(=tip)/`.tag-pending`(=caution)共用 |
| `--status-fail` | `#ef4444` | `#dc2626` | `.tag-fail`、現金流圖的負值柱 |
| `--chart-muted/grid/axis/ref` | 灰階四階 | 灰階四階 | 圖表:資料先用灰,品牌橘只標「資產」這條主線 |

**鐵律**:元件/頁面/版面/腳本裡**禁止 raw hex**——一律 `var(--token)` 或 `color-mix(...)`。新色 = 先在 global.css 定 token(深淺兩套)再用。

## 三、字體與字階(實測值)

- 字體:**Inter**(Google Fonts,400/500/600/700/800)+ 系統 fallback;不引入第二字體。等寬用 `--font-mono`。
- 字階:h1 `text-4xl→sm:text-6xl`(36→60px, w800)· h2 `text-2xl→sm:text-3xl`(24→30px, w800)· 正文 16/24 · `.prose` 16/28 · 表格 0.9rem · 小標/eyebrow `text-xs` 大寫字距。
- CJK 行長:文件頁內文欄 ~46 字/行(理想 40–50),**不要加寬內文欄**。
- **排版節奏 v3(2026-09)**:h1/h2/h3 收緊 `letter-spacing:-0.01em`(較有產品感);表格/統計數字一律 `.tabular-nums`
  或 `.sh-table td/th`(已內建等寬數字),對齊感是資料密集頁面的核心。

## 四、版面

- 首頁 = 試算器:`max-w-6xl`,`lg` 以上兩欄 `minmax(0,380px) / minmax(0,1fr)`(左輸入、右結果);`lg` 以下單欄,輸入在上。
- 卡片:`.panel`(`rounded-[0.9rem]` + `border var(--border)` + `bg var(--bg-card)`),內距 `p-4`(輸入)/ `p-5`(結果)。
- 方法頁:`max-w-3xl` 單欄 `.prose`;公式用 `<pre><code>` 純文字,不引入數學排版套件。
- Nav:sticky + `backdrop-blur`;兩個連結(試算器 / 計算方法);`sm` 以下隱藏品牌字樣,只留 S 標誌。

## 五、元件規則

| 元件 | 規則 |
|---|---|
| 輸入欄 `.inp` + `.inp-unit` | 單位寫在欄位內右側;百分比欄位以 % 輸入(`data-pct`),引擎收小數。數字欄位不顯示上下箭頭 |
| 動態清單(貸款 / 年金 / 目標) | 每列 = 名稱 + 刪除鈕一行,數字欄位一行(`.inp-unit.compact`),下方一行衍生數字(月付、折算本金、當年金額) |
| 結論卡片 | 4 張:目標資金、併用所需報酬率(含 `.tag` 判讀)、一次 / 分期累積、最早 FIRE 年份 |
| `.tag` | 只表狀態:檢核結果、報酬率判讀(≤4% 保守即可 / ≤7% 需股票部位 / >7% 偏高) |
| `.sh-table` | 所有結果表共用;`min-width:520px`,手機在容器內橫向捲動;第 2 欄數字不換行 |
| 圖表 | 純 SVG 字串,寬度跟隨容器(resize 重畫),字級固定 11–12px;每個資料點附 `<title>` 懸停說明 |

## 六、無障礙底線

- 觸控目標 ≥40×40px(主題切換);刪除鈕 30px 但與欄位分開排列;所有清單欄位有 `aria-label`。
- 結果區 `aria-live="polite"`;圖表 `role="img"` + `aria-label`。
- 預設深色,`:root.light` 切換;新樣式必須雙主題驗。

## 七、設計驗收清單(改前端後必跑)

1. `npm run build` 零錯誤零警告;`npm test` 全過。
2. 375px 無橫向捲動(`document.documentElement.scrollWidth ≤ 375`);表格在 `.sh-table` 內捲。
3. 淺色主題截圖檢查對比與 token(無寫死顏色)。
4. 改任何計算 → 先改 `tests/fire.test.mjs` 的預期值並說明來源,再改 `src/lib/fire.js`。
