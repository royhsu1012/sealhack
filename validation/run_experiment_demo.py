"""§3.3「統一實驗入口」的可跑版:證明 run_experiment 協議真的能落地(OOF 落盤 + experiments.csv)。
文件原版留了 predict / log_experiment 未定義、config 未給,無法執行;這裡補齊並在合成資料上 dogfood 兩個實驗。
用法:python run_experiment_demo.py"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd, csv, tempfile, time
from pathlib import Path
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold
import lightgbm as lgb

# --- config.py 的內容(文件把它抽成獨立檔;這裡就地定義)---
SEED, N_FOLDS = 42, 5
OOF_DIR = Path(tempfile.mkdtemp(prefix="sealhack_oof_"))   # demo 用暫存目錄,不落 repo
EXP_CSV = OOF_DIR / "experiments.csv"
METRIC_FN = roc_auc_score

def predict(model, X):                       # 二分類回機率;迴歸就改成 model.predict(X)
    return model.predict_proba(X)[:, 1]

def log_experiment(exp_id, model_name, cv_mean, cv_std, fold_scores, runtime, notes):
    new = not EXP_CSV.exists()
    with open(EXP_CSV, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new: w.writerow(["exp_id","model","cv_mean","cv_std","fold_scores","runtime_min","notes"])
        w.writerow([exp_id, model_name, f"{cv_mean:.5f}", f"{cv_std:.5f}",
                    "|".join(f"{s:.5f}" for s in fold_scores), f"{runtime:.3f}", notes])

def run_experiment(model_factory, X, y, X_test, folds, exp_id, model_name, notes=""):
    """所有實驗的唯一入口。保證 OOF 落盤 + 記錄寫入。"""
    t0 = time.time()
    oof = np.zeros(len(X)); test_pred = np.zeros(len(X_test)); fold_scores = []
    for f, (tr, va) in enumerate(folds):
        m = model_factory().fit(X.iloc[tr], y[tr])
        oof[va] = predict(m, X.iloc[va])
        test_pred += predict(m, X_test) / len(folds)
        fold_scores.append(METRIC_FN(y[va], oof[va]))
    cv_mean = METRIC_FN(y, oof)              # 全體 OOF 分數(比 fold 平均更可靠)
    cv_std = float(np.std(fold_scores))
    np.save(OOF_DIR / f"train_oof_{model_name}_{exp_id}.npy", oof)
    np.save(OOF_DIR / f"test_preds_{model_name}_{exp_id}.npy", test_pred)
    log_experiment(exp_id, model_name, cv_mean, cv_std, fold_scores, (time.time()-t0)/60, notes)
    print(f"  {exp_id} {model_name}: CV {cv_mean:.5f} (fold std {cv_std:.5f})")
    return oof, test_pred, cv_mean

if __name__ == "__main__":
    rng = np.random.default_rng(SEED)
    n, n_test = 3000, 1000
    Xall = pd.DataFrame(rng.normal(size=(n + n_test, 8)), columns=[f"f{i}" for i in range(8)])
    logit = Xall.f0 * 0.9 + Xall.f1 * Xall.f2 * 0.6 - Xall.f3 * 0.7
    yall = (logit + rng.logistic(size=n + n_test) > 0).astype(int).values
    X, X_test = Xall.iloc[:n].reset_index(drop=True), Xall.iloc[n:].reset_index(drop=True)
    y = yall[:n]
    folds = list(StratifiedKFold(N_FOLDS, shuffle=True, random_state=SEED).split(X, y))

    lgbm = lambda **k: lgb.LGBMClassifier(n_estimators=200, learning_rate=0.05, verbose=-1, random_state=SEED, **k)
    run_experiment(lambda: lgbm(num_leaves=31), X, y, X_test, folds, "v001", "lgbm")
    run_experiment(lambda: lgbm(num_leaves=8, min_child_samples=40), X, y, X_test, folds, "v002", "lgbm_reg")

    files = sorted(p.name for p in OOF_DIR.glob("*.npy"))
    rows = list(csv.DictReader(open(EXP_CSV, encoding="utf-8")))
    oof_ok = len(files) == 4 and all(np.load(OOF_DIR / f).shape[0] in (n, n_test) for f in files)
    log_ok = len(rows) == 2 and {r["exp_id"] for r in rows} == {"v001", "v002"}
    print(f"\nOOF 落盤:{files}")
    print(f"experiments.csv:{[(r['exp_id'], r['model'], r['cv_mean']) for r in rows]}")
    print(f"→ §3.3 協議可執行:{'✅ 證實(4 個 OOF 檔 + 2 筆記錄)' if oof_ok and log_ok else '❌'}(輸出目錄 {OOF_DIR})")
