"""house-prices 階段 3 深化(目標前 30%):三組經典組合特徵,RepeatedKFold 同折配對 t>2 才留;
LGBM 開 subsample(修 v1 確定性 seed 平均空操作),最終 5-seed 真平均。
B1 面積合成:TotalSF、TotalBath   B2 屋齡:AgeAtSale、SinceRemod、IsRemod   B3 品質×面積:Qual*TotalSF"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import RepeatedKFold
import lightgbm as lgb
import harness as H

SEED = 42
DATA = Path(__file__).parent / "data" / "house-prices"
DER = {
    "TotalSF":   lambda d, r: (d["TotalBsmtSF"].fillna(0) + d["1stFlrSF"] + d["2ndFlrSF"]).to_numpy(dtype=float),
    "TotalBath": lambda d, r: (d["FullBath"] + 0.5 * d["HalfBath"] + d["BsmtFullBath"].fillna(0) + 0.5 * d["BsmtHalfBath"].fillna(0)).to_numpy(dtype=float),
    "AgeAtSale": lambda d, r: (d["YrSold"] - d["YearBuilt"]).to_numpy(dtype=float),
    "SinceRemod": lambda d, r: (d["YrSold"] - d["YearRemodAdd"]).to_numpy(dtype=float),
    "IsRemod":   lambda d, r: (d["YearRemodAdd"] != d["YearBuilt"]).astype(float),
    "QualSF":    lambda d, r: (d["OverallQual"] * (d["TotalBsmtSF"].fillna(0) + d["1stFlrSF"] + d["2ndFlrSF"])).to_numpy(dtype=float),
}
BLOCKS = {"B1_area": ["TotalSF", "TotalBath"], "B2_age": ["AgeAtSale", "SinceRemod", "IsRemod"], "B3_qualsf": ["QualSF"]}

def feature_fn(d, ref, cols):
    out = []
    for c in cols:
        if c in DER: out.append(DER[c](d, ref))
        elif not pd.api.types.is_numeric_dtype(d[c]):
            cats = pd.Categorical(ref[c]).categories
            out.append(pd.Categorical(d[c], categories=cats).codes.astype(float))
        else: out.append(d[c].to_numpy(dtype=float))
    return np.column_stack(out)

def main():
    t0 = time.time()
    tr = pd.read_csv(DATA / "train.csv"); te = pd.read_csv(DATA / "test.csv")
    y = np.log1p(tr["SalePrice"].to_numpy(dtype=float))
    base_use = [c for c in tr.columns if c not in ("Id", "SalePrice")]
    folds = list(RepeatedKFold(n_splits=5, n_repeats=2, random_state=SEED).split(tr))
    metric = lambda yt, p: -float(np.sqrt(np.mean((yt - p) ** 2)))
    pred = lambda m, X: m.predict(X)
    fac = lambda s=SEED: (lambda: lgb.LGBMRegressor(n_estimators=600, learning_rate=0.05, num_leaves=31,
                                                    subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                                                    random_state=s, verbose=-1))
    use = list(base_use)
    _, _, base = H.run_cv(feature_fn, tr, te, y, folds, use, fac(), False, pred, metric)
    print(f"base 折均 RMSE(log) {-base.mean():.5f}(v1 OOF .13255)")
    for name, feats in BLOCKS.items():
        _, _, sc = H.run_cv(feature_fn, tr, te, y, folds, use + feats, fac(), False, pred, metric)
        t = H.paired_t(sc, base); keep = t > 2.0
        print(f"{name:10s} 折均 {-sc.mean():.5f} 配對t {t:+.2f} {'✅留' if keep else '✗棄'}")
        if keep: use += feats; base = sc
    # 最終:5-seed 真平均(subsample 已開,seed 有效)
    preds = []
    for s in range(5):
        oof, tep, _ = H.run_cv(feature_fn, tr, te, y, folds, use, fac(SEED + s), False, pred, metric)
        preds.append(tep)
        if s == 0: print(f"final seed0 OOF RMSE(log) {-metric(y, oof):.5f}")
    te_avg = np.mean(preds, axis=0)
    pd.DataFrame({"Id": te["Id"], "SalePrice": np.expm1(te_avg)}).to_csv(
        Path(__file__).parent / "submission_houseprices_v2.csv", index=False)
    print(f"✅ 完成 {(time.time()-t0)/60:.1f} 分(v1 LB 0.12749)")

if __name__ == "__main__":
    main()
