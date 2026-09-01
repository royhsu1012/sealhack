---
title: 傻瓜手冊:第一場比賽保姆級教學
description: 零基礎照抄版:一張流程圖 + 七個命令句步驟 + 一段可直接貼的程式碼,今天就交出你的第一份提交。
---

> **🐣 手冊** → [0 診斷](/workflow/0-diagnose/) → [1 驗證](/workflow/1-validate/) → [2 基線](/workflow/2-baseline/) → [3 特徵](/workflow/3-features/) → [4–5 集成](/workflow/4-ensemble/)
>
> ⏱ 約 18 分 · 前置:會 Python + Kaggle 帳號

你只需要:會跑 Python、一個 Kaggle 帳號、大約 45 分鐘。**不需要**懂機器學習理論——先完成,再理解。

## 全程流程圖(整場比賽就這一張)

```text
拿到題目
   ↓
【問】資料是表格嗎?(csv,一列一筆)
   ↓ 是
【問】資料有時間順序嗎?(例:按日期的銷售)
   ├─ 有 → CV 用「時間切」:過去訓練、未來驗證
   └─ 沒有 → CV 用「隨機切」(分類題用 Stratified)
   ↓
清洗:用 LightGBM 就先不要填補 NaN(它自己會處理)
   ↓
24 小時內跑通:讀檔 → 最簡特徵 → LightGBM
   → 交出第一份提交(分數爛沒關係,格式對就好)
   ↓
記下你的 CV 分數(這是你的基準線)
   ↓
┌── 特徵迴圈(每次只做一件事)─────────────┐
│  加一組特徵 → 同一組折重跑 → CV 升了嗎?  │
│    ├─ 明顯升了 → 留下                    │
│    └─ 沒升或降了 → 丟掉,換下一個想法    │
└──────────────────────────────────────────┘
   ↓
【問】資料超過 3000 列嗎?
   ├─ 是 → 可以試集成(多個模型平均)
   └─ 否 → 跳過集成,單模就好
   ↓
選兩份提交:CV 最高的一份 + 最穩健的一份
   ↓
交之前檢查:行數 / 欄名 / ID 順序 / 沒有 NaN
   ↓
完賽 🎉 → 想懂每一步為什麼 → 快速版與完整版
```

## 七步照抄

### 第 1 步|報名一場比賽

到 Kaggle 首頁 → Competitions → 找標籤 **Playground** 或 **Getting Started** 的比賽(免費、無門檻)→ 點進去按 **Join Competition** → **I Understand and Accept**。

### 第 2 步|拿到資料

比賽頁的 **Data** 分頁 → **Download All** → 解壓縮。你會看到三個檔:`train.csv`(有答案)、`test.csv`(要你預測)、`sample_submission.csv`(交卷格式範本)。

### 第 3 步|看三眼資料

```python
import pandas as pd
tr = pd.read_csv("train.csv")
print(tr.shape)        # 幾列幾欄
print(tr.head(3))      # 長什麼樣
print(pd.read_csv("sample_submission.csv").head(3))  # 要交什麼格式
```

看 `sample_submission.csv` 的**第二欄欄名**——那就是你要預測的目標。

### 第 4 步|回答流程圖上面兩個問題

- **是表格嗎?** csv 打開一列一筆就是。(圖片/文字題先別碰,完賽一場表格題再說。)
- **有時間順序嗎?** 資料裡有日期欄、且題目是「預測未來」→ 有。沒有日期或順序無關 → 沒有。

### 第 5 步|貼上這段,跑出第一份提交

把 `TARGET` 和 `ID` 改成你的欄名,其他不用動(以最常見的二分類為例):

```python
import pandas as pd, numpy as np, lightgbm as lgb
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score

TARGET = "target"   # ← 改:sample_submission 的第二欄欄名
ID     = "id"       # ← 改:sample_submission 的第一欄欄名

tr = pd.read_csv("train.csv"); te = pd.read_csv("test.csv")
y  = tr[TARGET]
X  = tr.drop(columns=[TARGET, ID]); Xt = te.drop(columns=[ID])

# 文字欄轉數字(傻瓜版:給編號,LightGBM 吃得下)
for c in X.columns:
    if not pd.api.types.is_numeric_dtype(X[c]):
        cats = X[c].astype("category").cat.categories
        X[c]  = pd.Categorical(X[c],  categories=cats).codes
        Xt[c] = pd.Categorical(Xt[c], categories=cats).codes

oof = np.zeros(len(X)); pred = np.zeros(len(Xt))
for tr_i, va_i in StratifiedKFold(5, shuffle=True, random_state=42).split(X, y):
    m = lgb.LGBMClassifier(n_estimators=400, learning_rate=0.05, verbose=-1)
    m.fit(X.iloc[tr_i], y.iloc[tr_i])
    oof[va_i] = m.predict_proba(X.iloc[va_i])[:, 1]
    pred     += m.predict_proba(Xt)[:, 1] / 5

print("你的 CV(AUC):", round(roc_auc_score(y, oof), 5))   # ★ 把這個數字抄下來
pd.DataFrame({ID: te[ID], TARGET: pred}).to_csv("submission.csv", index=False)
print("已產生 submission.csv")
```

> 迴歸題(預測數字)改三處:`LGBMClassifier`→`LGBMRegressor`、`predict_proba(...)[:, 1]`→`predict(...)`、`StratifiedKFold(5, ...).split(X, y)`→`KFold(5, shuffle=True, random_state=42).split(X)`,分數改用 RMSE。

比賽頁 **Submit Prediction** → 上傳 `submission.csv`。**恭喜,你已經在排行榜上了。**

### 第 6 步|加特徵,一次一個

想一個新欄位(例:兩欄相除、按某類別分組的平均),加進 `X` 和 `Xt`,**重跑第 5 步**:

- CV 比剛才**明顯高** → 留下
- 差不多或變低 → 刪掉,換下一個想法

鐵律:**一次只加一個想法**。一次加十個,你永遠不知道是哪個有用。

#### 想不出加什麼?先試這三招萬用特徵

貼在「文字欄轉數字」那段**之後**、CV 迴圈**之前**;把大寫的欄名換成你資料裡的欄位,**一次只開一招**:

```python
# 招 1|比值:樹模型學不好除法,手動餵給它效果最好
X["ratio_1"]  = X["欄A"]  / (X["欄B"] + 1e-3)
Xt["ratio_1"] = Xt["欄A"] / (Xt["欄B"] + 1e-3)

# 招 2|群組相對值:這一筆比「同類的平均」高還是低
grp = X.groupby("類別欄")["數值欄"].mean()          # 平均只用 train 算
X["rel_1"]  = X["數值欄"]  / X["類別欄"].map(grp)
Xt["rel_1"] = Xt["數值欄"] / Xt["類別欄"].map(grp)   # test 套用 train 的平均

# 招 3|缺失樣態:有沒有缺、缺幾個,本身常常就是訊號
X["n_missing"]  = tr.isna().sum(axis=1)
Xt["n_missing"] = te.isna().sum(axis=1)
```

**為什麼是這三招**(不是隨便挑的):

- **比值**是樹模型的結構弱點——它只會沿著單一欄位切一刀,學不出 `A/B` 這種形狀。本站在兩場真比賽實測都過關(統計檢定 t=+8.99 與 +4.38),[沙盒證明在這](/validation/ratio_feature.py)。
- **群組相對值**把「絕對數字」變成「相對於同類的位置」,通常比原始聚合值更有訊號。
- **缺失樣態**:很多資料的「沒填」本身就是答案的線索(例:鐵達尼沒有艙房號碼的人多半是低艙等)。

> ⚠️ **唯一的地雷**:招 2 千萬**不要用「答案欄」去算平均**(例如「這個城市的平均存活率」)。那叫目標編碼,做錯就是洩漏——CV 會漂亮得不合理、一交卷就崩。想用它請先讀[階段 3 的正確做法](/workflow/3-features/)。

加完**重跑第 5 步**,看 CV 有沒有升。升了留下、沒升丟掉,再換下一招。

> 這裡有個更深的問題:CV 升了 0.001,**那是真的變好,還是運氣?** 手冊的答案是「明顯升了才留」;完整版教你用配對比較把它算出來——那是[階段 3](/workflow/3-features/) 的內容,也是業餘與穩定拿牌的分水嶺。

### 第 7 步|選兩份,交卷

比賽結束前,在 Submissions 頁勾選兩份最終提交:**CV 最高的一份 + 你覺得最穩的一份**。絕對不要兩份都挑「public 榜分數最高」的——那個榜只用了一小部分測試資料,會騙人。

## 卡關急救(90% 的新手死在這五個)

| 症狀 | 原因與解法 |
|---|---|
| 交卷得 0 分或報錯 | 格式錯:對照 sample_submission 檢查欄名、列數、ID 順序 |
| CV 很高、榜上很爛 | 十之八九是洩漏或切錯:時間資料用了隨機切?特徵偷看了答案? |
| 程式跑不動:文字欄報錯 | 忘了第 5 步的「文字欄轉數字」迴圈 |
| NaN 報錯 | 用 LightGBM 不會;若換其他模型,先 `X = X.fillna(-999)` |
| 跑太慢 | `n_estimators` 先降到 100;資料太大先 `tr.sample(100000)` 練手 |

## 你剛剛其實走完了六階段

那七步不是隨便排的——它是完整方法論的**最短版本**。你剛剛做的每一件事都對應一個階段:

| 你剛剛做的 | 這在方法論裡叫 | 想做得更好 |
|---|---|---|
| 回答「有時間順序嗎」再決定怎麼切 | 階段 0:讀題診斷 | [0 診斷](/workflow/0-diagnose/) |
| 貼上那段程式,跑通並交出第一份 | 階段 1:鎖死驗證(那個 5 折就是 CV) | [1 驗證](/workflow/1-validate/) |
| 印出來的那個 CV 分數 | 階段 2:基線(你的起點) | [2 基線](/workflow/2-baseline/) |
| 一次加一個欄位,看分數升不升 | 階段 3:特徵迭代 | [3 特徵](/workflow/3-features/) |
| (這版先跳過) | 階段 4:集成 | [4–5 集成](/workflow/4-ensemble/) |
| 選兩份、交卷前檢查格式 | 階段 5:收尾與提交 | [4–5 交卷](/workflow/4-ensemble/) |

**差別在哪**:手冊教你「一次加一個特徵,看分數升不升」;完整版教你**怎麼判斷那個「升」是真的還是運氣**(配對比較、t>2)。這一步就是業餘與穩定拿牌的分水嶺。

## 完賽之後

你已經走完六階段的傻瓜版。想知道每一步**為什麼**這樣做、以及怎麼做得更好:

1. [快速版:最短完賽路](/workflow/quickstart/) —— 同一條路,每步多一層理由 + 學習地圖與自我檢核
2. [讀題診斷與清洗](/workflow/0-diagnose/) 起的完整版 —— 每階段的全部深度
3. [主張登錄表](/claims/) —— 本手冊每條規則背後的可重跑證據
