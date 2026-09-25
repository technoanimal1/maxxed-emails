import io
body=io.open('/tmp/tc_body.html',encoding='utf-8').read()
toc=io.open('/tmp/tc_toc.html',encoding='utf-8').read()
# the first block is the document's own "Terms and Conditions" title — the page has its own
body='\n'.join(l for l in body.split('\n') if 'Terms and Conditions</strong>' not in l)

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Terms and Conditions — Maxxed Partners</title>
<meta name="description" content="The Maxxed Partners Affiliate Program Agreement: terms and conditions governing membership, marketing, commission and payment." />
<meta name="theme-color" content="#050505" />
<meta name="robots" content="index, follow" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Anton&display=swap" rel="stylesheet" />
<style>
  @font-face {
    font-family: "PP Right Grotesk Compact Dark";
    src: url("https://framerusercontent.com/assets/MCsGYC4nzIhUPFZcPpY9pBD50.woff2") format("woff2");
    font-display: swap; font-style: normal; font-weight: 800;
  }
  :root {
    --bg: #050505; --surface: #0e0e0e; --surface2: #171717;
    --line: #1c1c1c; --line2: #262626;
    --accent: #8ffc80; --accent-2: #63ee4f; --accent-ink: #050505;
    --white: #ffffff; --dim: #8a8a8a; --muted: #555555;
    --display: "PP Right Grotesk Compact Dark", "Anton", "Inter", system-ui, sans-serif;
    --body: "Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    --maxw: 1240px; --gutter: clamp(20px, 5vw, 48px);
    --radius: 18px; --radius-sm: 8px;
    --bar-h: 64px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  body {
    font-family: var(--body); background: var(--bg); color: var(--white);
    line-height: 1.65; overflow-x: clip; -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; text-decoration: none; }
  .wrap { width: min(var(--maxw), 100%); margin-inline: auto; padding-inline: var(--gutter); }

  /* ── Top bar ── */
  .bar {
    position: sticky; top: 0; z-index: 20; height: var(--bar-h);
    display: flex; align-items: center;
    background: rgba(5,5,5,.86); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .bar .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .bar .mark { display: flex; align-items: center; gap: 12px; }
  .bar .mark img { width: 34px; height: auto; display: block; }
  .bar .mark span { font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); }
  .back {
    font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--dim); display: inline-flex; align-items: center; gap: 8px; transition: color .2s ease;
  }
  .back:hover { color: var(--accent); }

  /* ── Masthead ── */
  .masthead { padding: clamp(48px, 8vw, 96px) 0 clamp(28px, 4vw, 44px); border-bottom: 1px solid var(--line); }
  .eyebrow {
    font-family: var(--mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
    color: var(--accent); display: inline-flex; align-items: center; gap: 10px; margin-bottom: 18px;
  }
  .dot { width: 7px; height: 7px; background: var(--accent); transform: rotate(45deg); flex: none; }
  h1 {
    font-family: var(--display); font-weight: 800; text-transform: uppercase;
    font-size: clamp(40px, 8vw, 96px); line-height: .96; letter-spacing: -.02em;
  }
  .masthead p { color: var(--dim); max-width: 60ch; margin-top: 20px; font-size: 15px; }
  .meta { font-family: var(--mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-top: 22px; }

  /* ── Layout: contents rail + document ── */
  .doc-grid {
    display: grid; grid-template-columns: 276px minmax(0, 1fr);
    gap: clamp(28px, 4vw, 56px); align-items: start;
    padding: clamp(32px, 5vw, 64px) 0 clamp(60px, 9vw, 120px);
  }
  .toc {
    position: sticky; top: calc(var(--bar-h) + 20px);
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 22px 18px;
  }
  .toc-links {
    max-height: calc(100svh - var(--bar-h) - 104px); overflow-y: auto; overscroll-behavior: contain;
  }
  .toc summary {
    font-family: var(--mono); font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 14px; font-weight: 700; cursor: pointer; list-style: none;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .toc summary::-webkit-details-marker { display: none; }
  .toc summary::after { content: "\2212"; color: var(--dim); font-size: 13px; }
  .toc:not([open]) summary { margin-bottom: 0; }
  .toc:not([open]) summary::after { content: "+"; }
  .toc a {
    display: block; font-size: 12.5px; line-height: 1.45; color: var(--dim);
    padding: 5px 8px; border-radius: 6px; border-left: 2px solid transparent;
    transition: color .18s ease, background .18s ease, border-color .18s ease;
  }
  .toc a:hover { color: var(--white); background: var(--surface2); }
  .toc a.toc-1 { padding-left: 20px; font-size: 12px; color: var(--muted); }
  .toc a.is-current { color: var(--accent); border-left-color: var(--accent); background: var(--surface2); }
  .toc-links::-webkit-scrollbar { width: 6px; }
  .toc-links::-webkit-scrollbar-thumb { background: var(--line2); border-radius: 3px; }

  /* ── The agreement itself ── */
  .doc { max-width: 78ch; font-size: 15px; color: #d6d6d6; }
  .doc h2 {
    font-family: var(--body); color: var(--white); letter-spacing: -.01em;
    font-size: clamp(20px, 2.4vw, 25px); font-weight: 800; line-height: 1.25;
    margin: clamp(44px, 5vw, 64px) 0 18px; scroll-margin-top: calc(var(--bar-h) + 20px);
  }
  .doc h2.h-1 { font-size: clamp(16px, 1.8vw, 18px); margin-top: clamp(30px, 3.5vw, 40px); color: var(--accent); }
  .doc h2:first-child { margin-top: 0; }
  .doc .p { margin: 0 0 14px; }
  .doc .cl { display: grid; grid-template-columns: 3.4em minmax(0, 1fr); gap: 4px; margin: 0 0 14px; }
  .doc .cl-1 { margin-left: clamp(12px, 2.5vw, 34px); grid-template-columns: 2.4em minmax(0, 1fr); }
  .doc .cn { font-family: var(--mono); font-size: 12.5px; color: var(--accent); padding-top: 2px; }
  .doc strong { color: var(--white); font-weight: 700; }
  .doc a[href] { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
  .doc a[href]:hover { color: var(--accent-2); }

  /* ── Footer ── */
  footer { border-top: 1px solid var(--line); padding: clamp(32px, 5vw, 52px) 0; }
  .foot-row { display: flex; flex-wrap: wrap; gap: 18px; justify-content: space-between; align-items: center; }
  .foot-row a.btn {
    display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: var(--accent-ink);
    font-weight: 800; font-size: 13px; letter-spacing: .08em; text-transform: uppercase;
    padding: 14px 22px; border-radius: var(--radius-sm); transition: background .2s ease, transform .15s ease;
  }
  .foot-row a.btn:hover { background: var(--accent-2); transform: translateY(-2px); }
  .foot-legal { font-family: var(--mono); font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }

  @media (max-width: 1000px) {
    .doc-grid { grid-template-columns: 1fr; }
    .toc { position: static; order: -1; }
    .toc-links { max-height: 46svh; }
  }
  @media print {
    .bar, .toc, footer .btn { display: none; }
    body { background: #fff; color: #000; }
    .doc, .doc .cn, .doc strong, h1 { color: #000; }
  }
</style>
</head>
<body>

  <div class="bar">
    <div class="wrap">
      <a class="mark" href="/"><img src="assets/mark.svg" alt="Maxxed" width="34" height="28" /><span>Maxxed Partners</span></a>
      <a class="back" href="/">&larr; Back to site</a>
    </div>
  </div>

  <div class="wrap masthead">
    <span class="eyebrow"><span class="dot"></span>Affiliate Program Agreement</span>
    <h1>Terms and<br>Conditions</h1>
    <p>These terms govern membership of the Maxxed Partners affiliate program, how you may market the Promoted Sites, and how commission is calculated and paid. Please read them together with any Insertion Order agreed with us.</p>
    <p class="meta">Obsidian Ventures Limited &nbsp;/&nbsp; BVI company no. 2192674</p>
  </div>

  <div class="wrap doc-grid">
    <details class="toc" id="toc" open>
      <summary>Contents</summary>
      <nav class="toc-links" aria-label="Contents">
__TOC__
      </nav>
    </details>

    <main class="doc">
__BODY__
    </main>
  </div>

  <footer>
    <div class="wrap foot-row">
      <p class="foot-legal">The official affiliate program for Maxxed.io. 18+ only. Please gamble responsibly.</p>
      <a class="btn" id="registerCta" href="https://ro-affiliate.maxxedpartners.com/registration" target="_blank" rel="noopener">Become a partner</a>
    </div>
  </footer>

  <script>
  /* 143 entries shouldn't sit on top of the text on a phone */
  (function () {
    var toc = document.getElementById('toc');
    if (toc && window.matchMedia('(max-width: 1000px)').matches) toc.open = false;
  })();

  /* highlight the section currently in view in the contents rail */
  (function () {
    var links = [].slice.call(document.querySelectorAll('.toc a'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var heads = [].slice.call(document.querySelectorAll('.doc h2[id]'));
    if (!heads.length || !('IntersectionObserver' in window)) return;
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var a = map[e.target.id];
        if (!a || a === current) return;
        if (current) current.classList.remove('is-current');
        a.classList.add('is-current');
        current = a;
        /* keep the active item visible in the rail without scrolling the page */
        var rail = document.querySelector('.toc-links');
        if (rail && rail.scrollHeight > rail.clientHeight) {
          var top = a.offsetTop - rail.clientHeight / 2;
          rail.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    heads.forEach(function (h) { io.observe(h); });
  })();
  </script>
</body>
</html>
'''
out=HEAD.replace('__TOC__', '      '+toc.replace('\n','\n      ')).replace('__BODY__','      '+body.replace('\n','\n      '))
io.open('/home/user/maxxed-emails/partners/terms.html','w',encoding='utf-8').write(out)
print('wrote', len(out), 'bytes')
