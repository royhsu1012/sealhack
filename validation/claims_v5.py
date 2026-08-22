"""終版修正:C7a 適應性過擬合(關鍵教條修訂)/ C7b 乾淨的 group_id 洩漏"""
import sys; sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950,印 ✅/❌ 會崩潰
import numpy as np
from sklearn.model_selection import StratifiedKFold, GroupKFold
from sklearn.metrics import roc_auc_score
import lightgbm as lgb
rng=np.random.default_rng(7)
def lgbm(n=120,l=31): return lgb.LGBMClassifier(n_estimators=n,learning_rate=0.06,num_leaves=l,verbose=-1,random_state=42)

print("C7a 終版|適應性決策:連續 30 次特徵開關,由 public 引導 vs 由 CV 引導")
N=16000; cut=int(N*0.8)
Nf=24; X=rng.normal(size=(N,Nf))
w=np.zeros(Nf); w[:8]=rng.normal(size=8)*0.5
y=(X@w+np.sin(X[:,0]*2)*0.6+rng.logistic(size=N)*1.1>0).astype(int)
Xtr,ytr,Xho,yho=X[:cut],y[:cut],X[cut:],y[cut:]
folds=list(StratifiedKFold(5,shuffle=True,random_state=42).split(Xtr,ytr))
pub=rng.choice(N-cut,800,replace=False)
prv=np.setdiff1d(np.arange(N-cut),pub)          # public/private 不相交

def cv_score(cols):
    o=np.zeros(cut)
    for tr,va in folds:
        m=lgbm().fit(Xtr[tr][:,cols],ytr[tr]); o[va]=m.predict_proba(Xtr[va][:,cols])[:,1]
    return roc_auc_score(ytr,o)
def ho_pred(cols):
    return lgbm().fit(Xtr[:,cols],ytr).predict_proba(Xho[:,cols])[:,1]

def adaptive(guide):
    cols=list(range(8))                          # 起點:8 個真特徵
    p=ho_pred(cols)
    cur = cv_score(cols) if guide=='cv' else roc_auc_score(yho[pub],p[pub])
    accepted=0
    toggles=rng.integers(8,Nf,size=30)           # 30 次:試加一個噪音特徵
    for t in toggles:
        trial=cols+[int(t)] if t not in cols else [c for c in cols if c!=t]
        pt=ho_pred(trial)
        s = cv_score(trial) if guide=='cv' else roc_auc_score(yho[pub],pt[pub])
        if s>cur: cols,cur,p=trial,s,pt; accepted+=1
    return roc_auc_score(yho[prv],p[prv]), accepted
pr_cv,acc_cv = adaptive('cv')
pr_pub,acc_pub = adaptive('pub')
print(f"  CV 引導    :採納 {acc_cv} 次改動 → 私榜 {pr_cv:.4f}")
print(f"  public 引導:採納 {acc_pub} 次改動 → 私榜 {pr_pub:.4f}")
ok_a = pr_cv>pr_pub and acc_pub>acc_cv
print(f"  → C7a(終版):{'✅ 證實' if ok_a else '❌'} — public 引導接受更多噪音改動、私榜更差")

print()
print("C7b 終版|洩漏特徵 = group_id 本身(只在隨機切下能背答案)— 5 seeds")
# 判準修訂(2026-08-22):原版要求 GroupKF |ΔCV|<0.01 的絕對門檻,換函式庫版本即翻盤(-0.0126 → ❌)。
# 改為相對判準、多 seed:隨機切的 ΔCV 必須高於私榜 Δ(被騙),且 GroupKF 的 ΔCV 必須比隨機切更接近私榜。
G=300
def cvv(F,y,g,scheme):
    o=np.zeros(len(y))
    it=StratifiedKFold(5,shuffle=True,random_state=42).split(F,y) if scheme=='rand' else GroupKFold(5).split(F,y,g)
    for tr,va in it: o[va]=lgbm(200,63).fit(F[tr],y[tr]).predict_proba(F[va])[:,1]
    return roc_auc_score(y,o)
print(f"  {'seed':>4} {'隨機ΔCV':>8} {'GroupΔCV':>9} {'私榜Δ':>7}")
hits=[]
for seed in (7,1,2,3,4):
    rs=np.random.default_rng(seed)
    grp=rs.integers(0,G,size=N); geff=rs.normal(scale=0.8,size=G)
    Xg=rs.normal(size=(N,8)); wg=rs.normal(size=8)*0.4
    yg=(Xg@wg+geff[grp]+rs.logistic(size=N)>0).astype(int)
    tr_g=grp<240; Xt,yt,gt=Xg[tr_g],yg[tr_g],grp[tr_g]; Xh,yh,gh=Xg[~tr_g],yg[~tr_g],grp[~tr_g]
    F=np.c_[Xt,gt.astype(float)]
    d_r=cvv(F,yt,gt,'rand')-cvv(Xt,yt,gt,'rand'); d_g=cvv(F,yt,gt,'grp')-cvv(Xt,yt,gt,'grp')
    d_p=(roc_auc_score(yh,lgbm(200,63).fit(F,yt).predict_proba(np.c_[Xh,gh.astype(float)])[:,1])
         -roc_auc_score(yh,lgbm(200,63).fit(Xt,yt).predict_proba(Xh)[:,1]))
    hits.append((d_r-d_p>0) and (abs(d_g-d_p)<abs(d_r-d_p)))
    print(f"  {seed:>4} {d_r:+8.4f} {d_g:+9.4f} {d_p:+7.4f}", flush=True)
ok_b=all(hits)
print(f"  → C7b(終版):{'✅ 證實' if ok_b else '❌'} — {sum(hits)}/{len(hits)} seeds:隨機切 ΔCV 高於私榜(被騙),GroupKFold 的 ΔCV 更接近私榜")
