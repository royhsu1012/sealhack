---
title: 多樣化基線
description: 先鋪開不同家族的模型群 + AutoGluon 錨點,而不是先鑽研單一模型。
---

> 你在這裡:[🐣 手冊](/workflow/handbook/) → [0 診斷](/workflow/0-diagnose/) → [1 驗證](/workflow/1-validate/) → **2 基線** → [3 特徵](/workflow/3-features/) → [4–5 集成與交卷](/workflow/4-ensemble/)

## 這頁在講什麼

先用幾個**原理不同**的簡單模型跑出基準分數,知道自己的起點在哪、哪個家族接得住這份資料。

**你要做的三件事**

1. 先跑一次自動工具當「錨點」
2. 跑一個 LightGBM(表格題的首選)
3. 資料 ≤5 萬列時試試 TabPFN

<details>
<summary><strong>這頁會出現的術語(展開對照)</strong></summary>

| 術語 | 白話 |
|---|---|
| **基線(baseline)** | 最簡單的可行方案,當作比較基準 |
| **家族** | 原理不同的模型類別:樹、線性、神經網路——它們「犯錯的方式」不同 |
| **錨點** | 不做人工特徵能到的分數;你的努力要贏過它才算數 |

</details>

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


## 延伸閱讀

- **TabPFN(§4.2)**:Prior Labs & Univ. Freiburg, *TabPFN-2.5*, 2025 — [arXiv:2511.08667](https://arxiv.org/abs/2511.08667)
- **六階段流程的藍本**:NVIDIA / Kaggle Grandmasters, [*The Kaggle Grandmasters Playbook*](https://developer.nvidia.com/blog/the-kaggle-grandmasters-playbook-7-battle-tested-modeling-techniques-for-tabular-data)(2025)

## 實戰印證:選對家族 > 調參

s6e8 上同一組特徵:**近預設 LightGBM OOF AUC 0.9625,LogReg 只有 0.506(≈瞎猜)**——訊號是非線性的,家族選錯直接歸零,任何調參都救不回來([`case_s6e8.py`](/validation/case_s6e8.py))。多樣化基線的目的不是每個都強,是**確認哪個家族接得住這份資料**,以及為集成準備誤差不同的成員。

## 學會了沒?

答得出來再往下一頁;答不出來,回頭看上面對應的段落——**能講出來才算學會,讀過不算**。

1. 為什麼起手要先跑一個自動工具當「錨點」?贏不過它代表什麼?
2. 同一份特徵,LightGBM 拿 0.96、邏輯迴歸只有 0.51。這告訴你什麼?
3. 多樣化基線的目的只是「找出最強的那個」嗎?

<details>
<summary><strong>參考答案(先自己想過再展開)</strong></summary>

1. 錨點告訴你「完全不做人工特徵能到哪」。贏不過它 = 你的人工投入方向錯了,該回頭檢查診斷與特徵假設,而不是繼續加工。

2. 訊號是非線性的,家族選錯直接歸零——**選對家族比調參重要得多**(s6e8 實測)。也代表這個弱成員之後對集成沒用(C3 前提)。

3. 不是。還要為階段 4 準備**犯錯方式不同**的成員;而且各家族的表現差距本身就是診斷資訊(告訴你資料的形狀)。

</details>

## 動手驗證

光讀不會信,跑過才會。本頁對應的可下載腳本(先 `pip install -r validation/requirements.txt && python validation/fetch_data.py`):

- [`case_s6e8.py`](/validation/case_s6e8.py) —— 同一份特徵下,LightGBM OOF 0.9625、邏輯迴歸 0.506(≈瞎猜)——家族選錯直接歸零,親眼看差距。
