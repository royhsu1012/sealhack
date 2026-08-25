"""L2 驗證核心診斷工具:Adversarial Validation(§1.3)是否真能(a)偵測 train/test 分布漂移、
(b)用 feature importance 指出漂移來源、(c)丟掉該特徵能改善對「未來 test」的泛化。
做法:造兩種資料——無漂移(train/test 同分布)、有漂移(一個時間戳/ID 特徵在 test 上分布不同)。
  訓練 adversarial 分類器(train 標 0、test 標 1)看 AUC 與重要度;再比丟棄前後對 test 的真實 AUC。8 seeds。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from sklearn.model_selection import cross_val_predict, StratifiedKFold
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

FEATS = [f'f{i}' for i in range(8)] + ['stamp']   # f0..f7 是真訊號,stamp 是時間戳/ID

def make(seed, shift):
    """shift=True:test 的 stamp 分布往後移(模擬時間戳),且 y 對 stamp 有微弱依賴(漂移的來源)。"""
    rng = np.random.default_rng(seed)
    def block(n, t0):
        X = rng.normal(size=(n, 8))
        stamp = rng.uniform(t0, t0 + 1, n) if shift else rng.uniform(0, 1, n)
        y = ((X @ W) * 0.9 + (stamp * 0.4 if shift else 0) + rng.logistic(size=n) > 0).astype(int)
        df = pd.DataFrame(X, columns=[f'f{i}' for i in range(8)]); df['stamp'] = stamp
        return df, y
    tr, ytr = block(3000, 0.0)
    te, yte = block(1500, 1.0)      # shift 時 test 的 stamp∈[1,2],train∈[0,1] → 明顯漂移
    return tr, ytr, te, yte

W = np.random.default_rng(42).normal(size=8)   # 全程共用的真權重

def lgbm(): return lgb.LGBMClassifier(n_estimators=200, num_leaves=31, verbose=-1, random_state=42)

def adversarial(tr, te):
    X = pd.concat([tr, te], ignore_index=True)
    y = np.r_[np.zeros(len(tr)), np.ones(len(te))]
    cv = StratifiedKFold(5, shuffle=True, random_state=42)
    oof = cross_val_predict(lgbm(), X, y, cv=cv, method='predict_proba')[:, 1]
    m = lgbm().fit(X, y)
    imp = pd.Series(m.feature_importances_, index=X.columns)
    return roc_auc_score(y, oof), imp.idxmax()

for shift, label in [(False, '無漂移'), (True, '有漂移(stamp 在 test 往後移)')]:
    advs, tops, gain = [], [], []
    for seed in range(8):
        tr, ytr, te, yte = make(seed, shift)
        adv, top = adversarial(tr, te); advs.append(adv); tops.append(top)
        # 丟棄 vs 保留 stamp:對真實 test 的 AUC
        with_ = roc_auc_score(yte, lgbm().fit(tr, ytr).predict_proba(te)[:, 1])
        drop = roc_auc_score(yte, lgbm().fit(tr.drop(columns='stamp'), ytr).predict_proba(te.drop(columns='stamp'))[:, 1])
        gain.append(drop - with_)
    top_is_stamp = sum(t == 'stamp' for t in tops)
    print(f"{label}:adversarial AUC {np.mean(advs):.3f} | 最高重要度 = stamp 的次數 {top_is_stamp}/8"
          f" | 丟 stamp 對 test AUC 的改變 {np.mean(gain):+.4f}")

print("\n→ 主張(§1.3):AUC≈0.5 表同分布、AUC 高表漂移且最高重要度即漂移源;漂移下丟棄該特徵改善泛化。")
print("  判準:無漂移 AUC 接近 0.5、有漂移 AUC 明顯更高且 stamp 被抓為 top、丟棄後 test AUC 不降(多半上升)。")
