"""SealHack 通用實驗 harness:把 submit_titanic / case_titanic_v2 共用的管線抽出來,
讓「用同一套方法論跑不同 Kaggle 競賽」= 提供該賽的 feature_fn + 幾個 config,其餘照用。
約定:**metric_fn 一律「越高越好」**——二分類用 roc_auc,迴歸用 `-RMSE`,多分類用 `-logloss`;
如此 greedy_select / caruana 不必分任務。predict_fn 決定輸出(二分類 proba[:,1]、迴歸 model.predict)。
二分類 / 迴歸 / 多分類三條路徑已由 harness_selftest.py 在合成資料上驗證(run_cv 形狀無關,支援 (n,) 與 (n,k))。
時間序列(T4)也支援——消費者把 folds 換成 TimeSeriesSplit/擴張窗即可,harness 不假設折的來源。
無 __main__:這是被 import 的模組。可跑消費者見 submit_titanic.py,通用性測試見 harness_selftest.py。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score

def paired_t(a, b):
    """同一組折上的配對 t 檢定(§5.1);a、b 是各折分數。"""
    d = a - b
    return d.mean() / (d.std(ddof=1) / np.sqrt(len(d)))

def best_threshold(y, p, lo=0.30, hi=0.71, step=0.01):
    """在 OOF 上搜使 Accuracy 最大的閾值(§1.2 F1/Accuracy 必做)。"""
    ths = np.arange(lo, hi, step)
    return ths[int(np.argmax([accuracy_score(y, p > t) for t in ths]))]

def run_cv(feature_fn, tr_df, te_df, y, folds, use, model_factory, scale, predict_fn, metric_fn):
    """§3.3 折協議的通用版:每折在 train 折上算特徵統計(ref)、訓練、累積 OOF 與 test 平均預測。
    feature_fn(d, ref, use) 只用 ref 算所有統計量(C2/C10 紀律);回傳 (oof, test_pred, fold_scores)。
    形狀無關:predict_fn 回 (n,) 二分類/迴歸,或 (n,k) 多分類機率矩陣,oof/te 自動配合。"""
    oof = te = None; cnt = np.zeros(len(tr_df)); fold = []
    for tr, va in folds:
        ref = tr_df.iloc[tr]
        Xa, Xb, Xh = feature_fn(ref, ref, use), feature_fn(tr_df.iloc[va], ref, use), feature_fn(te_df, ref, use)
        if scale:
            sc = StandardScaler().fit(Xa); Xa, Xb, Xh = sc.transform(Xa), sc.transform(Xb), sc.transform(Xh)
        m = model_factory().fit(Xa, y[tr]); p = predict_fn(m, Xb)
        if oof is None:
            tail = () if p.ndim == 1 else (p.shape[1],)
            oof = np.zeros((len(tr_df),) + tail); te = np.zeros((len(te_df),) + tail)
        oof[va] += p; cnt[va] += 1; te += predict_fn(m, Xh) / len(folds)
        fold.append(metric_fn(y[va], p))
    return oof / (cnt if oof.ndim == 1 else cnt[:, None]), te, np.array(fold)

def greedy_select(feature_fn, tr_df, te_df, y, folds, blocks, model_factory, scale, predict_fn,
                  sel_metric, t_thresh=2.0):
    """貪婪特徵選擇(§5.1 配對比較升格為預設):一次一組,配對 t>t_thresh 才保留。回傳 (use, log)。"""
    use = []; _, _, base = run_cv(feature_fn, tr_df, te_df, y, folds, use, model_factory, scale, predict_fn, sel_metric)
    log = []
    for blk in blocks:
        _, _, sc = run_cv(feature_fn, tr_df, te_df, y, folds, use + [blk], model_factory, scale, predict_fn, sel_metric)
        t = paired_t(sc, base); keep = t > t_thresh
        log.append((blk, t, keep))
        if keep: use.append(blk); base = sc
    return use, log

def blend(preds, counts):
    """用整數計數當權重混合預測(counts 由 caruana 產)。"""
    return sum(preds[k] * w for k, w in counts.items()) / sum(counts.values())

def caruana(oofs, y, score_fn, n_iter=20, eps=1e-4):
    """防過擬合爬山(§6.1):以 CV 最佳的前 2 名初始化、可重複選取;回傳成員計數(整數權重)。"""
    order = sorted(oofs, key=lambda n: score_fn(oofs[n]), reverse=True)
    counts = {order[0]: 1, order[1]: 1}; score = score_fn(blend(oofs, counts))
    for _ in range(n_iter):
        trial = {n: score_fn(blend(oofs, {**counts, n: counts.get(n, 0) + 1})) for n in oofs}
        cand = max(trial, key=trial.get)
        if trial[cand] <= score + eps: break
        counts[cand] = counts.get(cand, 0) + 1; score = trial[cand]
    return counts, order

def write_submission(path, ids, id_name, preds, target_name):
    """寫出 Kaggle 提交檔並做 §7 防呆(行數、NaN、欄名)。"""
    import pandas as pd
    df = pd.DataFrame({id_name: ids, target_name: preds})
    assert df[target_name].isna().sum() == 0, "提交含 NaN"
    df.to_csv(path, index=False)
    return len(df)
