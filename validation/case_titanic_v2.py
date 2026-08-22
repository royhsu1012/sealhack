"""鐵達尼 × SealHack 方法論 v2.2:端到端示範(L3 預演),20 次不同 70/30 切分報分布。
相對 v1(case_titanic.py)的三個修正:
(1) 特徵決策用配對 AUC t 檢定(§16.2/16.3),不用 0.5×std 門檻;
(2) 單模與集成用同一種量:50 個折模型的平均 OOF(搜閾值)對 50 個折模型在 holdout 的平均預測(§3.3 協議);
(3) 單次切分不當結論:報 20 次切分的分布與配對差(STANDARDS S8)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from joblib import Parallel, delayed
from sklearn.model_selection import RepeatedStratifiedKFold, train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, roc_auc_score
import lightgbm as lgb

DF = pd.read_csv('titanic.csv')
N_SPLITS, N_FOLDS, N_REPEATS = 20, 10, 5
BLOCKS = ['title', 'family', 'cabin', 'ticket']
MODELS = {   # (工廠, 是否標準化)
 'lgbm':       (lambda: lgb.LGBMClassifier(n_estimators=200, learning_rate=0.05, num_leaves=8,
                                           min_child_samples=15, n_jobs=1, verbose=-1, random_state=42), False),
 'logreg':     (lambda: LogisticRegression(max_iter=2000, C=0.5), True),
 'extratrees': (lambda: ExtraTreesClassifier(200, min_samples_leaf=4, n_jobs=1, random_state=42), False),
 'knn':        (lambda: KNeighborsClassifier(15), True),
}

def title_of(d):
    t = d.Name.str.extract(r',\s*([^\.]+)\.')[0].str.strip().replace({'Mlle': 'Miss', 'Ms': 'Miss', 'Mme': 'Mrs'})
    return t.where(t.isin(['Mr', 'Miss', 'Mrs', 'Master']), 'Rare')

def features(d, ref, use):
    """d 的特徵矩陣;所有統計量(中位數、票團生還率)只用 ref 計算——C2/C10 紀律"""
    t, tr = title_of(d), title_of(ref)
    X = pd.DataFrame({'pclass': d.Pclass, 'sex': (d.Sex == 'male').astype(int), 'sibsp': d.SibSp, 'parch': d.Parch,
                      'fare': d.Fare.fillna(ref.Fare.median()),
                      'age': d.Age.fillna(t.map(ref.Age.groupby(tr).median())).fillna(ref.Age.median()),
                      'emb_S': (d.Embarked == 'S').astype(int), 'emb_C': (d.Embarked == 'C').astype(int)})
    if 'title' in use:
        for k in ['Mr', 'Miss', 'Mrs', 'Master', 'Rare']: X[f't_{k}'] = (t == k).astype(int)
    if 'family' in use:
        fs = d.SibSp + d.Parch + 1; X['famsize'] = fs; X['alone'] = (fs == 1).astype(int)
    if 'cabin' in use:
        X['hascabin'] = d.Cabin.notna().astype(int)
        X['deck'] = d.Cabin.str[0].map({c: i + 1 for i, c in enumerate('ABCDEFG')}).fillna(0)
    if 'ticket' in use:   # 目標相關統計 → 一階洩漏風險,必須 fold 內(ref)計算並平滑
        g = ref.groupby('Ticket').Survived.agg(['mean', 'count']); prior = ref.Survived.mean()
        known = d.Ticket.map((g['mean'] * g['count'] + prior * 3) / (g['count'] + 3))
        X['tix_surv'] = known.fillna(prior); X['tix_known'] = known.notna().astype(int)
    return X.values.astype(float)

def run(tr_df, ho_df, folds, use, model='lgbm'):
    """§3.3 協議的單一迴圈:每折訓練一次 → 累積 OOF 與 holdout 預測 → 回傳平均值與各折 AUC"""
    y = tr_df.Survived.values; make, scale = MODELS[model]
    oof = np.zeros(len(tr_df)); cnt = np.zeros(len(tr_df)); ho = np.zeros(len(ho_df)); fold_auc = []
    for tr, va in folds:
        ref = tr_df.iloc[tr]
        Xa, Xb, Xh = features(ref, ref, use), features(tr_df.iloc[va], ref, use), features(ho_df, ref, use)
        if scale:
            sc = StandardScaler().fit(Xa); Xa, Xb, Xh = sc.transform(Xa), sc.transform(Xb), sc.transform(Xh)
        m = make().fit(Xa, y[tr]); p = m.predict_proba(Xb)[:, 1]
        oof[va] += p; cnt[va] += 1; ho += m.predict_proba(Xh)[:, 1] / len(folds)
        fold_auc.append(roc_auc_score(y[va], p))
    return oof / cnt, ho, np.array(fold_auc)

def paired_t(a, b):
    d = a - b; return d.mean() / (d.std(ddof=1) / np.sqrt(len(d)))

def best_threshold(y, p):
    ths = np.arange(0.30, 0.71, 0.01)
    return ths[int(np.argmax([accuracy_score(y, p > t) for t in ths]))]

def one_split(seed):
    tr_df, ho_df = train_test_split(DF, test_size=0.3, stratify=DF.Survived, random_state=seed)
    tr_df, ho_df = tr_df.reset_index(drop=True), ho_df.reset_index(drop=True)
    y, yho = tr_df.Survived.values, ho_df.Survived.values
    folds = list(RepeatedStratifiedKFold(n_splits=N_FOLDS, n_repeats=N_REPEATS, random_state=42).split(tr_df, y))

    # 階段 1+3|基線 → 一次一組特徵,配對 AUC t>2 才保留(§16.2/16.3)
    use = []; _, _, cur_auc = run(tr_df, ho_df, folds, use); tvals = {}
    for blk in BLOCKS:
        _, _, auc = run(tr_df, ho_df, folds, use + [blk])
        tvals[blk] = paired_t(auc, cur_auc)
        if tvals[blk] > 2: use.append(blk); cur_auc = auc

    # 階段 2|多樣化模型 → OOF 池(同一組特徵、同一組折)
    oofs, hos = {}, {}
    for name in MODELS: oofs[name], hos[name], _ = run(tr_df, ho_df, folds, use, name)

    # 同一個評估函式給單模與集成:平均 OOF 搜閾值後的 Accuracy
    def cv_acc(p): th = best_threshold(y, p); return accuracy_score(y, p > th), th
    blend = lambda d, c: sum(d[n] * k for n, k in c.items()) / sum(c.values())

    # 階段 4|Caruana 爬山:前 2 名初始化、可重複選取(§6.1 防過擬合 (1)+(2))
    order = sorted(oofs, key=lambda n: cv_acc(oofs[n])[0], reverse=True)
    counts = {order[0]: 1, order[1]: 1}; score = cv_acc(blend(oofs, counts))[0]
    for _ in range(20):
        trial = {n: cv_acc(blend(oofs, {**counts, n: counts.get(n, 0) + 1}))[0] for n in oofs}
        cand = max(trial, key=trial.get)
        if trial[cand] <= score + 1e-4: break
        counts[cand] = counts.get(cand, 0) + 1; score = trial[cand]

    # 階段 5|兩份提交,同一種量:折模型在 holdout 的平均預測 + OOF 選出的閾值
    best = order[0]
    cv1, th1 = cv_acc(oofs[best]); ho1 = accuracy_score(yho, hos[best] > th1)
    cv2, th2 = cv_acc(blend(oofs, counts)); ho2 = accuracy_score(yho, blend(hos, counts) > th2)
    return dict(seed=seed, feats='+'.join(use) or '(base)', best=best, members=counts, tvals=tvals,
                cv1=cv1, ho1=ho1, cv2=cv2, ho2=ho2, gender=accuracy_score(yho, (ho_df.Sex == 'female').astype(int)))

if __name__ == '__main__':
    R = pd.DataFrame(Parallel(n_jobs=5)(delayed(one_split)(s) for s in range(N_SPLITS)))
    print(f"鐵達尼 v2.2|{N_SPLITS} 次 70/30 切分 × {N_FOLDS}×{N_REPEATS} 折|n_train=623, n_holdout=268")
    print(f"{'seed':>4} {'保留特徵':<28} {'單模':<10} {'單模 CV→私榜':<16} {'集成成員':<34} {'集成 CV→私榜':<16} {'私榜Δ':>7}")
    for r in R.itertuples():
        print(f"{r.seed:>4} {r.feats:<28} {r.best:<10} {r.cv1:.4f}→{r.ho1:.4f}    "
              f"{str(r.members):<34} {r.cv2:.4f}→{r.ho2:.4f}    {r.ho2 - r.ho1:+.4f}")
    print("\n特徵保留率(配對 AUC t>2):", {b: f"{sum(r.tvals[b] > 2 for r in R.itertuples())}/{N_SPLITS}" for b in BLOCKS})
    print("各組 t 值中位數:", {b: round(float(np.median([r.tvals[b] for r in R.itertuples()])), 2) for b in BLOCKS})
    d = R.ho2 - R.ho1; t = paired_t(R.ho2.values, R.ho1.values)
    print(f"\n性別規則私榜      {R.gender.mean():.4f} ± {R.gender.std():.4f}")
    print(f"單模私榜          {R.ho1.mean():.4f} ± {R.ho1.std():.4f}   CV−私榜 {(R.cv1 - R.ho1).mean():+.4f}")
    print(f"集成私榜          {R.ho2.mean():.4f} ± {R.ho2.std():.4f}   CV−私榜 {(R.cv2 - R.ho2).mean():+.4f}")
    print(f"配對差 集成−單模   {d.mean():+.4f} ± {d.std():.4f}   t={t:+.2f}   集成贏 {(d > 0).sum()}/{N_SPLITS} 平 {(d == 0).sum()}")
    verdict = "集成顯著更差" if t < -2 else ("集成顯著更好" if t > 2 else "無顯著差異(|t|<2)")
    print(f"→ §16.6「小樣本集成降級」:{'✅ 成立' if t < -2 else '❌ 不成立'} — 20 次切分的配對檢定:{verdict}")
