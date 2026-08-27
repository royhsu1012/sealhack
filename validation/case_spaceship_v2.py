"""spaceship 階段 3 深化(目標前 30%):三組候選,同折配對 t>2 才留;模型不動(同 v1 LGBM/LogReg/ET)。
B1 團體:PassengerId 前綴 gggg → group_size、alone(統計只用 ref,C2)
B2 艙位數字:Cabin 中段 num 數值化
B3 消費 log:五項消費 log1p(偏斜校準的正用)"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import ExtraTreesClassifier
import lightgbm as lgb
import harness as H

SEED = 42
DATA = Path(__file__).parent / "data" / "spaceship-titanic"
SPEND = ["RoomService", "FoodCourt", "ShoppingMall", "Spa", "VRDeck"]
CATS = ["HomePlanet", "CryoSleep", "Destination", "VIP", "deck", "side"]
NUMS = ["Age"] + SPEND

def prep(df):
    df = df.copy()
    cab = df["Cabin"].str.split("/", expand=True)
    df["deck"], df["cab_num"], df["side"] = cab[0], pd.to_numeric(cab[1], errors="coerce"), cab[2]
    df["grp"] = df["PassengerId"].str.split("_").str[0]
    return df

DER = {
    "total_spend": lambda d, r: np.nansum(d[SPEND].to_numpy(dtype=float), axis=1),
    "no_spend":    lambda d, r: (np.nansum(d[SPEND].to_numpy(dtype=float), axis=1) == 0).astype(float),
    "group_size":  lambda d, r: d["grp"].map(pd.concat([r["grp"], d["grp"]]).value_counts()).to_numpy(dtype=float),
    "alone":       lambda d, r: (d["grp"].map(pd.concat([r["grp"], d["grp"]]).value_counts()) == 1).astype(float),
    "cab_num":     lambda d, r: d["cab_num"].to_numpy(dtype=float),
}
for c in SPEND:
    DER[f"log_{c}"] = (lambda col: lambda d, r: np.log1p(np.clip(d[col].to_numpy(dtype=float), 0, None)))(c)

BLOCKS = {
    "B1_group": ["group_size", "alone"],
    "B2_cabnum": ["cab_num"],
    "B3_logspend": [f"log_{c}" for c in SPEND],
}

def feature_fn(d, ref, use):
    cols = []
    for u in use:
        if u in DER: cols.append(DER[u](d, ref))
        elif u in CATS:
            cats = pd.Categorical(ref[u]).categories
            cols.append(pd.Categorical(d[u], categories=cats).codes.astype(float))
        else: cols.append(d[u].to_numpy(dtype=float))
    return np.column_stack(cols)

def main():
    t0 = time.time()
    tr = prep(pd.read_csv(DATA / "train.csv")); te = prep(pd.read_csv(DATA / "test.csv"))
    y = tr["Transported"].astype(int).to_numpy()
    folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(tr, y))
    auc = lambda yt, p: roc_auc_score(yt, p)
    proba = lambda m, X: m.predict_proba(X)[:, 1]
    lg = lambda: lgb.LGBMClassifier(n_estimators=400, learning_rate=0.05, num_leaves=31, random_state=SEED, verbose=-1)
    use = NUMS + CATS + ["total_spend", "no_spend"]   # v1 已驗證的起點
    _, _, base = H.run_cv(feature_fn, tr, te, y, folds, use, lg, False, proba, auc)
    print(f"base(v1 特徵) 折均 AUC {base.mean():.5f}")
    for name, feats in BLOCKS.items():
        _, _, sc = H.run_cv(feature_fn, tr, te, y, folds, use + feats, lg, False, proba, auc)
        t = H.paired_t(sc, base); keep = t > 2.0
        print(f"{name:12s} 折均 {sc.mean():.5f} 配對t {t:+.2f} {'✅留' if keep else '✗棄'}")
        if keep: use += feats; base = sc
    nan_fn = lambda d, r, u: np.nan_to_num(feature_fn(d, r, u), nan=-999.0)
    models = {"lgbm": (feature_fn, lg, False),
              "logreg": (nan_fn, lambda: LogisticRegression(max_iter=2000), True),
              "extratrees": (nan_fn, lambda: ExtraTreesClassifier(n_estimators=300, min_samples_leaf=5, n_jobs=4, random_state=SEED), False)}
    oofs, tests, cvs = {}, {}, {}
    for name, (ffn, fac, sc) in models.items():
        oof, tep, _ = H.run_cv(ffn, tr, te, y, folds, use, fac, sc, proba, auc)
        oofs[name], tests[name], cvs[name] = oof, tep, auc(y, oof)
        print(f"{name:10s} OOF AUC {cvs[name]:.5f}")
    counts, _ = H.caruana(oofs, y, lambda p: auc(y, p), n_iter=30)
    ens_oof, ens_te = H.blend(oofs, counts), H.blend(tests, counts)
    pick_oof, pick_te = (ens_oof, ens_te) if auc(y, ens_oof) >= max(cvs.values()) else (oofs[max(cvs, key=cvs.get)], tests[max(cvs, key=cvs.get)])
    th = H.best_threshold(y, pick_oof)
    print(f"集成 {counts} OOF AUC {auc(y, ens_oof):.5f} | 選用 Acc {accuracy_score(y, pick_oof > th):.5f}@{th:.2f}(v1 LB 0.80406)")
    pd.DataFrame({"PassengerId": te["PassengerId"], "Transported": (pick_te > th)}).to_csv(
        Path(__file__).parent / "submission_spaceship_v2.csv", index=False)
    print(f"✅ 完成 {(time.time()-t0)/60:.1f} 分")

if __name__ == "__main__":
    main()
