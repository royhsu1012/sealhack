"""案例:Digit Recognizer — L3 掃描 #6。診斷:影像(像素表格化)10 類多分類、指標 Accuracy、隨機切、n=42000×784。
簡單模型(裁示,不用 CNN):像素直入 LGBM 多分類;harness (n,k) 路徑。單一家族+argmax,無集成(單模已足,C3 無近敵)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score
import lightgbm as lgb
import harness as H

SEED = 42
DATA = Path(__file__).parent / "data" / "digit-recognizer"

def main():
    t0 = time.time()
    tr = pd.read_csv(DATA / "train.csv"); te = pd.read_csv(DATA / "test.csv")
    y = tr["label"].to_numpy()
    use = [c for c in tr.columns if c != "label"]
    ffn = lambda d, r, u: d[u].to_numpy(dtype=np.float32)
    folds = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(tr, y))
    acc = lambda yt, p: accuracy_score(yt, p.argmax(1))
    proba = lambda m, X: m.predict_proba(X)
    fac = lambda: lgb.LGBMClassifier(objective="multiclass", num_class=10, n_estimators=200,
                                     learning_rate=0.1, num_leaves=63, colsample_bytree=0.5,
                                     random_state=SEED, verbose=-1, n_jobs=4)
    oof, tep, fold = H.run_cv(ffn, tr, te, y, folds, use, fac, False, proba, acc)
    print(f"lgbm-multiclass OOF Acc {acc(y, oof):.5f}  折 {np.round(fold, 5)}")
    pred = tep.argmax(1)
    pd.DataFrame({"ImageId": np.arange(1, len(te) + 1), "Label": pred}).to_csv(
        Path(__file__).parent / "submission_digit_single.csv", index=False)
    print(f"✅ 完成 {(time.time()-t0)/60:.1f} 分")

if __name__ == "__main__":
    main()
