"""L2 驗證框架主張:Frequency Encoding(用類別的出現次數取代類別)便宜且常有效(§5.2C)。
機制:當「類別多常見/多罕見」本身帶訊號(如罕見類別=高風險),label encoding 給的編號是任意的、樹要靠多次分裂硬背;
  直接把 value_counts 映成一欄,就把頻率訊號一次餵進去。反面:若頻率與 y 無關,它只是無用欄(便宜但無效)。
做法:兩情境——頻率帶訊號 vs 頻率無關;比 base(label 編碼)vs base+frequency 的 holdout AUC(lgbm)。8 seeds。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

def make(seed, freq_signal):
    rng = np.random.default_rng(seed)
    n = 6000
    # 高基數類別:類別編號 0..K,出現頻率高度不均(少數常見、多數罕見)
    cat = rng.zipf(1.6, n) % 400
    freq = pd.Series(cat).map(pd.Series(cat).value_counts()).values.astype(float)
    Xn = rng.normal(size=(n, 4))
    base_signal = Xn @ rng.normal(size=4) * 0.8
    # freq_signal=True:罕見類別(freq 小)風險高 → 頻率帶訊號;False:y 與 freq 無關
    extra = (-np.log(freq) * 0.5) if freq_signal else 0.0
    y = (base_signal + extra + rng.logistic(size=n) > 0).astype(int)
    df = pd.DataFrame(Xn, columns=[f'n{i}' for i in range(4)])
    df['cat'] = cat.astype(float)                 # label encoding(任意編號)
    return df, freq, y

for freq_signal, label in [(True, '頻率帶訊號(罕見=高風險)'), (False, '頻率與 y 無關')]:
    dB, dF = [], []
    for seed in range(8):
        df, freq, y = make(seed, freq_signal)
        tr, ho = train_test_split(np.arange(len(y)), test_size=0.3, random_state=seed, stratify=y)
        base = lgb.LGBMClassifier(n_estimators=300, num_leaves=31, verbose=-1, random_state=seed).fit(df.iloc[tr], y[tr])
        dB.append(roc_auc_score(y[ho], base.predict_proba(df.iloc[ho])[:, 1]))
        Xf = df.copy(); Xf['cat_freq'] = freq
        fe = lgb.LGBMClassifier(n_estimators=300, num_leaves=31, verbose=-1, random_state=seed).fit(Xf.iloc[tr], y[tr])
        dF.append(roc_auc_score(y[ho], fe.predict_proba(Xf.iloc[ho])[:, 1]))
    b, f = np.mean(dB), np.mean(dF)
    print(f"  {label:22s} base {b:.4f} → +frequency {f:.4f}(Δ {f-b:+.4f})")

print("\n→ 主張(§5.2C):frequency encoding 便宜(一行 value_counts),但「有效」有條件——")
print("  當頻率本身帶訊號(常見/罕見與 y 相關)時明顯加分;頻率與 y 無關時只是無用欄(不虧但不賺)。")
