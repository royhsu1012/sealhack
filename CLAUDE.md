# CLAUDE.md — sealhack.com 專案憲法 v5(定稿)

## 專案是什麼
SealHack:機器學習競賽方法論教學網站。方法論 v2.2 已收斂
(12 條主張全數通過文獻+實驗雙驗證,含 1 個官方反例)。
使用 Astro Starlight 官方文件主題,不自造設計系統。
src/content/docs/ 的 Markdown 與 validation/ 的腳本是唯一事實來源,網站是渲染它們的殼。

## 專案結構(v0.1 已建置——研究與前端不分離,純 Node build)
```text
src/content/docs/     頁面(方法論散文,依 sidebar 一頁一檔)
  index.mdx  claims.mdx  cases/titanic.mdx  workflow/*.md  maps/*.md  glossary.md
src/components/        ClaimsTable / ValidationList / CasesTable(靜態渲染 src/data/*.json,非互動)
src/data/*.json        主張/案例/驗證索引(手維護原始檔,committed;元件直接 import)
validation/*.py        研究腳本(數字的唯一事實來源);build 時 copy 到 public/validation/ 供下載
scripts/copy-validation.mjs  唯一 build 前置:把 validation/ 複製進 public/(研究內嵌網站)
internal/              MASTER_PLAN.md(不建頁面)+ legacy-monoliths/(拆分前的原始 MD,歸檔)
```
- 指令:`npm run dev`(預覽)、`npm run build`(= copy-validation + astro build,不需 Python)。
- 改內容 = 編 src/content/docs 的 MD;改主張/案例數字 = 編 src/data/*.json(對應 validation/ 腳本重跑後,手動同步)。
- 研究與前端不分離:validation/ 腳本被 build 複製進 public/,主張表每列連到它;數字經 src/data/*.json 進元件。

## 定位(所有文案的依據)
「先學會診斷,再讓 AI 動手」— AI vibecoding 之前的方法論層。
差異化資產:每條方法論主張都附可重跑的驗證實驗(validation/)。
本站同時是作者的資歷證明,內容正確性優先於一切。

## 技術約束(不可違反)
- Astro + @astrojs/starlight 最新穩定版,靜態輸出,zh-TW locale
- 部署:Cloudflare Pages,網域 sealhack.com
- 視覺一律 Starlight 預設。僅允許:accent #E8481F(src/styles/theme.css)、site title「SealHack」、首頁 hero 文案。
- **元件例外(2026-08 核准)**:為了「研究內嵌前端」,允許極少數**靜態渲染**元件把 src/data/*.json 畫成表格
  (ClaimsTable / ValidationList / CasesTable)。僅止於渲染資料,**不得有互動**。
- 禁止互動功能:登入、資料庫、後端、表單、localStorage、診斷工具、client-side JS 互動。
- Starlight 內建(搜尋、深色模式、目錄、上/下頁)直接用,不重造;UI 繁體字串用 src/content/i18n/zh-TW.json。

## 網站結構(已建置;sidebar 順序見 astro.config.mjs)
```text
首頁 splash(index.mdx)  title「先學會診斷,再讓 AI 動手」;actions [開始→/workflow/0-diagnose] [驗證證據→/claims]
方法論(group)  workflow/0-diagnose · 0-clean · 1-validate · 2-baseline · 3-features · 4-ensemble · 5-submit · small-n
證據(group)    claims(<ClaimsTable> 讀 src/data/claims.json)· cases/titanic(六階段敘事 + <CasesTable>)
地圖(group)    maps/solution · maps/learning
詞彙表          glossary
```
- 各頁內容由拆分前的方法論 monolith 遷移而來(原始檔已刪,現以 src/content/docs 為唯一來源)。
- cases/titanic 的編輯基調:方法論如何得到誠實的 0.828(20 次切分分布,非單次幸運)。關鍵數字:配對 AUC t 檢定
  否決 Title/family/cabin(≤1/20 顯著)、確診票團目標編碼有害(t 中位 −9.98);單模 0.8280±0.020 vs 集成 0.8287±0.018、
  配對差 +0.0007(小樣本集成無紅利,雙提交是保險);真提交 public LB 0.7488/0.7727(內部 CV 高估 0.06~0.09)。
- internal/MASTER_PLAN.md 是內部規劃文件,不建頁面。

## 品質標準與持續優化
- 內容與腳本的可檢查標準:STANDARDS.md(計分板:`python .claude/skills/sealhack-loop/scripts/check.py`,掃 src/content/docs)
- 方法論優化迴圈(研究階段,已暫停):`.claude/skills/sealhack-loop/SKILL.md`,歷史在 internal/LOOP_LOG.md

## 內容規則
- 不改寫技術內容;保留所有表格、程式碼區塊、ASCII 圖(包 ```text 圍欄);全繁體(檢查見 STANDARDS S5)
- validation/ 由 build 複製進 public/validation/(scripts/copy-validation.mjs);claims 頁的主張表每列連到對應腳本,
  claims 頁附重跑說明「pip install -r validation/requirements.txt && python validation/fetch_data.py」(腳本已強制 UTF-8)
- 每頁 frontmatter(title、description);鐵律與陷阱用 Aside(caution),每頁 ≤3 個
- 首頁 hero 下第一段必含:「幻覺不是最大的危險,『流暢地執行錯誤的方向』才是。」

## 驗收標準(v0.1 全數達成)
- ✅ npm run build 零錯誤零警告(15 頁)
- ✅ 首頁 →「開始」→ 用「下一頁」可從 0-diagnose 一路走到 small-n
- ✅ 站內搜尋可搜到「OOF」「配對比較」「主張登錄表」
- ✅ /claims 的主張表(<ClaimsTable>,14 列含 L1/L2/L3 + 腳本連結)完整渲染
- ✅ 手機 375px 無橫向捲動(寬表格在容器內捲)
