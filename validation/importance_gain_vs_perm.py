"""L2 驗證框架主張:GBDT 的 gain importance 會系統性高估高基數特徵;permutation importance 才反映真實貢獻(§5.3)。
機制:高基數特徵(如隨機 ID)提供大量分裂點,樹能靠它「背」訓練資料 → gain 被灌高,但對 holdout 沒貢獻。
  permutation importance 在 holdout 上打亂該欄看分數掉多少,純噪音欄應接近 0。
做法:資料 = 5 個真訊號欄 + 1 個高基數純噪音欄(hcid,幾千個唯一值)+ 1 個低基數純噪音欄。
  比 hcid 在 gain 與 permutation 兩種排名下的位置。8 seeds。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.inspection import permutation_importance
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

def make(seed):
    rng = np.random.default_rng(seed)
    n = 5000
    Xs = rng.normal(size=(n, 5))
    y = ((Xs @ rng.normal(size=5)) * 0.9 + rng.logistic(size=n) > 0).astype(int)
    df = pd.DataFrame(Xs, columns=[f'sig{i}' for i in range(5)])
    df['hcid'] = rng.integers(0, n // 2, n).astype(float)   # 高基數純噪音(~2500 唯一值)
    df['lcid'] = rng.integers(0, 5, n).astype(float)        # 低基數純噪音
    return df, y

def rank_of(series, col):
    """col 在(由高到低)重要度排名的名次(1 = 最高)。"""
    return int(series.rank(ascending=False)[col])

CONFIGS = {
    '正則化(num_leaves=31, min_child=20)': dict(num_leaves=31, min_child_samples=20),
    '不正則化(num_leaves=255, min_child=1)': dict(num_leaves=255, min_child_samples=1),
}
nfeat = 7
print(f"高基數純噪音欄 hcid 的重要度排名(共 {nfeat} 欄,1=最高;8 seeds)\n")
res = {}
for cfg_name, cfg in CONFIGS.items():
    g_rank, p_rank, g_share, p_val = [], [], [], []
    for seed in range(8):
        df, y = make(seed)
        tr, ho, ytr, yho = train_test_split(df, y, test_size=0.3, random_state=seed, stratify=y)
        m = lgb.LGBMClassifier(n_estimators=300, verbose=-1, random_state=seed,
                               importance_type='gain', **cfg).fit(tr, ytr)
        gain = pd.Series(m.feature_importances_, index=df.columns)
        perm = pd.Series(permutation_importance(m, ho, yho, scoring='roc_auc', n_repeats=5,
                                                random_state=seed).importances_mean, index=df.columns)
        g_rank.append(rank_of(gain, 'hcid')); p_rank.append(rank_of(perm, 'hcid'))
        g_share.append(gain['hcid'] / gain.sum()); p_val.append(perm['hcid'])
    res[cfg_name] = (np.mean(g_rank), np.mean(g_share), np.mean(p_rank), np.mean(p_val))
    print(f"  {cfg_name}")
    print(f"    gain        :hcid 平均排名 {np.mean(g_rank):.1f}/{nfeat}(佔總 gain {np.mean(g_share):.0%})")
    print(f"    permutation :hcid 平均排名 {np.mean(p_rank):.1f}/{nfeat}(perm 值 {np.mean(p_val):+.5f} ≈ 0)")

reg, deep = res['正則化(num_leaves=31, min_child=20)'], res['不正則化(num_leaves=255, min_child=1)']
# 判準:不正則化時 gain 明顯把噪音排更前(share 更高);permutation 兩種都把它壓在後段(值≈0)
ok = deep[1] > reg[1] * 1.5 and deep[2] >= 5 and abs(deep[3]) < 0.005 and abs(reg[3]) < 0.005
print(f"\n→ 修訂主張(§5.3):gain 對高基數的高估**視正則化而定**——不正則化時 gain share {deep[1]:.0%} >> 正則化 {reg[1]:.0%};"
      f"permutation 兩種都穩(值≈0):{'✅ 證實' if ok else '❌'}")
print("  指引:正則化的 LightGBM 對 gain 高估已相當穩健;深/不正則化的樹才明顯。無論如何,特徵篩選用 permutation / null importance 最保險。")
