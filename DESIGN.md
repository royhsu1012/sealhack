# DESIGN.md — sealhack.com 設計系統憲法

> 目的:**防漂移**。任何前端改動都對照本文件;本文件與實作不符時,修其中之一並記錄(審計輪 S10 會抓)。
> Token 的唯一事實來源是 `src/styles/global.css`;本文件是它的「為什麼」與驗收標準。

## 一、設計原則(改版不可violate)

1. **證據感優先**:深色預設、單一強調色、數字與表格是主角——這是資歷證明站,不是行銷頁。
2. **內容即介面**:前端是 `src/content/docs` 的渲染殼(CLAUDE.md 憲法);設計不得要求改寫內容遷就版面。
3. **一個強調色**:品牌橘之外不引入第二彩色;語意色僅 Aside 三型(note/tip/caution)。
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
| `--aside-note/tip/caution` | 藍 `#3b82f6` / 綠 `#22c55e` / 琥珀 `#f59e0b` | 深一階(`#2563eb`/`#16a34a`/`#d97706`) | 僅 Aside 語意色 |

**鐵律**:元件/頁面/版面裡**禁止 raw hex**——一律 `var(--token)` 或 `color-mix(...)`(check.py S10 掃描,唯一豁免:search modal 遮罩 `rgba(0,0,0,.6)`)。新色 = 先在 global.css 定 token(深淺兩套)再用。

## 三、字體與字階(實測值)

- 字體:**Inter**(Google Fonts,400/500/600/700/800)+ 系統 fallback;不引入第二字體。等寬用 `--font-mono`。
- 字階:h1 `text-4xl→sm:text-6xl`(36→60px, w800)· h2 `text-2xl→sm:text-3xl`(24→30px, w800)· 正文 16/24 · `.prose` 16/28 · 表格 0.9rem · 小標/eyebrow `text-xs` 大寫字距。
- CJK 行長:文件頁內文欄 ~46 字/行(理想 40–50),**不要加寬內文欄**。

## 四、間距與形狀節奏

- Section 垂直節奏:**64px**(`py-16`/`pb-16`);landing 固定 **3 段**(hero+數據條 / 金句+AutoML+背書 / 六階段)。
- 卡片:`p-5` + `rounded-xl`(12px)+ `border var(--border)` + `bg var(--bg-card)`;hover 一律 `.lift`。
- 圓角族:卡片/modal 12px(xl)、按鈕/小元素 8px(lg/md)、pill 全圓。
- 數據條:`gap-px` + `bg:var(--border)` 做 1px 分隔線(不是每格畫框)。

## 五、版面

- Landing:`max-w-4xl`(六階段區 `max-w-5xl`),置中。
- 文件頁:`max-w-7xl` 三欄 `240px / minmax(0,1fr) / 200px`(側欄 / 內文 / TOC);`lg` 以下側欄與 TOC 隱藏(行動選單補位)。TOC 只列 **H2**。
- Nav:sticky + `backdrop-blur` + 82% 透明底;高度 56px;頂列連結 4 個(快速版/方法論/證據/案例),`md` 以下收進 ☰。
- 斷點使用:`sm` 640 / `md` 768 / `lg` 1024,不自訂斷點。

## 六、元件清單(新增元件前先問「刪掉哪個換它進來」)

| 元件 | 規則 |
|---|---|
| Nav | 圖示按鈕 **40×40**(a11y 觸控下限);搜尋 🔍 = Ctrl/⌘K;主題切換寫 `sh-theme` localStorage |
| Sidebar / 行動選單 | 資料來源唯一:`src/nav.ts`(2 群組;方法論帶階段序號標籤) |
| Aside | 三型 note/tip/caution;**每頁 ≤3**(CLAUDE.md 內容規則) |
| ClaimsTable / CasesTable / ValidationList | 靜態渲染 `src/data/*.json`;自帶捲動容器 |
| `.prose table` | `display:block; overflow-x:auto`(表格自己是捲動容器);**≤6 欄**(STANDARDS S6) |
| 搜尋 modal | 懶載入 /pagefind/;`role=dialog aria-modal`;Esc 關閉並還原捲動;色彩走 `--pagefind-ui-*` tokens |
| Footer | 5 連結;不放 sitemap 式長清單 |

## 七、無障礙底線

- 觸控目標 **≥40×40px**;圖示按鈕必有 `aria-label`。
- 對比:正文 AA(muted 文字兩主題皆 ≥4.5:1);不移除 focus outline。
- 主題:預設深色,`:root.light` 切換;兩主題都要能讀(新樣式必須雙主題驗)。

## 八、設計驗收清單(改前端後必跑;審計輪抽驗)

1. `npm run build` 零錯誤;375px 無橫向捲動(`document.scrollWidth ≤ innerWidth`)。
2. 每個 `table`:自身 `overflow-x:auto` 內捲,無被裁切(查 table 本身,不是 parent)。
3. 淺色主題抽 2 頁看對比與 token 完整(沒有「深色寫死」的顏色)。
4. 圖示按鈕 40×40 + aria-label;搜尋 modal Esc 可關。
5. `check.py` S10 = 0(元件/頁面/版面無 raw hex)。
6. Landing 仍為 3 段、hero/金句/tagline 未動(動它們需使用者拍板,CLAUDE.md)。

## 九、修改流程

- 改顏色 → 只改 global.css tokens(兩主題一起)。改字階/間距 → 改本文件同步改實作。
- 新視覺模式(新元件/新動效)→ 先在本文件立條目(含理由與刪換對象)再實作。
- 本文件 ↔ 實作衝突 = 缺陷:修其一,並在 LOOP_LOG 記一行。
