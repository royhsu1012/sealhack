"""L2 驗證框架主張:Pseudo-Labeling(用最強模型給無標資料打標籤、混回重訓)「資料不多時值得」(§6.3)。
冠軍方案常用的半監督招式;本站原本只有主張 + Lee 2013 引用,沒有實測。這裡驗證兩件事:
  (1) 標籤稀少時,偽標籤能提升 holdout;(2) 標籤充足時,增益消失(所以是「資料不多時」才值得)。
做法:合成二分類,切成 labeled(小)/ unlabeled pool / holdout。base = 只用 labeled;
  pseudo = 教師模型對 pool 打硬標籤、只留高信心樣本混回重訓。兩種 labeled 量 × 8 seeds。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from sklearn.datasets import make_classification
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

def lgbm(seed=0):
    return lgb.LGBMClassifier(n_estimators=200, num_leaves=15, learning_rate=0.05, verbose=-1, random_state=seed)

def run(n_lab, seed, conf=0.30):
    X, y = make_classification(n_samples=12000, n_features=20, n_informative=8, n_redundant=4,
                               flip_y=0.08, class_sep=0.8, random_state=seed)
    rng = np.random.default_rng(seed); idx = rng.permutation(len(y))
    lab, pool, ho = idx[:n_lab], idx[n_lab:n_lab + 5000], idx[n_lab + 5000:n_lab + 8000]
    # base:只用 labeled
    m0 = lgbm(seed).fit(X[lab], y[lab])
    auc_base = roc_auc_score(y[ho], m0.predict_proba(X[ho])[:, 1])
    # pseudo:教師對 pool 打標籤,只留高信心(|p-0.5|>conf),混回重訓
    p_pool = m0.predict_proba(X[pool])[:, 1]
    keep = np.abs(p_pool - 0.5) > conf
    Xp = np.vstack([X[lab], X[pool][keep]])
    yp = np.concatenate([y[lab], (p_pool[keep] > 0.5).astype(int)])
    m1 = lgbm(seed).fit(Xp, yp)
    auc_pseudo = roc_auc_score(y[ho], m1.predict_proba(X[ho])[:, 1])
    return auc_base, auc_pseudo, keep.mean()

print("Pseudo-Labeling:base(只用 labeled) vs pseudo(加高信心偽標籤)holdout AUC,8 seeds")
gains = {}
for n_lab, tag in [(300, '標籤稀少 n=300'), (3000, '標籤充足 n=3000')]:
    dB, dP, kept = [], [], []
    for seed in range(8):
        b, p, k = run(n_lab, seed); dB.append(b); dP.append(p); kept.append(k)
    b, p = np.mean(dB), np.mean(dP); gains[n_lab] = p - b
    wins = int(sum(pp > bb for pp, bb in zip(dP, dB)))
    print(f"  {tag:16s} base {b:.4f} → pseudo {p:.4f}(Δ {p-b:+.4f}|pseudo 勝 {wins}/8|採用 pool {np.mean(kept):.0%})")

ok = gains[300] > 0.002 and gains[300] > gains[3000]
print(f"\n→ 主張(§6.3):偽標籤「資料不多時值得」——稀少 {gains[300]:+.4f} >> 充足 {gains[3000]:+.4f}:{'✅ 證實' if ok else '❌'}")
print("  指引:標籤稀少時用高信心偽標籤補資料;標籤已充足時增益消失,別多此一舉。k-fold 記得產 k 套偽標籤防洩漏。")
