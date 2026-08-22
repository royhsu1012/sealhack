---
title: 鎖死驗證
description: 24 小時內跑通端到端閉環;鎖死可信的 CV 與 OOF 落盤協議。
---

## 2. 階段 1:鎖死 CV + 端到端提交(1 天)

**目標:24 小時內跑通「讀檔 → 最簡特徵 → 模型 → 提交」的完整閉環。**
在有一次成功提交之前,不要碰任何特徵工程。

### 2.1 CV 切法決策樹

```text
test 是按時間切的?
├─ 是 → TimeSeriesSplit / 自訂時間窗(絕不可隨機切)
└─ 否 → 同一個實體(用戶/病人/門店)會同時出現在 train 和 test 嗎?
        ├─ 不會 → GroupKFold / StratifiedGroupKFold(按實體分組)
        └─ 會   → 目標是分類?
                  ├─ 是 → StratifiedKFold
                  └─ 否 → KFold(回歸可對 target 分箱後做 Stratified)
```

**漂移警告(v2.0,經 L2 驗證)**:持續概念漂移下,連正確的時間切分 CV 都仍然樂觀
(實驗:隨機切高估 +0.153,時間切仍高估 +0.098)。時間切「減少」而非「消除」高估。
對策:以最近窗口的分數為準、預期上線衰減、訓練時加大近期樣本權重。

**折數選擇**:5 折是預設。資料 < 5 萬或指標方差大 → 10 折 或 5×repeat。
**Seed 固定**:`SEED=42` 寫進 config,所有實驗共用同一組 fold,否則 OOF 不可比較、無法整合。

### 2.2 CV vs LB 關係表(從第一次提交就開始記)

| 實驗 ID | CV | Public LB | 差值 | 同向? |
|---|---|---|---|---|
| exp_001 | 0.8912 | 0.8887 | -0.0025 | — |
| exp_002 | 0.8945 | 0.8921 | -0.0024 | ✅ |

- 連續 5~8 次實驗若 **CV 上升 → LB 也上升**,則 CV 可信,之後**只看 CV 做決策**。
- 若兩者脫鉤,先懷疑:CV 切法錯、有洩漏、public LB 太小。**不要轉去擬合 LB。**

---

## 3. 目錄結構與 OOF 協議(框架的地基)

```text
comp_name/
├── config.py              # SEED / N_FOLDS / 路徑 / 指標
├── data/
│   ├── raw/               # 原始 csv
│   └── processed/         # 特徵後的 parquet
├── src/
│   ├── folds.py           # 只寫一次的 fold 生成器
│   ├── features/          # 每組特徵一個函數,可開關
│   ├── models/            # lgbm.py / xgb.py / cat.py / nn.py / tabpfn.py
│   └── run.py             # 統一實驗入口
├── oof/                   # ★ 資產池
│   ├── train_oof_lgbm_v001.npy
│   ├── test_preds_lgbm_v001.npy
│   └── ...
├── experiments.csv        # ★ 實驗記錄表
└── subs/                  # 提交文件
```

### 3.1 OOF 協議(不可妥協)

**每一次實驗,無論 CV 好壞,都必須落盤:**

```text
oof/train_oof_{MODEL}_{VERSION}.npy    # shape = (n_train,) 或 (n_train, n_class)
oof/test_preds_{MODEL}_{VERSION}.npy   # shape = (n_test,)  或 (n_test, n_class)
```

失敗的實驗也要存。理由:CV 差的模型可能因為**誤差方向不同**而在整合里加分。這是後期幾百個檔案能做 hill climbing 的前提。

### 3.2 實驗記錄表 schema(`experiments.csv`)

```csv
exp_id,date,model,feature_set,params_hash,cv_mean,cv_std,fold_scores,lb_public,runtime_min,oof_file,notes
```

`cv_std` 必須記錄。**`0.5 × cv_std` 是快篩**(一眼看提升有沒有進到噪音量級);
真正的保留判準是**配對比較**——同一組折上算新舊差值再做配對 t 檢定(§5.1),因為我們本來就共用 fold/seed,配對是免費的。

### 3.3 統一實驗入口(核心模板)

```python
# src/run.py  —— 完整可跑版見 validation/run_experiment_demo.py(合成資料 dogfood,產 4 個 OOF 檔 + experiments.csv)
import numpy as np, time
from pathlib import Path
from config import N_FOLDS, OOF_DIR, METRIC_FN     # SEED / 折 / 指標寫死在 config.py

def predict(model, X):                             # 二分類回機率;迴歸改成 model.predict(X)
    return model.predict_proba(X)[:, 1]

def log_experiment(exp_id, model_name, cv_mean, cv_std, fold_scores, runtime, notes):
    import csv
    f = Path(OOF_DIR) / "experiments.csv"; new = not f.exists()
    with open(f, "a", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        if new: w.writerow("exp_id model cv_mean cv_std fold_scores runtime_min notes".split())
        w.writerow([exp_id, model_name, f"{cv_mean:.5f}", f"{cv_std:.5f}",
                    "|".join(f"{s:.5f}" for s in fold_scores), f"{runtime:.2f}", notes])

def run_experiment(model_factory, X, y, X_test, folds, exp_id, model_name, notes=""):
    """所有實驗的唯一入口。保證 OOF 落盤 + 記錄寫入。"""
    t0 = time.time()
    oof = np.zeros(len(X)); test_pred = np.zeros(len(X_test)); fold_scores = []
    for f, (tr_idx, va_idx) in enumerate(folds):
        model = model_factory().fit(X.iloc[tr_idx], y[tr_idx])   # 用 eval_set/early_stopping 就在這加
        oof[va_idx] = predict(model, X.iloc[va_idx])
        test_pred += predict(model, X_test) / len(folds)
        fold_scores.append(METRIC_FN(y[va_idx], oof[va_idx]))
        print(f"  fold {f}: {fold_scores[-1]:.5f}")
    cv_mean = METRIC_FN(y, oof)          # 全體 OOF 分數(比 fold 平均更可靠)
    cv_std  = float(np.std(fold_scores))
    print(f"  ==> CV {cv_mean:.5f} (fold std {cv_std:.5f})")
    np.save(Path(OOF_DIR) / f"train_oof_{model_name}_{exp_id}.npy", oof)
    np.save(Path(OOF_DIR) / f"test_preds_{model_name}_{exp_id}.npy", test_pred)
    log_experiment(exp_id, model_name, cv_mean, cv_std, fold_scores, (time.time()-t0)/60, notes)
    return oof, test_pred, cv_mean
```

**注意**:`cv_mean` 用全體 OOF 算,不要用各 fold 分數的平均。對 AUC 這類非可加指標,兩者可能差很多,全體 OOF 才是整合時的真實基準。

---

## 11. 第一步該做什麼

**今天就做這三件事,其他先不要碰:**

1. 建好 §3 的目錄結構,寫死 `config.py`(SEED、N_FOLDS、METRIC_FN)與 `folds.py`。
2. 跑 §1.3 的 adversarial validation,決定 CV 切法,產出 Data Memo。
3. 跑一次 LGBM baseline 走完 `run_experiment`,完成第一次提交,記錄 CV 與 LB。

做完這三件,框架就活了,之後每一次實驗都會自動累積成資產。

---

### 參考來源
- NVIDIA / Kaggle Grandmasters,《The Kaggle Grandmasters Playbook: 7 Battle-Tested Modeling Techniques for Tabular Data》(2025-09)
- Chris Deotte,《Winning a Kaggle Competition with Generative AI–Assisted Coding》(2026-04)
- Prior Labs,《TabPFN-2.5: Advancing the State of the Art in Tabular Foundation Models》(arXiv:2511.08667)
- Nadeau & Bengio,《Inference for the Generalization Error》(2003)——重複 k 折配對 t 值膨脹的依據


---
