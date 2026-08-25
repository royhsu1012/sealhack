"""案例:Playground S6E8「Predicting Smartphone Addiction」— 方法論 L3 多案例掃描 #2(首個進行中比賽,真私榜)。

階段 0|五問診斷(2026-08-25,依公開頁面;賽期 2026-08-01 ~ 08-31 23:59 UTC):
  模態=表格(synthetic,源自 Smartphone Addiction Prediction Dataset;29 欄、train+test 71MB、test id 自 691369 起 → train ≈ 69 萬列)
  任務=二分類(輸出 addicted_label 機率)
  指標=ROC-AUC → 平滑指標:直接用機率、無閾值搜尋;rank vs prob 平均見 C11(成員同尺度時 prob 平均即可)
  test 切法=隨機(playground 慣例;仍以 adversarial validation 實測確認)
  賽制=prediction(非 code 賽)→ 軌道 T1
  小樣本?否(n≈69 萬 ≫ 3000)→ 集成有紅利、單次 5-fold 分數可信(不需 20 次切分)
用法:先 `kaggle competitions download -c playground-series-s6e8 -p data/s6e8 --unzip`(需先在網站 Join),
再 `python case_s6e8.py`。產出 submission_s6e8_single.csv / submission_s6e8_ensemble.csv(雙提交,§7)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import ExtraTreesClassifier
import lightgbm as lgb
import harness as H

SEED = 42
DATA = Path(__file__).parent / "data" / "s6e8"
TARGET, ID = "addicted_label", "id"

def load():
    tr = pd.read_csv(DATA / "train.csv")
    te = pd.read_csv(DATA / "test.csv")
    return tr, te

def feature_fn(d, ref, use):
    """基線特徵:數值原樣(LGBM 原生吃 NaN);類別欄以 ref 的類別集合做 codes(fold 內統計,C2/C10 紀律)。"""
    out = {}
    for c in use:
        if not pd.api.types.is_numeric_dtype(d[c]):  # pandas 3.0:字串欄是 str dtype,非 object
            cats = pd.Categorical(ref[c]).categories
            out[c] = pd.Categorical(d[c], categories=cats).codes.astype(float)
        else:
            out[c] = d[c].to_numpy(dtype=float)
    return np.column_stack([out[c] for c in use])

def main():
    t0 = time.time()
    tr, te = load()
    y = tr[TARGET].to_numpy()
    use = [c for c in tr.columns if c not in (TARGET, ID)]
    print(f"train {tr.shape}  test {te.shape}  欄位 {len(use)}  正例率 {y.mean():.4f}")

    # 階段 1|鎖死 CV:StratifiedKFold(5) 全流程共用(§3.3)
    folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(tr, y))
    metric = lambda yt, p: roc_auc_score(yt, p)
    proba = lambda m, X: m.predict_proba(X)[:, 1]

    # 診斷防呆|對抗驗證:train vs test 可分性(§C7b/對抗驗證教條)
    n_s = min(40000, len(tr), len(te))
    Xa = feature_fn(tr.sample(n_s, random_state=SEED), tr, use)
    Xb = feature_fn(te.sample(n_s, random_state=SEED), tr, use)
    Xadv = np.nan_to_num(np.vstack([Xa, Xb]), nan=-999.0)
    yadv = np.r_[np.zeros(n_s), np.ones(n_s)]
    adv = lgb.LGBMClassifier(n_estimators=120, num_leaves=31, random_state=SEED, verbose=-1)
    from sklearn.model_selection import cross_val_score
    adv_auc = cross_val_score(adv, Xadv, yadv, cv=3, scoring="roc_auc").mean()
    print(f"對抗驗證 AUC = {adv_auc:.4f}(≈0.5 同分布可隨機切;>0.8 有漂移要查)")

    # 階段 2|多樣化基線(3 家族;n 大 → KNN 略過)
    models = {
        "lgbm": dict(factory=lambda: lgb.LGBMClassifier(
            n_estimators=600, learning_rate=0.05, num_leaves=63,
            colsample_bytree=0.8, subsample=0.8, subsample_freq=1,
            random_state=SEED, verbose=-1), scale=False),
        "logreg": dict(factory=lambda: LogisticRegression(max_iter=2000, C=1.0), scale=True),
        "extratrees": dict(factory=lambda: ExtraTreesClassifier(
            n_estimators=300, min_samples_leaf=20, n_jobs=-1, random_state=SEED), scale=False),
    }
    oofs, tests, cvs = {}, {}, {}
    for name, m in models.items():
        t = time.time()
        # logreg/ET 不吃 NaN → 以 -999 佔位(樹可分裂出來;線性靠 scale 後仍可用)
        ffn = feature_fn if name == "lgbm" else (lambda d, r, u: np.nan_to_num(feature_fn(d, r, u), nan=-999.0))
        oof, tep, fold = H.run_cv(ffn, tr, te, y, folds, use, m["factory"], m["scale"], proba, metric)
        oofs[name], tests[name] = oof, tep
        cvs[name] = metric(y, oof)
        print(f"{name:10s} OOF AUC {cvs[name]:.5f}  折 {np.round(fold,5)}  {time.time()-t:.0f}s")

    # OOF 落盤(§3.1:整合的原料)
    np.savez_compressed(DATA / "oofs.npz", y=y, **{f"oof_{k}": v for k, v in oofs.items()},
                        **{f"test_{k}": v for k, v in tests.items()})

    # 階段 4|Caruana 爬山集成(§6.1;n 大 → 集成有紅利;harness 合約:oofs=dict、回 counts 整數權重)
    counts, order = H.caruana(oofs, y, lambda p: metric(y, p), n_iter=30)
    ens_oof = H.blend(oofs, counts)
    ens_te = H.blend(tests, counts)
    best = max(cvs, key=cvs.get)
    print(f"集成計數 {counts}(排序 {order})  集成 OOF AUC {metric(y, ens_oof):.5f}  vs 最佳單模 {best} {cvs[best]:.5f}")

    # 階段 5|雙提交(§7):CV 最高單模 + 穩健集成;不追 public LB(§13)
    H.write_submission(str(Path(__file__).parent / "submission_s6e8_single.csv"),
                       te[ID].to_numpy(), ID, tests[best], TARGET)
    H.write_submission(str(Path(__file__).parent / "submission_s6e8_ensemble.csv"),
                       te[ID].to_numpy(), ID, ens_te, TARGET)
    print(f"✅ 兩份提交已產出(single={best} / ensemble)。總耗時 {(time.time()-t0)/60:.1f} 分")
    print("提交:kaggle competitions submit -c playground-series-s6e8 -f submission_s6e8_ensemble.csv -m 'sealhack ensemble'")

if __name__ == "__main__":
    if not (DATA / "train.csv").exists():
        print(f"❌ 找不到 {DATA}/train.csv — 先在網站 Join 後執行:\n"
              f"   kaggle competitions download -c playground-series-s6e8 -p {DATA} --unzip")
        sys.exit(1)
    main()
