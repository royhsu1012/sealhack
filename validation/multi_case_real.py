"""多案例驗證(真實公開資料,非合成):同一套 harness 方法論跑三種任務型別,各留 25% holdout。
目的:回答「不同案例在同一套分析框架是否都能完成」——在 Kaggle 競賽規則解鎖前,用 sklearn 內建
真實資料(breast_cancer 二分類 / diabetes 迴歸 / digits 多分類 10 類)做端到端驗證。
這不是 Kaggle 真提交的替代(無真實私榜),而是「方法論可完成 + CV 對 holdout 誠實」的補充證據。
用法:python multi_case_real.py"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from sklearn.datasets import load_breast_cancer, load_diabetes, load_digits
from sklearn.model_selection import StratifiedKFold, KFold, train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score, mean_squared_error, log_loss
from sklearn.linear_model import LogisticRegression, Ridge
import lightgbm as lgb
import harness as H

def feats(cols):
    return lambda d, ref, use: d[list(cols)].values.astype(float)   # 乾淨資料:直接用全部數值欄

def cv_all_oof(oof, y, kind, K=None):
    """全體 OOF 分數(§3.3:比 fold 平均可靠)"""
    if kind == 'bin':  th = H.best_threshold(y, oof); return accuracy_score(y, oof > th), roc_auc_score(y, oof)
    if kind == 'reg':  return mean_squared_error(y, oof) ** 0.5,
    return accuracy_score(y, oof.argmax(1)), log_loss(y, oof, labels=list(range(K)))

def run_case(name, X, y, kind):
    df = pd.DataFrame(X, columns=[f"f{i}" for i in range(X.shape[1])]); cols = list(df.columns)
    strat = y if kind != 'reg' else None
    tr, ho, ytr, yho = train_test_split(df, y, test_size=0.25, random_state=42, stratify=strat)
    tr, ho = tr.reset_index(drop=True), ho.reset_index(drop=True)
    if kind == 'reg': folds = list(KFold(5, shuffle=True, random_state=42).split(tr))
    else:             folds = list(StratifiedKFold(5, shuffle=True, random_state=42).split(tr, ytr))
    ff = feats(cols)
    if kind == 'bin':
        predict = lambda m, Xx: m.predict_proba(Xx)[:, 1]; metric = roc_auc_score
        models = {'lgbm': (lambda: lgb.LGBMClassifier(n_estimators=200, num_leaves=15, verbose=-1, random_state=42), False),
                  'logreg': (lambda: LogisticRegression(max_iter=2000), True)}
    elif kind == 'reg':
        predict = lambda m, Xx: m.predict(Xx); metric = lambda a, b: -mean_squared_error(a, b) ** 0.5
        models = {'lgbm': (lambda: lgb.LGBMRegressor(n_estimators=300, num_leaves=15, verbose=-1, random_state=42), False),
                  'ridge': (lambda: Ridge(alpha=1.0), True)}
    else:
        K = len(set(y)); predict = lambda m, Xx: m.predict_proba(Xx); metric = lambda a, b: -log_loss(a, b, labels=list(range(K)))
        models = {'lgbm': (lambda: lgb.LGBMClassifier(n_estimators=200, num_leaves=31, verbose=-1, random_state=42), False),
                  'logreg': (lambda: LogisticRegression(max_iter=2000), True)}
    oofs, hos = {}, {}
    for nm, (mk, sc) in models.items():
        oofs[nm], hos[nm], _ = H.run_cv(ff, tr, ho, ytr, folds, [], mk, sc, predict, metric)
    counts, order = H.caruana(oofs, ytr, lambda p: metric(ytr, p))
    best = order[0]; K = len(set(y)) if kind == 'mc' else None

    # holdout 揭曉(單模 vs 集成)
    def score_ho(p):
        if kind == 'bin': th = H.best_threshold(ytr, oofs[best]); return accuracy_score(yho, p > th)
        if kind == 'reg': return mean_squared_error(yho, p) ** 0.5
        return accuracy_score(yho, p.argmax(1))
    cv_best = cv_all_oof(oofs[best], ytr, kind, K)
    cv_ens = cv_all_oof(H.blend(oofs, counts), ytr, kind, K)
    metric_name = {'bin': 'Acc', 'reg': 'RMSE', 'mc': 'Acc'}[kind]
    lo = lambda t: t[0]
    print(f"\n【{name}】{ {'bin':'二分類','reg':'迴歸','mc':'多分類'}[kind] }  n_train={len(tr)} n_holdout={len(ho)} 特徵={X.shape[1]}")
    print(f"  單模 {best:7s} CV {metric_name} {lo(cv_best):.4f} → holdout {score_ho(hos[best]):.4f}")
    print(f"  集成 {dict(counts)} CV {metric_name} {lo(cv_ens):.4f} → holdout {score_ho(H.blend(hos, counts)):.4f}")
    gap = abs(lo(cv_ens) - score_ho(H.blend(hos, counts)))
    print(f"  → 完成 ✅|CV−holdout 差 {gap:.4f}")
    return True

print("多案例驗證(真實資料,同一套 harness 方法論)")
run_case("breast_cancer", *[(lambda d: (d.data, d.target))(load_breast_cancer())][0], 'bin')
run_case("diabetes", *[(lambda d: (d.data, d.target))(load_diabetes())][0], 'reg')
run_case("digits", *[(lambda d: (d.data, d.target))(load_digits())][0], 'mc')
print("\n→ 三種任務型別(二分類/迴歸/多分類)在同一套框架下皆端到端完成;CV 對 holdout 的差距見各案。")
print("  (Kaggle 真提交待競賽規則解鎖;此處以 holdout 代真實 test,無 public/private LB。)")
