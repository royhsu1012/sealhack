---
title: 讀題與五問診斷
description: 先學會診斷:五問路由定位軌道 + 讀題風險盤點 + 與 Claude 協作模板。
---

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
| AUC | 只在乎排序 → 整合用 **rank 平均**;不需要校準 |
| LogLoss / Brier | 需要**機率校準**(isotonic / Platt);clip 極端值 |
| RMSE | 考慮 `log1p(target)` 變換;對離群值敏感 |
| MAE | 訓練 objective 用 MAE 而非 MSE;預測取中位數整合 |
| MAP@k / NDCG | 後處理排序 + 閾值搜尋往往比模型更值錢 |
| F1 / Accuracy | **閾值搜尋是必做項**,在 OOF 上搜最優閾值 |

### 1.3 Adversarial Validation(強烈建議第一天就跑)

把 train 標 0、test 標 1,訓練一個分類器區分兩者。

- **AUC ≈ 0.5** → train/test 同分布,隨機 KFold 可用,放心。
- **AUC > 0.8** → 存在明顯分布漂移。看 feature importance,排名最高的特徵通常是 ID / 時間戳 / 洩漏源,**優先考慮丟棄**。
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
