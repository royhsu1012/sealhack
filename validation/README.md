# validation/ — 研究目錄(數字的唯一事實來源)

網站上每個實驗數字都出自這裡的某支腳本(S1 可追溯)。31 支腳本三類:
- `claims_*.py`、各校準腳本 — 逐條驗證 13 條主張(對應 `src/data/claims.json`,claims 頁每列連到腳本)
- `case_*.py` — L3 真比賽案例(titanic / s6e8 / spaceship / houseprices / nlp / digit;協議見 SKILL「案例輪」)
- `harness.py` — 通用管線(run_cv / greedy_select / caruana / blend / write_submission;metric 一律「越高越好」;自測 `harness_selftest.py`)

## 重跑

```bash
pip install -r requirements.txt
python fetch_data.py     # Titanic 資料(sha256 校驗)
python run_all.py        # 全套 ~40 分;--fast 數秒級 4 支
```

Windows 可直接跑(腳本已強制 UTF-8)。競賽案例需先在 Kaggle 網站 Join 該賽,再 `kaggle competitions download -c <賽> -p data/<賽>`(資料與 log 皆 gitignored)。
