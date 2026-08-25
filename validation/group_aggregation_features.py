"""L2 驗證框架主張:群組聚合後,「差值/比值」是否真的比「原始聚合值」更有訊號(§5.2A)。
機制:造一份 x 的絕對值被群組基線混淆、真訊號是「x 相對於所在群組」的資料。
  原始聚合(group_mean/std)給模型的是群組基線;差值(x−group_mean)、比值(x/group_mean)才是去混淆後的訊號。
預期:線性模型(logreg)自己算不出 x−group_mean,差值/比值幫助大;樹模型(lgbm)能在 x 與 group_mean 上分裂近似,幫助較小。
做法:8 seeds,比 base / base+原始聚合 / base+差值比值 三組特徵的 holdout AUC,對 logreg 與 lgbm 各測。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

N, G = 6000, 40
def make_data(seed):
    rng = np.random.default_rng(seed)
    grp = rng.integers(0, G, N)
    base = rng.normal(0, 2.0, G)[grp]                 # 每群的基線位移(混淆源)
    rel = rng.normal(0, 1.0, N)                       # x 相對群組的偏移 = 真訊號
    x = base + rel                                    # 觀測到的 x,絕對值被 base 混淆
    noise = rng.normal(size=(N, 4))                   # 干擾特徵
    y = ((rel * 1.6 + noise[:, 0] * 0.5) + rng.logistic(size=N) > 0).astype(int)
    df = pd.DataFrame({'x': x, 'grp': grp})
    for i in range(4): df[f'n{i}'] = noise[:, i]
    return df, y

def feats(df, ref, kind):
    """ref = 訓練集(群組統計只用 ref 算,避免洩漏);kind: base / raw / diffratio"""
    X = df[['x', 'n0', 'n1', 'n2', 'n3']].copy()
    gm = ref.groupby('grp')['x'].mean(); gs = ref.groupby('grp')['x'].std().fillna(0)
    gmean = df['grp'].map(gm).fillna(ref['x'].mean()); gstd = df['grp'].map(gs).fillna(0)
    if kind == 'raw':
        X['grp_mean'] = gmean; X['grp_std'] = gstd
    elif kind == 'diffratio':
        X['x_sub_mean'] = df['x'] - gmean
        X['x_div_mean'] = df['x'] / (gmean.abs() + 1.0)
    return X.values.astype(float)

def auc(model, df_tr, y_tr, df_ho, y_ho, kind, scale):
    Xa, Xb = feats(df_tr, df_tr, kind), feats(df_ho, df_tr, kind)
    if scale:
        sc = StandardScaler().fit(Xa); Xa, Xb = sc.transform(Xa), sc.transform(Xb)
    p = model().fit(Xa, y_tr).predict_proba(Xb)[:, 1]
    return roc_auc_score(y_ho, p)

MODELS = {'logreg': (lambda: LogisticRegression(max_iter=2000), True),
          'lgbm':   (lambda: lgb.LGBMClassifier(n_estimators=200, num_leaves=15, verbose=-1, random_state=0), False)}

print("群組聚合特徵:原始聚合 vs 差值/比值(holdout AUC,8 seeds)")
rows = {}
for name, (mk, scale) in MODELS.items():
    res = {k: [] for k in ('base', 'raw', 'diffratio')}
    for seed in range(8):
        df, y = make_data(seed)
        tr, ho, ytr, yho = train_test_split(df, y, test_size=0.3, random_state=seed, stratify=y)
        for k in res: res[k].append(auc(mk, tr.reset_index(drop=True), ytr, ho.reset_index(drop=True), yho, k, scale))
    m = {k: np.mean(v) for k, v in res.items()}
    rows[name] = m
    print(f"  {name:7s} base {m['base']:.4f} | +原始聚合 {m['raw']:.4f}(Δ{m['raw']-m['base']:+.4f})"
          f" | +差值比值 {m['diffratio']:.4f}(Δ{m['diffratio']-m['base']:+.4f})"
          f" | 差值比值−原始聚合 {m['diffratio']-m['raw']:+.4f}")

gain_lin = rows['logreg']['diffratio'] - rows['logreg']['raw']
gain_tree = rows['lgbm']['diffratio'] - rows['lgbm']['raw']
print(f"\n差值/比值 相對 原始聚合 的增益:線性 {gain_lin:+.4f} vs 樹 {gain_tree:+.4f}")
ok = gain_lin > 0.01 and gain_lin > gain_tree
print(f"→ 修訂主張「差值/比值 > 原始聚合,對線性模型尤其明顯(樹能自行近似,增益較小)」:{'✅ 證實' if ok else '❌'}")
