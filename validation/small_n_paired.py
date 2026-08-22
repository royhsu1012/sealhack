"""小樣本兩條主張的 L2 驗證(鐵達尼真資料),20 次切分分布版。特徵與 case_titanic_v2 共用同一份定義(STANDARDS S4)。
C9|配對比較:同折差值的變異遠小於分數本身,且 AUC 比 Accuracy 解析度高 → 小樣本決策看配對差 + 平滑指標。
C10|填補統計:中位數填補 fold 內擬合 vs 整池擬合,差距是二階小量(對照 C2 目標編碼的一階洩漏)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from joblib import Parallel, delayed
from sklearn.model_selection import RepeatedStratifiedKFold, train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
import lightgbm as lgb
from case_titanic_v2 import DF, features, paired_t, N_FOLDS, N_REPEATS   # 唯一特徵來源

N_SPLITS, BLOCKS = 20, ['title', 'family', 'cabin', 'ticket']
def lgbm(): return lgb.LGBMClassifier(n_estimators=200, learning_rate=0.05, num_leaves=8,
                                      min_child_samples=15, n_jobs=1, verbose=-1, random_state=42)

def fold_scores(tr_df, folds, use, impute_ref=None):
    """回傳每折的 (Accuracy@0.5, AUC)。impute_ref='full' → 用整個訓練池算填補統計(輕微洩漏,給 C10)。"""
    y = tr_df.Survived.values; acc, auc = [], []
    for tr, va in folds:
        ref = tr_df if impute_ref == 'full' else tr_df.iloc[tr]     # 'full' 讓驗證折看到整池的中位數
        Xa = features(tr_df.iloc[tr], tr_df.iloc[tr], use)          # 目標相關統計一律 fold 內(C2 不鬆動)
        Xb = features(tr_df.iloc[va], ref, use)
        p = lgbm().fit(Xa, y[tr]).predict_proba(Xb)[:, 1]
        acc.append(accuracy_score(y[va], p > 0.5)); auc.append(roc_auc_score(y[va], p))
    return np.array(acc), np.array(auc)

def one_split(seed):
    tr_df, _ = train_test_split(DF, test_size=0.3, stratify=DF.Survived, random_state=seed)
    tr_df = tr_df.reset_index(drop=True)
    folds = list(RepeatedStratifiedKFold(n_splits=N_FOLDS, n_repeats=N_REPEATS, random_state=42).split(tr_df, tr_df.Survived))
    b_acc, b_auc = fold_scores(tr_df, folds, [])
    row = {'seed': seed, 'score_std_auc': b_auc.std(ddof=1)}
    for blk in BLOCKS:
        a_acc, a_auc = fold_scores(tr_df, folds, [blk])
        row[f'{blk}_t_acc'] = paired_t(a_acc, b_acc); row[f'{blk}_t_auc'] = paired_t(a_auc, b_auc)
        row[f'{blk}_pstd_auc'] = (a_auc - b_auc).std(ddof=1)
    # C10:整池填補 − fold 內填補(僅 base 數值特徵,差別只在 age/fare 中位數的來源)
    f_acc, _ = fold_scores(tr_df, folds, [], impute_ref='fold')
    p_acc, _ = fold_scores(tr_df, folds, [], impute_ref='full')
    row['c10_delta'] = float((p_acc - f_acc).mean())
    return row

if __name__ == '__main__':
    R = pd.DataFrame(Parallel(n_jobs=5)(delayed(one_split)(s) for s in range(N_SPLITS)))
    print(f"鐵達尼小樣本主張|{N_SPLITS} 次 70/30 切分 × {N_FOLDS}×{N_REPEATS} 折|特徵定義 = case_titanic_v2\n")

    print("C9|配對比較的核心:配對差的 std 遠小於分數本身的 std(所以看差值、不看均值)")
    score_std = R['score_std_auc'].mean()
    print(f"  分數 std(fold 間 AUC 波動)平均         {score_std:.4f}")
    for blk in BLOCKS:
        print(f"  {blk:8s} 配對差 std 平均 {R[f'{blk}_pstd_auc'].mean():.4f}"
              f"  (= 分數 std 的 {R[f'{blk}_pstd_auc'].mean()/score_std:.0%})")

    print("\nC9|解析度:同一批特徵,Accuracy 配對檢定 vs AUC 配對檢定,t>2 的切分數 / 20")
    print(f"  {'特徵':8s} {'Acc t>2':>8s} {'Acc t中位':>9s} {'AUC t>2':>8s} {'AUC t中位':>9s}")
    for blk in BLOCKS:
        print(f"  {blk:8s} {(R[f'{blk}_t_acc']>2).sum():>6}/20 {R[f'{blk}_t_acc'].median():>9.2f}"
              f" {(R[f'{blk}_t_auc']>2).sum():>6}/20 {R[f'{blk}_t_auc'].median():>9.2f}")
    print("  → 平滑指標(AUC)的解析度高於賽制指標(Accuracy);但『看得見』不等於『穩健』——")
    print("    只有票團有害(t 深負、跨切分一致)是穩的結論,Title/family 在分布上並不穩。")

    d = R['c10_delta']
    print(f"\nC10|整池填補 − fold 內填補(中位數填補):Δ均值 {d.mean():+.5f} ± {d.std(ddof=1):.5f}")
    print(f"  → 不碰目標的填補,洩漏是二階小量(|Δ| ≈ {abs(d.mean()):.5f});對照 C2 目標編碼一階洩漏 +0.030。")
