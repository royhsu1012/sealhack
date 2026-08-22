# SealHack 持續優化迴圈日誌

> 每 30 分鐘一輪,流程見 `.claude/skills/sealhack-loop/SKILL.md`,標準見 `STANDARDS.md`。
> 頂部「目前狀態」每輪改寫;「規則變更」與輪次紀錄只追加。舊輪次壓成一行(整理輪處理)。

## 目前狀態

**環境**:`validation/requirements.txt` 已 pin(lightgbm 4.7.0 / sklearn 1.9.0 / pandas 3.0.5 / scipy 1.18.0 / numpy 2.5.2,Python 3.12)。
本機 venv:`…/scratchpad/.venv`(session 專屬;新 session 用 `uv venv --python 3.12 && uv pip install -r validation/requirements.txt` 重建)。
一鍵重跑:`python run_all.py`(全套 ~40 分)或 `--fast`(數秒級 4 支)。語言檢查用 opencc(`uv pip install opencc-python-reimplemented`,非驗證相依,check.py 沒它會退回手工清單)。
跑腳本:cwd=`validation/`、`python fetch_data.py && python <script>.py`;kaggle 指令先 `export USERPROFILE='C:\Users\royhs'`。

**憑證**:Kaggle token 有效(第 3 輪 venv 唯讀 `kaggle competitions list` 認證通過);Titanic 規則已接受(userHasEntered=True)。
其他目標競賽需使用者在網站按 Join 接受規則,API 才能下載/提交。**迴圈不得寫入 token,只用唯讀 list 驗證、不 peek 檔案內容。**

**覆現狀態(2026-08-22,本機)**:12 條主張全部與文件一致;C7b 改 5 seeds 相對判準(5/5 ✅);
案例 case_titanic_v2(20 切分:單模 0.8280±0.020、集成 0.8287±0.018、配對差 +0.0007 t=0.26);
C9/C10 small_n_paired v2(配對差 std ≈ 分數 std 的 1/4;票團有害 0/20、Title/family 1/20;C10 |Δ|≈0.0001)。
**L3 實戰**:Titanic 真提交 CV 0.8373 → public LB 單模 0.7488 / 集成 0.7727;內部驗證高估 0.06~0.09(§16.8)。
**多案例(§16.9,multi_case_real.py)**:同一套 harness 在 breast_cancer/diabetes/digits(二分類/迴歸/多分類)皆完成;乾淨資料 CV−holdout ≈ 0,對比 Titanic 0.06~0.09 = 分布差非方法論。

**計分板(第 15 輪終點)**:
```text
  [S5] content/ 簡體字行數           0   (code 0 / prose 0)   目標 0   ✅
  [S5] OpenCC 誤轉次數               0   目標 0                        ✅
  [S4] validation 腳本可編譯 / UTF-8 / doc   12/12 全數
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

## 規則變更(只追加)
- 2026-08-22|建立 STANDARDS.md(S1–S8)、sealhack-loop skill、check.py 計分板|第 1 輪:C7b 絕對門檻翻盤、案例單次切分當結論、覆現三度被環境問題擋住
- 2026-08-22|SKILL「停下來」放寬:結論反轉達 S2 就直接改+留修訂史(僅首頁文案/定位句要等)|第 2 輪使用者「你執行」授權
- 2026-08-22|STANDARDS S4 加「同一案例特徵只定義一次」|第 2 輪:small_n_paired 與 case_titanic base 特徵不同,§16.3 t 值無法與案例互證
- 2026-08-22|SKILL 加「真提交後不追分(§13)、規則接受是使用者閘門」|第 4 輪:多競賽掃描需防 LB-probing
- 2026-08-22|抽出 harness.py(通用管線),submit_titanic 改用之並位元重現 round-4 輸出|第 10 輪:為競賽掃描解鎖後即插即用做準備;case_titanic_v2 不動(其數字是 §16 依據)
- 2026-08-22|check.py 簡體檢查改用 opencc s2t 為權威(手工 SIMP 為 fallback),並擴充手工清單|第 9 輪:手工清單漏 体/吗/后/径/征/侦 等字,給過假 0——計分板本身不可信就守不住「不得變差」
- 2026-08-22|整理輪:壓縮第 1–3 輪為摘要、合併 SKILL 三條 Kaggle 規則為兩條、更新過時計分板/憑證狀態|第 5 輪。檢視 S1–S8 與 SKILL 各規則:全部可追溯到真實事件,無死規則可刪

---

## 輪次摘要(1–3,整理輪壓縮;數字的真正來源在 content/ 與 validation/)
- **第 1 輪|可重跑性止血**:fetch_data.py(sha256)、7 腳本 UTF-8 防呆、requirements pin、C7b 判準改 5 seeds 相對(5/5 ✅,原絕對門檻在 seed 2 失敗)。覆現 12 條主張全部與文件一致。
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

## 第 12 輪|2026-08-22 09:15|harness 多分類 head(阻塞下最後前置)

### 做了什麼
- 競賽仍全阻塞(6/6)。補齊 harness 最後一個可測路徑:多分類。
- `run_cv` 改成形狀無關(predict_fn 回 (n,) 或 (n,k),oof/te 自動配合);**Titanic 1-D 路徑位元重現不變**(三檔 sha256 與 round-4 相同)。
- harness_selftest.py 加多分類任務(4 類,proba 矩陣 + -logloss),斷言 OOF 形狀 (n,k)、每列機率和=1、Acc > 亂猜。
- harness 文件更新:三路徑已測,T4 時間序列傳 TimeSeriesSplit folds 即可(harness 不假設折來源)。

### 數字(harness_selftest.py)
- 二分類 集成 AUC 0.7852 ≥ 單模 0.7798 ✅|迴歸 集成 RMSE 0.6625 ≪ y std 2.68 ✅|多分類 OOF (3000,4) 機率和=1、Acc 0.4283 > 0.25 ✅。
- Titanic 位元重現:sub_single/sub_ensemble/cv_report 三檔 sha256 不變。計分板 14/14、0 硬錯誤。

### 自省
(a) 順利。改動 run_cv(載重於 Titanic 提交)有風險,續用位元比對驗收——1-D 路徑數值零變化。
(b) 新增規則:無。

### 下一步
harness 涵蓋 T1/T2/T3/T4 全部規劃軌道且有回歸測試。**內容、模板、語言、工具全部就緒且已驗證。**
**唯一未完成 = 待辦 3,100% 阻塞於使用者接受競賽規則。** 解鎖前已無可驗證的實作項——
後續輪次僅確認解鎖狀態;解鎖後第一個競賽即可用 harness 直接開跑。

---

## 第 13 輪|2026-08-22 09:45|多案例真實資料驗證(阻塞下推進根本目標)

### 做了什麼
- 競賽仍全阻塞(6/6)。判斷:使用者根本目標是「不同案例驗證同一方法論能否完成」;Kaggle 卡規則,但可用真實公開資料(sklearn)做端到端驗證推進此目標(非 Kaggle 提交的替代,是補充)。
- 新增 `validation/multi_case_real.py`:同一套 harness 跑 breast_cancer(二分類)/diabetes(迴歸)/digits(多分類 10 類),各留 25% holdout,報 CV vs holdout。
- 三案例皆端到端完成;新增 §16.9 + §12.2「多案例」列。

### 數字(multi_case_real.py,真實資料 holdout)
| 案例 | CV | holdout | CV−holdout |
|---|---|---|---|
| breast_cancer(二分類)| Acc 0.986 | 0.986 | 0.0001 |
| diabetes(迴歸)| RMSE 56.2 | 53.1 | 3.1 |
| digits(多分類)| Acc 0.970 | 0.969 | 0.0007 |
洞見:乾淨資料 CV−holdout ≈ 0,對比 Titanic CV−LB 0.06~0.09——**差距來源是分布不是方法論**(§2.2 印證)。

### 自省
(a) 判斷題:第 12 輪說「阻塞下不做假工作」,這輪做了 multi_case——但這不是假工作,是用真實資料推進使用者的根本目標(可完成性 + CV 誠實),且完全可重跑。界線:合成資料堆功能=假工作;真實資料驗證方法論=真進展。
(b) 新增規則:無。

### 下一步
harness 已在合成(自我測試)+ 真實(multi_case_real)資料上驗證三種任務。**Kaggle 真提交仍等使用者接受規則。**
可延伸:多案例再加更大/更髒的真實資料(需下載)或更多任務;但核心已證。優先仍是等使用者解鎖 Kaggle 拿真實 LB。

---

## 第 14 輪|2026-08-22 10:15|run_all.py 一鍵重跑(重跑性收尾)

### 做了什麼
- 競賽仍全阻塞(6/6)。補第 0 輪就點名、一直沒做的缺口:整個驗證套件的一鍵重跑器。
- 新增 `validation/run_all.py`:依序跑 11 支自足腳本,擷取各自判決行,印狀態表;任一非 0 或判決含 ❌ 則退出碼 1。`--fast` 只跑數秒級 4 支。
- `--fast` 實測:hill_climb_weights / run_experiment_demo / harness_selftest / multi_case_real 全 ok,判決行正確擷取。全套在背景跑(~40 分,含 claims_* 與 case_titanic_v2)。

### 數字(run_all.py --fast)
- 4 支數秒級腳本狀態全 ok、失敗 0;各判決行(§6.1 bug ✅、§3.3 可執行 ✅、harness 三路徑 ✅、多案例完成 ✅)正確顯示。
- 全套結果:背景任務,完成後補記。計分板腳本 16/16、0 硬錯誤。

### 自省
(a) run_all 是「12/12 可重跑」這個差異化資產的機器化收尾——之前靠人肉一支支跑,現在一個指令。屬待辦 1 的正當收尾,非新功能。
(b) 新增規則:無。

### 全套結果補記(背景完成)
- 11 支全部乾淨跑完(輸出零 traceback);claims_test.py 單獨確認 exit 0。→ **14 輪修改零回歸**。
- run_all.py 初版誤報 4 個「FAIL」:判準 `"❌" in stdout` 太粗。那些 ❌ 是腳本的**資料**——
  claims_test/v3 的原始版依 S3 保留當修訂史(C1/C3/C8 舊結論本就 ❌)、case_titanic_v2 的「集成降級❌不成立」是期望的反轉。
  **已修 run_all.py:判準改退出碼**(腳本乾淨跑完 = 通過);❌ 數量改為在判決行標註「修訂史/反例」供參。

### 自省(補)
(a) 好事:全套跑一次就抓到 run_all 判準本身的 bug——驗證器也要被驗證。修訂史含 ❌ 是 S3 的直接後果,判準不能把資料當失敗。
(b) 新增規則:無(S3 已涵蓋;修正寫進 run_all.py 註解)。

### 下一步
整套 16 腳本一鍵可重跑且零回歸。**Kaggle 真提交仍等使用者接受規則**——唯一未完成項。

---

## 第 15 輪|2026-08-22 10:45|整理輪 + 停點確認

### 做了什麼
- 競賽仍全阻塞(6/6,連續第 7 輪)。整理輪:壓縮第 7–11 輪為摘要(日誌 255→154 行);複查 STANDARDS S1–S8 與 SKILL 規則,全部可追溯到真實事件,無死規則。
- 確認已達自然停點:待辦 1/2/4/5/6 全完成,待辦 3 唯一未完成且 100% 阻塞於使用者接受競賽規則。
- 註記:本迴圈由 cron(每 30 分)自動觸發;在使用者接受規則前,每輪只會是狀態確認 + 極小整理,無實質前進空間。

### 數字
- 計分板全綠(簡體/OpenCC/裸 fence 全 0、腳本 16/16、0 硬錯誤);run_all 全套零回歸(第 14 輪)。

### 自省
(a) 判斷:第 11–14 輪已把「阻塞下能做的真實前置」(harness 三路徑、多案例真實驗證、run_all)做完;再往下就是製造工作。守住不空轉。
(b) 新增規則:無。

### 下一步(需使用者)
**唯一路徑 = 使用者在競賽頁按 Join 接受規則**(建議 playground-series-s6e8,8/31 截止有真實私榜)。
在那之前建議暫停 cron(每 30 分空轉無益);已向使用者說明,由其決定停或續。解鎖後任一競賽即可用 harness 直接開跑。
