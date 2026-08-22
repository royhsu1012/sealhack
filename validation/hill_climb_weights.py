"""模板正確性驗證:KAGGLE_FRAMEWORK §6.1 hill_climb() 的 used[] 權重記帳。
Bug:ens 每步把整個集成乘 (1-w),但 used 只縮放「新成員自己」的舊權重,沒縮放其他成員。
後果:讀者拿 used 去加權 test 預測,得到的不是爬山在 OOF 上選出的那個集成。
正解:每步把所有成員權重乘 (1-w)、再給新成員 +w(權重和恆為 1),test 端用同一組權重混合。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from sklearn.metrics import roc_auc_score

rng = np.random.default_rng(0)
n = 4000; y = (rng.random(n) > 0.5).astype(int); sig = y + rng.normal(0, 1.0, n)
oofs = {'A': sig + rng.normal(0, 1.2, n), 'B': sig + rng.normal(0, 1.3, n), 'C': sig + rng.normal(0, 1.4, n)}
test = {k: sig[:1000] + rng.normal(0, 1.2, 1000) for k in oofs}     # 假想 test 預測

def climb_buggy(oofs, y, grid=np.arange(0.05, 1.01, 0.05)):
    names = list(oofs); best = max(names, key=lambda n: roc_auc_score(y, oofs[n]))
    ens = oofs[best].copy(); used = {best: 1.0}; score = roc_auc_score(y, ens)
    for _ in range(200):
        cand, cb = None, score
        for nm in names:
            for w in grid:
                s = roc_auc_score(y, ens * (1 - w) + oofs[nm] * w)
                if s > cb: cb, cand = s, (nm, w)
        if cand is None: break
        nm, w = cand; ens = ens * (1 - w) + oofs[nm] * w
        used[nm] = used.get(nm, 0) * (1 - w) + w; score = cb      # ← 文件原版(錯)
    return ens, used

def climb_fixed(oofs, y, grid=np.arange(0.05, 1.01, 0.05)):
    names = list(oofs); best = max(names, key=lambda n: roc_auc_score(y, oofs[n]))
    ens = oofs[best].copy(); w_ = {best: 1.0}; score = roc_auc_score(y, ens)
    for _ in range(200):
        cand, cb = None, score
        for nm in names:
            for w in grid:
                s = roc_auc_score(y, ens * (1 - w) + oofs[nm] * w)
                if s > cb: cb, cand = s, (nm, w)
        if cand is None: break
        nm, w = cand; ens = ens * (1 - w) + oofs[nm] * w
        for k in w_: w_[k] *= (1 - w)                              # ← 所有成員一起縮 (1-w)
        w_[nm] = w_.get(nm, 0) + w; score = cb
    return ens, w_

def blend(preds, weights):                                        # 用權重混合任一組預測(權重和=1)
    return sum(preds[k] * w for k, w in weights.items())

ens_oof, used = climb_buggy(oofs, y)
ens_oof2, w_ = climb_fixed(oofs, y)
print(f"文件版 used   :{ {k: round(v,3) for k,v in used.items()} }  和={sum(used.values()):.3f}")
print(f"正解 weights  :{ {k: round(v,3) for k,v in w_.items()} }  和={sum(w_.values()):.3f}")

# 重建 OOF 集成:正解權重誤差≈0;文件版即使正規化也對不上
err_fixed = np.abs(blend(oofs, w_) - ens_oof2).max()
err_used = np.abs(blend(oofs, {k: v/sum(used.values()) for k,v in used.items()}) - ens_oof).max()
print(f"用正解 weights 重建 OOF 集成的最大誤差 :{err_fixed:.2e}")
print(f"用文件版 used(正規化)重建的最大誤差   :{err_used:.3f}")

# test 端:正解權重給出爬山真正選的集成;文件版給出另一個東西
auc_fixed = roc_auc_score(y[:1000], blend(test, w_))
auc_used  = roc_auc_score(y[:1000], blend(test, {k: v/sum(used.values()) for k,v in used.items()}))
print(f"test 端 AUC:正解 weights {auc_fixed:.4f} vs 文件版 used {auc_used:.4f}")
ok = err_fixed < 1e-9 and err_used > 0.01
print(f"→ 模板 bug {'✅ 證實(文件版 used 無法重建集成,正解可以)' if ok else '❌ 未證實'};§6.1 應改用正解 weights + blend()")
