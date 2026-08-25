---
title: 特徵迭代
description: 時間大頭:消融驅動的選題 + 一次一組特徵 + 配對比較。
---

## 5. 階段 3:特徵工程迭代(時間大頭)

### 5.0 消融驅動的選題(v2.0 新增,採自 MLE-STAR)
「下一批實驗做什麼」不靠直覺,靠量測:每 5~8 個實驗跑一次消融盤點——
逐一移除特徵組/管線組件,記錄各自掉分,下一批實驗只打「掉分最大」的那塊。
Google MLE-STAR 用這招把 agent 的獎牌率從 25.8% 拉到 43.9%;
L2 驗證(主張 5)證實消融能正確排序組件價值。

### 5.1 迭代紀律

> **一次只加一組特徵 → 在同一組折上算新舊的「配對差值」→ 配對 t 檢定 → 保留或砍掉。**

**配對比較是所有 n 的預設判準,不只小樣本。** 因為我們共用 fold/seed(§2.1、§3.3),
同一組折上「新特徵組 − 舊特徵組」的差值消掉了「這次切分運氣好壞」這個共同項:
`Var(A−B) = Var(A)+Var(B) − 2Cov(A,B)`,共折下 `Cov` 很高,所以配對差的變異遠小於分數本身
(small_n_paired.py 實測 ≈ 分數 std 的 1/4)。判準:**配對 t > 2 才保留**。

- **`0.5 × cv_std` 只當快篩**:提升連這都不到,不必算配對 t 就砍;過了才做配對檢定。
- ⚠️ **重複 k 折的配對 t 會膨脹**(fold 相關違反獨立假設,Nadeau–Bengio 2003):把 t 當「排序/篩選」用,
  不要當成真的 p 值;跨多次資料切分穩定達 t>2 才算穩(§16.3 的 Title/family 只有 1/20,就是被這條擋下)。

### 5.2 特徵套路清單(按投資報酬率排序)

**A. 群組聚合統計(通常最有效)**
```python
for key in ["user_id", "category", "region"]:
    for col in NUM_COLS:
        g = df.groupby(key)[col]
        df[f"{key}_{col}_mean"] = g.transform("mean")
        df[f"{key}_{col}_std"]  = g.transform("std")
        df[f"{col}_div_{key}_mean"] = df[col] / (df[f"{key}_{col}_mean"] + 1e-9)
        df[f"{col}_sub_{key}_mean"] = df[col] - df[f"{key}_{col}_mean"]
```
> 差值 / 比值往往比原始聚合值更有訊號。
>
> **實測校準(group_aggregation_features.py,8 seeds)**:最大的收益是**加入群組聚合本身**——在一份「x 被群組基線混淆」的資料上,加聚合特徵讓 AUC +0.16(樹與線性皆然)。但**差值/比值相對原始聚合值的額外增益很小**(樹 +0.003、線性 +0.0004),因為只要 x 與聚合值都在,模型多半能自行組合。務實結論:**一定要加群組聚合;差值/比值是錦上添花(對樹略有幫助),不是主力。**

**B. 類別兩兩組合**(實測有效,曾靠這招拿過第一)
```python
for i, c1 in enumerate(CATS[:-1]):
    for c2 in CATS[i+1:]:
        df[f"{c1}_{c2}"] = df[c1].astype(str) + "_" + df[c2].astype(str)
```
8 個類別列 → 28 個新互動特徵。

**C. Frequency Encoding**:`df[c].map(df[c].value_counts())` — 便宜(一行)。**實測校準(frequency_encoding.py,8 seeds)**:對**已有該類別欄的 LightGBM**,再加 frequency 幾乎不加分(頻率帶訊號時 +0.0001、無關時 −0.0008)——樹已能學到每類別效果。對**線性模型**或類別本身難用(被丟棄)時才明顯。

**D. Target Encoding**:⚠️ **必須在 fold 內計算**,加平滑,否則直接洩漏。
```python
def target_encode(tr, va, col, y, smooth=20):
    prior = y[tr.index].mean()
    stats = y.groupby(tr[col]).agg(["mean", "count"])
    te = (stats["mean"]*stats["count"] + prior*smooth) / (stats["count"] + smooth)
    return va[col].map(te).fillna(prior)
```

**E. 時間特徵**:小時/星期/月、週期編碼 `sin/cos`、距上次事件的時間差、滾動視窗統計(注意只用過去)。

**F. 數值互動**:比值、差值、乘積、多項式。GBDT 學不好除法,手動給它。**實測證實(ratio_feature.py,8 seeds)**:訊號是 x/z 時,手動加 x/z 一欄,線性 +0.007、樹 +0.003——樹只能用軸對齊分裂近似比值、線性根本算不出,所以這招確實有效(增益雖不大但方向一致)。

**G. 降維產物**:PCA / UMAP / SVD 的前幾個主成分當作額外特徵。

### 5.3 特徵篩選

- 用 **permutation importance** 或 **null importance**(把 target 打亂當基準),不要只看 `gain`。
- **`gain` 對高基數的高估要看模型(校準)**:這是不純度(MDI)重要度的經典偏誤,原始出處是隨機森林([Strobl et al. 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC1796903/))。但實測(importance_gain_vs_perm.py,8 seeds)顯示 **LightGBM 的 gain 相當穩健**——一個高基數純噪音欄只佔 9% gain、排名 6/7,正則與否皆然(histogram binning 抵消了「分裂點多」的優勢)。permutation 則在所有情況都正確壓到 ≈0。**特徵篩選仍以 permutation / null importance 最保險。**
- 篩選後重跑,確認 CV 沒掉。

---

## 9. 每日迭代迴圈(Meredith Loop)

```text
早上   ── 看 experiments.csv,選 3~5 個待驗證假設
白天   ── 每個假設 → 一次實驗 → OOF 落盤 → 記錄
傍晚   ── 跑一次 hill climbing,看當前最佳集成分數
每週   ── 復盤:什麼提升了 OOF、什麼失敗了、
          什麼進入最終集成池、什麼該砍掉
```

**每個分支只回答一個問題**:驗證分數更好?跨 fold 更穩定?推理更快?整合多樣性更高?**答案不明確就砍掉。**

另一條重要紀律:**不要照抄別人的獲獎方案**。任何從論壇或過往方案借來的技巧,都必須在你自己的切分與算力預算下重新驗證一次。

---


## 延伸閱讀

- **目標編碼(§5.2D)**:Micci-Barreca, *A Preprocessing Scheme for High-Cardinality Categorical Attributes*, SIGKDD 2001 — [doi:10.1145/507533.507538](https://doi.org/10.1145/507533.507538)
- **消融驅動選題(§5.0)**:Google, *MLE-STAR*, 2025 — [arXiv:2506.15692](https://arxiv.org/abs/2506.15692)
- **配對比較的統計基礎(§5.1)**:Nadeau & Bengio, *Inference for the Generalization Error*, 2003 — [doi:10.1023/A:1024068626366](https://doi.org/10.1023/A:1024068626366)
- **特徵重要度偏誤(§5.3)**:Strobl et al., *Bias in Random Forest Variable Importance Measures*, BMC Bioinformatics 2007 — [PMC1796903](https://pmc.ncbi.nlm.nih.gov/articles/PMC1796903/)
