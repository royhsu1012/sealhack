"""SealHack 品質計分板:檢查 STANDARDS.md 裡可機器檢查的條目(S4 / S5 / S6 / 日誌結構)。
用法:在 repo 根目錄 `python .claude/skills/sealhack-loop/scripts/check.py`
退出碼:硬錯誤(腳本不可編譯、requirements 未 pin、缺 fetch_data.py、LOOP_LOG 結構壞)→ 1;其餘只計分。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")
import io, re, glob, py_compile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]          # .claude/skills/sealhack-loop/scripts → repo 根目錄
# 內容已遷移到 Astro 專案的 src/content/docs(.md + .mdx);語言檢查跟著實際網站頁面走
CONTENT = sorted((ROOT / "src" / "content" / "docs").rglob("*.md")) + \
          sorted((ROOT / "src" / "content" / "docs").rglob("*.mdx"))
SCRIPTS = sorted((ROOT / "validation").glob("*.py"))

# S5:簡體獨有字(對應繁體不同、台灣不通用);第 9 輪擴充——原集漏了 体/吗/后/务/损/竞/赛 等,給過假 0
SIMP = set("阶读风险盘点产锁实验数据预测训练时间随运进选择记录标签复优资统绝设计终开决轨诊断学习节补课现该层级骤"
           "权动态调参构结综业网络编码规则归类认识兴来没关应们说话详细简单杂东对处为过让会输档经线样际义发环错误寻"
           "亲临个问题这机试链库图书写从维护获奖导报势门长当与两条还头远继续争论坛讨见观达战术种负责换满压缩创总览"
           "钱费贵买卖员组织队团轮择"
           "体吗务损竞赛变边运连远适内单双样规则类别约级联称输详绍户众币奖励评审纪录异驱库页职尽几际齐争离旧灵拟"
           "扩扫执抛护担拥挡换据极构检楼欧毁毕汇汉沟潜灭烦热爱环疗监盖础积稳窃筛签紧红纳纵纸练组细织终绍经结绕给"
           "络绝继绩续维绿缓编缘缩罗聪肃肠肤肿脉脏脑舍艰苏范荐获营虑装订议讯讲许议访证词译诚话误诱诸谁调谈谓贫购"
           "贯贴贷贸赋赏质赢趋车转轮软轻较迁违迟递遗邮释钟铁银锐键镜闪阅陆陈隐难静顶须顿频颗颜额飞驶鱼鸡麦黄")
OPENCC = ["超引數", "引數", "自定義", "演演算法", "計分物件", "預測的物件", "一列一個物件"]   # 長詞在前,避免重複計數

def read(p): return io.open(p, encoding="utf-8").read()

# opencc s2t 可用時當權威(手工 SIMP 清單會漏字,第 9 輪就給過假 0);IGNORE 排除台灣異體字正規化
_IGNORE = set("纔羣隻佈裏於峯麪")
try:
    import opencc; _CC = opencc.OpenCC("s2t")
except Exception:
    _CC = None

def _is_simplified(line):
    if _CC is None:
        return any(ch in SIMP for ch in line)
    conv = _CC.convert(line)
    return any(a != b and b not in _IGNORE for a, b in zip(line, conv))

def scan_simplified():
    hits = []                                                      # (file, line_no, in_code)
    for f in CONTENT:
        in_code = False
        for i, line in enumerate(read(f).split("\n"), 1):
            if line.strip().startswith("```"): in_code = not in_code; continue
            if _is_simplified(line): hits.append((f.name, i, in_code))
    return hits

def scan_opencc():
    hits = []
    for f in CONTENT:
        text = read(f)
        for w in OPENCC:
            n = text.count(w)
            if n: hits.append((f.name, w, n)); text = text.replace(w, "")
    return hits

def scan_bare_fences():
    hits = []
    for f in CONTENT:
        lines = read(f).split("\n"); in_code = False
        for i, line in enumerate(lines, 1):
            s = line.strip()
            if s.startswith("```"):
                if not in_code and s == "```": hits.append((f.name, i))
                in_code = not in_code
    return hits

def check_scripts():
    rows = []
    for f in SCRIPTS:
        try: py_compile.compile(str(f), doraise=True); ok = True
        except py_compile.PyCompileError: ok = False
        src = read(f)
        utf8 = "sys.stdout.reconfigure" in src or f.name == "fetch_data.py"
        doc = src.lstrip().startswith('"""')
        rows.append((f.name, ok, utf8, doc))
    return rows

def scan_links():
    """內部連結稽核:content 的 /... 連結要指向存在的頁面路由或 validation 檔(從原始檔推,不依賴 build)。"""
    docs = ROOT / "src" / "content" / "docs"
    routes = {"/"}
    for f in list(docs.rglob("*.md")) + list(docs.rglob("*.mdx")):
        rel = f.relative_to(docs).as_posix().rsplit(".", 1)[0]
        routes.add("/" if rel == "index" else "/" + rel + "/")
    valfiles = {"/validation/" + p.name for p in (ROOT / "validation").glob("*.py")}
    valfiles.add("/validation/requirements.txt")
    bad = []
    for f in list(docs.rglob("*.md")) + list(docs.rglob("*.mdx")):
        for m in re.finditer(r"\]\((/[^)\s#]+)", read(f)):
            url = m.group(1)
            if url.startswith("/validation/"):
                if url not in valfiles: bad.append((f.name, url))
            else:
                norm = url if url.endswith("/") else url + "/"
                if norm not in routes: bad.append((f.name, url))
    return bad

def check_requirements():
    p = ROOT / "validation" / "requirements.txt"
    if not p.exists(): return False, "缺檔"
    lines = [l.strip() for l in read(p).split("\n") if l.strip() and not l.startswith("#")]
    bad = [l for l in lines if "==" not in l]
    return (not bad), (f"未 pin:{bad}" if bad else f"{len(lines)} 套件全 pin")

def check_log():
    p = ROOT / "internal" / "LOOP_LOG.md"
    if not p.exists(): return False, "缺檔"
    s = read(p)
    has_status = "## 目前狀態" in s; rounds = len(re.findall(r"^## 第 \d+ 輪", s, re.M))
    return has_status and rounds > 0, f"目前狀態 {'✓' if has_status else '✗'},輪次 {rounds}"

simp = scan_simplified(); opencc = scan_opencc(); fences = scan_bare_fences(); links = scan_links()
scripts = check_scripts(); req_ok, req_msg = check_requirements(); log_ok, log_msg = check_log()
fetch_ok = (ROOT / "validation" / "fetch_data.py").exists()
n_code = sum(1 for _, _, c in simp if c); n_prose = len(simp) - n_code
n_compile = sum(1 for _, ok, _, _ in scripts if ok); n_utf8 = sum(1 for _, _, u, _ in scripts if u)
n_doc = sum(1 for _, _, _, d in scripts if d)

print("SealHack 品質計分板")
print(f"  [S5] content/ 簡體字行數        {len(simp):>4}   (code {n_code} / prose {n_prose})   目標 0")
print(f"  [S5] OpenCC 誤轉次數            {sum(n for _, _, n in opencc):>4}   目標 0")
print(f"  [S4] validation 腳本可編譯      {n_compile}/{len(scripts)}")
print(f"  [S4] UTF-8 防呆 / docstring     {n_utf8}/{len(scripts)} / {n_doc}/{len(scripts)}")
print(f"  [S4] requirements 全 pin        {'✓' if req_ok else '✗'}   {req_msg}")
print(f"  [S4] fetch_data.py 存在          {'✓' if fetch_ok else '✗'}")
print(f"  [S6] 無語言標籤的 code fence    {len(fences):>4}   目標 0")
print(f"  [S6] 內部斷連結                 {len(links):>4}   目標 0")
print(f"  [日誌] LOOP_LOG 結構             {'✓' if log_ok else '✗'}   {log_msg}")

if "-v" in sys.argv:
    print("\n簡體字行:"); [print(f"  {f}:{i} [{'code' if c else 'prose'}]") for f, i, c in simp]
    print("OpenCC:"); [print(f"  {f}: {w} ×{n}") for f, w, n in opencc]
    print("裸 fence:"); [print(f"  {f}:{i}") for f, i in fences]
    print("斷連結:"); [print(f"  {f}: {u}") for f, u in links]
    print("腳本:"); [print(f"  {n}: compile={ok} utf8={u} doc={d}") for n, ok, u, d in scripts]

hard = [n for n, ok, _, _ in scripts if not ok] + ([] if req_ok else ["requirements"]) \
       + ([] if fetch_ok else ["fetch_data.py"]) + ([] if log_ok else ["LOOP_LOG"])
print(f"\n硬錯誤:{len(hard)} {hard if hard else ''}")
sys.exit(1 if hard else 0)
