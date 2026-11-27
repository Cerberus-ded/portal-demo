# kit_slice.py — режет сборную картинку из прайса фабрики («двери или образцы в ряд, подписи под ними»)
# на плитки «картинка + её подпись». tiles(im) → список рамок (x0,y0,x1,y1) или None, если резать нельзя
# (подписи сбоку, заголовок сверху, одна картинка). trim(im) срезает пустые поля по краям.
import numpy as np
from PIL import Image
def bgmask(im):
    a=np.asarray(im.convert('RGBA')).astype(int)
    rgb=a[...,:3]; al=a[...,3]
    # прозрачное считаем фоном
    edge=np.concatenate([rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]])
    bg=np.median(edge,axis=0)
    d=np.abs(rgb-bg).max(axis=2)
    return (d>22)&(al>40)
def runs(prof,gap):
    idx=np.where(prof)[0]
    if not len(idx): return []
    out=[[idx[0],idx[0]]]
    for i in idx[1:]:
        if i-out[-1][1]<=gap: out[-1][1]=i
        else: out.append([i,i])
    return [(a,b+1) for a,b in out]
def tiles(im, tall=34, mincol=18, warn=None):
    m=bgmask(im); H,W=m.shape
    a_=np.asarray(im.convert('RGBA')).astype(int)
    bands=runs(m.any(axis=1),1)
    rows=[]
    for a,b in bands:
        if b-a>=tall: rows.append([(a,b),[]])
        elif rows: rows[-1][1].append((a,b))
        else: return None  # текст сверху: заголовок, не режем
    if not rows: return None
    out=[]
    for (a,b),caps in rows:
        if not caps: return None   # подписи не под картинками
        h=b-a; ca,cb=a+h//5, b-h//5          # серединка полосы: без хвостов чужих подписей
        raw=runs(m[ca:cb].any(axis=0),2)
        wide=[r for r in raw if r[1]-r[0]>=mincol]
        if not wide: return None
        medw=float(np.median([r[1]-r[0] for r in wide]))
        # белый образец на белом фоне виден только рамкой: две тонкие полосы на ширину плитки
        segs=[]; i=0
        while i<len(raw):
            r=raw[i]
            if r[1]-r[0]>=mincol: segs.append(r); i+=1; continue
            j=i+1; got=None
            while j<len(raw) and raw[j][0]-r[0]<=medw*1.3:
                if raw[j][1]-raw[j][0]>=mincol: break
                if abs((raw[j][1]-r[0])-medw)<=medw*0.25: got=j
                j+=1
            if got is not None: segs.append((r[0],raw[got][1])); i=got+1
            else: i+=1
        cy0=caps[0][0]; cy1=caps[-1][1]
        ink=m[cy0:cy1].sum(axis=0)
        cuts=[]
        for (s0,s1),(t0,t1) in zip(segs,segs[1:]):
            cand=[x for x in range(s1,t0) if not m[ca:cb,x].any()]
            if not cand: return None
            best=min(ink[x] for x in cand)
            free=[x for x in cand if ink[x]==best]
            if best>0 and warn is not None: warn.append((a,s1,t0,int(best)))
            cuts.append(free[len(free)//2])
        xs=[0]+cuts+[W]
        for i,(s0,s1) in enumerate(segs):
            x0,x1=xs[i],xs[i+1]
            # верх плитки: от серединки вверх до первой пустой строки в своих столбцах
            col=m[:, s0:s1].any(axis=1)
            y0=ca
            while y0>0 and col[y0-1]: y0-=1
            y1=min(H,cy1+3)
            sub=m[y0:y1,x0:x1]; cols=np.where(sub.any(axis=0))[0]
            out.append((x0+max(0,cols[0]-3), max(0,y0-2), x0+min(x1-x0,cols[-1]+4), y1))
    return out
def trim(im, pad=4):
    m=bgmask(im)
    ys=np.where(m.any(axis=1))[0]; xs=np.where(m.any(axis=0))[0]
    if not len(ys) or not len(xs): return im
    return im.crop((max(0,xs[0]-pad), max(0,ys[0]-pad), min(im.width,xs[-1]+1+pad), min(im.height,ys[-1]+1+pad)))
if __name__=='__main__':
    import sys,os,glob
    from PIL import ImageDraw
    src=sys.argv[1]; out=sys.argv[2]; os.makedirs(out,exist_ok=True)
    for f in sorted(glob.glob(os.path.join(src,'*.png'))):
        im=Image.open(f); w=[]; t=tiles(im,warn=w)
        print(os.path.basename(f), im.size, 'whole' if t is None else len(t), 'WARN' if w else '', w[:3])
        if t:
            v=im.convert('RGB'); d=ImageDraw.Draw(v)
            for x0,y0,x1,y1 in t: d.rectangle((x0,y0,x1-1,y1-1),outline='red')
            v.save(os.path.join(out,os.path.basename(f)))
