"""案例:Contradictory, My Dear Watson — L3 掃描 #8,**首個 code 賽**(賽制軸補完:prediction×7 + code×1)。
診斷:多語言(15 語)句對 NLI 三分類、Accuracy、**GroupKFold(premise)**(同 premise 多標籤,隨機切=結構洩漏,v1 實測 OOF 0.287<隨機 0.333 揭露之)、n=12120、code 賽。
簡單模型裁示:TF-IDF(char_wb 語言無關)+ LogReg;word 家族當多樣性成員。無預訓練(XLM-R 之類一律不用)。
流程:本檔算誠實 CV;kernel_watson.py 為 Kaggle 遠端版(全量訓練→submission.csv)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import accuracy_score, log_loss
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
import harness as H

SEED = 42
DATA = Path(__file__).parent / "data" / "watson"

def make_text(df):
    # v3:徹底去 premise 身分——test 與 train 共享 52% premise 且為異標籤(NLI 造題),
    # 含 premise 的模型全量訓練後在 test 反向記憶(v2 實測 LB 0.254 << CV 0.400,C7b 野外現形)。
    return (df["lang_abv"] + " ¶ " + df["hypothesis"].fillna(""))

def make_ffn(params):
    def ffn(d, ref, use):
        vec = TfidfVectorizer(**params).fit(make_text(ref))
        return vec.transform(make_text(d))
    return ffn

def main():
    t0 = time.time()
    tr = pd.read_csv(DATA / "train.csv"); te = pd.read_csv(DATA / "test.csv")
    y = tr["label"].to_numpy()
    print(f"train {tr.shape} 語言數 {tr['lang_abv'].nunique()} 類別分布 {np.bincount(y)}")
    # 診斷更正:premise 為群組軸(32.5% premise 多標籤→隨機切會把「背 premise」當訊號,OOF 低於隨機)
    folds = list(StratifiedGroupKFold(5, shuffle=True, random_state=SEED).split(tr, y, groups=tr["premise"]))
    acc = lambda yt, p: accuracy_score(yt, p.argmax(1))
    proba = lambda m, X: m.predict_proba(X)
    fams = {
        "char": make_ffn(dict(analyzer="char_wb", ngram_range=(2, 5), min_df=2, max_features=200000, sublinear_tf=True)),
        "word": make_ffn(dict(ngram_range=(1, 2), min_df=2, max_features=100000, sublinear_tf=True)),
    }
    oofs, tests, cvs = {}, {}, {}
    for name, ffn in fams.items():
        oof, tep, fold = H.run_cv(ffn, tr, te, y, folds, [], lambda: LogisticRegression(max_iter=3000, C=2.0), False, proba, acc)
        oofs[name], tests[name], cvs[name] = oof, tep, acc(y, oof)
        print(f"{name:5s} OOF Acc {cvs[name]:.5f}  折 {np.round(fold,4)}")
    counts, order = H.caruana(oofs, y, lambda p: acc(y, p), n_iter=20)
    ens_oof, ens_te = H.blend(oofs, counts), H.blend(tests, counts)
    best = max(cvs, key=cvs.get)
    print(f"集成 {counts} OOF Acc {acc(y, ens_oof):.5f} vs 單模 {best} {cvs[best]:.5f}")
    # code 賽:本地產出僅供對照;正式提交走 kernel_watson.py(Kaggle 遠端)
    pred = (ens_te if acc(y, ens_oof) >= cvs[best] else tests[best]).argmax(1)
    pd.DataFrame({"id": te["id"], "prediction": pred}).to_csv(Path(__file__).parent / "submission_watson_local.csv", index=False)
    print(f"✅ 完成 {(time.time()-t0)/60:.1f} 分(誠實 CV 出爐;LB 需經 notebook 提交)")

if __name__ == "__main__":
    main()
