"""鐵達尼 × SealHack 方法論:端到端實戰(L3 預演)— v1,單次切分(seed 42)+ 0.5×std 舊規則。
已被 case_titanic_v2.py(20 次切分、配對 AUC 檢定、同一種量評估)取代,保留作修訂史;數字仍可重跑。
891 筆真資料;30% 留作「模擬私榜」,全程只看 CV,最後揭曉。"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np, pandas as pd
from sklearn.model_selection import RepeatedStratifiedKFold, train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score
import lightgbm as lgb
pd.set_option('display.width',120)

df = pd.read_csv('titanic.csv')
tr_df, ho_df = train_test_split(df, test_size=0.3, stratify=df.Survived, random_state=42)
tr_df, ho_df = tr_df.reset_index(drop=True), ho_df.reset_index(drop=True)
ytr, yho = tr_df.Survived.values, ho_df.Survived.values

print("═"*66)
print("階段 0|讀題與五問診斷")
print("═"*66)
print("""模態=表格  任務=二分類  指標=Accuracy(→需在 OOF 上搜最佳閾值)
test切法=隨機(家庭/同票團體被拆散在兩邊 → 團體特徵可轉移,但必須 fold 內計算)
賽制=prediction
⚠ 小資料警報:n=624(訓練池)→ CV 噪音大 → 10-fold × 5 repeats
⚠ 真實鐵達尼 LB >0.85 多為查史料作弊;誠實天花板約 0.83""")
# 團體跨越 train/holdout 的證據
tix = set(tr_df.Ticket) & set(ho_df.Ticket)
print(f"跨 train/私榜 的同票團體數:{len(tix)}(團體特徵有轉移價值的證據)")

print()
print("═"*66)
print("階段 1|鎖死 CV + 基線")
print("═"*66)
cv = RepeatedStratifiedKFold(n_splits=10, n_repeats=5, random_state=42)
folds = list(cv.split(tr_df, ytr))

# 基線 0:性別規則(著名的 0.766 基準)
acc_gender_cv = accuracy_score(ytr, (tr_df.Sex=='female').astype(int))
print(f"基線|性別規則:CV(訓練池整體) {acc_gender_cv:.4f}")

def build(dtr, dva, use=('base',)):
    """特徵工程:目標相關特徵(票團生還率)一律用 dtr 計算再套 dva(C2 紀律)"""
    def f(d, ref):
        X = pd.DataFrame(index=d.index)
        X['pclass']=d.Pclass; X['sex']=(d.Sex=='male').astype(int)
        X['sibsp']=d.SibSp; X['parch']=d.Parch
        X['fare']=d.Fare.fillna(ref.Fare.median())
        title = d.Name.str.extract(r',\s*([^\.]+)\.')[0].str.strip()
        title = title.replace({'Mlle':'Miss','Ms':'Miss','Mme':'Mrs'})
        title = title.where(title.isin(['Mr','Miss','Mrs','Master']), 'Rare')
        ref_title = ref.Name.str.extract(r',\s*([^\.]+)\.')[0].str.strip().replace(
            {'Mlle':'Miss','Ms':'Miss','Mme':'Mrs'})
        ref_title = ref_title.where(ref_title.isin(['Mr','Miss','Mrs','Master']),'Rare')
        age_med = ref.Age.groupby(ref_title).median()
        X['age'] = d.Age.fillna(title.map(age_med)).fillna(ref.Age.median())
        if 'title' in use:
            for t in ['Mr','Miss','Mrs','Master','Rare']: X[f't_{t}']=(title==t).astype(int)
        if 'family' in use:
            fs=d.SibSp+d.Parch+1; X['famsize']=fs; X['alone']=(fs==1).astype(int)
        if 'cabin' in use:
            X['hascabin']=d.Cabin.notna().astype(int)
            X['deck']=d.Cabin.str[0].map({'A':1,'B':2,'C':3,'D':4,'E':5,'F':6,'G':7}).fillna(0)
        if 'ticket' in use:
            g = ref.groupby('Ticket').Survived.agg(['mean','count'])
            prior = ref.Survived.mean()
            m = (g['mean']*g['count']+prior*3)/(g['count']+3)     # 平滑
            known = d.Ticket.map(m)
            X['tix_surv'] = known.fillna(prior)
            X['tix_known'] = known.notna().astype(int)
        if 'embarked' in use:
            X['emb_S']=(d.Embarked=='S').astype(int); X['emb_C']=(d.Embarked=='C').astype(int)
        return X.values.astype(float)
    return f(dtr, dtr), f(dva, dtr)

MODELS = {
 'logreg': (lambda: LogisticRegression(max_iter=2000, C=0.5), True),
 'lgbm'  : (lambda: lgb.LGBMClassifier(n_estimators=200, learning_rate=0.05,
             num_leaves=8, min_child_samples=15, verbose=-1, random_state=42), False),
 'extratrees': (lambda: ExtraTreesClassifier(400, min_samples_leaf=4,
             n_jobs=-1, random_state=42), False),
 'knn'   : (lambda: KNeighborsClassifier(15), True),
}

def run(use, model='lgbm'):
    """回傳 OOF 機率、fold 準確率(0.5 閾值)"""
    oof = np.zeros(len(ytr)); fold_acc=[]
    f, scale = MODELS[model]
    for tr, va in folds:
        Xa, Xb = build(tr_df.iloc[tr], tr_df.iloc[va], use)
        if scale:
            sc=StandardScaler().fit(Xa); Xa,Xb=sc.transform(Xa),sc.transform(Xb)
        m=f().fit(Xa, ytr[tr])
        p=m.predict_proba(Xb)[:,1]
        oof[va]=oof[va]*0  # RepeatedKFold 會重複覆蓋;改為累加
        fold_acc.append(accuracy_score(ytr[va], p>0.5))
    # RepeatedKFold:重跑一次取平均 OOF
    oof=np.zeros(len(ytr)); cnt=np.zeros(len(ytr))
    for tr,va in folds:
        Xa,Xb=build(tr_df.iloc[tr],tr_df.iloc[va],use)
        if scale:
            sc=StandardScaler().fit(Xa); Xa,Xb=sc.transform(Xa),sc.transform(Xb)
        m=f().fit(Xa,ytr[tr]); oof[va]+=m.predict_proba(Xb)[:,1]; cnt[va]+=1
    oof/=cnt
    return oof, np.mean(fold_acc), np.std(fold_acc)

use0=('base','embarked')
oof0, acc0, std0 = run(use0)
print(f"基線|LGBM 基本特徵:CV {acc0:.4f} ± {std0:.4f}(fold std)")
NOISE = 0.5*std0
print(f"→ 噪音門檻 = 0.5 × fold std = {NOISE:.4f}(低於此的『提升』不算數)")

print()
print("═"*66)
print("階段 3|特徵迭代(一次一組,過噪音門檻才保留)+ 消融")
print("═"*66)
cur=list(use0); cur_acc=acc0
for blk in ['title','family','cabin','ticket']:
    oof_,a_,s_=run(tuple(cur+[blk]))
    d=a_-cur_acc
    keep = d>NOISE
    print(f"+{blk:8s}: CV {a_:.4f} ({d:+.4f}) {'✅ 保留' if keep else '✗ 砍掉(<噪音門檻)'}")
    if keep: cur.append(blk); cur_acc=a_
print(f"最終特徵組:{cur}")

print("\n消融盤點(C5):")
oof_full, acc_full, std_full = run(tuple(cur))
for blk in [b for b in cur if b not in ('base',)]:
    rest=tuple(b for b in cur if b!=blk)
    _,a_,_=run(rest)
    print(f"  移除 {blk:8s} → 掉分 {acc_full-a_:+.4f}")

print()
print("═"*66)
print("階段 2+4|多樣化模型 → OOF 池 → 防過擬合爬山集成")
print("═"*66)
oofs={}; stats={}
for name in MODELS:
    o,a,s=run(tuple(cur),name)
    oofs[name]=o; stats[name]=(a,s)
    print(f"  {name:10s} CV {a:.4f} ± {s:.4f}")
# 閾值搜尋(指標是 Accuracy)
def best_th(p):
    ths=np.arange(0.3,0.71,0.01)
    return ths[int(np.argmax([accuracy_score(ytr,p>t) for t in ths]))]
# 爬山:top-2 初始化 + 可重複選取(Caruana)
order=sorted(oofs,key=lambda n:stats[n][0],reverse=True)
ens=(oofs[order[0]]+oofs[order[1]])/2; weights={order[0]:1,order[1]:1}
def acc_of(p): return accuracy_score(ytr,p>best_th(p))
score=acc_of(ens)
for _ in range(20):
    cand=None;cb=score
    for n in oofs:
        trial=(ens*sum(weights.values())+oofs[n])/(sum(weights.values())+1)
        s=acc_of(trial)
        if s>cb+1e-4: cb,cand=s,n
    if not cand: break
    ens=(ens*sum(weights.values())+oofs[cand])/(sum(weights.values())+1)
    weights[cand]=weights.get(cand,0)+1; score=cb
th=best_th(ens)
print(f"  集成成員權重:{weights}|OOF CV {score:.4f}(閾值 {th:.2f})")

print()
print("═"*66)
print("階段 5|兩份提交 → 模擬私榜揭曉")
print("═"*66)
def ho_prob(model):
    f,scale=MODELS[model]
    Xa,Xb=build(tr_df,ho_df,tuple(cur))
    if scale:
        sc=StandardScaler().fit(Xa);Xa,Xb=sc.transform(Xa),sc.transform(Xb)
    return f().fit(Xa,ytr).predict_proba(Xb)[:,1]
sub1=ho_prob(order[0])                                  # 提交1:CV最佳單模
tot=sum(weights.values())
sub2=sum(ho_prob(n)*w for n,w in weights.items())/tot   # 提交2:穩健集成
g=accuracy_score(yho,(ho_df.Sex=='female').astype(int))
p1=accuracy_score(yho,sub1>best_th(oofs[order[0]]))
p2=accuracy_score(yho,sub2>th)
print(f"性別規則基準       私榜 {g:.4f}")
print(f"提交1|最佳單模({order[0]}) CV {stats[order[0]][0]:.4f} → 私榜 {p1:.4f}(差 {stats[order[0]][0]-p1:+.4f})")
print(f"提交2|穩健集成           CV {score:.4f} → 私榜 {p2:.4f}(差 {score-p2:+.4f})")
print(f"\n判定:CV-私榜差距是否落在噪音範圍(±{std_full:.3f})內?"
      f" 提交1 {'✅' if abs(stats[order[0]][0]-p1)<2*std_full else '❌'} /"
      f" 提交2 {'✅' if abs(score-p2)<2*std_full else '❌'}")
