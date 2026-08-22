---
title: 多樣化基線
description: 先鋪開不同家族的模型群 + AutoGluon 錨點,而不是先鑽研單一模型。
---

## 4. 階段 2:多樣化 Baseline 群(1 天)

### 4.0 先跑 AutoGluon 當錨點(v2.0 新增)
起手第一件事:`AutoGluon best_quality` 跑一次。它內建的就是本方法論的自動化版
——k-fold bagging 產 OOF、多層 stacking、Greedy Weighted Ensemble——
所以它的分數是「不做人工特徵能到哪」的誠實錨點。
2025 年已有它擊敗人工精調集成奪冠的實例。你之後所有人工投入,
都應該以「有沒有贏過錨點」來衡量;贏不過,代表你的時間該花在
它自動化不了的地方:診斷、CV 設計、洩漏判斷、領域特徵。


一開始就鋪開**不同家族**的模型,而不是先鑽研單一模型。這能立刻告訴你哪個家族適合這份資料,也是整合多樣性的來源。

### 4.1 建議的 Baseline 清單

| 家族 | 模型 | 備註 |
|---|---|---|
| GBDT | LightGBM | 首選,最快 |
| GBDT | XGBoost | `device="cuda"` |
| GBDT | CatBoost | 類別特徵多時常最強 |
| 線性 | Logistic / Ridge / Lasso | cuML 加速,提供最大誤差多樣性 |
| 近鄰 | KNN | 弱但常在整合里加分 |
| 核方法 | SVR / SVC | Rainfall 那場單一 SVC 就接近榜首 |
| NN | MLP / FT-Transformer | 與 GBDT 誤差方向差異大 |
| 基礎模型 | **TabPFN-2.5** | ≤5 萬行 / ≤2000 特徵時非常強 |

### 4.2 關於 TabPFN(2026 年的新變數)

TabPFN-2.5 支援到 5 萬筆資料、2000 個特徵,在 TabArena 上已超越調優過的樹模型,並追平需要跑 4 小時的 AutoGluon 1.4;在 ≤1 萬筆的中小型分類任務上,預設參數對預設 XGBoost 的勝率是 100%。

**實務建議**:
- 資料 ≤ 5 萬行 → **一定要試一次 TabPFN**,常常是零成本的強 baseline。
- 資料更大 → 用 K-Means 抽樣代表性子集喂進去,或直接當作整合的一員。
- 它與 GBDT 的誤差結構差異大,即使單獨分數略低,**在 stack 裡價值很高**。

---
