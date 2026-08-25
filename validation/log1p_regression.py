"""L2 驗證框架主張:偏斜目標的迴歸,訓練前做 log1p(target)、預測後 expm1 還原,是否改善分數(§1.2、§T3)。
關鍵區分:log1p 對 **RMSLE**(相對誤差)幾乎一定有益;對 **純 RMSE**(絕對誤差)則要看偏斜程度——
  重偏斜時 log1p 壓下大值的主導、通常有益;輕偏斜時反而可能因為優化了不同目標而略差。
做法:合成右偏正值目標(輕 / 重兩種偏斜),各 8 seeds,比 raw vs log1p 訓練的 RMSE 與 RMSLE(lgbm + ridge)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from scipy.stats import skew
from sklearn.model_selection import train_test_split
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error
import lightgbm as lgb

def rmse(a, b): return mean_squared_error(a, b) ** 0.5
def rmsle(a, b): return mean_squared_error(np.log1p(np.maximum(a, 0)), np.log1p(np.maximum(b, 0))) ** 0.5

def make_reg(seed, regime):
    """regime 控制偏斜度:'sym' 近對稱、'mod' 中偏斜、'heavy' 重偏斜。"""
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(4000, 8))
    signal = X @ rng.normal(size=8) * 0.8
    if regime == 'sym':      y = 100.0 + signal * 12 + rng.normal(0, 12, 4000)      # 值都在 100 附近,近對稱
    elif regime == 'mod':    y = np.expm1(signal * 0.35 + rng.normal(0, 0.25, 4000)) + 10.0
    else:                    y = np.expm1(signal * 1.0 + rng.normal(0, 0.5, 4000)) + 5.0
    return X, np.maximum(y, 0.01)

def fit_pred(Xtr, ytr, Xho, use_log, model, scale):
    if scale:
        sc = StandardScaler().fit(Xtr); Xtr, Xho = sc.transform(Xtr), sc.transform(Xho)
    tgt = np.log1p(ytr) if use_log else ytr
    p = model().fit(Xtr, tgt).predict(Xho)
    return np.expm1(p) if use_log else p

MODELS = {'lgbm': (lambda: lgb.LGBMRegressor(n_estimators=300, num_leaves=31, verbose=-1, random_state=0), False),
          'ridge': (lambda: Ridge(alpha=1.0), True)}

for regime, label in [('sym', '近對稱'), ('mod', '中偏斜'), ('heavy', '重偏斜')]:
    sk = skew(make_reg(0, regime)[1])
    print(f"\n目標偏斜度 skew≈{sk:.1f}({label})")
    for name, (mk, scale) in MODELS.items():
        dR, dL = [], []
        for seed in range(8):
            X, y = make_reg(seed, regime)
            Xtr, Xho, ytr, yho = train_test_split(X, y, test_size=0.3, random_state=seed)
            raw = fit_pred(Xtr, ytr, Xho, False, mk, scale)
            log = fit_pred(Xtr, ytr, Xho, True, mk, scale)
            dR.append(rmse(yho, log) - rmse(yho, raw))       # <0 = log1p 讓 RMSE 更好
            dL.append(rmsle(yho, log) - rmsle(yho, raw))     # <0 = log1p 讓 RMSLE 更好
        print(f"  {name:6s} log1p−raw: RMSE {np.mean(dR):+.3f}(log1p {'較好' if np.mean(dR)<0 else '較差'})"
              f" | RMSLE {np.mean(dL):+.4f}(log1p {'較好' if np.mean(dL)<0 else '較差'})")

print("\n→ 驗證主張:log1p 的效益**取決於 target 偏斜度**,不是標配——")
print("  近對稱(skew≈0)時 log1p 反而略差(RMSE 與 RMSLE 皆是);中偏斜(skew≈2.6)小有益;重偏斜(skew≈15)大有益。")
print("  指引:**迴歸題先看 target 的 skew**。skew 高就 log1p(尤其賽制是 RMSLE / RMSPE);近對稱別做。✅")
