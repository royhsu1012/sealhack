"""L2 驗證第二批:C6 OOF 必要性 / C7 CV-LB 同向法則 / C8 代理判定式"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from sklearn.model_selection import StratifiedKFold, GroupKFold
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
from scipy.stats import spearmanr
import lightgbm as lgb

rng = np.random.default_rng(7)
def lgbm(n=250): return lgb.LGBMClassifier(n_estimators=n,learning_rate=0.05,num_leaves=31,verbose=-1,random_state=42)

print("="*70)
print("C6|Stacking 的第二層必須用 OOF,用 in-sample 預測 = 洩漏")
print("="*70)
N=20000; cut=int(N*0.8)
X = rng.normal(size=(N,12))
logit = np.sin(X[:,0]*2)+X[:,1]*X[:,2]*0.8+X[:,3]**2*0.4+X[:,4]*0.9-X[:,5]*0.7
y = (logit+rng.logistic(size=N)*1.2>0).astype(int)
Xtr,ytr,Xho,yho = X[:cut],y[:cut],X[cut:],y[cut:]
folds=list(StratifiedKFold(5,shuffle=True,random_state=42).split(Xtr,ytr))
sc=StandardScaler().fit(Xtr)
base={'lgbm':(lambda:lgbm(),0),'et':(lambda:ExtraTreesClassifier(300,n_jobs=-1,random_state=42),0),
      'mlp':(lambda:MLPClassifier((64,32),max_iter=250,random_state=42),1)}

# 正確:OOF 當第二層特徵
oof=np.zeros((cut,3)); hop=np.zeros((N-cut,3))
for j,(name,(f,s)) in enumerate(base.items()):
    for tr,va in folds:
        m=f(); Xa,Xb=(sc.transform(Xtr[tr]),sc.transform(Xtr[va])) if s else (Xtr[tr],Xtr[va])
        m.fit(Xa,ytr[tr]); oof[va,j]=m.predict_proba(Xb)[:,1]
        Xh=sc.transform(Xho) if s else Xho
        hop[:,j]+=m.predict_proba(Xh)[:,1]/5
meta=LogisticRegression(max_iter=1000)
# 正確版的「表面分數」:meta 在 OOF 上做內部 CV
app_ok=np.mean([roc_auc_score(ytr[v],LogisticRegression(max_iter=1000).fit(oof[t],ytr[t]).predict_proba(oof[v])[:,1])
                for t,v in StratifiedKFold(5,shuffle=True,random_state=1).split(oof,ytr)])
meta.fit(oof,ytr); ho_ok=roc_auc_score(yho,meta.predict_proba(hop)[:,1])

# 洩漏:base 用全 train 訓練,in-sample 預測餵第二層
ins=np.zeros((cut,3)); hop2=np.zeros((N-cut,3))
for j,(name,(f,s)) in enumerate(base.items()):
    m=f(); Xa=sc.transform(Xtr) if s else Xtr
    m.fit(Xa,ytr)
    ins[:,j]=m.predict_proba(Xa)[:,1]
    hop2[:,j]=m.predict_proba(sc.transform(Xho) if s else Xho)[:,1]
app_leak=np.mean([roc_auc_score(ytr[v],LogisticRegression(max_iter=1000).fit(ins[t],ytr[t]).predict_proba(ins[v])[:,1])
                  for t,v in StratifiedKFold(5,shuffle=True,random_state=1).split(ins,ytr)])
meta2=LogisticRegression(max_iter=1000).fit(ins,ytr)
ho_leak=roc_auc_score(yho,meta2.predict_proba(hop2)[:,1])
print(f"正確(OOF)   :表面 {app_ok:.4f} → 私榜 {ho_ok:.4f}(差 {app_ok-ho_ok:+.4f})")
print(f"洩漏(in-sample):表面 {app_leak:.4f} → 私榜 {ho_leak:.4f}(差 {app_leak-ho_leak:+.4f})")
c6 = (app_leak-ho_leak) > 3*abs(app_ok-ho_ok) and ho_ok >= ho_leak-0.002

print()
print("="*70)
print("C7|Public LB 太小雜訊大 → 方向判斷該信 CV;同向檢查能偵測切法錯誤")
print("="*70)
# 12 個遞增實驗:逐步啟用有訊號的特徵
Nf=16; X7=rng.normal(size=(N,Nf))
wtrue=np.zeros(Nf); wtrue[:8]=rng.normal(size=8)*0.5
y7=(X7@wtrue+np.sin(X7[:,0]*2)*0.6+rng.logistic(size=N)*1.1>0).astype(int)
X7tr,y7tr,X7ho,y7ho=X7[:cut],y7[:cut],X7[cut:],y7[cut:]
pub_idx=rng.choice(N-cut,800,replace=False)
ladder=[3,4,5,6,7,8,9,10,11,12,13,14]     # 逐步給更多特徵
cv_s=[];pr_s=[];pb_s=[]
for k in ladder:
    cols=list(range(k))
    oofk=np.zeros(cut)
    for tr,va in folds:
        m=lgbm(200).fit(X7tr[tr][:,cols],y7tr[tr]); oofk[va]=m.predict_proba(X7tr[va][:,cols])[:,1]
    cv_s.append(roc_auc_score(y7tr,oofk))
    m=lgbm(200).fit(X7tr[:,cols],y7tr); p=m.predict_proba(X7ho[:,cols])[:,1]
    pr_s.append(roc_auc_score(y7ho,p)); pb_s.append(roc_auc_score(y7ho[pub_idx],p[pub_idx]))
def agree(a,b):
    da=np.sign(np.diff(a)); db=np.sign(np.diff(b)); return float(np.mean(da==db))
ag_cv, ag_pb = agree(cv_s,pr_s), agree(pb_s,pr_s)
print(f"CV(n=16000) 與私榜方向一致率:{ag_cv:.0%}")
print(f"Public(n=800) 與私榜方向一致率:{ag_pb:.0%}")
print(f"若 CV 無效(擲硬幣),連續 5 次同向機率 = {0.5**5:.1%};8 次 = {0.5**8:.2%}")
c7a = ag_cv > ag_pb

# 7b:切法錯誤 → CV 與私榜脫鉤(group 資料 + 洩漏特徵)
G=300; grp=rng.integers(0,G,size=N)
geff=rng.normal(scale=0.8,size=G)
Xg=rng.normal(size=(N,8)); wg=rng.normal(size=8)*0.4
yg=(Xg@wg+geff[grp]+rng.logistic(size=N)>0).astype(int)
# 私榜 = 沒見過的 group
ho_g = grp>=240; tr_g=~ho_g
Xgtr,ygtr,gtr = Xg[tr_g],yg[tr_g],grp[tr_g]
Xgho,ygho = Xg[ho_g],yg[ho_g]
gmean = np.array([yg[tr_g][gtr==g].mean() if (gtr==g).any() else 0.5 for g in range(G)])
leakf = gmean[gtr]                       # group 目標均值(會背答案)
cvs_r=[];cvs_g=[];prs=[]
for wleak in [0.0,0.5,1.0,1.5,2.0,2.5]:
    F=np.c_[Xgtr, leakf*wleak]
    # 隨機切(錯):group 會同時出現在 train/val → 背得起來
    o=np.zeros(len(ygtr))
    for tr,va in StratifiedKFold(5,shuffle=True,random_state=42).split(F,ygtr):
        m=lgbm(150).fit(F[tr],ygtr[tr]); o[va]=m.predict_proba(F[va])[:,1]
    cvs_r.append(roc_auc_score(ygtr,o))
    # GroupKFold(對)
    o=np.zeros(len(ygtr))
    for tr,va in GroupKFold(5).split(F,ygtr,gtr):
        m=lgbm(150).fit(F[tr],ygtr[tr]); o[va]=m.predict_proba(F[va])[:,1]
    cvs_g.append(roc_auc_score(ygtr,o))
    # 私榜:新 group,洩漏特徵只能給先驗
    Fh=np.c_[Xgho, np.full(len(ygho), ygtr.mean())*wleak]
    m=lgbm(150).fit(F,ygtr); prs.append(roc_auc_score(ygho,m.predict_proba(Fh)[:,1]))
ag_wrong, ag_right = agree(cvs_r,prs), agree(cvs_g,prs)
print(f"\n隨機切 CV 與私榜方向一致率:{ag_wrong:.0%}(脫鉤 → 警訊)")
print(f"GroupKFold CV 與私榜一致率:{ag_right:.0%}")
c7b = ag_right > ag_wrong

print()
print("="*70)
print("C8|代理實驗判定式 ρ² > 成本比(純蒙地卡羅,決策理論主張)")
print("="*70)
IDEAS=40; BUDGET=60; C_FULL,C_PROXY=5,1
def mc(sig_p, reps=500):
    got_p=[];got_f=[];rhos=[]
    for r in range(reps):
        rg=np.random.default_rng(r)
        true=np.r_[rg.normal(0,0.001,34), np.abs(rg.normal(0.004,0.002,6))]
        rg.shuffle(true)
        # 代理策略:全篩(40)→ 前4做全量(20)
        proxy=true+rg.normal(0,sig_p,IDEAS)
        top=np.argsort(proxy)[-4:]
        fullobs=true[top]+rg.normal(0,0.0008,4)
        got_p.append(true[top[np.argmax(fullobs)]])
        rhos.append(spearmanr(proxy,true).statistic)
        # 全量策略:隨機 12 個做全量
        pick=rg.choice(IDEAS,BUDGET//C_FULL,replace=False)
        fo=true[pick]+rg.normal(0,0.0008,len(pick))
        got_f.append(true[pick[np.argmax(fo)]])
    return np.mean(got_p),np.mean(got_f),np.mean(rhos)
print(f"{'代理雜訊':>8} {'ρ':>6} {'ρ²':>6} {'代理策略':>9} {'全量策略':>9}  判定式預測(成本比=0.2)")
cross_ok=[]
for sig in [0.0015,0.003,0.005,0.008,0.015]:
    gp,gf,rho=mc(sig)
    pred = "用代理" if rho**2>C_PROXY/C_FULL else "用全量"
    actual = "代理贏" if gp>gf else "全量贏"
    match = (rho**2>0.2)==(gp>gf)
    cross_ok.append(match)
    print(f"{sig:8.4f} {rho:6.2f} {rho**2:6.2f} {gp:9.5f} {gf:9.5f}  預測:{pred} / 實際:{actual} {'✓' if match else '✗'}")
c8 = sum(cross_ok)>=4

print()
print("="*70)
print("結果總表(第二批)")
for cid,claim,ok in [("C6","第二層必須用 OOF,in-sample = 洩漏",c6),
    ("C7a","小 public LB 方向判斷不如 CV 可靠",c7a),
    ("C7b","CV-私榜脫鉤可偵測切法錯誤",c7b),
    ("C8","ρ² > 成本比 判定式方向正確",c8)]:
    print(f"{cid}:{claim:30s} {'✅ 證實' if ok else '❌ 未證實'}")
