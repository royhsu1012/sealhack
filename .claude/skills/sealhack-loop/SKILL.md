# SealHack 迴圈(v2:三種輪)

一輪 = 30 分內「做完並驗證」的單位;價值在留下可檢查的痕跡(數字、腳本、日誌)。
標準:內容 `STANDARDS.md`(S1–S10)· 設計 `DESIGN.md` · 憲法 `CLAUDE.md`。狀態:`internal/LOOP_LOG.md`。
計分板:`python .claude/skills/sealhack-loop/scripts/check.py`(含 S10 設計漂移)。
三種輪共用鐵律:**改完重跑 build + check.py,計分板不得變差;紀錄寫回 LOOP_LOG**。

## A|審計輪(每小時 cron;抓不一致、不修錯)

只修「不會有第二種正確答案」的錯;其餘寫待辦標「待使用者判斷」。七查:
1. `npm run build`:零錯誤、**12 頁 + 4 redirect**、pagefind Indexed 12(看完整輸出,別搶讀)。
2. `check.py`:硬錯誤 0、各項不得比上輪差(含 S10=0)。
3. 文件對現況:grep stale(starlight/舊頁數/已併頁 URL);LOOP_LOG 歷史段與 redirects 設定豁免。
4. 數字對資料:主張「14 條 C1a–C12,13 條 L1+L2、C11 僅 L2;官方反例 C3、C12(M4)」;LB 0.7488/0.7727;landing nScripts=validation.json 條數(check.py 的腳本數含已棄用 v1,兩者不同指標皆正確)。
5. 連結:斷連結 0;nav.ts 每 slug 有頁(11 slug)。
6. 回歸:landing 3 段、卡 4/5 同連 4-ensemble、Aside ≤3/頁、搜尋 UI 在 dist;設計抽驗照 DESIGN.md §八。
7. 線上:apex 200 / www 301 / pagefind 200 / 舊 URL 301。
紀錄政策:**全綠輪不追加條目**,只改寫 LOOP_LOG 頂部「審計:連續全綠 N 輪(至 A<編號> <時間>)」一行;**有發現/有修才立條目**。不單獨 commit/push(push 觸發正式站重建;隨下次實質變更帶上)。全綠就回報「全綠無異常」,不為做事而亂改。

## B|案例輪(L3 多案例掃描;一輪推進一場比賽的一個階段)

**使用者裁示:一律簡單模型**(近預設 LightGBM + 樸素線性/樹;禁調參、深度學習、預訓練)——分數必須來自方法論紀律。
流程(每場一支 `validation/case_<賽>.py`,六階段內嵌):
0. 診斷:公開頁定五問(模態/任務/指標/切法/賽制);資料 `kaggle competitions download`(需已 Join——只有使用者能按)。
1. 鎖 CV:任務對應切法,全流程共用 folds+seed;**對抗驗證**先跑(AUC≈0.5 → 隨機切證實;>0.8 → 查漂移)。
2. 基線:2–3 個簡單家族 → OOF 落盤(npz,§3.1)。
3. 特徵迭代:候選分組、**一次一組、同折配對 t>2 才留**(H.paired_t;模型不動)。
4. 集成:`H.caruana(oofs_dict)`(成員懸殊時預期無紅利=C3,照做記錄)。
5. 雙提交:CV 最高 + 最穩健;`kaggle competitions submit`;**只如實記 public LB,不追榜(§13)**;寫回 LOOP_LOG + src/data/cases.json。
harness 合約備忘:`run_cv(feature_fn, tr, te, y, folds, use, factory, scale, predict_fn, metric_fn)`;
`caruana(oofs=dict, y, score_fn)→(counts, order)`、`blend(dict, counts)`;metric 一律「越高越好」。
已知坑:pandas 3.0 字串欄是 `str` dtype(用 `is_numeric_dtype` 判斷,別用 `==object`);線性/樹系不吃 NaN 用 -999 佔位;群組統計只用 ref(C2/C10)。

## C|研究輪(方法論強化;要續跑 /loop)

照 v1 骨架:讀狀態 → 挑待辦第一個未阻塞項 → 做(方法論修改必須引文獻或 L2 實驗;判準照 S2)→ 驗 → 寫回 → 自省。
方法論結論反轉:證據達 S2 就改+留修訂史(S3);**首頁文案/定位句/刪整節仍需使用者拍板**。

## 停下來等使用者(三種輪通用)
- 憑證與 Join:token 只能使用者放;競賽規則接受只能使用者做(或其明確授權下用其已登入瀏覽器代按)。
- 真提交後不為衝分反覆提交;最終計分只選兩份(CV 依據)。
- 刪除整節內容/一條主張、改 hero/金句/tagline、改版設計原則(DESIGN.md §一)。
阻塞時在 LOOP_LOG 待辦標「阻塞(等使用者:原因)」,跳下一項。

## 自省(每輪最後)
(a) 哪裡浪費了時間或差點出錯?(b) 哪條規則能防止它?有答案當場改 SKILL/STANDARDS/DESIGN,LOOP_LOG「規則變更」加一行;沒有寫「無」。

## 本機環境
- venv:session scratchpad `.venv`(`uv venv --python 3.12` + `uv pip install -r validation/requirements.txt kaggle`);PYTHONUTF8=1。
- kaggle CLI 前先 `export USERPROFILE='C:\Users\royhs'`;迴圈不寫入 token、不 peek。
- 跑腳本 cwd=`validation/`;>5 分鐘用 run_in_background;競賽資料在 `validation/data/<賽>/`(gitignored)。
- push astro-site = 正式站自動重建(~2 分);純日誌不 push。
