# Terms page tooling

`terms.html` is generated from the signed Word agreement, not hand-written.

1. `docx-to-terms.py` — reads the .docx (path at the top of the file), resolves
   Word's list numbering into real section numbers, keeps bold/italic and
   hyperlinks, and writes `/tmp/tc_body.html` + `/tmp/tc_toc.html`.
2. `build-terms-page.py` — wraps those fragments in the site's design
   (dark theme, lime accent, sticky contents rail) and writes `partners/terms.html`.

When the agreement changes, point step 1 at the new .docx and re-run both.
Verify afterwards that every character of the source still appears in the
output, in order — the conversion should only ever add numbering labels.
