# SealHack

機器學習競賽方法論教學網站 —— **先學會診斷,再讓 AI 動手**。

AI vibecoding 之前的方法論層:教你怎麼問對、怎麼驗證。差異化資產是**每一條方法論主張都附一支可重跑的驗證實驗**;12 條核心主張全數通過文獻 + 沙盒雙驗證(含 1 個官方反例),並用鐵達尼真提交拿到第一個真實 Kaggle 排行榜數據點。

## 這個 repo 長怎樣(研究與前端不分離)

```text
src/                前端(Astro Starlight 網站)
  content/docs/     頁面:index / workflow(八頁)/ claims / cases/titanic / maps / glossary
  components/       ClaimsTable · ValidationList · CasesTable(靜態渲染 src/data/*.json)
  data/*.json       主張 / 案例 / 驗證索引(手維護原始檔)
validation/         研究(Python 腳本,數字的唯一事實來源);build 時複製進 public/validation/ 供下載
scripts/            copy-validation.mjs(唯一 build 前置,把研究內嵌網站)
internal/           MASTER_PLAN / LOOP_LOG / PROMPTS(規劃與歷史)
CLAUDE.md STANDARDS.md   專案憲法與品質標準
```

一條線:`validation/*.py`(研究數字)→ 主張表每列連到對應腳本(可直接下載重跑)→ 數字經 `src/data/*.json` 進元件。

## 開發

```bash
npm install
npm run dev      # 預覽 http://localhost:4321
npm run build    # = copy-validation + astro build,純 Node
```

## 重跑研究(驗證方法論的每條主張)

```bash
pip install -r validation/requirements.txt
python validation/fetch_data.py     # 下載 Titanic 資料(sha256 校驗)
python validation/run_all.py         # 一鍵跑全套,印各主張判決
```

腳本已強制 UTF-8 輸出,Windows 亦可。品質計分板:`python .claude/skills/sealhack-loop/scripts/check.py`。

## 授權與定位

本站是作者的資歷證明,**內容正確性優先於一切**。方法論修改須引文獻或新增可執行的 L2 實驗(見 CLAUDE.md 憲法)。
