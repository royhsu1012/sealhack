"""L3 實戰:用 SealHack 方法論對 Kaggle 官方 Titanic test.csv 產生兩份提交(§7 雙提交)。
管線用通用 harness.py;Titanic 專屬的特徵與模型池沿用 case_titanic_v2(同一種量)。
全程只看 CV,提交後才由 public LB 揭曉 CV−LB 差距。
用法:python submit_titanic.py <official_train.csv> <official_test.csv> <out_dir>
輸出:sub_single.csv(CV 最佳單模)、sub_ensemble.csv(穩健集成)、cv_report.txt"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.metrics import accuracy_score, roc_auc_score
from case_titanic_v2 import features, MODELS, N_FOLDS, N_REPEATS, BLOCKS   # Titanic 專屬:特徵 + 模型池
import harness as H

train_path, test_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
tr_df = pd.read_csv(train_path); te_df = pd.read_csv(test_path)
y = tr_df.Survived.values
folds = list(RepeatedStratifiedKFold(n_splits=N_FOLDS, n_repeats=N_REPEATS, random_state=42).split(tr_df, y))

# 二分類的 predict/metric,交給 harness(換競賽只改這幾行 + feature_fn)
proba = lambda m, X: m.predict_proba(X)[:, 1]
def run(use, model):
    make, scale = MODELS[model]
    return H.run_cv(features, tr_df, te_df, y, folds, use, make, scale, proba, roc_auc_score)

# 階段 3|貪婪配對 t 選特徵(§5.1);Titanic 用 lgbm 當選特徵的模型
def run_lgbm(use):
    make, scale = MODELS['lgbm']
    return H.run_cv(features, tr_df, te_df, y, folds, use, make, scale, proba, roc_auc_score)
use, _base_auc = [], run_lgbm([])[2]
picked = []
for blk in BLOCKS:
    auc = run_lgbm(use + [blk])[2]; t = H.paired_t(auc, _base_auc); keep = t > 2
    picked.append(f"  +{blk:8s} 配對 AUC t={t:+.2f} {'✅保留' if keep else '✗砍'}")
    if keep: use.append(blk); _base_auc = auc
FEATS = use or ['(base)']

# 階段 2|OOF 池(同一組特徵、同一組折)
oofs, tes = {}, {}
for name in MODELS: oofs[name], tes[name], _ = run(use, name)

def cv_acc(p):
    th = H.best_threshold(y, p); return accuracy_score(y, p > th), th

# 階段 4|Caruana 爬山
counts, order = H.caruana(oofs, y, lambda p: cv_acc(p)[0])

# 階段 5|兩份提交(同一種量:折模型平均 + OOF 選出的閾值)
best = order[0]
cv1, th1 = cv_acc(oofs[best]); sub1 = (tes[best] > th1).astype(int)
cv2, th2 = cv_acc(H.blend(oofs, counts)); sub2 = (H.blend(tes, counts) > th2).astype(int)
for name, sub in [('sub_single', sub1), ('sub_ensemble', sub2)]:
    H.write_submission(f"{out_dir}/{name}.csv", te_df.PassengerId, 'PassengerId', sub, 'Survived')

report = [
    f"保留特徵:{FEATS}", *picked,
    "各單模 CV(閾值後 Accuracy):" + "  ".join(f"{n} {cv_acc(oofs[n])[0]:.4f}" for n in order),
    f"提交1|CV 最佳單模 {best}:CV {cv1:.4f}(閾值 {th1:.2f})",
    f"提交2|穩健集成 {counts}:CV {cv2:.4f}(閾值 {th2:.2f})",
]
open(f"{out_dir}/cv_report.txt", "w", encoding="utf-8").write("\n".join(report))
print("\n".join(report))
print(f"\n寫出:{out_dir}/sub_single.csv、sub_ensemble.csv(各 {len(sub1)} 列)")
