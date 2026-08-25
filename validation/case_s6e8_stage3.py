"""s6e8 階段 3|特徵迭代(§5.1 配對比較):一次一組、同折配對 t>2 才保留;模型不動(近預設 LGBM)。
候選五組(領域假設,呼應沙盒校準:比值/互動是樹學不好的形狀、群組聚合看基準差):
  B1 ratios_screen:社群/遊戲佔螢幕時數比
  B2 sleep_interact:螢幕/睡眠比、清醒時間佔比
  B3 weekend_delta:週末超額(差值+比值)
  B4 notif_apps:每次開啟通知數、每小時開啟次數
  B5 group_dev:對(stress_level×gender)群組均值的偏差(統計僅用 ref,C2/C10 紀律)
產出:submission_s6e8_single2.csv(lgbm raw+kept)、submission_s6e8_ensemble2.csv(caruana:新 lgbm + 既存 ET OOF)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score
import lightgbm as lgb
import harness as H

SEED = 42
DATA = Path(__file__).parent / "data" / "s6e8"
TARGET, ID = "addicted_label", "id"
EPS = 1e-3
NUM = ["age", "daily_screen_time_hours", "social_media_hours", "gaming_hours", "work_study_hours",
       "sleep_hours", "notifications_per_day", "app_opens_per_day", "weekend_screen_time"]
CAT = ["gender", "stress_level", "academic_work_impact"]
RAW = NUM + CAT

def col(d, c):
    if c in CAT:
        return None  # 由 feature_fn 處理
    return d[c].to_numpy(dtype=float)

DERIVED = {
    "ratio_social":  lambda d, r: col(d, "social_media_hours") / (col(d, "daily_screen_time_hours") + EPS),
    "ratio_gaming":  lambda d, r: col(d, "gaming_hours") / (col(d, "daily_screen_time_hours") + EPS),
    "scr_per_sleep": lambda d, r: col(d, "daily_screen_time_hours") / (col(d, "sleep_hours") + EPS),
    "wake_share":    lambda d, r: col(d, "daily_screen_time_hours") / (24.0 - col(d, "sleep_hours") + EPS),
    "wk_delta":      lambda d, r: col(d, "weekend_screen_time") - col(d, "daily_screen_time_hours"),
    "wk_ratio":      lambda d, r: col(d, "weekend_screen_time") / (col(d, "daily_screen_time_hours") + EPS),
    "notif_per_open": lambda d, r: col(d, "notifications_per_day") / (col(d, "app_opens_per_day") + EPS),
    "opens_per_hour": lambda d, r: col(d, "app_opens_per_day") / (col(d, "daily_screen_time_hours") + EPS),
}
def _group_dev(d, r):
    key = ["stress_level", "gender"]
    gm = r.groupby(key)["daily_screen_time_hours"].mean()
    idx = pd.MultiIndex.from_frame(d[key])
    base = gm.reindex(idx).to_numpy(dtype=float)
    return col(d, "daily_screen_time_hours") - base
DERIVED["group_dev_screen"] = _group_dev

BLOCKS = {
    "B1_ratios_screen": ["ratio_social", "ratio_gaming"],
    "B2_sleep_interact": ["scr_per_sleep", "wake_share"],
    "B3_weekend_delta": ["wk_delta", "wk_ratio"],
    "B4_notif_apps": ["notif_per_open", "opens_per_hour"],
    "B5_group_dev": ["group_dev_screen"],
}

def feature_fn(d, ref, use):
    cols = []
    for u in use:
        if u in DERIVED:
            cols.append(DERIVED[u](d, ref))
        elif u in CAT:
            cats = pd.Categorical(ref[u]).categories
            cols.append(pd.Categorical(d[u], categories=cats).codes.astype(float))
        else:
            cols.append(d[u].to_numpy(dtype=float))
    return np.column_stack(cols)

def main():
    t0 = time.time()
    tr = pd.read_csv(DATA / "train.csv"); te = pd.read_csv(DATA / "test.csv")
    y = tr[TARGET].to_numpy()
    folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(tr, y))
    metric = lambda yt, p: roc_auc_score(yt, p)
    proba = lambda m, X: m.predict_proba(X)[:, 1]
    factory = lambda: lgb.LGBMClassifier(n_estimators=600, learning_rate=0.05, num_leaves=63,
                                         colsample_bytree=0.8, subsample=0.8, subsample_freq=1,
                                         random_state=SEED, verbose=-1)
    use = list(RAW)
    oof, tep, base = H.run_cv(feature_fn, tr, te, y, folds, use, factory, False, proba, metric)
    print(f"base(raw12) OOF {metric(y, oof):.5f}  折 {np.round(base,5)}")
    best_oof, best_te = oof, tep
    # 一次一組:同折配對 t>2 才保留(§5.1)
    for name, feats in BLOCKS.items():
        t = time.time()
        o2, t2, sc = H.run_cv(feature_fn, tr, te, y, folds, use + feats, factory, False, proba, metric)
        tval = H.paired_t(sc, base)
        keep = tval > 2.0
        print(f"{name:18s} OOF {metric(y, o2):.5f}  配對t {tval:+.2f}  {'✅留' if keep else '✗棄'}  {time.time()-t:.0f}s")
        if keep:
            use += feats; base = sc; best_oof, best_te = o2, t2
    kept = [u for u in use if u not in RAW]
    print(f"保留特徵組 {kept if kept else '無(裸基線已飽和)'}  最終單模 OOF {metric(y, best_oof):.5f}")

    # 集成:新 lgbm + 既存 extratrees(raw)OOF(§6.1;成員懸殊時預期無紅利,照做以記錄)
    z = np.load(DATA / "oofs.npz")
    oofs = {"lgbm_s3": best_oof, "extratrees": z["oof_extratrees"]}
    tests = {"lgbm_s3": best_te, "extratrees": z["test_extratrees"]}
    counts, order = H.caruana(oofs, y, lambda p: metric(y, p), n_iter=30)
    ens_oof, ens_te = H.blend(oofs, counts), H.blend(tests, counts)
    print(f"集成計數 {counts}  集成 OOF {metric(y, ens_oof):.5f}")

    H.write_submission(str(Path(__file__).parent / "submission_s6e8_single2.csv"), te[ID].to_numpy(), ID, best_te, TARGET)
    H.write_submission(str(Path(__file__).parent / "submission_s6e8_ensemble2.csv"), te[ID].to_numpy(), ID, ens_te, TARGET)
    print(f"✅ 完成,共 {(time.time()-t0)/60:.1f} 分")

if __name__ == "__main__":
    main()
