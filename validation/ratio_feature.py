"""L2 驗證框架主張:GBDT 學不好比值/除法,手動給 x/z 當特徵會有幫助(§5.2F)。
機制:訊號是 x/z(高度非線性、非軸對齊),樹只能用一連串軸對齊分裂近似,效率差;線性模型更是完全算不出除法。
  手動加一欄 x/z,把「模型自己難學的形狀」直接餵進去。
做法:合成資料,y 由 x/z 決定;比 base(x,z,noise)vs base+ratio(加 x/z)的 holdout AUC,對 lgbm 與 logreg 各測。8 seeds。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

def make(seed):
    rng = np.random.default_rng(seed)
    n = 6000
    x = rng.uniform(1, 10, n)
    z = rng.uniform(1, 10, n)
    noise = rng.normal(size=(n, 4))
    ratio = x / z                                     # 真訊號 = 比值
    y = ((ratio - 1.0) * 2.0 + noise[:, 0] * 0.3 + rng.logistic(size=n) > 0).astype(int)
    base = np.column_stack([x, z, noise])
    return base, ratio.reshape(-1, 1), y

MODELS = {'lgbm': (lambda: lgb.LGBMClassifier(n_estimators=300, num_leaves=31, verbose=-1, random_state=0), False),
          'logreg': (lambda: LogisticRegression(max_iter=2000), True)}

def auc(model, Xtr, ytr, Xho, yho, scale):
    if scale:
        sc = StandardScaler().fit(Xtr); Xtr, Xho = sc.transform(Xtr), sc.transform(Xho)
    return roc_auc_score(yho, model().fit(Xtr, ytr).predict_proba(Xho)[:, 1])

print("訊號 = x/z(比值):base(x,z,noise) vs base+手動比值(x/z) 的 holdout AUC(8 seeds)")
gains = {}
for name, (mk, scale) in MODELS.items():
    dB, dR = [], []
    for seed in range(8):
        base, ratio, y = make(seed)
        tr, ho = train_test_split(np.arange(len(y)), test_size=0.3, random_state=seed, stratify=y)
        dB.append(auc(mk, base[tr], y[tr], base[ho], y[ho], scale))
        Xr = np.hstack([base, ratio])
        dR.append(auc(mk, Xr[tr], y[tr], Xr[ho], y[ho], scale))
    b, r = np.mean(dB), np.mean(dR); gains[name] = r - b
    print(f"  {name:7s} base {b:.4f} → +手動比值 {r:.4f}(Δ {r-b:+.4f})")

# 判準:兩模型加比值都提升,且線性(完全算不出除法)提升 >> 樹(能部分近似)
ok = gains['lgbm'] > 0.002 and gains['logreg'] > gains['lgbm']
print(f"\n增益:樹(lgbm){gains['lgbm']:+.4f} vs 線性(logreg){gains['logreg']:+.4f}")
print(f"→ 主張(§5.2F):比值是軸對齊樹難完全自學的形狀,手動給 x/z 有幫助(線性尤其明顯):{'✅ 證實' if ok else '❌'}")
