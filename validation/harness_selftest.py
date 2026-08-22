"""harness.py 的自我測試:證明同一套管線(run_cv / greedy_select / caruana / blend)
在二分類與迴歸兩種任務上都能跑,不只 Titanic。約定:metric_fn 一律「越高越好」
(二分類用 roc_auc;迴歸用 -RMSE),greedy_select / caruana 就不必分任務。
這也是 harness 的回歸測試——之後重構 harness 若破壞任一路徑,這裡會紅。
用法:python harness_selftest.py"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.metrics import roc_auc_score, mean_squared_error, log_loss, accuracy_score
from sklearn.linear_model import Ridge, LogisticRegression
import lightgbm as lgb
import harness as H

def make_feats(cols):
    def fn(d, ref, use):                       # ref 未用(合成資料無需 fold 內統計);簽名與 harness 一致
        keep = list(cols) + [c for c in use]
        return d[keep].values.astype(float)
    return fn

rng = np.random.default_rng(0)
N, NT = 3000, 1000
base_cols = ['x0', 'x1', 'x2']; blocks = ['x3', 'x4', 'noise']
Xall = pd.DataFrame(rng.normal(size=(N + NT, 6)), columns=['x0', 'x1', 'x2', 'x3', 'x4', 'noise'])
Xall['noise'] = rng.normal(size=N + NT)        # 純噪音,應被 greedy_select 砍掉

# ---- 任務 1:二分類(proba + AUC)----
sig = Xall.x0 * 1.2 + Xall.x1 * Xall.x2 * 0.6 + Xall.x3 * 0.5
yb = (sig + rng.logistic(size=N + NT) > 0).astype(int).values
trb, teb = Xall.iloc[:N].reset_index(drop=True), Xall.iloc[N:].reset_index(drop=True)
foldsb = list(StratifiedKFold(5, shuffle=True, random_state=42).split(trb, yb[:N]))
ff = make_feats(base_cols)
proba = lambda m, X: m.predict_proba(X)[:, 1]
lgbm_c = lambda: lgb.LGBMClassifier(n_estimators=150, num_leaves=31, verbose=-1, random_state=42)
useb, logb = H.greedy_select(ff, trb, teb, yb[:N], foldsb, blocks, lgbm_c, False, proba, roc_auc_score)
oofs = {}
for nm, mk, sc in [('lgbm', lgbm_c, False), ('logreg', lambda: LogisticRegression(max_iter=500), True)]:
    oofs[nm], _, _ = H.run_cv(ff, trb, teb, yb[:N], foldsb, useb, mk, sc, proba, roc_auc_score)
counts, order = H.caruana(oofs, yb[:N], lambda p: roc_auc_score(yb[:N], p))
auc_ens = roc_auc_score(yb[:N], H.blend(oofs, counts))
# 判準只驗管線(形狀/範圍/集成不弱於最佳單模);「noise 是否被砍」是統計性的,
# 單次 5 折的配對 t 本會讓噪音偶爾過關(§16.3 / Nadeau–Bengio),不當通過條件。
best_single = max(roc_auc_score(yb[:N], oofs[n]) for n in oofs)
bin_ok = len(oofs['lgbm']) == N and 0.5 < auc_ens <= 1.0 and auc_ens >= best_single - 1e-6
print(f"二分類:選到特徵 {useb}|集成 OOF-AUC {auc_ens:.4f} ≥ 最佳單模 {best_single:.4f}|{'✅' if bin_ok else '❌'}")

# ---- 任務 2:迴歸(predict + -RMSE,無閾值)----
yr = (Xall.x0 * 2.0 + Xall.x1 ** 2 * 0.8 - Xall.x4 * 1.3 + rng.normal(scale=0.5, size=N + NT)).values
trr, ter = Xall.iloc[:N].reset_index(drop=True), Xall.iloc[N:].reset_index(drop=True)
foldsr = list(KFold(5, shuffle=True, random_state=42).split(trr))
value = lambda m, X: m.predict(X)
neg_rmse = lambda y, p: -mean_squared_error(y, p) ** 0.5     # 越高越好
lgbm_r = lambda: lgb.LGBMRegressor(n_estimators=200, num_leaves=31, verbose=-1, random_state=42)
user, logr = H.greedy_select(ff, trr, ter, yr[:N], foldsr, blocks, lgbm_r, False, value, neg_rmse)
oofr = {}
for nm, mk, sc in [('lgbm', lgbm_r, False), ('ridge', lambda: Ridge(alpha=1.0), True)]:
    oofr[nm], _, _ = H.run_cv(ff, trr, ter, yr[:N], foldsr, user, mk, sc, value, neg_rmse)
counts_r, _ = H.caruana(oofr, yr[:N], lambda p: neg_rmse(yr[:N], p))
rmse_ens = -neg_rmse(yr[:N], H.blend(oofr, counts_r))
std_y = yr[:N].std()
reg_ok = rmse_ens < std_y and len(oofr['lgbm']) == N     # 模型有學到東西(RMSE 遠小於只猜均值的 y std)
print(f"迴歸:  選到特徵 {user}|集成 OOF-RMSE {rmse_ens:.4f}(遠小於 y std {std_y:.4f})|{'✅' if reg_ok else '❌'}")

# ---- 任務 3:多分類(proba 矩陣 (n,k) + -logloss)----
K = 4
logits = np.stack([Xall.x0 * 1.1, Xall.x1 * 1.0, Xall.x2 * 0.9, Xall.x3 * 0.8], axis=1) + rng.gumbel(size=(N + NT, K))
ym = logits.argmax(1)
trm, tem = Xall.iloc[:N].reset_index(drop=True), Xall.iloc[N:].reset_index(drop=True)
foldsm = list(StratifiedKFold(5, shuffle=True, random_state=42).split(trm, ym[:N]))
proba_m = lambda m, X: m.predict_proba(X)          # (n, K)
neg_ll = lambda y, p: -log_loss(y, p, labels=list(range(K)))   # 越高越好
lgbm_m = lambda: lgb.LGBMClassifier(n_estimators=150, num_leaves=31, verbose=-1, random_state=42)
usem, _ = H.greedy_select(ff, trm, tem, ym[:N], foldsm, blocks, lgbm_m, False, proba_m, neg_ll)
oofm, _, _ = H.run_cv(ff, trm, tem, ym[:N], foldsm, usem, lgbm_m, False, proba_m, neg_ll)
mc_acc = accuracy_score(ym[:N], oofm.argmax(1))
mc_ok = oofm.shape == (N, K) and np.allclose(oofm.sum(1), 1, atol=1e-6) and mc_acc > 1.0 / K
print(f"多分類:OOF 形狀 {oofm.shape}(每列機率和=1={np.allclose(oofm.sum(1),1,atol=1e-6)})|OOF Acc {mc_acc:.4f}(> 亂猜 {1/K:.2f})|{'✅' if mc_ok else '❌'}")

# submission 防呆(迴歸寫原值)
n = H.write_submission(__import__('tempfile').mktemp(suffix='.csv'), ter.index, 'id', np.zeros(NT), 'target')
allok = bin_ok and reg_ok and mc_ok
print(f"\n→ harness 通用性:{'✅ 二分類 + 迴歸 + 多分類三條路徑都通過' if allok else '❌ 有路徑未通過'}(write_submission OK,{n} 列)")
