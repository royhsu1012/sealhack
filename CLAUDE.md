# CLAUDE.md — sealhack.com 專案憲法 v5(定稿)

## 文件地圖(每份一個職責,重疊即缺陷)
| 文件 | 職責 | 何時讀 |
|---|---|---|
| CLAUDE.md(本檔) | 憲法:定位、結構、不可違反約束 | 每個 session 開頭 |
| README.md | 對外門面:是什麼、線上版、怎麼跑 | GitHub 訪客 |
| STANDARDS.md | 內容/腳本品質標準 S1–S10(check.py 計分) | 改內容或腳本前 |
| DESIGN.md | 設計系統憲法(tokens/元件/驗收) | 改前端前 |
| validation/README.md | 研究目錄導覽:重跑、harness 合約 | 跑驗證前 |
| .claude/skills/sealhack-loop/SKILL.md | 三種輪操作手冊(審計/案例/研究) | 執行迴圈時 |
| internal/LOOP_LOG.md | 狀態+待辦+歷史(頂部每輪改寫) | 每輪開頭 |
| internal/MASTER_PLAN.md | 產品路線圖(Phase 0–3,使用者主權) | 規劃時 |

## 專案是什麼
SealHack:機器學習競賽方法論教學網站。方法論 v2.2 已收斂
(登錄 13 條主張 C1a–C11:12 條文獻+實驗雙驗證,C11 目前僅沙盒、文獻待補;含 1 個官方反例 C3)。
Astro + Tailwind 自訂設計(2026-08 前端打掉重練,取代原 Starlight)。
src/content/docs/ 的 Markdown 與 validation/ 的腳本是唯一事實來源,前端是渲染它們的殼。

## 專案結構(已重練——研究與前端不分離,純 Node build)
```text
src/pages/index.astro       自訂 landing(3 段:hero+數據條 → 金句+看得懂的AutoML+背書+差異化 → 六階段)
src/pages/[...slug].astro    動態路由:用 content collection 渲染 src/content/docs 的每頁
src/content/docs/           頁面內容(方法論散文,MD/MDX):
  claims.mdx(含來源+延伸資源) cases/titanic.mdx  glossary.md  maps/solution.md
  workflow/:quickstart(含學習地圖)· 0-diagnose(含 0.5 清洗)· 1-validate · 2-baseline · 3-features · 4-ensemble(含 5 提交)· small-n
src/layouts/                Base.astro(shell + Nav + Footer)、Doc.astro(側欄 + 內文 + TOC + 上/下頁)
src/components/             Nav / Sidebar / Footer / Aside / ClaimsTable / ValidationList / CasesTable
src/nav.ts                  導覽結構(取代舊 Starlight sidebar)
src/styles/global.css       Tailwind v4 + 設計 tokens(品牌 #E8481F/#ff5a2c、深色預設)
src/data/*.json             主張/案例/驗證索引(手維護原始檔,committed;元件直接 import)
validation/*.py             研究腳本(數字的唯一事實來源);build 時 copy 到 public/validation/ 供下載
scripts/copy-validation.mjs 唯一 build 前置:把 validation/ 複製進 public/(研究內嵌網站)
internal/                   MASTER_PLAN.md / LOOP_LOG.md(規劃與歷史,不建頁面)
DESIGN.md                   設計系統憲法(tokens/字階/間距/元件規則/驗收;防漂移,S10 掃描)
```
- 指令:`npm run dev`(預覽 localhost:4321)、`npm run build`(= copy-validation + astro build + pagefind 索引 dist,不需 Python)。搜尋索引只在 build 後產出,dev 模式無搜尋。
- 改內容 = 編 src/content/docs 的 MD/MDX;改主張/案例數字 = 編 src/data/*.json(對應 validation/ 腳本重跑後,手動同步);改導覽 = src/nav.ts。
- 研究與前端不分離:validation/ 腳本被 build 複製進 public/,主張表每列連到它;數字經 src/data/*.json 進元件。

## 定位(所有文案的依據)
「先學會診斷,再讓 AI 動手」— AI vibecoding 之前的方法論層。
差異化資產:每條方法論主張都附可重跑的驗證實驗(validation/)。
本站同時是作者的資歷證明,內容正確性優先於一切。

## 技術約束(不可違反)
- **Astro + Tailwind 自訂設計**(2026-08 使用者核准前端打掉重練,取代原 Starlight)。靜態輸出、zh-TW、深色為預設。
- 部署:**已上線 https://sealhack.com**(2026-08-25)。Cloudflare Workers 靜態資產(Worker 名 `sealhack`);**CI/CD 已實測:push astro-site → Workers Builds 自動建置部署**(不吃 GitHub Actions 額度)。www 301 轉向 apex;舊 GitHub Pages A 記錄已移除。更新網站 = commit + push,即自動上線。
- 視覺:自訂設計系統,tokens 在 `src/styles/global.css`(品牌色 #E8481F / 深色 #ff5a2c);字體 Inter。
- 版面:`src/layouts/Base.astro`(shell + Nav + Footer)、`Doc.astro`(側欄 + 內文 + TOC + 上/下頁);導覽結構在 `src/nav.ts`。
- 首頁是**自訂 landing**(`src/pages/index.astro`);文件頁由 `src/pages/[...slug].astro` 渲染 `src/content/docs` 的 MD/MDX。
- 元件:ClaimsTable / ValidationList / CasesTable / Aside(靜態渲染 src/data 或 slot)。
- **禁止產品互動功能**:登入、資料庫、後端、表單、診斷工具。允許 UI 層 client JS(主題切換、行動選單、站內搜尋)。
- 站內搜尋:Pagefind 靜態索引(`pagefind --site dist` 於 build 尾段掃 dist,無後端);UI 在 Nav(🔍 / Ctrl⌘K 開 modal,懶載入 /pagefind/,主題色跟隨 tokens);索引標記 `data-pagefind-body`(main)、`data-pagefind-ignore`(側欄/TOC/上下頁)。

## 網站結構(已建置;導覽順序見 src/nav.ts)
```text
首頁 landing(src/pages/index.astro)  hero「先學會診斷,再讓 AI 動手」+ tagline「The simple way to AutoML」;actions [開始→quickstart] [驗證證據→claims]
方法論(group)    quickstart · 0|診斷與清洗 · 1|鎖死驗證 · 2|基線 · 3|特徵 · 4–5|集成與提交 · 小樣本 · 解題地圖(側欄標籤帶階段序號)
證據與參考(group) claims(<ClaimsTable> + 學術來源 + 延伸資源)· cases/titanic(六階段敘事 + <CasesTable>)· glossary(字典表格)
(收斂 2026-08-25:16 頁 → 12 頁——maps/learning→quickstart、resources→claims、0-clean→0-diagnose、5-submit→4-ensemble,舊網址皆 301;六階段「模型」不變,landing 六卡照舊,卡 4/5 同頁)
```
- 各頁內容由拆分前的方法論 monolith 遷移而來(原始檔已刪,現以 src/content/docs 為唯一來源)。
- cases/titanic 的編輯基調:方法論如何得到誠實的 0.828(20 次切分分布,非單次幸運)。關鍵數字:配對 AUC t 檢定
  否決 Title/family/cabin(≤1/20 顯著)、確診票團目標編碼有害(t 中位 −9.98);單模 0.8280±0.020 vs 集成 0.8287±0.018、
  配對差 +0.0007(小樣本集成無紅利,雙提交是保險);真提交 public LB 0.7488/0.7727(內部 CV 高估 0.06~0.09)。
- internal/MASTER_PLAN.md 是內部規劃文件,不建頁面。

## 品質標準與持續優化
- 內容與腳本的可檢查標準:STANDARDS.md(計分板:`python .claude/skills/sealhack-loop/scripts/check.py`,掃 src/content/docs)
- 前端設計的可檢查標準:DESIGN.md(tokens 唯一來源 global.css;S10 禁元件內 raw hex;驗收清單見 §八)
- 方法論優化迴圈(研究階段,已暫停):`.claude/skills/sealhack-loop/SKILL.md`,歷史在 internal/LOOP_LOG.md

## 內容規則
- 不改寫技術內容;保留所有表格、程式碼區塊、ASCII 圖(包 ```text 圍欄);全繁體(檢查見 STANDARDS S5)
- validation/ 由 build 複製進 public/validation/(scripts/copy-validation.mjs);claims 頁的主張表每列連到對應腳本,
  claims 頁附重跑說明「pip install -r validation/requirements.txt && python validation/fetch_data.py」(腳本已強制 UTF-8)
- 每頁 frontmatter(title、description);鐵律與陷阱用 Aside(caution),每頁 ≤3 個
- 首頁 hero 下第一段必含:「幻覺不是最大的危險,『流暢地執行錯誤的方向』才是。」

## 驗收標準(前端重練後現況)
- ✅ npm run build 零錯誤零警告(12 頁 + 4 redirect)
- ✅ 首頁「開始」→ 快速版;方法論各頁用頁尾「下一頁」可從 0-diagnose 走到 small-n(側欄 2 群組、方法論 8 項)
- ✅ /claims 的 <ClaimsTable> 完整渲染(讀 src/data/claims.json:13 條核心主張 + demo/multi,含 L1/L2/L3 驗證層與腳本連結)
- ✅ 手機 375px 無橫向捲動;行動選單(☰)展開全站導覽;寬表格在容器內捲
- ✅ 深色為預設可切換淺色;Shiki 程式碼高亮;文件頁側欄 + TOC + 上/下頁
- ✅ 站內搜尋:Pagefind 靜態索引(build 後掃 dist);🔍 或 Ctrl/⌘K 開啟,深/淺色跟隨主題;dev 模式無索引(僅正式 build 可用)
