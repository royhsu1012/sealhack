---
title: 集成與提交
description: Hill Climbing 防過擬合三招 + Stacking + 偽標籤 + 知識蒸餾;收尾強化(多 seed、雙提交)與常見踩雷清單。
---

## 6. 階段 4:整合

### 6.0 集成紅利的前提(v2.0 修訂,經 L2 驗證)
集成要贏最佳單模,需要成員「實力相近 + 誤差多樣」。
L2 實驗:當 logreg 落後 lgbm 六個百分點時,爬山集成毫無增益(-0.0005);
換成實力相近的 lgbm / ExtraTrees / MLP 後,集成 +0.0024 且三者全被採用。
教訓:多樣性是必要條件,不是充分條件——先把弱成員拉到可比水準
(調參/換特徵),再談集成。強弱懸殊時,爬山只會過擬合 OOF。

### 6.1 Hill Climbing(先做這個,簡單且強)

**防過擬合三招(v2.1,Caruana 2004 / KDD Cup 09 冠軍作法)**:
爬山會過擬合 OOF(我們在 C3 實驗親眼看過)。標準解法:
(1) 可重複選取——同一模型可被選多次,自然形成權重;
(2) 用單模表現最好的前 N 個初始化,不從空集合開始;
(3) bagged selection——隨機抽模型子集各自爬山,最後取聯集平均。
成員少於 10 個時用 (1)+(2) 即可;成員上百時 (3) 必做。

從最強的單模型出發,系統性地嘗試加入其他模型與權重,只保留能提升驗證分數的組合,重複直到無法再提升。

```python
import numpy as np

def hill_climb(oofs, y, metric_fn, n_iter=200, weights_grid=np.arange(0.05, 1.01, 0.05)):
    """oofs: dict[name] -> oof array。回傳 (weights, best);weights 權重和恆為 1,
    對 OOF 或 test 都用同一個 blend(preds, weights) 套用——這是集成能落地到 test 的關鍵。"""
    names = list(oofs)
    best_name = max(names, key=lambda n: metric_fn(y, oofs[n]))
    ens = oofs[best_name].copy()
    weights = {best_name: 1.0}
    best = metric_fn(y, ens)

    for _ in range(n_iter):
        cand_best, cand = best, None
        for n in names:
            for w in weights_grid:
                s = metric_fn(y, ens * (1 - w) + oofs[n] * w)
                if s > cand_best:
                    cand_best, cand = s, (n, w)
        if cand is None:
            break
        n, w = cand
        ens = ens * (1 - w) + oofs[n] * w
        for k in weights:                 # ★ 整個集成乘 (1-w),所以所有成員一起縮
            weights[k] *= (1 - w)
        weights[n] = weights.get(n, 0) + w
        best = cand_best
    return weights, best

def blend(preds, weights):                # 用同一組權重混合 OOF / test 預測(權重和 = 1)
    return sum(preds[k] * w for k, w in weights.items())

# 用法:weights, _ = hill_climb(oofs, y, metric_fn)
#       test_ensemble = blend(test_preds, weights)   # ← 交給 Kaggle 的就是這個
```

> ⚠️ **常見錯**:早期版本只把新成員的舊權重乘 (1-w),沒縮放其他成員,`used` 權重和 > 1、
> 拿去加權 test 得到的不是爬山選出的那個集成(`validation/hill_climb_weights.py`:文件舊版和=1.75、
> 重建誤差 1.13;正解和=1.0、誤差 ~0;test AUC 0.7232 vs 0.7171)。混合 OOF 與 test **必用同一組 weights**。

**加速技巧**:用 CuPy 向量化,一次並行評估上千組權重組合。
**AUC 專用(2026-08 修訂)**:rank 平均(`scipy.stats.rankdata` 後除以 n 再平均)**不是普遍較優**——L2 實驗(rank_vs_prob_auc.py,20 seeds)顯示成員同為 [0,1] 機率、尺度相近時 rank 平均沒有優勢、甚至略差(勝 4/20、均值 −0.0005);**只在成員分數尺度差異大時才有益**(把一個成員 ×50 模擬未正規化輸出後,rank 平均 10/10 勝、+0.0077)。
> 修訂史:原措辭「rank 平均通常比直接平均機率好」被此實驗推翻,改為條件式。實務:預設用(加權)機率平均;成員尺度明顯不同(如混入未校準的 margin/decision\_function)時才轉 rank。

### 6.2 Stacking(第二層模型)

兩種做法:
- **OOF as Features**:把第一層的 OOF 預測當成第二層的輸入特徵(可再拼上部分原始特徵)。
- **Residuals**:第二層直接學第一層的殘差。

⚠️ **關鍵防洩漏規則**:第二層必須使用**與第一層完全相同的 fold 劃分**。這就是為什麼 `SEED` 和 fold 生成器要寫死在 config 裡。

冠軍方案常見結構:三到四層,Level 1 是多樣化基模型(線性、KNN、SVR、RF、MLP、TabPFN、GBDT),Level 2/3 是 XGBoost 與 MLP 的 stacker,最後一層加權平均。

### 6.3 Pseudo-Labeling(資料不多時值得)

用最強的模型給 test(或外部無標資料)打軟標籤,混回訓練集重訓。冠軍方案常用的半監督招式。

**實測證實(pseudo_labeling.py,8 seeds)**:「資料不多時值得」有明確**交叉點**——標籤稀少(n=300)時 base 0.8831 → pseudo 0.8872(+0.0042,勝 6/8);標籤充足(n=3000)時反而 base 0.9331 → pseudo 0.9305(−0.0026,勝 0/8)。**標籤已充足就別做**,只會引入偽標籤噪音。

**注意事項**:
- 用**軟標籤**(機率)而非硬 0/1,資訊更多、噪聲更低,還可以過濾低信心樣本。
- 教師模型越強,偽標籤越好;多輪迭代通常優於單輪。
- ⚠️ **防洩漏**:做 k-fold 時必須產生 k 套偽標籤,確保驗證集看不到由自己訓練出的模型所給的標籤。

### 6.4 Knowledge Distillation

把所有 OOF / test 預測當作蒸餾目標,訓練**一個**新的強單模型。好處是又產出一個高質量、且與原模型高度不同的整合成員。

---


## 7. 階段 5:收尾強化(最後 3 天)

1. **多 seed 平均**:同一組超參跑 10~100 個不同 seed 取平均。**實測(seed_averaging.py,8 切分)**:平均永遠不低於單 seed 均值、消掉「單顆種子的運氣」;但增益大小隨模型 seed 方差而定——穩定的 LightGBM 種子方差小(std≈0.001),增益就小(+0.0001~0.0015 AUC);少樹 / 強 subsample / NN / 小資料等高方差設定才明顯。**當它是保險(不虧),不是主力漲分。**
2. **全量重訓**:超參確定後,用 100% 訓練資料重訓最終模型。
3. **提交選擇**(最關鍵,很多人在這裡翻車):
   - 選 **2 個** final submission:
     - #1 = **CV 最高**的方案(相信自己的驗證)
     - #2 = **最穩健**的方案(模型數最多、fold 方差最小的整合)
   - **絕不**兩個都選 public LB 最高的。
4. **最後一次防呆檢查**:提交檔案行數、ID 順序、列名、是否有 NaN、機率是否在 [0,1]。

---

## 8. 常見踩雷清單

| 雷 | 症狀 | 解法 |
|---|---|---|
| Target encoding 洩漏 | CV 極高,LB 崩 | fold 內計算 + 平滑 |
| CV 切法與 test 不符 | CV 與 LB 完全脫鉤 | 回到 §2.1 決策樹 |
| 用不同 fold 做 stacking | 第二層 CV 虛高 | 全流程共用 fold |
| 擬合 public LB | 私榜大跳水 | 迭代決策用 CV,LB 只做單次判讀(§13)|
| 沒存 OOF | 後期無法整合 | §3.1 協議 |
| 把 fold 平均當 CV | 整合時基準對不上 | 用全體 OOF 算 |
| 提交前沒檢查格式 | 直接 0 分 | 防呆檢查清單 |
| 一次加十組特徵 | 不知道哪組有用 | 一次一組 |

## 延伸閱讀

- **Stacking 原始論文**:Wolpert, *Stacked Generalization*, Neural Networks 1992 — [doi:10.1016/S0893-6080(05)80023-1](https://doi.org/10.1016/S0893-6080(05)80023-1)
- **爬山集成(§6.1 的來源)**:Caruana et al., *Ensemble Selection from Libraries of Models*, ICML 2004 — [doi:10.1145/1015330.1015432](https://doi.org/10.1145/1015330.1015432)
- **知識蒸餾 / 偽標籤**:Hinton, Vinyals & Dean (2015) [arXiv:1503.02531](https://arxiv.org/abs/1503.02531) / Lee, *Pseudo-Label*, ICML 2013 Workshop
- **實務入門**:MLWave, [*Kaggle Ensembling Guide*](https://mlwave.com/kaggle-ensembling-guide/)
