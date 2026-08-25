"""L2 驗證框架主張:AUC 指標下,集成時「rank 平均」是否真的優於「機率平均」(§6.1、§4 指標戰術)。
機制:不同家族的機率尺度/分布不同(knn 粗糙、logreg 平滑、lgbm 另一種),直接平均會被尺度大的主導;
先各自轉成 rank(除以 n)再平均,等於只用「排序」資訊——AUC 只在乎排序,理應更穩。
做法:合成二分類 + 真實 breast_cancer,各 10 seeds,比 holdout AUC(rank 平均 − 機率平均)的配對分布。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from scipy.stats import rankdata
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.datasets import load_breast_cancer, make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

def holdout_preds(Xtr, ytr, Xho, seed):
    """訓練多個家族,回傳各自對 holdout 的機率(尺度/分布刻意不同)。"""
    sc = StandardScaler().fit(Xtr)
    models = {
        'lgbm':   (lgb.LGBMClassifier(n_estimators=200, num_leaves=15, verbose=-1, random_state=seed), False),
        'logreg': (LogisticRegression(max_iter=2000), True),
        'knn':    (KNeighborsClassifier(15), True),
        'et':     (ExtraTreesClassifier(200, random_state=seed, n_jobs=1), False),
    }
    out = {}
    for nm, (m, scale) in models.items():
        Xa, Xh = (sc.transform(Xtr), sc.transform(Xho)) if scale else (Xtr, Xho)
        out[nm] = m.fit(Xa, ytr).predict_proba(Xh)[:, 1]
    return out

def compare(Xall, yall, name, n_seeds=10):
    diffs = []
    for seed in range(n_seeds):
        Xtr, Xho, ytr, yho = train_test_split(Xall, yall, test_size=0.3, random_state=seed, stratify=yall)
        preds = holdout_preds(Xtr, ytr, Xho, seed)
        prob_ens = np.mean([p for p in preds.values()], axis=0)                      # 直接平均機率
        rank_ens = np.mean([rankdata(p) / len(p) for p in preds.values()], axis=0)   # 先轉 rank 再平均
        diffs.append(roc_auc_score(yho, rank_ens) - roc_auc_score(yho, prob_ens))
    d = np.array(diffs)
    wins = int((d > 0).sum()); ties = int((d == 0).sum())
    t = d.mean() / (d.std(ddof=1) / np.sqrt(len(d))) if d.std(ddof=1) > 0 else float('inf')
    print(f"  {name:16s} rank−prob AUC: 均值 {d.mean():+.5f} ± {d.std(ddof=1):.5f} | rank 勝 {wins}/{n_seeds}(平 {ties})| 配對 t {t:+.2f}")
    return d

def compare_mismatched(Xall, yall, name, n_seeds=10):
    """成員尺度差異大時(人為把一個成員的分數放大 ×50 模擬未校準/未正規化的輸出)。"""
    diffs = []
    for seed in range(n_seeds):
        Xtr, Xho, ytr, yho = train_test_split(Xall, yall, test_size=0.3, random_state=seed, stratify=yall)
        preds = holdout_preds(Xtr, ytr, Xho, seed)
        preds['knn'] = preds['knn'] * 50.0        # 一個成員尺度大得多 → 直接平均會被它主導
        prob_ens = np.mean([p for p in preds.values()], axis=0)
        rank_ens = np.mean([rankdata(p) / len(p) for p in preds.values()], axis=0)
        diffs.append(roc_auc_score(yho, rank_ens) - roc_auc_score(yho, prob_ens))
    d = np.array(diffs); t = d.mean() / (d.std(ddof=1) / np.sqrt(len(d)))
    print(f"  {name:16s} rank−prob AUC: 均值 {d.mean():+.5f} ± {d.std(ddof=1):.5f} | rank 勝 {int((d>0).sum())}/{n_seeds} | 配對 t {t:+.2f}")
    return d

print("情境 A|成員同為 [0,1] 機率、尺度相近(rank 平均 vs 機率平均,10 seeds)")
Xs, ys = make_classification(n_samples=4000, n_features=20, n_informative=8, n_redundant=4,
                             flip_y=0.08, class_sep=0.8, random_state=0)
ds = compare(Xs, ys, "合成二分類")
bc = load_breast_cancer(); db = compare(bc.data, bc.target, "breast_cancer")
alld = np.concatenate([ds, db])

print("\n情境 B|成員尺度差異大(一個成員 ×50,模擬未正規化輸出)")
dm = compare_mismatched(Xs, ys, "合成二分類")

print(f"\n情境 A(尺度相近)合併 20 seeds:rank 勝 {(alld>0).sum()}/20、均值 {alld.mean():+.5f}")
print(f"情境 B(尺度差異大):rank 勝 {int((dm>0).sum())}/10、均值 {dm.mean():+.5f}")
verdict = alld.mean() <= 0 and dm.mean() > abs(alld.mean())
print(f"→ 修訂主張「rank 平均只在成員尺度差異大時有益,同尺度機率下沒有優勢(甚至略差)」:"
      f"{'✅ 證實' if verdict else '❌'}")
