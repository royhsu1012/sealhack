"""方法論 L2 驗證:把核心主張變成可跑的實驗。
每個主張:建一個已知結構的資料集 → 照方法論做 vs 違反方法論做 → 用「未來/私榜」holdout 揭曉。
"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from sklearn.model_selection import StratifiedKFold
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

rng = np.random.default_rng(42)
N, F = 24000, 20

def lgbm():
    return lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05,
                              num_leaves=31, verbose=-1, random_state=42)

print("="*72)
print("主張 1|時間序列用隨機 KFold,CV 會虛高(用未來預測過去)")
print("="*72)
# 概念漂移資料:係數隨時間旋轉
t = np.linspace(0, 1, N)
X = rng.normal(size=(N, F))
w0, w1 = rng.normal(size=F), rng.normal(size=F)
logit = (X * ((1-t)[:,None]*w0 + t[:,None]*w1)).sum(1) * 0.9
y = (logit + rng.logistic(size=N) > 0).astype(int)
# 前 80% 當 train,後 20% 當「私榜」(未來)
cut = int(N*0.8)
Xtr, ytr, Xho, yho = X[:cut], y[:cut], X[cut:], y[cut:]

# (a) 違反:隨機 StratifiedKFold
skf = StratifiedKFold(5, shuffle=True, random_state=42)
aucs=[]
for tr,va in skf.split(Xtr,ytr):
    m=lgbm().fit(Xtr[tr],ytr[tr]); aucs.append(roc_auc_score(ytr[va],m.predict_proba(Xtr[va])[:,1]))
cv_rand=np.mean(aucs)
# (b) 遵守:時間切分(擴張窗,3 段)
aucs=[]
for fr in (0.5,0.65,0.8):
    a,b=int(cut*fr),int(cut*(fr+0.15)) if fr<0.8 else (int(cut*0.8),cut)
    a=int(cut*fr); b=min(cut,int(cut*(fr+0.15)))
    m=lgbm().fit(Xtr[:a],ytr[:a]); aucs.append(roc_auc_score(ytr[a:b],m.predict_proba(Xtr[a:b])[:,1]))
cv_time=np.mean(aucs)
# 私榜真相
m=lgbm().fit(Xtr,ytr); ho=roc_auc_score(yho,m.predict_proba(Xho)[:,1])
print(f"隨機 KFold CV : {cv_rand:.4f}   ← 樂觀")
print(f"時間切分  CV : {cv_time:.4f}")
print(f"私榜(未來): {ho:.4f}")
print(f"→ 隨機切高估 {cv_rand-ho:+.4f};時間切誤差 {cv_time-ho:+.4f}")
c1 = (cv_rand-ho) > 2.5*abs(cv_time-ho)

print()
print("="*72)
print("主張 2|Target encoding 不在 fold 內做 = 洩漏,CV 虛高、實戰崩")
print("="*72)
# 一般資料 + 高基數類別(與 y 有弱關聯)
X2 = rng.normal(size=(N, 10))
w = rng.normal(size=10)
cat = rng.integers(0, 800, size=N)              # 高基數
cat_eff = rng.normal(scale=0.3, size=800)
logit2 = X2@w*0.5 + cat_eff[cat]
y2 = (logit2 + rng.logistic(size=N) > 0).astype(int)
idx = rng.permutation(N); X2,cat,y2 = X2[idx],cat[idx],y2[idx]
Xtr2,ctr,ytr2 = X2[:cut],cat[:cut],y2[:cut]
Xho2,cho,yho2 = X2[cut:],cat[cut:],y2[cut:]

def te_map(c_arr, y_arr, smooth=20):
    prior = y_arr.mean()
    s={}; 
    import collections
    cnt=collections.Counter(c_arr)
    sm=collections.defaultdict(float)
    for c,yy in zip(c_arr,y_arr): sm[c]+=yy
    return {c:(sm[c]+prior*smooth)/(cnt[c]+smooth) for c in cnt}, prior

skf = StratifiedKFold(5, shuffle=True, random_state=42)
def run_te(leaky):
    oof=np.zeros(cut); 
    if leaky:
        mp,pr = te_map(ctr,ytr2)          # ← 用全部 train 算(洩漏)
    for tr,va in skf.split(Xtr2,ytr2):
        if not leaky:
            mp,pr = te_map(ctr[tr],ytr2[tr])   # ← fold 內算(正確)
        te_tr = np.array([mp.get(c,pr) for c in ctr[tr]])
        te_va = np.array([mp.get(c,pr) for c in ctr[va]])
        m=lgbm().fit(np.c_[Xtr2[tr],te_tr],ytr2[tr])
        oof[va]=m.predict_proba(np.c_[Xtr2[va],te_va])[:,1]
    cv=roc_auc_score(ytr2,oof)
    # 私榜:TE 只能用 train 算(這對兩者一致)
    mp,pr = te_map(ctr,ytr2)
    m=lgbm().fit(np.c_[Xtr2,[mp.get(c,pr) for c in ctr]],ytr2)
    ho=roc_auc_score(yho2,m.predict_proba(np.c_[Xho2,[mp.get(c,pr) for c in cho]])[:,1])
    return cv,ho
cv_leak,ho_leak = run_te(True)
cv_ok,ho_ok     = run_te(False)
print(f"洩漏版 TE:CV {cv_leak:.4f} → 私榜 {ho_leak:.4f}(差 {cv_leak-ho_leak:+.4f})")
print(f"正確版 TE:CV {cv_ok:.4f} → 私榜 {ho_ok:.4f}(差 {cv_ok-ho_ok:+.4f})")
c2 = (cv_leak-ho_leak) > 2.5*abs(cv_ok-ho_ok)

print()
print("="*72)
print("主張 3+4|OOF 爬山集成 > 最佳單模;弱模型(CV 較差)仍可能加分")
print("="*72)
# 非線性資料讓模型家族各有盲點
X3 = rng.normal(size=(N,12))
logit3 = (np.sin(X3[:,0]*2)+X3[:,1]*X3[:,2]*0.8+X3[:,3]**2*0.4
          + X3[:,4]*0.9 - X3[:,5]*0.7)
y3 = (logit3 + rng.logistic(size=N)*1.2 > 0).astype(int)
Xtr3,ytr3,Xho3,yho3 = X3[:cut],y3[:cut],X3[cut:],y3[cut:]

folds = list(StratifiedKFold(5,shuffle=True,random_state=42).split(Xtr3,ytr3))
models = {
 'lgbm': lambda: lgbm(),
 'logreg': lambda: LogisticRegression(max_iter=1000),
 'knn': lambda: KNeighborsClassifier(50),
}
oofs={}; hos={}
sc = StandardScaler().fit(Xtr3)
for name,f in models.items():
    oof=np.zeros(cut); ho_pred=np.zeros(len(yho3))
    for tr,va in folds:
        m=f()
        Xa,Xb = (Xtr3[tr],Xtr3[va]) if name=='lgbm' else (sc.transform(Xtr3[tr]),sc.transform(Xtr3[va]))
        m.fit(Xa,ytr3[tr]); oof[va]=m.predict_proba(Xb)[:,1]
        Xh = Xho3 if name=='lgbm' else sc.transform(Xho3)
        ho_pred += m.predict_proba(Xh)[:,1]/len(folds)
    oofs[name]=oof; hos[name]=ho_pred
    print(f"{name:7s} OOF-CV {roc_auc_score(ytr3,oof):.4f}   私榜 {roc_auc_score(yho3,ho_pred):.4f}")

# 爬山(在 OOF 上找權重),同權重套私榜
best = max(oofs, key=lambda n: roc_auc_score(ytr3,oofs[n]))
ens_oof = oofs[best].copy(); ens_ho = hos[best].copy(); used={best:1.0}
score = roc_auc_score(ytr3,ens_oof)
for _ in range(30):
    cand=None; cbest=score
    for n in oofs:
        for wgt in np.arange(0.05,0.55,0.05):
            s=roc_auc_score(ytr3, ens_oof*(1-wgt)+oofs[n]*wgt)
            if s>cbest: cbest,cand=s,(n,wgt)
    if cand is None: break
    n,wgt=cand
    ens_oof=ens_oof*(1-wgt)+oofs[n]*wgt
    ens_ho =ens_ho*(1-wgt)+hos[n]*wgt
    used[n]=used.get(n,0)+wgt; score=cbest
best_single_ho = roc_auc_score(yho3,hos[best])
ens_ho_auc = roc_auc_score(yho3,ens_ho)
print(f"\n最佳單模({best})私榜: {best_single_ho:.4f}")
print(f"爬山集成       私榜: {ens_ho_auc:.4f}  ({ens_ho_auc-best_single_ho:+.4f})")
print(f"集成用到的模型: {sorted(used)}")
c3 = ens_ho_auc > best_single_ho
c4 = len(used) > 1   # 弱模型被納入

print()
print("="*72)
print("主張 5|消融能正確指出「最該投資的組件」(MLE-STAR 修訂)")
print("="*72)
# 三個特徵塊:A 強訊號 / B 中 / C 純噪音
A = rng.normal(size=(N,4)); B = rng.normal(size=(N,4)); C = rng.normal(size=(N,4))
logit5 = A@rng.normal(size=4)*1.2 + B@rng.normal(size=4)*0.4
y5 = (logit5 + rng.logistic(size=N) > 0).astype(int)
X5 = np.c_[A,B,C]
Xtr5,ytr5 = X5[:cut],y5[:cut]
blocks = {'A(強)':slice(0,4),'B(中)':slice(4,8),'C(噪音)':slice(8,12)}
def cv_auc(Xm):
    oof=np.zeros(cut)
    for tr,va in StratifiedKFold(5,shuffle=True,random_state=42).split(Xm[:cut],ytr5):
        m=lgbm().fit(Xm[tr],ytr5[tr]); oof[va]=m.predict_proba(Xm[va])[:,1]
    return roc_auc_score(ytr5,oof)
full = cv_auc(Xtr5)
print(f"完整模型 CV: {full:.4f}")
drops={}
for name,sl in blocks.items():
    keep=[i for i in range(12) if not (sl.start<=i<sl.stop)]
    drops[name]=full-cv_auc(Xtr5[:,keep])
    print(f"移除 {name}: 掉分 {drops[name]:+.4f}")
order = sorted(drops,key=drops.get,reverse=True)
print(f"→ 消融排序:{' > '.join(order)}")
c5 = order[0].startswith('A') and order[-1].startswith('C')

print()
print("="*72)
print("結果總表")
for i,(claim,ok) in enumerate([
    ("時間序列隨機切分會虛高",c1),("TE 不在 fold 內做會洩漏",c2),
    ("OOF 爬山集成勝最佳單模",c3),("弱模型仍被集成採用",c4),
    ("消融正確排序組件價值",c5)],1):
    print(f"主張 {i}:{claim:24s} {'✅ 證實' if ok else '❌ 未證實'}")
