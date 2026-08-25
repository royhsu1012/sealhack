"""案例:NLP Disaster Tweets — L3 掃描 #5。診斷:文字二分類、指標 F1(OOF 搜 F1 閾值)、隨機切、n=7613。
簡單模型(裁示):TF-IDF(word 1-2gram)+LogReg 主force;char 3-5gram LogReg 第二家族(多樣性)。
C2 紀律:向量器只在 ref(訓練折)上 fit。不用任何預訓練模型。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import f1_score, roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
import harness as H

SEED = 42
DATA = Path(__file__).parent / "data" / "nlp-getting"

def make_ffn(vec_params):
    def ffn(d, ref, use):
        vec = TfidfVectorizer(**vec_params).fit(ref["text"])
        return vec.transform(d["text"])   # 稀疏矩陣直接給 LogReg(scale=False)
    return ffn

def best_f1_threshold(y, p):
    ths = np.arange(0.2, 0.8, 0.01)
    f1s = [f1_score(y, p > t) for t in ths]
    i = int(np.argmax(f1s)); return ths[i], f1s[i]

def main():
    t0 = time.time()
    tr = pd.read_csv(DATA / "train.csv"); te = pd.read_csv(DATA / "test.csv")
    tr["text"] = tr["text"].fillna(""); te["text"] = te["text"].fillna("")
    y = tr["target"].to_numpy()
    folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(tr, y))
    auc = lambda yt, p: roc_auc_score(yt, p)
    proba = lambda m, X: m.predict_proba(X)[:, 1]
    fams = {
        "word": make_ffn(dict(ngram_range=(1, 2), min_df=2, max_features=60000)),
        "char": make_ffn(dict(analyzer="char_wb", ngram_range=(3, 5), min_df=2, max_features=80000)),
    }
    oofs, tests, cvs = {}, {}, {}
    for name, ffn in fams.items():
        oof, tep, fold = H.run_cv(ffn, tr, te, y, folds, [], lambda: LogisticRegression(max_iter=3000, C=1.0), False, proba, auc)
        oofs[name], tests[name], cvs[name] = oof, tep, auc(y, oof)
        print(f"{name:5s} OOF AUC {cvs[name]:.5f}")
    counts, order = H.caruana(oofs, y, lambda p: auc(y, p), n_iter=20)
    ens_oof, ens_te = H.blend(oofs, counts), H.blend(tests, counts)
    best = max(cvs, key=cvs.get)
    th_s, f1_s = best_f1_threshold(y, oofs[best]); th_e, f1_e = best_f1_threshold(y, ens_oof)
    print(f"集成 {counts} OOF AUC {auc(y, ens_oof):.5f} | F1:單模 {f1_s:.5f}@{th_s:.2f} 集成 {f1_e:.5f}@{th_e:.2f}")
    for tag, pred, th in [("single", tests[best], th_s), ("ensemble", ens_te, th_e)]:
        pd.DataFrame({"id": te["id"], "target": (pred > th).astype(int)}).to_csv(
            Path(__file__).parent / f"submission_nlp_{tag}.csv", index=False)
    print(f"✅ 完成 {(time.time()-t0)/60:.1f} 分")

if __name__ == "__main__":
    main()
