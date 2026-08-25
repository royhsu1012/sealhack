"""案例:Spaceship Titanic — L3 掃描 #3。診斷:表格二分類(Transported)、指標 Accuracy(OOF 搜閾值)、
隨機切、n=8693(>3000,5-fold 可信)。簡單模型:LGBM + LogReg + ET。特徵:原欄 + Cabin 拆 deck/side + 消費總額(一組,配對檢定)。"""
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
DERIVED = {"total_spend": lambda d, r: np.nansum(d[SPEND].to_numpy(dtype=float), axis=1),
           "no_spend": lambda d, r: (np.nansum(d[SPEND].to_numpy(dtype=float), axis=1) == 0).astype(float)}

def prep(df):
    df = df.copy()
    cab = df["Cabin"].str.split("/", expand=True)
    df["deck"], df["side"] = cab[0], cab[2]
    return df

def feature_fn(d, ref, use):
    cols = []
    for u in use:
        if u in DERIVED: cols.append(DERIVED[u](d, ref))
        elif u in CATS:
            cats = pd.Categorical(ref[u]).categories
            cols.append(pd.Categorical(d[u], categories=cats).codes.astype(float))
        else: cols.append(d[u].to_numpy(dtype=float))
    return np.column_stack(cols)

def main():
    t0 = time.time()
    tr = prep(pd.read_csv(DATA / "train.csv")); te = prep(pd.read_csv(DATA / "test.csv"))
    y = tr["Transported"].astype(int).to_numpy()
    base_use = NUMS + CATS
    folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(tr, y))
    auc = lambda yt, p: roc_auc_score(yt, p)   # 平滑指標做決策(§C9),Accuracy 只在最後算
    proba = lambda m, X: m.predict_proba(X)[:, 1]
    nan_fn = lambda d, r, u: np.nan_to_num(feature_fn(d, r, u), nan=-999.0)
    models = {
        "lgbm": (feature_fn, lambda: lgb.LGBMClassifier(n_estimators=400, learning_rate=0.05, num_leaves=31, random_state=SEED, verbose=-1), False),
        "logreg": (nan_fn, lambda: LogisticRegression(max_iter=2000), True),
        "extratrees": (nan_fn, lambda: ExtraTreesClassifier(n_estimators=300, min_samples_leaf=5, n_jobs=4, random_state=SEED), False),
    }
    # 階段 3(一組候選:消費特徵)先在 lgbm 上配對檢定
    _, _, sc_base = H.run_cv(feature_fn, tr, te, y, folds, base_use, models["lgbm"][1], False, proba, auc)
    _, _, sc_plus = H.run_cv(feature_fn, tr, te, y, folds, base_use + ["total_spend", "no_spend"], models["lgbm"][1], False, proba, auc)
    tval = H.paired_t(sc_plus, sc_base); keep = tval > 2.0
    use = base_use + (["total_spend", "no_spend"] if keep else [])
    print(f"消費特徵組 配對t {tval:+.2f} {'✅留' if keep else '✗棄'}")
    oofs, tests, cvs = {}, {}, {}
    for name, (ffn, fac, sc) in models.items():
        oof, tep, fold = H.run_cv(ffn, tr, te, y, folds, use, fac, sc, proba, auc)
        oofs[name], tests[name], cvs[name] = oof, tep, auc(y, oof)
        print(f"{name:10s} OOF AUC {cvs[name]:.5f}")
    counts, order = H.caruana(oofs, y, lambda p: auc(y, p), n_iter=30)
    ens_oof, ens_te = H.blend(oofs, counts), H.blend(tests, counts)
    best = max(cvs, key=cvs.get)
    th_s = H.best_threshold(y, oofs[best]); th_e = H.best_threshold(y, ens_oof)
    print(f"集成 {counts} OOF AUC {auc(y, ens_oof):.5f} | Acc:單模 {accuracy_score(y, oofs[best]>th_s):.5f}@{th_s:.2f} 集成 {accuracy_score(y, ens_oof>th_e):.5f}@{th_e:.2f}")
    ids = pd.read_csv(DATA / "test.csv")["PassengerId"]
    for tag, pred, th in [("single", tests[best], th_s), ("ensemble", ens_te, th_e)]:
        out = pd.DataFrame({"PassengerId": ids, "Transported": (pred > th)})
        out.to_csv(Path(__file__).parent / f"submission_spaceship_{tag}.csv", index=False)
    print(f"✅ 完成 {(time.time()-t0)/60:.1f} 分")

if __name__ == "__main__":
    main()
