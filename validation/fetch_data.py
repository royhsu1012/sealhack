"""取得驗證腳本需要的真實資料。用法:python fetch_data.py
目前只有 Kaggle 入門賽 Titanic 的 train.csv(891 列),從公開 mirror 下載並以 sha256 校驗。
有 Kaggle API 憑證時,等價指令:kaggle competitions download -c titanic"""
import hashlib, sys, urllib.request
from pathlib import Path

HERE = Path(__file__).parent
FILES = {
    "titanic.csv": ("https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv",
                    "4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7"),
}
for name, (url, sha) in FILES.items():
    dst = HERE / name
    if dst.exists() and hashlib.sha256(dst.read_bytes()).hexdigest() == sha:
        print(f"ok  {name} 已存在且校驗通過"); continue
    data = urllib.request.urlopen(url, timeout=30).read()
    if hashlib.sha256(data).hexdigest() != sha:
        sys.exit(f"FAIL {name} 校驗失敗,來源可能已變動")
    dst.write_bytes(data); print(f"ok  {name} 下載完成 ({len(data):,} bytes)")
