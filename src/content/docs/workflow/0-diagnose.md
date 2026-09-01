---
title: 讀題診斷與資料清洗
description: 先學會診斷:五問路由定位軌道 + 讀題風險盤點 + 與 Claude 協作模板;含階段 0.5 清洗與補全守則。
---

> [🐣 手冊](/workflow/handbook/) → **0 診斷** → [1 驗證](/workflow/1-validate/) → [2 基線](/workflow/2-baseline/) → [3 特徵](/workflow/3-features/) → [4–5 集成](/workflow/4-ensemble/)
>
> ⏱ 約 17 分 · 前置:做過一次手冊

## 這頁在講什麼

動手前先搞清楚:題目在問什麼、分數怎麼算、資料該怎麼切。**這步錯,後面全錯,而且 AI 不會告訴你。**

**你要做的三件事**

1. 回答五個問題,定位這是哪類題目
2. 決定驗證資料怎麼切(隨機?時間?分組?)
3. 清洗只做必要的——樹模型別亂填補

<details>
<summary><strong>這頁會出現的術語(展開對照)</strong></summary>

| 術語 | 白話 |
|---|---|
| **五問路由** | 定位題型的五個問題:資料長相→要預測什麼→怎麼算分→測試資料怎麼切→賽制 |
| **CV(交叉驗證)** | 把訓練資料輪流當考卷,自己給自己打分的方法 |
| **洩漏(leakage)** | 不小心用到「預測當下不該知道」的資訊,分數會虛高、上線就崩 |
| **Data Memo** | 一頁讀題筆記,寫下你對這題的所有判斷 |

</details>

## 0. 框架總覽

```text
階段 0  讀題與風險盤點        0.5 天   產出:一頁 Data Memo
階段 1  鎖死 CV + 端到端提交   1 天     產出:可信 CV + 第一次提交
階段 2  多樣化 Baseline 群     1 天     產出:5~8 個不同家族的模型 + OOF
階段 3  特徵工程迭代           佔 50% 時間  產出:數十~數百個實驗 + OOF
階段 4  集成(Hill Climb/Stack) 後段 25%  產出:多層 stack
階段 5  收尾強化               最後 3 天  產出:seed 平均 / 全量重訓 / 提交選擇
```

**貫穿全程的兩條鐵律**
1. **快速實驗**:最佳化的是整條管線,不只是訓練那一步。GPU 化 dataframe(cuDF / Polars)、GPU backend 的 XGB/LGBM/CatBoost。
2. **謹慎驗證**:CV 切法必須對應 test 的結構。CV 不可信 = 後面每個決策都是賭博。

---

## 2.0 總路由:五個問題定位你的軌道

```text
Q1. 資料是什麼形態?        → 決定模態軌道
Q2. 要預測什麼?            → 決定任務類型
Q3. 官方用什麼指標?        → 決定損失函數與後處理
Q4. test 怎麼切的?         → 決定 CV 策略  ★最容易錯
Q5. 是 code 競賽嗎?        → 決定算力預算與推論限制
```

**回答完這五題,你的技術方案就已經確定 80%。**

---

## 1. 階段 0:讀題與風險盤點(0.5 天)

### 1.1 必須回答的問題(Data Memo 模板)

| 專案 | 內容 |
|---|---|
| 任務型別 | 二分類 / 多分類 / 迴歸 / 排序 |
| 評估指標 | AUC / LogLoss / RMSE / MAE / MAP@k / 自訂 |
| 指標對目標的敏感性 | 指標對極端值敏感嗎?需要 target 變換嗎? |
| train / test 行列數 | |
| 目標列分布 | 類別不平衡比例、是否長尾 |
| 特徵清單 | 數值 / 類別 / 時間 / 文字 / ID |
| 缺失值 | 哪些列、缺失是否本身有資訊 |
| test 的切分方式 | 隨機 / 按使用者 / 按時間 / 按地區 |
| 疑似洩漏變數 | ID 順序、時間戳、行號相關性 |
| 是否有原始資料集 | Playground 系列幾乎都有 original dataset,常是免費分數 |
| Public LB 佔比 | 決定你能多信 LB |

### 1.2 指標決定的戰術差異

| 指標 | 關鍵動作 |
|---|---|
| AUC | 只在乎排序;不需要校準。整合預設用機率平均,**成員尺度差異大時才轉 rank**(見集成頁 L2 實驗) |
| LogLoss / Brier | 需要**機率校準**(isotonic / Platt);clip 極端值 |
| RMSE | **先看 target 偏斜度**再決定 `log1p`(log1p_regression.py:近對稱反而略差、偏斜越重效益越大);對離群值敏感 |
| MAE | 訓練 objective 用 MAE 而非 MSE;預測取中位數整合 |
| MAP@k / NDCG | 後處理排序 + 閾值搜尋往往比模型更值錢 |
| F1 / Accuracy | **閾值搜尋是必做項**,在 OOF 上搜最優閾值 |

### 1.3 Adversarial Validation(強烈建議第一天就跑)

把 train 標 0、test 標 1,訓練一個分類器區分兩者。

- **AUC ≈ 0.5** → train/test 同分布,隨機 KFold 可用,放心。
- **AUC > 0.8** → 存在明顯分布漂移。看 feature importance,排名最高的特徵通常是 ID / 時間戳 / 洩漏源,**優先考慮丟棄**。

> **實測校準(adversarial_validation_test.py,8 seeds)**:偵測與定位是**強項**——無漂移時 adversarial AUC 0.496(≈0.5),有漂移時 1.000,且漂移源特徵被抓為最高重要度 8/8。但**「丟棄」是條件式,不是自動**:若該特徵是純 ID/洩漏(無真訊號)→ 丟了改善泛化;若它**同時帶真訊號**(實測:一個既漂移又對 y 有依賴的時間戳),丟棄對 test AUC 是中性(−0.0000)。**先用它偵測、定位;丟不丟看該特徵是純洩漏還是也帶訊號。**
- **副產品**:用 adversarial 模型給 train 樣本打分,取「最像 test」的樣本當驗證集,這是分布漂移下最穩的驗證方式。

```python
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.model_selection import cross_val_predict, StratifiedKFold
from sklearn.metrics import roc_auc_score

def adversarial_validation(train_df, test_df, feats):
    X = pd.concat([train_df[feats], test_df[feats]], axis=0, ignore_index=True)
    y = np.r_[np.zeros(len(train_df)), np.ones(len(test_df))]
    m = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=31)
    cv = StratifiedKFold(5, shuffle=True, random_state=42)   # X 是 concat(train,test),不 shuffle 會按序切偏
    oof = cross_val_predict(m, X, y, cv=cv, method="predict_proba")[:, 1]
    auc = roc_auc_score(y, oof)
    m.fit(X, y)
    imp = pd.Series(m.feature_importances_, index=feats).sort_values(ascending=False)
    return auc, imp
```

---

## 10. 與 Claude 協作的 Prompt 模板

丟資料給我時,用這個格式,我可以直接產出可執行程式碼。

### 10.1 首次接手
```text
比賽:<名稱/鏈接>
指標:<AUC / RMSE / ...>
資料:train.csv <行數×列數>,test.csv <行數×列數>
目標列:<名稱>,分布 <正例比例 / 數值範圍>
特徵:數值 <n> 個,類別 <n> 個,時間 <有/無>
test 切分:<隨機 / 按時間 / 按 group>
算力:<CPU / GPU 型號,單次訓練可接受時長>

請:
1. 判斷 CV 切法並說明理由
2. 寫出 folds.py + config.py
3. 寫出 LGBM baseline,套用 run_experiment 協議
4. 列出前 10 個最值得試的特徵假設,按預期收益排序
```

### 10.2 迭代中
```text
目前狀態:
- 最佳單模型:<model> CV <x> (fold std <y>)
- 已有 OOF 文件:<列表>
- 已試過且無效:<清單>
- 已試過且有效:<清單>

請:提出 5 個新假設,並寫出實驗代碼。
```

### 10.3 整合階段
```text
我有 <n> 個 OOF 文件,清單與各自 CV 如下:<表格>

請:寫出 hill climbing + 多種 meta model(Ridge / LogReg / MLP / GBDT)
的 stacking 代碼,並比較哪種 stacker 最好。
```

---

---

## 15. 階段 0.5|資料清洗與補全(v2.2 新增,補結構性缺口)

位置:階段 0 診斷之後、階段 1 鎖 CV 之前做初版;之後每個清洗選擇都回到實驗迴圈。

**核心原則:清洗不是儀式,每個清洗選擇都是一個假設**,和特徵一樣走
「一次一改 → 過門檻才保留」。中位數填 vs 分組填 vs 不填,是三個實驗,不是一個標配。

規則:
1. **fold 內擬合所有統計**。分級對待:不碰目標的統計(中位數/眾數/縮放)
   洩漏是二階小量(L2 實測 |Δ|≈0.0001,small_n_paired.py 20 切分),fold 內做是衛生習慣;
   **碰到目標的統計(目標編碼、分組目標均值填補)洩漏是一階大量**(C2:+0.030),違反即崩。
2. **樹模型預設不填補**——LightGBM/XGBoost 原生處理 NaN,填補反而抹掉「缺失本身的訊號」。
   線性/NN/KNN 才必填。
3. **缺失指示欄**:`is_missing` 常常比填補值更有訊號(鐵達尼的 hascabin 就是)。
4. **哨兵值巡檢**:-999、0 當缺失、9999 當上限——先看每欄分布再決定。
5. **重複列檢查**:train 內重複要處理;**train-test 重複是免費分數**,一定要查。
6. 目標離群值:迴歸題先看分布**與偏斜度**,決定 clip / log1p——log1p 只在 target 明顯偏斜時有益,近對稱反而略差(見 log1p_regression.py)。

## 實戰印證(2026-08 七場掃描)

對抗驗證不是儀式:s6e8(69 萬列 synthetic)開跑前先測 train-vs-test 可分性得 **AUC 0.553 ≈ 0.5** → 診斷「隨機切」成立;之後四筆真提交的 CV→LB 落差全部只有 **+0.0013~0.0014**——切法對,CV 就誠實([`case_s6e8.py`](/validation/case_s6e8.py))。對照組:鐵達尼真實 test 為異分布,同一套流程 CV−LB 差 0.06~0.09。**先測分布,再選切法,落差可預測。**

## 學會了沒?

答得出來再往下一頁;答不出來,回頭看上面對應的段落——**能講出來才算學會,讀過不算**。

1. 這場比賽的測試資料是怎麼切出來的?你的驗證該用哪一種切法才對得上?
2. 你用 LightGBM,資料有一堆缺值。你會先填補嗎?為什麼?
3. 你能一句話說出這題的分數怎麼算、以及它偏好什麼樣的預測嗎?

<details>
<summary><strong>參考答案(先自己想過再展開)</strong></summary>

1. 看 test 是隨機抽、按時間切、還是按群組(使用者/病人)分開。**驗證的切法必須模仿 test 的切法**——時間題用隨機切會虛高,群組題會跨折互漏。

2. 不填。LightGBM 原生處理 NaN,填補反而抹掉「缺失本身就是訊號」;只加一欄 `is_missing` 記錄。線性/KNN/神經網路才必填。

3. 指標決定所有戰術:AUC 只看排序(不必校準機率)、LogLoss 在乎機率準不準、Accuracy/F1 要在 OOF 上搜最佳閾值。答不出來就回頭讀題。

</details>

## 動手驗證

光讀不會信,跑過才會。本頁對應的可下載腳本(先 `pip install -r validation/requirements.txt && python validation/fetch_data.py`):

- [`case_s6e8.py`](/validation/case_s6e8.py) —— 開跑前先做對抗驗證:印出 train/test 可分性 AUC。0.553≈0.5 → 診斷「隨機切」成立,之後四筆真提交的 CV−LB 落差果然只有 ±0.0014。
