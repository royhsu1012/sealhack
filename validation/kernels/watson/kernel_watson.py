# sealhack code-comp case: Watson NLI, simple models only (TF-IDF + LogReg).
# Decisions (blend weights) made offline by honest 5-fold CV; this kernel = full-train + predict.
import pandas as pd, numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer

import os
print("input tree:", os.listdir("/kaggle/input") if os.path.exists("/kaggle/input") else "NO /kaggle/input")
BASE = None
for root, dirs, files in os.walk("/kaggle/input"):
    if "train.csv" in files and "test.csv" in files:
        BASE = root + "/"; break
assert BASE, "competition data not attached"
print("using BASE:", BASE)
tr = pd.read_csv(BASE + "train.csv"); te = pd.read_csv(BASE + "test.csv")
y = tr["label"].to_numpy()
mk = lambda d: (d["lang_abv"] + " ¶ " + d["hypothesis"].fillna(""))  # v3: hypothesis-only(premise 身分=測試集反向記憶源)

FAMS = {
    "char": dict(analyzer="char_wb", ngram_range=(2, 5), min_df=2, max_features=200000, sublinear_tf=True),
    "word": dict(ngram_range=(1, 2), min_df=2, max_features=100000, sublinear_tf=True),
}
WEIGHTS = {"word": 1, "char": 1}  # v3 本地 GroupKFold CV caruana counts(OOF 0.46304)

probs = np.zeros((len(te), 3)); total = sum(WEIGHTS.values())
for name, params in FAMS.items():
    w = WEIGHTS.get(name, 0)
    if not w: continue
    vec = TfidfVectorizer(**params).fit(mk(tr))
    m = LogisticRegression(max_iter=3000, C=2.0).fit(vec.transform(mk(tr)), y)
    probs += w / total * m.predict_proba(vec.transform(mk(te)))

pd.DataFrame({"id": te["id"], "prediction": probs.argmax(1)}).to_csv("submission.csv", index=False)
print("submission.csv written", probs.shape)
