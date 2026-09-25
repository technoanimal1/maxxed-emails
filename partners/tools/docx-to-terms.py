import zipfile, html, re, io
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
SRC='/root/.claude/uploads/a7acb09c-46c9-5667-977f-9edd357f636e/49ebf12e-TC.docx'
z=zipfile.ZipFile(SRC)

# ---- relationships (hyperlink targets)
rels={}
rt=ET.fromstring(z.read('word/_rels/document.xml.rels'))
for r in rt:
    rels[r.get('Id')]=r.get('Target')

# ---- numbering definitions
absnum={}
nx=ET.fromstring(z.read('word/numbering.xml'))
for a in nx.iter(W+'abstractNum'):
    lv={}
    for l in a.findall(W+'lvl'):
        il=int(l.get(W+'ilvl'))
        fmt=l.find(W+'numFmt'); txt=l.find(W+'lvlText'); st=l.find(W+'start')
        lv[il]=(fmt.get(W+'val') if fmt is not None else 'decimal',
                txt.get(W+'val') if txt is not None else '%1.',
                int(st.get(W+'val')) if st is not None else 1)
    absnum[a.get(W+'abstractNumId')]=lv
num2abs={}
for x in nx.findall(W+'num'):
    a=x.find(W+'abstractNumId')
    num2abs[x.get(W+'numId')]=a.get(W+'val')

ROMAN=[(1000,'m'),(900,'cm'),(500,'d'),(400,'cd'),(100,'c'),(90,'xc'),(50,'l'),(40,'xl'),(10,'x'),(9,'ix'),(5,'v'),(4,'iv'),(1,'i')]
def roman(n):
    out=''
    for v,s in ROMAN:
        while n>=v: out+=s; n-=v
    return out
def fmtnum(n, f):
    if f=='decimal': return str(n)
    if f=='lowerLetter': return chr(ord('a')+(n-1)%26)
    if f=='upperLetter': return chr(ord('A')+(n-1)%26)
    if f=='lowerRoman': return roman(n)
    if f=='upperRoman': return roman(n).upper()
    if f=='bullet': return '•'
    return str(n)

counters={}   # numId -> {ilvl: current}
def label(numId, ilvl):
    lv=absnum.get(num2abs.get(numId,''),{})
    if ilvl not in lv: return ''
    fmt,txt,start=lv[ilvl]
    c=counters.setdefault(numId,{})
    c[ilvl]=start if ilvl not in c else c[ilvl]+1
    for deeper in [k for k in c if k>ilvl]:
        del c[deeper]
    if fmt=='bullet': return txt
    out=txt
    for i in range(0,9):
        ph='%%%d'%(i+1)
        if ph in out:
            f_i=lv.get(i,('decimal','',1))[0]
            v=c.get(i, lv.get(i,('decimal','',1))[2])
            out=out.replace(ph, fmtnum(v,f_i))
    return out

def runs_html(node):
    """Inline HTML for a paragraph, preserving bold/italic and hyperlinks."""
    parts=[]
    def emit_run(r, href=None):
        t=''.join(x.text or '' for x in r.iter(W+'t'))
        if r.find('.//'+W+'tab') is not None and not t: t=' '
        if not t: return
        s=html.escape(t)
        rpr=r.find(W+'rPr')
        if rpr is not None:
            if rpr.find(W+'b') is not None: s='<strong>%s</strong>'%s
            if rpr.find(W+'i') is not None: s='<em>%s</em>'%s
        if href:
            s='<a href="%s" target="_blank" rel="noopener">%s</a>'%(html.escape(href), s)
        parts.append(s)
    for child in node:
        if child.tag==W+'r': emit_run(child)
        elif child.tag==W+'hyperlink':
            href=rels.get(child.get(R+'id'),'')
            for r in child.findall(W+'r'): emit_run(r, href)
        elif child.tag==W+'ins':
            for r in child.iter(W+'r'): emit_run(r)
    out=''.join(parts)
    for t in ('strong','em'):
        out=re.sub(r'</%s>(\s*)<%s>'%(t,t), r'\1', out)
    return out

def autolink(s):
    """Turn bare emails and URLs in already-escaped HTML into links, outside tags."""
    def sub_text(seg):
        seg=re.sub(r'(?<![\w@.])([\w.+-]+@[\w-]+\.[\w.]{2,})', r'<a href="mailto:\1">\1</a>', seg)
        seg=re.sub(r'(?<!["=/\w])(https?://[^\s<)\]]+[^\s<)\].,;])',
                   r'<a href="\1" target="_blank" rel="noopener">\1</a>', seg)
        return seg
    out=[]; i=0; in_a=0
    for m in re.finditer(r'<[^>]+>', s):
        seg=s[i:m.start()]
        out.append(seg if in_a else sub_text(seg))
        tag=m.group(0)
        if tag.startswith('<a '): in_a+=1
        elif tag.startswith('</a'): in_a=max(0, in_a-1)
        out.append(tag); i=m.end()
    out.append(s[i:] if in_a else sub_text(s[i:]))
    return ''.join(out)

doc=ET.fromstring(z.read('word/document.xml'))
body=doc.find(W+'body')
blocks=[]; toc=[]; sec_i=0
for p in body.findall(W+'p'):
    ppr=p.find(W+'pPr')
    style=''
    if ppr is not None:
        st=ppr.find(W+'pStyle')
        if st is not None: style=st.get(W+'val')
    numpr=ppr.find(W+'numPr') if ppr is not None else None
    lbl=''
    if numpr is not None:
        nid=numpr.find(W+'numId'); il=numpr.find(W+'ilvl')
        if nid is not None:
            lbl=label(nid.get(W+'val'), int(il.get(W+'val')) if il is not None else 0)
    txt=runs_html(p)
    plain=re.sub(r'<[^>]+>','',txt).strip()
    if not plain and not lbl:
        continue
    txt=autolink(txt)
    all_bold = bool(p.findall('.//'+W+'r')) and all(
        r.find(W+'rPr') is not None and r.find(W+'rPr').find(W+'b') is not None
        for r in p.findall('.//'+W+'r') if ''.join(t.text or '' for t in r.iter(W+'t')).strip())
    is_head = style in ('Heading1','Heading2') or (lbl and all_bold and len(plain)<70 and not plain.endswith('.'))
    if is_head:
        sec_i+=1
        sid='s%d'%sec_i
        head=(lbl.rstrip('.')+'. ' if lbl else '')+html.unescape(plain)
        toc.append((sid, head, 1 if head.count('.')>1 else 0))
        blocks.append('<h2 id="%s" class="h-%d">%s</h2>'%(sid, 1 if head.count('.')>1 else 0, html.escape(head)))
    elif lbl:
        depth=1 if lbl.startswith('(') or lbl=='•' else 0
        blocks.append('<p class="cl cl-%d"><span class="cn">%s</span><span class="ct">%s</span></p>'
                      % (depth, html.escape(lbl), txt))
    elif style=='Title':
        blocks.append('<p class="p">%s</p>'%txt)
    else:
        blocks.append('<p class="p">%s</p>'%txt)

def visible(b):
    return html.unescape(re.sub(r'<[^>]+>','',b)).strip()

# merge identical adjacent links ("…@x.com" + ".")
def fuse_links(b):
    return re.sub(r'</a><a href="([^"]+)"[^>]*>', lambda m: '', b) if b.count('href') > 1 and len(set(re.findall(r'href="([^"]+)"', b)))==1 else b

# a Word paragraph break mid-sentence should not become a paragraph break on the page
merged=[]
for b in blocks:
    prev = merged[-1] if merged else ''
    if (merged and b.startswith('<p class="p">') and not prev.startswith('<h2')
            and visible(prev) and visible(prev)[-1] not in '.:;?!\u2022'):
        inner=b[len('<p class="p">'):-len('</p>')]
        if prev.endswith('</span></p>'):
            head, tail = prev[:-len('</span></p>')], '</span></p>'
        elif prev.endswith('</p>'):
            head, tail = prev[:-len('</p>')], '</p>'
        else:
            head = tail = None
        if head is not None:
            merged[-1]=fuse_links(head + ' ' + inner + tail)
            continue
    merged.append(b)
blocks=merged

io.open('/tmp/tc_body.html','w',encoding='utf-8').write('\n'.join(blocks))
io.open('/tmp/tc_toc.html','w',encoding='utf-8').write('\n'.join(
    '<a class="toc-%d" href="#%s">%s</a>'%(d,i,html.escape(t)) for i,t,d in toc))
print('blocks',len(blocks),'sections',len(toc))
for t in toc[:20]: print(' ',t[1][:80])
