import json, pathlib, itertools
import numpy as np
root=pathlib.Path(__file__).resolve().parents[1]
d=json.loads((root/'data/nhl.json').read_text())
history={}
samples=[]
current=d['seasons'][-1]
for g in sorted(d['games'],key=lambda g:(g['date'],g['id'])):
    for pid,name,club,goals,points in g['players']:
        h=history.setdefault(pid,[])
        if g['season']==current and len(h)>=20:
            periods=[h[-10:],h[-20:],[x for x in h if x[0]==current],h]
            if len(periods[2])>=5:
                features=[[sum(x[k] for x in a)/len(a) for a in periods] for k in (1,2)]
                samples.append((g['date'],features,[int(goals>0),int(points>0)]))
        h.append((g['season'],int(goals>0),int(points>0)))
dates=sorted(set(x[0] for x in samples))
if len(dates)<10: raise RuntimeError('Insufficient dates for chronological holdout')
cut=dates[int(len(dates)*.7)]
grid=np.array([(a,b,c,20-a-b-c) for a in range(21) for b in range(21-a) for c in range(21-a-b)])/20
baseline=np.array([.30,.35,.20,.15])
report={'cutoff':cut,'grid_size':len(grid),'minimum_history':20,'minimum_current':5,'models':{}}
for k,mode in enumerate(('goals','points')):
    def arrays(train):
        s=[x for x in samples if (x[0]<cut)==train]
        return np.array([x[1][k] for x in s]),np.array([x[2][k] for x in s])
    X,y=arrays(True); V,z=arrays(False)
    if not len(y) or not len(z): raise RuntimeError('Empty split')
    scores=np.einsum('ij,jk,ik->i',grid,X.T@X/len(y),grid)-2*grid@(X.T@y/len(y))+np.mean(y*y)
    w=grid[np.argmin(scores)]
    def metrics(weights):
        p=V@weights
        bins=[]
        for i in range(10):
            mask=(p>=i/10)&((p<(i+1)/10) if i<9 else (p<=1))
            if mask.any(): bins.append({'n':int(mask.sum()),'predicted':float(p[mask].mean()),'observed':float(z[mask].mean())})
        return {'weights':weights.tolist(),'brier':float(np.mean((p-z)**2)),'calibration':bins}
    report['models'][mode]={'train_n':len(y),'test_n':len(z),'candidate':metrics(w),'baseline':metrics(baseline),'season_only':metrics(np.array([0,0,1,0]))}
(root/'data/backtest.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
