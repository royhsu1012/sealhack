"""對照實驗:同模型「裸版(天真做法)」vs「方法論版」——量測方法論本身的貢獻(使用者提問「我們的方法有比較好嗎」)。
模型不變(spaceship/house 用同設定 LGBM、nlp 用同設定 LogReg),只拔掉方法論決策:
  spaceship 裸:原始欄(Cabin 整欄當類別、不拆 deck/side、無消費特徵)、閾值固定 0.5(不在 OOF 搜)
  house 裸:目標不做 log1p(直接迴歸原始 SalePrice)
  nlp 裸:word TF-IDF 單家族、閾值固定 0.5
對照組=既有 case 腳本的正式提交(LB 已知)。本檔產出三份 naive 提交。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.metrics import roc_auc_score, f1_score
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
import lightgbm as lgb
import harness as H

SEED = 42
ROOT = Path(__file__).parent / "data"

def codes(d, ref, cols):
    out = []
    for c in cols:
        if not pd.api.types.is_numeric_dtype(d[c]):
            cats = pd.Categorical(ref[c]).categories
            out.append(pd.Categorical(d[c], categories=cats).codes.astype(float))
        else:
            out.append(d[c].to_numpy(dtype=float))
    return np.column_stack(out)

# ---------- spaceship 裸 ----------
tr = pd.read_csv(ROOT / "spaceship-titanic" / "train.csv"); te = pd.read_csv(ROOT / "spaceship-titanic" / "test.csv")
y = tr["Transported"].astype(int).to_numpy()
use = [c for c in tr.columns if c not in ("Transported", "PassengerId", "Name")]  # Cabin 原欄直入
folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(tr, y))
fac = lambda: lgb.LGBMClassifier(n_estimators=400, learning_rate=0.05, num_leaves=31, random_state=SEED, verbose=-1)
oof, tep, _ = H.run_cv(codes, tr, te, y, folds, use, fac, False, lambda m, X: m.predict_proba(X)[:, 1], lambda a, b: roc_auc_score(a, b))
from sklearn.metrics import accuracy_score
print(f"[spaceship 裸] OOF AUC {roc_auc_score(y, oof):.5f}  Acc@0.5 {accuracy_score(y, oof > 0.5):.5f}(方法論版 Acc .80571@0.44)")
pd.DataFrame({"PassengerId": te["PassengerId"], "Transported": (tep > 0.5)}).to_csv(Path(__file__).parent / "submission_spaceship_naive.csv", index=False)

# ---------- house 裸(不做 log1p)----------
tr = pd.read_csv(ROOT / "house-prices" / "train.csv"); te = pd.read_csv(ROOT / "house-prices" / "test.csv")
y_raw = tr["SalePrice"].to_numpy(dtype=float)
use = [c for c in tr.columns if c not in ("Id", "SalePrice")]
folds = list(KFold(5, shuffle=True, random_state=SEED).split(tr))
facr = lambda: lgb.LGBMRegressor(n_estimators=500, learning_rate=0.05, num_leaves=31, random_state=SEED, verbose=-1)
rmse_log = lambda a, b: -float(np.sqrt(np.mean((np.log1p(np.clip(a, 0, None)) - np.log1p(np.clip(b, 0, None))) ** 2)))
oof, tep, _ = H.run_cv(codes, tr, te, y_raw, folds, use, facr, False, lambda m, X: m.predict(X), rmse_log)
print(f"[house 裸] OOF RMSE(log) {-rmse_log(y_raw, oof):.5f}(方法論版 .13255,LB .12749)")
pd.DataFrame({"Id": te["Id"], "SalePrice": np.clip(tep, 1, None)}).to_csv(Path(__file__).parent / "submission_houseprices_naive.csv", index=False)

# ---------- nlp 裸(word only、閾值 0.5)----------
tr = pd.read_csv(ROOT / "nlp-getting" / "train.csv"); te = pd.read_csv(ROOT / "nlp-getting" / "test.csv")
tr["text"] = tr["text"].fillna(""); te["text"] = te["text"].fillna("")
y = tr["target"].to_numpy()
folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(tr, y))
def ffn(d, ref, use):
    vec = TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=60000).fit(ref["text"])
    return vec.transform(d["text"])
oof, tep, _ = H.run_cv(ffn, tr, te, y, folds, [], lambda: LogisticRegression(max_iter=3000, C=1.0), False,
                       lambda m, X: m.predict_proba(X)[:, 1], lambda a, b: roc_auc_score(a, b))
print(f"[nlp 裸] OOF AUC {roc_auc_score(y, oof):.5f}  F1@0.5 {f1_score(y, oof > 0.5):.5f}(方法論版 F1 .76818@0.44,LB .79619)")
pd.DataFrame({"id": te["id"], "target": (tep > 0.5).astype(int)}).to_csv(Path(__file__).parent / "submission_nlp_naive.csv", index=False)
print("✅ 三份 naive 提交檔已產出")
