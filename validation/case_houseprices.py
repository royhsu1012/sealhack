"""案例:House Prices — L3 掃描 #4。診斷:表格迴歸、指標 RMSE(log 空間)=訓練目標 log1p(SalePrice)(偏斜重,
log1p 校準的正用例)、隨機切、**n=1460 → 小樣本**:照 small-n 守則跳過爬山集成,單模 + 5-seed 平均;
決策用 RepeatedKFold 配對。簡單模型:LGBM(主)+ Ridge(對照)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import RepeatedKFold
from sklearn.linear_model import Ridge
import lightgbm as lgb
import harness as H

SEED = 42
DATA = Path(__file__).parent / "data" / "house-prices"

def main():
    t0 = time.time()
    tr = pd.read_csv(DATA / "train.csv"); te = pd.read_csv(DATA / "test.csv")
    y = np.log1p(tr["SalePrice"].to_numpy(dtype=float))
    use = [c for c in tr.columns if c not in ("Id", "SalePrice")]
    def feature_fn(d, ref, cols):
        out = []
        for c in cols:
            if not pd.api.types.is_numeric_dtype(d[c]):
                cats = pd.Categorical(ref[c]).categories
                out.append(pd.Categorical(d[c], categories=cats).codes.astype(float))
            else: out.append(d[c].to_numpy(dtype=float))
        return np.column_stack(out)
    nan_fn = lambda d, r, u: np.nan_to_num(feature_fn(d, r, u), nan=-999.0)
    folds = list(RepeatedKFold(n_splits=5, n_repeats=2, random_state=SEED).split(tr))
    metric = lambda yt, p: -float(np.sqrt(np.mean((yt - p) ** 2)))  # 越高越好 = -RMSE(log)
    pred = lambda m, X: m.predict(X)
    fac = lambda s=SEED: (lambda: lgb.LGBMRegressor(n_estimators=500, learning_rate=0.05, num_leaves=31, random_state=s, verbose=-1))
    oof, tep, sc = H.run_cv(feature_fn, tr, te, y, folds, use, fac(), False, pred, metric)
    print(f"lgbm  OOF RMSE(log) {-metric(y, oof):.5f}  折均 {-sc.mean():.5f}")
    oof_r, tep_r, sc_r = H.run_cv(nan_fn, tr, te, y, folds, use, lambda: Ridge(alpha=10.0), True, pred, metric)
    print(f"ridge OOF RMSE(log) {-metric(y, oof_r):.5f}  配對t(lgbm−ridge) {H.paired_t(sc, sc_r):+.2f}")
    # 小樣本收尾:5-seed 平均(§7 保險),不做爬山
    seeds_te = [tep]
    for s in (1, 2, 3, 4):
        _, tp, _ = H.run_cv(feature_fn, tr, te, y, folds, use, fac(SEED + s), False, pred, metric)
        seeds_te.append(tp)
    te_avg = np.mean(seeds_te, axis=0)
    ids = te["Id"]
    for tag, p in [("single", tep), ("seedavg", te_avg)]:
        pd.DataFrame({"Id": ids, "SalePrice": np.expm1(p)}).to_csv(Path(__file__).parent / f"submission_houseprices_{tag}.csv", index=False)
    print(f"✅ 完成 {(time.time()-t0)/60:.1f} 分(seed 平均為第二份,§small-n)")

if __name__ == "__main__":
    main()
