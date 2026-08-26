# SealHack 持續優化迴圈日誌

> 兩種輪:①**方法論研究輪**(暫停,要續研究 `/loop`)②**專案審計輪(每小時,現行)**,見下方「審計輪」。
> 流程見 `.claude/skills/sealhack-loop/SKILL.md`,標準見 `STANDARDS.md`。
> 頂部「目前狀態」每輪改寫;「規則變更」與輪次紀錄只追加。舊輪次壓成一行(整理輪處理)。

## 目前狀態

**★ 狀態(2026-08-25):已上線 https://sealhack.com,收斂完成 12 頁。** Astro + Tailwind 自訂設計、深色預設;build 12 頁 + 4 redirect 零錯誤、pagefind Indexed 12;計分板全綠(25/25 腳本、0 簡體、0 斷連結);導覽 2 群組(方法論 8 項帶階段序號 / 證據與參考 3 項)、landing 3 段;六階段模型不變。
**2026-08-25 里程碑(細節見底部各輪紀錄)**:文件校準(主張數統一 13 條 C1a–C11、清 Starlight 殘留)→ Pagefind 搜尋加回(🔍/Ctrl⌘K)→ 部署上線(Workers 靜態資產 + sealhack.com + www 301;push 自動建置部署)→ 收斂 16→14→12 頁(maps/learning→quickstart、resources→claims、0-clean→0-diagnose、5-submit→4-ensemble,皆 301)+ glossary 字典化(302→158 行)。

**審計:連續全綠 16 輪(A12–A27,至 2026-08-26 15:23;基準 14 條主張/25 支腳本,案例頁含七場總表)。**
**審計輪(每小時,現行)** — 目的是**抓不一致、不修錯**。固定六查,只修「不會有第二種正確答案」的錯,其餘寫進待辦標「待使用者判斷」:
1. `npm run build` 零錯誤零警告(12 頁 + 4 redirect;pagefind Indexed 12)。
2. `python .claude/skills/sealhack-loop/scripts/check.py` 硬錯誤 0、計分板不得變差。
3. **文件對現況**:grep 有無新的 Starlight/舊路徑/已刪檔殘留;CLAUDE.md 結構、驗收標準、頁數是否仍真。
4. **數字對資料**:散文裡的主張數、LB、統計量對得上 src/data/*.json 與 validation/ 腳本輸出(S1)。
5. **內部連結**:check.py 斷連結 = 0;nav.ts 每個 slug 都有對應頁。
6. **無回歸**:landing 的 nClaims/nScripts/bestLB 動態值與敘述一致;Aside 每頁 ≤3。
只發現、不亂改:方法論結論、文案、定位句、刪整節 → 一律寫待辦等使用者,不自行改(§停下來等使用者)。

**Git**:同步到 `origin/astro-site`(tracking;之後同步 = commit + `git push`)。遠端只有 astro-site 一支。
**★ 已上線(2026-08-25)**:https://sealhack.com = Cloudflare **Workers 靜態資產**(Worker 名 `sealhack`,連 GitHub astro-site 分支;非 Pages)。www 301 → apex(proxied CNAME + Redirect Rule 模板)。舊 GitHub Pages 站的 4 筆 A 記錄已刪(使用者拍板,舊「AI 數位分身」站自此網域下線)。**重新部署(已實測 2026-08-25)**:push astro-site → Cloudflare Workers Builds **自動建置並部署**(commit 3dc59b6 → deployment 474facc0,~2 分鐘上線;不吃 GitHub Actions 額度)。
**使用者一次性動作(loop 不能代勞)**:① (可選)預設分支改名 main ② Kaggle 競賽頁按 Join 解鎖真提交(待辦 3)。

**環境**:`validation/requirements.txt` 已 pin(lightgbm 4.7.0 / sklearn 1.9.0 / pandas 3.0.5 / scipy 1.18.0 / numpy 2.5.2,Python 3.12)。
本機 venv:`…/scratchpad/.venv`(session 專屬;新 session 用 `uv venv --python 3.12 && uv pip install -r validation/requirements.txt` 重建)。
一鍵重跑:`python run_all.py`(全套 ~40 分)或 `--fast`(數秒級 4 支)。語言檢查用 opencc(`uv pip install opencc-python-reimplemented`,非驗證相依,check.py 沒它會退回手工清單)。
跑腳本:cwd=`validation/`、`python fetch_data.py && python <script>.py`;kaggle 指令先 `export USERPROFILE='C:\Users\royhs'`。

**憑證**:Kaggle token 有效(第 3 輪 venv 唯讀 `kaggle competitions list` 認證通過);Titanic 規則已接受(userHasEntered=True)。
其他目標競賽需使用者在網站按 Join 接受規則,API 才能下載/提交。**迴圈不得寫入 token,只用唯讀 list 驗證、不 peek 檔案內容。**

**覆現狀態(2026-08-22,本機)**:13 條主張(C1a–C11)全部與文件一致;C7b 改 5 seeds 相對判準(5/5 ✅);
案例 case_titanic_v2(20 切分:單模 0.8280±0.020、集成 0.8287±0.018、配對差 +0.0007 t=0.26);
C9/C10 small_n_paired v2(配對差 std ≈ 分數 std 的 1/4;票團有害 0/20、Title/family 1/20;C10 |Δ|≈0.0001)。
**L3 實戰**:Titanic 真提交 CV 0.8373 → public LB 單模 0.7488 / 集成 0.7727;內部驗證高估 0.06~0.09(§16.8)。
**多案例(§16.9,multi_case_real.py)**:同一套 harness 在 breast_cancer/diabetes/digits(二分類/迴歸/多分類)皆完成;乾淨資料 CV−holdout ≈ 0,對比 Titanic 0.06~0.09 = 分布差非方法論。

**計分板(2026-08-25 文件校準後)**:
```text
  [S5] content/ 簡體字行數           0   (code 0 / prose 0)   目標 0   ✅
  [S5] OpenCC 誤轉次數               0   目標 0                        ✅
  [S4] validation 腳本可編譯 / UTF-8 / doc   25/25 全數
  [S4] requirements 全 pin ✓   fetch_data.py ✓
  [S6] 無語言標籤的 code fence       0   目標 0                        ✅
  [日誌] LOOP_LOG 結構             ✓
  硬錯誤 0
```

**待辦(優先序;每輪挑第一個未完成且未阻塞的。內容類全完成,唯一未完成 = 待辦 3(阻塞,等使用者接受競賽規則))**:
1. [x] 可重跑性止血 —— 第 1 輪
2. [x] 鐵達尼案例重做 + C9/C10 升級 —— 第 2、3 輪
3. [ ] **多案例掃描（整條阻塞：6 個競賽全部 entered=False，等使用者按 Join 接受規則）**。使用者 2026-08-22 指示「把能實驗的 Kaggle 都用快速模型跑一遍」。做法:通用 harness 已就緒(harness.py,第 10 輪;submit_titanic 位元重現證等價)。新競賽 = 寫該賽的 feature_fn + config(id/target/metric/models),呼叫 harness.run_cv/greedy_select/caruana/write_submission。harness 二分類/迴歸/多分類三路徑已測(harness_selftest.py);T4 時間序列傳 TimeSeriesSplit folds 即可。每輪一個競賽。目標(依優先):
   - [x] titanic(T1 二分類,Acc)—— 第 4 輪
   - [ ] **playground-series-s6e8（進行中,2026-08-31 截止,有真實私榜,最高優先）** —— 阻塞:等規則
   - [ ] spaceship-titanic（T1 二分類 ~8700,Acc）—— 阻塞:等規則
   - [ ] house-prices-advanced-regression-techniques（T3 迴歸,RMSE/log）—— 阻塞:等規則
   - [ ] digit-recognizer（T2 多分類 10 類,像素;快速 LGBM）—— 阻塞:等規則
   - [ ] nlp-getting-started（T7 文字;快速 = TF-IDF+logreg）—— 阻塞:等規則
   - [ ] store-sales-time-series-forecasting（T4 時間序列）—— 阻塞:等規則
4. [x] Kaggle 真提交(Titanic)—— 第 4 輪
5. [x] **修模板與措辭(全部完成)**:§6.1 hill_climb 權重(第 6 輪)、§1.3 shuffle + 標題(第 6 輪)、§3.3 可執行 + AutoML/只信CV 對齊(第 7 輪)、決策統計兩套合一(第 8 輪)
6. [x] 語言清理:簡體 code block、OpenCC 誤轉、sealhacl.com、CLAUDE.md §2.0 指向、裸 fence 全部歸零(opencc s2t 權威轉換)—— 第 9 輪

## 第二階段任務(2026-08-23,使用者新指示:研究強化框架 + 實際驗證 + 做好引用)
7. [x] **文章與專案引用(使用者強調)—— 完成(第 16、24 輪)**:claims 頁「學術來源與延伸閱讀」11 個來源全查證真實 URL/DOI;per-workflow 頁 延伸閱讀連結為選配(避免太複雜,先集中一處)。原文續寫如下
   原:**文章與專案引用**:為每個流程階段找**真實**的學術論文 / 文章 / 知名網站專案來源,
   用 WebSearch 查證(**不得捏造 URL 或作者**),放進對應 workflow 頁的「延伸閱讀」+ claims 參考來源。
   核心技術與其經典來源(待查證後填):Stacking(Wolpert 1992)、Ensemble selection/爬山(Caruana 2004)、
   目標編碼(Micci-Barreca 2001)、配對 t/CV 推論(Nadeau–Bengio 2003、Dietterich 1998)、
   偽標籤(Lee 2013)、蒸餾(Hinton 2015)、Adversarial validation、MLWave Ensembling Guide、
   Abhishek Thakur《Approaching (Almost) Any ML Problem》、Kaggle Grandmasters Playbook(NVIDIA)、Chris Deotte。
8. [x] **快速版 vs 完整版(避免太複雜)—— 第 17 輪**:六階段拆成兩層——「最短完賽路(快速版)」= 每階段只留必要動作;
   「完整版」= 現有全部深度。對應學習地圖路徑 A / B。可在 workflow 頁用 Aside 或首頁分流。
9. [ ] **繼續研究強化框架 + L2 驗證**:找框架缺口,新增/修改可執行實驗(維持 STANDARDS S1–S8;數字可追溯)。
10. [x] **站內搜尋(Pagefind)—— 2026-08-25 使用者核准後加回**:`pagefind@1.5.2` devDep;build 尾段 `pagefind --site dist`;Nav 加 🔍/Ctrl⌘K modal(懶載入 /pagefind/、自訂中文 translations、主題色跟隨 tokens);`data-pagefind-body`(main)+ `data-pagefind-ignore`(側欄/TOC/上下頁)。實測:16 頁索引、「集成」→12 結果連到 /workflow/4-ensemble/、Esc 關閉還原捲動。dev 模式無索引(onerror 顯示提示),與原 Starlight 行為一致。

## 規則變更(只追加)
- 2026-08-23|check.py 加「內部斷連結」計分項(S6),從原始檔推路由、不依賴 build|第 29 輪:網站要上線,斷連結是真缺陷,該常設檢查
- 2026-08-23|S2 加「判準必須測主張本身,不是更嚴格替身」|第 21 輪 seed std 閘門給假 ❌(第二次:第 14 輪 run_all ❌ 啟發式同類)
- 2026-08-23|新增 S9:所有外部引用(論文/文章/專案)必須 WebSearch 查證存在,附可驗證 URL/DOI;寧缺勿捏造|使用者新指示要求做好引用
- 2026-08-22|建立 STANDARDS.md(S1–S8)、sealhack-loop skill、check.py 計分板|第 1 輪:C7b 絕對門檻翻盤、案例單次切分當結論、覆現三度被環境問題擋住
- 2026-08-22|SKILL「停下來」放寬:結論反轉達 S2 就直接改+留修訂史(僅首頁文案/定位句要等)|第 2 輪使用者「你執行」授權
- 2026-08-22|STANDARDS S4 加「同一案例特徵只定義一次」|第 2 輪:small_n_paired 與 case_titanic base 特徵不同,§16.3 t 值無法與案例互證
- 2026-08-22|SKILL 加「真提交後不追分(§13)、規則接受是使用者閘門」|第 4 輪:多競賽掃描需防 LB-probing
- 2026-08-22|抽出 harness.py(通用管線),submit_titanic 改用之並位元重現 round-4 輸出|第 10 輪:為競賽掃描解鎖後即插即用做準備;case_titanic_v2 不動(其數字是 §16 依據)
- 2026-08-22|check.py 簡體檢查改用 opencc s2t 為權威(手工 SIMP 為 fallback),並擴充手工清單|第 9 輪:手工清單漏 体/吗/后/径/征/侦 等字,給過假 0——計分板本身不可信就守不住「不得變差」
- 2026-08-22|整理輪:壓縮第 1–3 輪為摘要、合併 SKILL 三條 Kaggle 規則為兩條、更新過時計分板/憑證狀態|第 5 輪。檢視 S1–S8 與 SKILL 各規則:全部可追溯到真實事件,無死規則可刪

---

## 輪次摘要(1–3,整理輪壓縮;數字的真正來源在 content/ 與 validation/)
- **第 1 輪|可重跑性止血**:fetch_data.py(sha256)、7 腳本 UTF-8 防呆、requirements pin、C7b 判準改 5 seeds 相對(5/5 ✅,原絕對門檻在 seed 2 失敗)。覆現 13 條主張(C1a–C11)全部與文件一致。
- **第 2 輪|鐵達尼案例重做 case_titanic_v2.py(20 切分)**:推翻「集成降級 -0.043」為評估不對等 + 268 人單次噪音的假象;同一種量下集成≈單模(+0.0007,t=0.26),CV−私榜 <0.01。改寫 §16.6/16.7、§12.2、CLAUDE.md;舊 case_titanic.py 標為修訂史。
- **第 3 輪|C9/C10 升級 small_n_paired v2**:共用 case_titanic_v2 特徵(消 S4 分歧);配對差 std≈分數 std 的 1/4;票團有害 0/20、Title/family 僅 1/20(單次的 2.22/2.83 留修訂史);C10 |Δ|≈0.0001。改寫 §16.2/16.3/§15/§12.2。憑證確認有效。

---

## 輪次摘要(4–6,整理輪壓縮)
- **第 4 輪|Kaggle 真提交(Titanic)L3**:submit_titanic.py 兩份提交,CV 0.8373 → public LB 單模 0.7488 / 集成 0.7727;內部驗證高估 0.06~0.09(§16.8);登錄表示範 L3 → ✅。SKILL 加「真提交不追分、規則接受是使用者閘門」。
- **第 5 輪|整理輪**:壓縮第 1–3 輪、合併 SKILL Kaggle 規則(5→4)、更新過時計分板/憑證;檢視 S1–S8 無死規則。
- **第 6 輪|修 §6.1 hill_climb 權重**:hill_climb_weights.py 證實舊 used 記帳錯(和 1.75 vs 正解 1.0);改回傳 weights(和=1)+ blend();順修 §1.3 shuffle、標題 v2.2。

---

## 輪次摘要(7–11,整理輪壓縮)
- **第 7 輪|§3.3 可執行**:run_experiment_demo.py dogfood(4 OOF + experiments.csv);GLOSSARY AutoML/只信CV 對齊 §4.0/§13。
- **第 8 輪|決策統計合一**:配對比較升格為所有 n 的預設(§5.1),0.5×std 降快篩;引變異恆等式 + Nadeau–Bengio。待辦 5 完成。
- **第 9 輪|語言清理**:content 全繁化(opencc s2t 權威 + 還原異體字)、OpenCC 誤轉/裸 fence/錯字全 0;check.py 簡體檢查改 opencc 權威。待辦 6 完成。
- **第 10 輪|抽出 harness.py**(整理輪):通用管線,submit_titanic 改用之並位元重現 round-4;壓縮第 4–6 輪。
- **第 11 輪|harness 通用性**:harness_selftest.py 驗證二分類+迴歸;metric_fn 約定「越高越好」。

## 輪次摘要(12–16,整理輪壓縮)
- **第 12 輪|harness 多分類 head**:run_cv 改形狀無關((n,) 與 (n,k)),Titanic 位元重現不變;二分類/迴歸/多分類三路徑全測(harness_selftest)。
- **第 13 輪|多案例真實資料**(multi_case_real.py):breast_cancer/diabetes/digits 皆端到端完成;乾淨資料 CV−holdout≈0,對比 Titanic 分布差(§16.9)。
- **第 14 輪|run_all.py 一鍵重跑**:11 支全乾淨跑完、零回歸;修 run_all 判準(輸出的 ❌ 是資料/修訂史,非失敗,改用退出碼)。
- **第 15 輪|整理輪 + 停點**:壓縮 7–11;確認方法論階段達停點(待辦 3 競賽掃描阻塞於使用者接受規則)。
- **第 16 輪|文章與專案引用(第二階段開工)**:claims 頁「學術來源與延伸閱讀」11 個來源全 WebSearch 查證真實 URL/DOI;立 STANDARDS S9(引用寧缺勿捏造)。

## 輪次摘要(17–22,整理輪壓縮;數字在 validation/ 各腳本 + content/)
- **第 17 輪|快速版**:workflow/quickstart.md(七步最短完賽路)+ sidebar 首項 + 首頁分流。對應學習地圖路徑 A。
- **第 18 輪|AUC rank 平均【推翻】**(rank_vs_prob_auc.py):尺度相近時無優勢(勝 4/20)、尺度差異大才有益(10/10,+0.0077);新增 C11 + 修訂史。
- **第 19 輪|群組聚合差值/比值【校準】**(group_aggregation_features.py):加聚合本身是大頭(+0.16),差值/比值額外增益小(<0.004);克制不加弱主張。
- **第 20 輪|整理輪**:壓縮 12–16、複查規則。
- **第 21 輪|多 seed 平均【校準】**(seed_averaging.py):不虧、增益小且隨模型方差而定;S2 加「判準必須測主張本身」。
- **第 22 輪|log1p【條件化】**(log1p_regression.py):近對稱略差、偏斜越重效益越大;校準 §1.2/§0.5。

## 輪次摘要(23–27,整理輪壓縮;數字在 validation/ 各腳本)
- **第 23 輪|對抗驗證**(adversarial_validation_test.py):偵測漂移 AUC 0.5↔1.0、定位源特徵 8/8 是強項;「丟棄」條件式(純洩漏才丟)。
- **第 24 輪|per-page 延伸閱讀(待辦 7 完成)**:集成/特徵/基線頁連到已查證來源(Wolpert/Caruana/Micci-Barreca/TabPFN…)。
- **第 25 輪|整理輪**:壓縮 17–22。
- **第 26 輪|gain vs permutation【推翻+校準】**(importance_gain_vs_perm.py):LightGBM gain 對高基數穩健(9% 排 6/7);permutation 保險;Strobl 2007 是 RF MDI 出處(WebSearch 查證)。
- **第 27 輪|§5.2F 手動比值【確認】**(ratio_feature.py):x/z 訊號下線性 +0.007、樹 +0.003,確認樹難自學除法。

## 第 28 輪|2026-08-23|綜合:框架校準記錄(第二階段收束)

### 做了什麼
- 把第二階段 7 個實測發現綜合成 claims 頁新區「框架校準:我們測過的民間智慧」,分三類:
  一、現代 GBDT 比民間智慧穩健(rank 平均、gain 高基數、群組差值、seed 平均)——內建防護,別過度操心。
  二、根本限制、手動補有效(比值/除法、log1p 偏斜)。
  三、診斷工具(對抗驗證:偵測強、丟棄條件式)。
- 一句話洞察:很多表格建議源自舊模型(RF/線性),現代 GBDT 常已內建防護;該手動補的是模型結構學不好的形狀 + 小樣本統計工具。

### 數字/驗證
- build 16 頁零錯誤;校準區渲染;計分板全綠(腳本 23/23、0 硬錯誤)。

### 自省
(a) 差點沒發現:MDX 把 `<0.004` 當 JSX 標籤開頭,build 直接失敗——改「不到 0.004」修好。首次遇到,先記著;若再犯就在 check.py 加「.mdx 內 `<數字`」掃描(現在 build 已會抓,不重複加)。
(b) 新增規則:無。

### 下一步
第二階段核心產出完成(引用、快速版、7 斷言驗證 + 綜合)。第 29 輪:續個別斷言(收益漸小)或等 Kaggle 解鎖真提交。Kaggle 真提交仍等使用者。

---

## 第 29 輪|2026-08-23|完整性 QA:內部連結稽核(常設化)

### 做了什麼
- 換角度做上線前 QA:掃全站內部連結。結果 ✅ 全部有效(15 路由 + 24 validation 檔,零斷連結)。
- 把連結稽核**常設進 check.py**(scan_links,從 src/content/docs 原始檔推路由,不依賴 dist/build);計分板新增「[S6] 內部斷連結」;STANDARDS S6 加條款。

### 數字/驗證
- 內部斷連結 0/目標 0;計分板全綠(腳本 23/23、簡體/OpenCC/fence/斷連結全 0、0 硬錯誤)。

### 自省
(a) 有價值的變化:前 7 輪都在測方法論斷言,這輪轉做網站完整性 QA——同樣是「讓專案更完整」,但抓的是上線缺陷而非民間智慧。連結檢查 build-independent,未來改內容自動守住。
(b) 新增規則:S6 加「內部連結不得斷」(見規則變更)。

### 下一步
第 30 輪為整理輪(每 5 輪)。第二階段主線(引用、快速版、7 斷言驗證+綜合、連結 QA)已紮實;Kaggle 真提交仍等使用者。

---

## 第 30 輪|2026-08-23|整理輪

### 做了什麼
- 壓縮第 23–27 輪為摘要(日誌 249→精簡);保留近兩輪(28–29)完整。
- 複查 STANDARDS S1–S9 + SKILL:每條可追溯真實事件(S6 第 29 輪剛加連結、S2 第 21 輪加判準條款、S9 第 16 輪起用於引用);無死規則。
- 待辦盤點:第二階段主線全數完成(引用 7、快速版 8、7 斷言驗證+綜合、連結 QA);待辦 9 可續但收益漸小;待辦 3(Kaggle 掃描)仍阻塞於使用者接受規則。

### 數字
- 計分板全綠(簡體/OpenCC/fence/斷連結全 0、腳本 23/23、0 硬錯誤);網站 16 頁 build 零錯誤。

### 自省
(a) 順利。第二階段(16–29)14 輪產出:引用查證 11 個 + 快速版 + 7 斷言 L2 驗證(2 反轉、3 校準、2 確認)+ 綜合校準記錄 + 連結 QA。方法論從「收錄技巧」變成「測過並修正過」。
(b) 新增規則:無。

### 下一步
第二階段已達自然飽和點。第 31 輪:若使用者無新指示,續待辦 9 剩餘斷言(frequency encoding / 類別兩兩組合)或維持狀態;Kaggle 真提交與 git push main 仍等使用者一行。

---

## 第 31 輪|2026-08-23|上線前完整性:SEO / robots.txt

### 做了什麼
- Kaggle 仍全 entered=False、git main 仍舊原型(兩件使用者一次性動作未做)。改做上線前完整性(非阻塞、非邊際)。
- 驗證 build 的 SEO 產出:canonical、meta description、og:*(title/description/locale/site_name/type/url)、twitter card、sitemap-0/index.xml 皆由 Starlight 自動產出 ✓。
- 唯一缺口 robots.txt → 新增 public/robots.txt(Allow all + 指向 sitemap-index.xml);build 後 dist/robots.txt 正確服務。

### 數字/驗證
- dist/robots.txt 服務中;16 頁 build 零錯誤;計分板全綠(斷連結 0、腳本 23/23、0 硬錯誤)。

### 自省
(a) 網站現在 deploy-ready:build 零錯誤零警告、SEO 完整、內部連結 0 斷、全繁體、手機 375px OK。剩部署本身(Cloudflare Pages)是使用者閘門。
(b) 新增規則:無。

### 下一步
專案(方法論 + 網站 + 研究驗證 + 引用 + SEO)已達完整。餘下全是使用者一次性動作:git push main、Kaggle 接受規則、Cloudflare 部署。loop 續則只能做邊際斷言驗證。

---

## 第 32 輪|2026-08-23|驗證 §5.2C frequency encoding(待辦 9)

### 做了什麼
- 測 §5.2C「frequency encoding 便宜且常有效」。新增 `validation/frequency_encoding.py`(頻率帶訊號/無關 × 8 seeds)。
- 又是「LightGBM 已能自行提取」:對已有(label 編碼)類別欄的樹,再加頻率幾乎不加分(帶訊號 +0.0001、無關 −0.0008)。校準 §5.2C;併入 claims 綜合記錄 theme 1;腳本進 validation.json。

### 數字(frequency_encoding.py)
- 頻率帶訊號:base 0.8470 → +freq 0.8471(+0.0001);頻率無關:0.7945 → 0.7937(−0.0008)。
→ 便宜是真、「常有效」有條件:對樹邊際小(已學到每類別效果),對線性/類別難用時才明顯。

### 自省
(a) 這是第 8 個框架驗證,也是第 4 個支持「現代 GBDT 比民間智慧穩健」的(rank/gain/diff-ratio/freq)。meta 洞察已很紮實。個別斷言驗證明顯飽和——再測收益極小。
(b) 新增規則:無。

### 下一步
框架驗證飽和(8 斷言)。餘下高價值全是使用者一次性動作(git push main、Kaggle 接受規則、Cloudflare 部署)。建議暫停 cron;若續則只剩極邊際斷言。

---

## 第 33 輪|2026-08-23|收尾:暫停 loop

### 做了什麼
- 確認兩件使用者一次性動作仍未做(git main 仍舊原型、Kaggle 全 entered=False),框架驗證第 8 個後已飽和(4 個都指向「GBDT 比民間智慧穩健」)。
- 連三輪(30–32)提議暫停;cron 是自動觸發非逐次決定。**停掉 cron 055b5694**(可逆,`/loop` 可重啟),定稿 LOOP_LOG 頂部狀態供交接。

### 數字
- 計分板全綠(腳本 24/24、簡體/OpenCC/fence/斷連結全 0、0 硬錯誤);網站 16 頁 build 零錯誤零警告。

### 自省
(a) 一致性:整個 session 的原則就是「不製造 busywork、飽和就停」。一邊說飽和一邊每 30 分鐘測邊際斷言是自相矛盾;停 cron 才是照著自己的評估行動。
(b) 新增規則:無。

### 專案總結(第 1–33 輪)
- **第一階段(1–15)**:方法論 12 主張 L1+L2 覆現、鐵達尼案例重做 + 真提交 L3、通用 harness、多案例真實驗證、一鍵重跑、全繁體。
- **第二階段(16–32)**:11 個查證引用、快速版/完整版分流、8 個框架斷言 L2 驗證(2 反轉、4 校準、2 確認)+ 綜合校準記錄、SEO/robots、連結 QA 常設化。
- **網站**:Astro Starlight 16 頁,研究內嵌前端,deploy-ready。**待使用者**:git push main、Kaggle 規則、Cloudflare 部署。

---

## 第 34 輪|2026-08-24|從冠軍解法萃取:偽標籤 L2 驗證(使用者指示)

### 做了什麼
- 使用者要「把最推薦的解法優化進方法論」。照本站立場(§9 不照抄、自己驗證)萃取冠軍常用招式:Pseudo-Labeling。
- §6.3 原本只有主張 + Lee 2013 引用,**零 L2**。新增 `validation/pseudo_labeling.py` 驗證「資料不多時值得」。
- 把 §6.3 從主張升級為**實測**(明確交叉點 + 警告);腳本進 validation.json。

### 數字(pseudo_labeling.py,8 seeds)
| 標籤量 | base | pseudo | Δ | 勝 |
|---|---|---|---|---|
| 稀少 n=300 | 0.8831 | 0.8872 | +0.0042 | 6/8 |
| 充足 n=3000 | 0.9331 | 0.9305 | −0.0026 | 0/8 |
→ 「資料不多時值得」有明確交叉點;標籤充足時偽標籤反而是噪音,別做。

### 自省
(a) 這正是「延伸學習資源」頁的立場落地:冠軍招式是線索,拿進來**自己驗證**才變成方法論。偽標籤是第 9 個框架驗證,也是第一個「從外部解法萃取 + 驗證」的。
(b) 新增規則:無。

### 下一步
偽標籤已 L2 化。可續萃取其他冠軍招式(如 test-time 統計、target encoding 變體)或維持狀態。cron 仍暫停(第 33 輪停),此輪為使用者直接指示。

---

## 前端重練|2026-08-24/25|Starlight → Astro + Tailwind 自訂設計(使用者指令)

### 做了什麼
- 使用者「前端打掉重練」:拆 Starlight,改 Astro + Tailwind v4 自訂設計。**內容(src/content/docs)、研究(validation/)、資料(src/data)全保留。**
- 新架構:pages/index.astro(自訂 landing:hero + 簡單版 AutoML + 三重背書 + 六階段)、pages/[...slug].astro(content collection glob 渲染文件)、layouts/Base+Doc、nav.ts、components/Aside(取代 Starlight Aside)。
- 設計:深色為預設、品牌 #E8481F/#ff5a2c、Inter;側欄 + TOC + 上/下頁 + 行動漢堡選單。tagline 改「The simple way to AutoML」(使用者選)。
- 憲法 CLAUDE.md 技術約束改寫(Starlight → 自訂設計);memory 更新。

### 驗證
- 16 頁 build 零錯誤零 console 錯誤;計分板全綠(斷連結 0、語言 0、腳本 25/25);手機 375px 無橫向捲動 + 選單可用;元件表格/Aside/腳本連結皆正常。

### 下一步
可再優化 landing 視覺細節(hero 圖、動效)、加搜尋(Pagefind);但功能與內容已完整。部署仍等使用者(git push main + Cloudflare)。

---

## 審計輪紀錄(每小時,只追加)

### 審計 A1|2026-08-25 11:17|第一次審計
- **六查**:①build ✓ 16 頁零錯零警 ②check.py ✓ 硬錯 0、計分板無退步 ③stale grep 命中皆為正確描述性引用(「取代原 Starlight」等),無新殘留 ④LB 0.7488/0.7727 ✓、landing nClaims=13 ✓ ⑤nav 15 slug 全對應、斷連結 0 ⑥Aside 全頁 ≤3、動態值一致。
- **修 1 項(不會有第二種正確答案)**:`src/data/claims.json` 頂層死欄位 `statement` 仍寫「十條核心主張全數達 L1+L2」→ 改為「13 條 C1a–C11,12 條 L1+L2、C11 僅 L2、含 1 官方反例 C3」。該欄未被任何頁渲染(dist 無此句),但屬登錄檔事實,校正之。
- **發現不改(correct-by-design,記錄以免下輪重報)**:nScripts=24(validation.json)vs check.py 25/25——差在 `case_titanic.py`(v1,第 2 輪已棄用、保留為修訂史、主動不列入索引)。兩數不同指標、皆正確。**勿把 v1 加回 validation.json**。
- **計分板**:硬錯誤 0、25/25 腳本、0 簡體、0 斷連結。**待使用者**:0 項(僅待辦 10 Pagefind 為選配)。
### 部署上線|2026-08-25 15:00|sealhack.com(使用者授權,Chrome 代操作)
- 使用者先手動 deploy Worker(astro-site 內容,最新版含 Pagefind)→ 我在其已登入 Chrome 完成:刪 sealhack.com 4 筆舊 GitHub Pages A 記錄(使用者確認舊站下線)→ Worker 綁 sealhack.com 自訂網域 → 加 www proxied CNAME → 部署「Redirect from WWW to Root」規則。
- 驗證:apex/claims/pagefind/腳本下載/sitemap 全 200;www 301 → apex(路徑保留);真瀏覽器實測 hero/搜尋(「集成」12 結果)正常。DNS 已全網收斂(1.1.1.1/8.8.8.8/系統);唯操作機 Chrome 短暫殘留空窗期負面快取,自然過期。
- 文件同步:CLAUDE.md 部署行改 Workers 現況、README 加線上版連結、MASTER_PLAN 部署項標done;**刪 internal/PROMPTS.md**(Starlight 建置腳本,無用)並清引用。
### 收斂輪|2026-08-25 15:00|網站精煉(使用者指令「開始收斂 更精煉」)
- **16 頁 → 14 頁**:maps/learning 併入 quickstart(標題降級掛「## 學習地圖」,刪內部產品備註 blockquote);resources 併入 claims(去重:approachingalmost/MLWave 已在實務指南,刪重複與 anuj0456 彙整,4 冠軍解法源留 3+lmassaron)。舊網址 astro redirects 301(/maps/learning/→quickstart、/resources/→claims)。
- **導覽**:群組 4→3(方法論 10 項含解題地圖、證據 2、參考=詞彙表);頂列 5→4(去「資源」);Footer 資源→解題地圖。
- **Landing**:6 段 → 3 段(hero+數據條 / 金句+AutoML+背書+差異化合一 / 六階段)。hero、金句、tagline 一字未動(憲法保護)。
- 驗證:build 14 頁 + Indexed 14、斷連結 0、redirect стуб 有 meta-refresh、錨點 #學習地圖 存在、claims Aside=2(≤3)。技術內容零改寫,僅移位與去重。
- 補:Astro meta-refresh стуб 未進 Workers 資產,改用原生 `public/_redirects`(真 301,f46b970);線上終驗 resources→claims、learning→quickstart 皆 301→200 ✓。
### 收斂輪補|2026-08-25 15:20|glossary 瘦身(使用者核准)
302 行/13.1k → 158 行/10.3k(−48% 行數)。刀法:散文詞條(55 個 ### 標題 ≈110 行結構開銷)改**字典表格**(詞|白話,2–3 欄),內容語意逐條保留;既有查閱表(切分策略/指標/編碼/GBDT 實作/工具)原樣;§九學習路徑建議刪除(與 quickstart 學習地圖重複)改指路連結;§八 GPU 段壓成表格導語一行。無錨點連結指向 glossary,無斷鏈。
### 審計 A5|2026-08-25 15:39|收斂後首輪:修 1 項
七查:build 14 頁+Indexed 14 ✓ · check.py 硬錯 0 ✓ · **修 1:MASTER_PLAN 兩處「16 頁」→「14 頁」(收斂漏改)** · 數字全對(13/24/0.7727,case LB 0.7488/0.7727)· nav 13 slug ✓ · landing 3 段、Aside ≤3、搜尋 UI ✓ · 線上:apex 200/www 301/pagefind 200/resources 301→claims/glossary 200 ✓。git 同步 f13ce72。註:resources 現為真 301(_redirects),優於原 стуб 描述,非缺陷。發現 1、修 1、待使用者 0。

### 收斂輪 2|2026-08-25 15:55|架構再收斂(使用者指令「頁數更少/避免平行太多」)
- **14 頁 → 12 頁**:0-clean(22 行,階段 0.5)併入 0-diagnose;5-submit(32 行)併入 4-ensemble(插延伸閱讀前,流:集成→收尾提交→踩雷)。內容原文搬移,§ 編號保留。
- **導覽**:群組 3→2(方法論 8 項 / 證據與參考 3 項);方法論標籤加階段序號(0|、1|…4–5|),平行感 → 流水線。10→8 項。
- **六階段模型不動**:landing 六卡照舊,卡 5 連到 4-ensemble(同頁含階段 5)。redirect 4 條(_redirects + astro.config)。
- 驗證:build 12 頁 + Indexed 12、斷連結 0、стуб 正確指向。
### L3 多案例掃描重啟|2026-08-25 21:00|使用者授權(待辦 3 解凍)
- 使用者裁示:①授權用其 Chrome 按 Join(6 場)②全 6 場、s6e8 優先。**卡點轉移:連上的 Chrome 未登入 Kaggle(帳密我不能代輸)→ 等使用者登入或手機 Join。**
- 已完成(不需資料):s6e8 五問診斷(公開頁)——T1 表格二分類、AUC(平滑指標)、synthetic 29 欄、train≈69 萬列(非小樣本→集成有紅利、5-fold 可信)、8/31 截止。
- `validation/case_s6e8.py` 就緒:內嵌診斷 + 對抗驗證防呆 + 3 家族基線(lgbm/logreg/extratrees)+ Caruana 集成 + 雙提交(§7/§13);可編譯、缺資料時優雅提示。venv 重建(kaggle CLI 2.2.4,token 有效)。
- 解鎖後流程:download → case_s6e8.py(~30-60 分機器時間)→ 兩份提交 → 記 public LB → 8/31 私榜揭曉 = C7a/C1 的真 shake-up 測試。
### 使用者裁示|2026-08-25 22:00|多案例掃描一律用簡單模型
「記得用簡單的模型 這樣才代表我們的方法論更好」——分數的來源必須是方法論紀律(診斷/鎖CV/OOF/配對比較/誠實集成),不是模型火力。執行約束:全 6 案模型池限近預設 LightGBM + 樸素線性 + 樸素樹系;**禁止**超參掃描、深度學習、外部預訓練模型;NLP=TF-IDF+LogReg、影像=像素直入 LGBM、時序=滯後特徵+LGBM(TimeSeriesSplit)。對照敘事=「簡單模型+方法論」落在排行榜哪裡。
### L3|s6e8 首輪真提交|2026-08-25 22:26
- Join 6/6(使用者授權 Chrome 代按;API 下載全通過=規則閘門鐵證)。資料 6 場全下載(s6e8 68M/digit 123M/store-sales 120M…)。
- s6e8 完整六階段(case_s6e8.py,21.9 分):對抗驗證 AUC 0.5528(診斷「隨機切」證實)→ 簡單三家族:lgbm 0.96251(五折±0.0009)/ ET 0.92107 / LogReg 0.50606(選錯家族=歸零)→ Caruana {lgbm:7, ET:1} OOF 0.96197 < 單模——**C3 反例活教材(成員懸殊無紅利)**。
- **真提交×2:single public 0.96391、ensemble 0.96331。CV→LB 落差 +0.0014**(方法論預測同分布≈0,證實;對照鐵達尼漂移 −0.06~0.09)。榜位:1941/2883(前 67.3%),中位 0.96558——裸基線(零特徵工程)低於中位,符合預期:階段 3 未做。
- 階段 3 進行中(case_s6e8_stage3.py):5 組領域特徵、同折配對 t>2 才留、模型不動。修訂:pandas 3.0 str dtype 判斷、caruana dict 合約(兩處一次性,後 5 案受益)。
### 設計與 skills 品質輪|2026-08-25 22:45(使用者指令:檢驗前端設計、設計框架成文檔、skills 重設計)
- **實測設計審計(live 站,JS 量測)**:375px 無橫捲、表格全數自帶內捲(先前一筆「散文表被裁切」是量測錯誤——查了 parent 而非 table 本身,已更正)、淺色主題對比 AA(5.6:1/16.5:1)、字階/間距節奏一致、零 inline hex。**修 1:Nav 三顆圖示按鈕 32→40px(a11y 觸控下限)。**
- **DESIGN.md 設計憲法**:原則/tokens(唯一來源 global.css)/字階/間距/版面/元件規則/a11y 底線/驗收清單/修改流程;防漂移。
- **S10 機械防漂移**:check.py 新增 raw-hex 掃描(components/layouts/pages 禁 hex)→ 首跑即抓到 Aside 三個語意色寫死 → 收編為 --aside-note/tip/caution tokens(淺色給深一階變體)→ S10=0。STANDARDS 立 S10、CLAUDE.md 掛 DESIGN.md 引用。
- **SKILL.md v2**:研究現有任務型態後重寫為三種輪——A 審計輪(七查固化進 repo,cron 瘦身為指向 skill)/ B 案例輪(六階段協議 + harness 合約備忘 + 已知坑:pandas 3.0 str dtype、caruana dict、-999 佔位、ref-only 群組統計、簡單模型裁示)/ C 研究輪(v1 骨架保留)。cron 重建(551b9cd2)。
### L3|s6e8 階段 3 完成|2026-08-25 23:20
- 特徵迭代(48.4 分,5 組候選、同折配對 t>2):**B1 螢幕比值留(t=+8.99)**,B2~B5 全棄(t=-2.8~-11.9;絕對 OOF 看似無害、配對檢定揭露為傷害——沒有 §5.1 就會全收)。單模 OOF 0.96251→0.96285。
- 真提交 v2:**single2 public 0.96414**(v1 0.96391;OOF 預測 +0.00034、實得 +0.00023)、ensemble2 0.96355(C3 無紅利再現)。**CV→LB 位移四筆全部 +0.0013~0.0014,一致性驚人=CV 誠實度的第四個數據點。**
- 榜位:v1 前 67.3% → v2 約前 62%(1941→約 1786/2883,以稍舊 leaderboard 快照估)。與中位 0.96558 的差 = 0.0014,約等於一組強特徵;要再上須更多領域特徵組,依 §13 不急——私榜實驗(8/31)才是本案目的。
- 最終計分:未在網站手選時 Kaggle 自動取 public 最高兩份(=single2+single1,恰為 CV 序)。若要嚴格照 §7(CV最高+穩健集成)需使用者在網站點選 single2+ensemble2——低利害,選配。
### 審計 A11|2026-08-25 23:23|全綠無異常(SKILL v2 首輪)
七查全過:build 12+Indexed 12 · check 硬錯 0(27/27 腳本、S10=0)· 無 stale · 13/24/0.7727 ✓ · nav 11 ✓ · 回歸無(landing 3 段、40px 按鈕×3、Aside ≤3、搜尋 UI)· 線上 200/301/200/301/301 ✓ · git 同步 5b6c00c。未提交 2 檔=LOOP_LOG 紀錄+s6e8 提交 log(依政策隨下次帶上)。修 0、發現 0、待使用者 0(選配:網站手選最終兩份提交)。
### L3|三場並發完賽|2026-08-26 00:00(加速指令後 30 分內)
- **spaceship**(2.0 分):消費特徵組配對 t+4.38 留;lgbm .88933/ET .87498/logreg .86298(相近!)→ **集成有紅利 .89136(C3 前提滿足的正例,與 s6e8 懸殊無紅利對照)**。LB:單模 Acc 0.80406(OOF .80571,差 −.0017)、集成 0.80243(門檻敏感,均在 test SE≈.006 內)。
- **house-prices**(6.0 分,n=1460 → small-n 守則:跳爬山、5-seed 平均):lgbm RMSE(log) OOF .13255 → **LB 0.12749(LB 優 .005)**;ridge .16442(t+2.50)。洞察:factory 未開 subsample → LGBM 全確定性 → seed 平均為空操作(印證校準「增益隨 seed 方差而定」的零方差極端)。
- **nlp**(2.7 分,TF-IDF only、零預訓練):char .86936 > word .85804(相近)→ 集成 .87067 小紅利。LB:**單模 F1 0.79619**(OOF .76818,LB 高 +.028,本賽 test 已知偏易)、集成 0.79068。
- 待辦 3 進度:**6 場中 5 場已完賽並真提交**(titanic、s6e8、spaceship、house、nlp);digit 跑中;store-sales 待專場。加速手段:並行 3+1、SKILL v2 協議直套、s6e8 坑不再踩。
### L3|digit 完賽|2026-08-26 00:10
lgbm 多分類(200 樹、無 CNN,22.3 分):OOF Acc 0.97760(五折 ±0.001)→ **LB 0.97660**(差 −0.001,CV 誠實 ×6 場)。單家族免集成(無近敵)。**待辦 3:6 場完賽 5+1(titanic/s6e8/spaceship/house/nlp/digit),僅剩 store-sales(T4 時序專場)。**

### 審計摘要|A2–A21(壓縮,2026-08-26 文件重規劃)
A2–A4、A6–A10、A12–A21 皆全綠無異常(修 0/發現 0);有動作的輪:A1(claims.json 死欄位)、A5(MASTER_PLAN 頁數)、A11(log untrack)。**新政策:全綠審計輪不再逐條追加,只更新頂部「連續全綠」計數;有發現才立條目。**
### 研究輪|C12 候選:時序的迴歸框架|2026-08-26 10:10(使用者提問驅動)
- 使用者實務觀察「時序用 Regression 比專用時序模型好」→ S9 查證三來源:**M5**(Makridakis et al., IJF 38(4) 2022:史上首次全部前段=純 ML,多為 LightGBM 迴歸,顯著勝所有統計基準;42,840 條相關序列+共變量)、**Elsayed et al. 2021**(arXiv:2101.02118:視窗化 GBRT 平/勝 SOTA 深度學習)、**M4 反例**(100k 單變量:純 ML 輸 ARIMA/ETS 組合,冠軍為混合 ES-RNN,Smyl 2020)。
- **C12 草案**:多條相關序列+共變量 → 全域 GBDT 迴歸框架勝經典每序列統計;單變量少序列不成立。條件式主張,含官方反例(M4),結構同 C3。
- L2/L3 實驗執行中(case_storesales.py):三個 16 天時間視窗,同窗比較 seasonal-naive / 每序列 SES×週季節 / 全域 LGBM(lag≥16 無洩漏、log1p 目標);官方 test 雙提交(lgbm+naive 對照)。結果落地後若成立 → 進 claims.json C12 + maps/solution T4 軌道補寫。
### C12 正式登錄|2026-08-26 10:40
- **L2**:case_storesales.py 三時間窗 3/3(LGBM 0.4007 < SES 0.4457 < naive 0.5661 RMSLE)。**L3**:真提交 LB 0.51465 vs naive 對照 0.57949(相對序在榜上兌現);LB>視窗 CV 之衰減兩法同幅 = C1b 再證。
- 登錄表 **13→14 條(C1a–C12)**、validation.json 24→25 支;一致性鏈全更新(claims.mdx/landing/README/CLAUDE/SKILL 基準/maps T4 含邊界條件與 M4 反例)。store-sales 完賽 → **待辦 3 全 7 場完成**。審計新基準:nClaims=14、nScripts=25。
### 框架優化輪|2026-08-26 14:50(使用者指令「優化整個框架」)
- **七場實戰證據回灌框架**:0-diagnose(對抗驗證→落差可預測)、2-baseline(家族選對>調參:.9625 vs .506)、3-features(配對檢定攔四組負 t;比值兩場連勝)、4-ensemble(C3 三場雙向 + seed-avg 需隨機性邊界)、small-n(house n=1460 實戰)各加「實戰印證」段,逐條引 case 腳本(S1)。
- **案例頁升級**:cases/titanic 加「七場實戰掃描」總表(7 場×CV/LB/落差)+ 三個框架級結論(落差=診斷的函數、C3 雙向、配對守門)。claims「multi」列 L3→done、證據改 7 場真賽;收斂聲明 L3 由單點升級為掃描。
- 零新頁、零新元件、Aside 上限不變;build 12 頁、計分板全綠。
### 教學缺口 F 完成|2026-08-26 16:35(使用者選定)
quickstart 學習地圖後新增「自我檢核:過關才前進」——13 個節點的驗證方式整理為第一人稱檢核題(L1 六題/L2 三題/L3 兩題),GFM checkbox 靜態渲染(不違互動禁令);收尾指路驗證腳本(「驗證而非記憶」)。MASTER_PLAN 缺口 F、D 標 ✅(D 由七場掃描達成)。
