"""修正版:主張 1(放寬為相對比較+新副主張)與主張 3(實力相近的多樣家族)"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from sklearn.model_selection import StratifiedKFold
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import lightgbm as lgb
rng = np.random.default_rng(42)
N=24000; cut=int(N*0.8)
def lgbm(): return lgb.LGBMClassifier(n_estimators=300,learning_rate=0.05,num_leaves=31,verbose=-1,random_state=42)

print("主張 3 修正|前提補上:『實力相近』的多樣家族才有集成紅利")
X = rng.normal(size=(N,12))
logit = (np.sin(X[:,0]*2)+X[:,1]*X[:,2]*0.8+X[:,3]**2*0.4+X[:,4]*0.9-X[:,5]*0.7)
y = (logit+rng.logistic(size=N)*1.2>0).astype(int)
Xtr,ytr,Xho,yho = X[:cut],y[:cut],X[cut:],y[cut:]
folds=list(StratifiedKFold(5,shuffle=True,random_state=42).split(Xtr,ytr))
sc=StandardScaler().fit(Xtr)
models={
 'lgbm':(lambda:lgbm(),False),
 'extratrees':(lambda:ExtraTreesClassifier(400,n_jobs=-1,random_state=42),False),
 'mlp':(lambda:MLPClassifier((64,32),max_iter=300,random_state=42),True),
}
oofs={};hos={}
for name,(f,scale) in models.items():
    oof=np.zeros(cut);hp=np.zeros(N-cut)
    for tr,va in folds:
        m=f()
        Xa,Xb,Xh=(sc.transform(Xtr[tr]),sc.transform(Xtr[va]),sc.transform(Xho)) if scale else (Xtr[tr],Xtr[va],Xho)
        m.fit(Xa,ytr[tr]);oof[va]=m.predict_proba(Xb)[:,1];hp+=m.predict_proba(Xh)[:,1]/5
    oofs[name]=oof;hos[name]=hp
    print(f"  {name:10s} OOF {roc_auc_score(ytr,oof):.4f}  私榜 {roc_auc_score(yho,hp):.4f}")
best=max(oofs,key=lambda n:roc_auc_score(ytr,oofs[n]))
ens_o=oofs[best].copy();ens_h=hos[best].copy();score=roc_auc_score(ytr,ens_o);used={best}
for _ in range(30):
    cand=None;cb=score
    for n in oofs:
        for w in np.arange(0.05,0.55,0.05):
            s=roc_auc_score(ytr,ens_o*(1-w)+oofs[n]*w)
            if s>cb+1e-5: cb,cand=s,(n,w)
    if not cand: break
    n,w=cand;ens_o=ens_o*(1-w)+oofs[n]*w;ens_h=ens_h*(1-w)+hos[n]*w;used.add(n);score=cb
bs=roc_auc_score(yho,hos[best]);es=roc_auc_score(yho,ens_h)
print(f"  最佳單模 {best} 私榜 {bs:.4f} | 集成 {es:.4f} ({es-bs:+.4f}) | 成員 {sorted(used)}")
print(f"  → 主張 3(修正:實力相近+多樣):{'✅ 證實' if es>bs else '❌ 未證實'}")

print()
print("主張 1 修正|隨機切比時間切更虛高;且漂移下時間切仍樂觀(新副主張)")
t=np.linspace(0,1,N);Xd=rng.normal(size=(N,20))
w0,w1=rng.normal(size=20),rng.normal(size=20)
yd=((Xd*((1-t)[:,None]*w0+t[:,None]*w1)).sum(1)*0.9+rng.logistic(size=N)>0).astype(int)
Xtr,ytr,Xho,yho=Xd[:cut],yd[:cut],Xd[cut:],yd[cut:]
aucs=[]
for tr,va in StratifiedKFold(5,shuffle=True,random_state=42).split(Xtr,ytr):
    m=lgbm().fit(Xtr[tr],ytr[tr]);aucs.append(roc_auc_score(ytr[va],m.predict_proba(Xtr[va])[:,1]))
cvr=np.mean(aucs)
aucs=[]
for fr in (0.5,0.65,0.8):
    a=int(cut*fr);b=min(cut,int(cut*(fr+0.15)))
    m=lgbm().fit(Xtr[:a],ytr[:a]);aucs.append(roc_auc_score(ytr[a:b],m.predict_proba(Xtr[a:b])[:,1]))
cvt=np.mean(aucs)
m=lgbm().fit(Xtr,ytr);ho=roc_auc_score(yho,m.predict_proba(Xho)[:,1])
gr,gt=cvr-ho,cvt-ho
print(f"  隨機切高估 {gr:+.4f} | 時間切高估 {gt:+.4f} | 私榜 {ho:.4f}")
print(f"  → 1a 隨機切更虛高(≥1.3×):{'✅ 證實' if gr>1.3*gt else '❌'}")
print(f"  → 1b 漂移下時間切仍樂觀(>0.02):{'✅ 證實(新增教訓)' if gt>0.02 else '❌'}")
