"""案例:Store Sales(T4 時序)— L3 掃描 #7,兼候選主張 C12 的 L2 實驗。
C12(草案):多條相關序列+共變量時,「時序視窗化成迴歸」的全域 GBDT 勝過經典每序列統計法;
單變量少序列時不成立(M4 反例)。L1:M5(Makridakis et al., IJF 2022)、Elsayed et al. 2021(arXiv:2101.02118)、M4(Smyl 2020)。
診斷:1782 條日序列(54 店×33 類)、共變量 onpromotion、指標 RMSLE、test=訓練末 16 天後之 16 天 → 時間切,禁隨機。
實驗:三個 16 天時間視窗,同窗比較 (a) seasonal-naive(t−21 同星期)(b) 每序列簡單指數平滑×週季節指數
(c) 全域 LGBM(lag≥16、rolling、日曆、promo)。log1p 目標(樹不外推,相對化)。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import time
from pathlib import Path
import numpy as np
import pandas as pd
import lightgbm as lgb

SEED = 42
DATA = Path(__file__).parent / "data" / "store-sales"
H = 16  # 賽制預測視野

def rmsle(y, p):
    return float(np.sqrt(np.mean((np.log1p(np.clip(y, 0, None)) - np.log1p(np.clip(p, 0, None))) ** 2)))

def load():
    tr = pd.read_csv(DATA / "train.csv", parse_dates=["date"])
    te = pd.read_csv(DATA / "test.csv", parse_dates=["date"])
    for d in (tr, te):
        d["key"] = d["store_nbr"].astype(str) + "_" + d["family"]
    return tr, te

def pivot_sales(tr):
    """(date × key) 銷售矩陣,便於做 lag/rolling 與經典法。"""
    return tr.pivot_table(index="date", columns="key", values="sales", aggfunc="sum").sort_index().fillna(0.0)

def seasonal_naive(mat, cutoff, horizon_dates):
    """(a) t−21 同星期(完全在視野外)。"""
    pred = {}
    for d in horizon_dates:
        src = d - pd.Timedelta(days=21)
        pred[d] = mat.loc[src] if src in mat.index else mat.loc[:cutoff].iloc[-1]
    return pd.DataFrame(pred).T  # date × key

def ses_weekly(mat, cutoff, horizon_dates, alpha=0.3):
    """(b) 經典代表:log1p 上簡單指數平滑等級 × 週季節指數(每序列獨立,近 90 天估計)。"""
    hist = np.log1p(mat.loc[:cutoff].tail(90))
    dow_idx = hist.groupby(hist.index.dayofweek).mean()          # 週季節
    deseason = hist - dow_idx.reindex(hist.index.dayofweek).set_axis(hist.index)
    level = deseason.ewm(alpha=alpha).mean().iloc[-1]            # SES 等級
    pred = {}
    for d in horizon_dates:
        pred[d] = np.expm1(level + dow_idx.loc[d.dayofweek])
    return pd.DataFrame(pred).T.clip(lower=0)

def build_frame(tr, te_frame, cutoff):
    """(c) 全域 LGBM 的特徵表:只用 cutoff(含)以前的銷售做 lag/rolling(無洩漏);promo/日曆為已知未來。"""
    mat = pivot_sales(tr)
    hist = mat.loc[:cutoff]
    out = te_frame.copy()
    lag_feats = {}
    for lag in (16, 21, 28, 35):
        lag_feats[f"lag{lag}"] = {(d, k): v for d in out["date"].unique()
                                  for k, v in (hist.loc[d - pd.Timedelta(days=lag)] if (d - pd.Timedelta(days=lag)) in hist.index else hist.iloc[-1]).items()}
    for w in (7, 28):
        rm = hist.rolling(w).mean().shift(0)
        lag_feats[f"rm{w}_l16"] = {(d, k): v for d in out["date"].unique()
                                   for k, v in (rm.loc[d - pd.Timedelta(days=16)] if (d - pd.Timedelta(days=16)) in rm.index else rm.iloc[-1]).items()}
    for name, mp in lag_feats.items():
        out[name] = [mp.get((d, k), 0.0) for d, k in zip(out["date"], out["key"])]
    out["dow"] = out["date"].dt.dayofweek
    out["day"] = out["date"].dt.day
    out["month"] = out["date"].dt.month
    out["payday"] = ((out["day"] == 15) | (out["date"].dt.is_month_end)).astype(int)
    out["store_nbr_c"] = out["store_nbr"].astype("category").cat.codes
    out["family_c"] = out["family"].astype("category").cat.codes
    return out

FEATS = ["lag16", "lag21", "lag28", "lag35", "rm7_l16", "rm28_l16", "dow", "day", "month", "payday", "onpromotion", "store_nbr_c", "family_c"]

def lgbm_fit_predict(train_frame, pred_frame):
    m = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.05, num_leaves=63,
                          colsample_bytree=0.8, subsample=0.8, subsample_freq=1,
                          random_state=SEED, verbose=-1)
    Xtr = np.log1p(train_frame[["lag16", "lag21", "lag28", "lag35", "rm7_l16", "rm28_l16"]]).join(
        train_frame[["dow", "day", "month", "payday", "onpromotion", "store_nbr_c", "family_c"]])
    Xpr = np.log1p(pred_frame[["lag16", "lag21", "lag28", "lag35", "rm7_l16", "rm28_l16"]]).join(
        pred_frame[["dow", "day", "month", "payday", "onpromotion", "store_nbr_c", "family_c"]])
    m.fit(Xtr, np.log1p(train_frame["sales"].clip(lower=0)))
    return np.expm1(m.predict(Xpr)).clip(0, None)

def main():
    t0 = time.time()
    tr, te = load()
    last = tr["date"].max()
    print(f"train {tr.shape} 至 {last.date()};序列數 {tr['key'].nunique()}")
    # 三個 16 天視窗(彼此相接、皆時間切)
    results = []
    for w in (3, 2, 1):
        cut_end = last - pd.Timedelta(days=H * (w - 1))
        cut = cut_end - pd.Timedelta(days=H)          # 視窗起點前一天 = 訓練截止
        win = tr[(tr["date"] > cut) & (tr["date"] <= cut_end)]
        mat = pivot_sales(tr)
        hd = sorted(win["date"].unique())
        # (a) seasonal naive
        sn = seasonal_naive(mat, cut, hd)
        # (b) 每序列 SES×週季節
        ses = ses_weekly(mat, cut, hd)
        # (c) 全域 LGBM:訓練列 = cutoff 前一年、其特徵同樣只看各自 date−16 以前
        hist_frame = tr[(tr["date"] <= cut) & (tr["date"] > cut - pd.Timedelta(days=365))]
        trf = build_frame(tr[tr["date"] <= cut], hist_frame, cut - pd.Timedelta(days=0))
        # 訓練列的 lag 需以「該列 date」對齊——build_frame 已按列 date 取 lag(其來源 hist 只到 cut,
        # 對訓練列 date≤cut 而言 lag16 仍是嚴格過去)。
        wf = build_frame(tr[tr["date"] <= cut], win, cut)
        lg = lgbm_fit_predict(trf, wf)
        y = win["sales"].to_numpy()
        sn_p = np.array([sn.loc[d, k] for d, k in zip(win["date"], win["key"])])
        ses_p = np.array([ses.loc[d, k] for d, k in zip(win["date"], win["key"])])
        r = (rmsle(y, sn_p), rmsle(y, ses_p), rmsle(y, lg))
        results.append(r)
        print(f"視窗{4-w}(至 {cut_end.date()}) RMSLE  naive {r[0]:.4f} | SES {r[1]:.4f} | LGBM {r[2]:.4f}")
    arr = np.array(results)
    print(f"平均 RMSLE  naive {arr[:,0].mean():.4f} | SES {arr[:,1].mean():.4f} | LGBM {arr[:,2].mean():.4f}")
    print(f"逐窗勝負(LGBM vs 最佳經典):{['LGBM勝' if r[2] < min(r[0], r[1]) else '經典勝' for r in results]}")
    # L3:全資料重建 → 官方 test 提交(promo 已知)
    tef = build_frame(tr, te, last)
    trf_full = build_frame(tr, tr[tr["date"] > last - pd.Timedelta(days=365)], last)
    pred = lgbm_fit_predict(trf_full, tef)
    sub = pd.DataFrame({"id": te["id"], "sales": pred})
    sub.to_csv(Path(__file__).parent / "submission_storesales_lgbm.csv", index=False)
    # 第二份:seasonal naive(保險/對照)
    mat = pivot_sales(tr)
    sn_full = seasonal_naive(mat, last, sorted(te["date"].unique()))
    sn_pred = np.array([sn_full.loc[d, k] for d, k in zip(te["date"], te["key"])])
    pd.DataFrame({"id": te["id"], "sales": np.clip(sn_pred, 0, None)}).to_csv(
        Path(__file__).parent / "submission_storesales_naive.csv", index=False)
    print(f"✅ 完成 {(time.time()-t0)/60:.1f} 分;產出 lgbm 與 naive 兩份提交")

if __name__ == "__main__":
    main()
