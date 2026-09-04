# Maxxed Partners — landing site

Responsive rebuild of the Framer-exported Maxxed Partners affiliate landing page.
Single self-contained `index.html` (fluid type, collapsing grids, animated marquee,
mobile-friendly floating nav). Logos live in `assets/` and are referenced with `<img>`.

## Local

Open `index.html` in any browser — fully self-contained (fonts + hero video load from CDN).

## Deploy (Vercel)

Static site, no build step.

```bash
# from this folder
npx vercel          # preview (test) deploy
npx vercel --prod   # production
```

A preview deploy is live at a `*.vercel.app` test domain (project `maxxed-partners-site`).
Preview deploys on the Pro plan may be behind **Vercel Authentication** — to make the
test URL publicly viewable, turn off Deployment Protection for the project in
Vercel → Project → Settings → Deployment Protection.

### Auto-deploy from Git (optional)

To have Vercel rebuild on every push, connect the GitHub repo in
Vercel → Add New → Project, and set the **Root Directory** to `partners`.
This requires the Vercel GitHub app to have access to `technoanimal1/maxxed-emails`.

## Structure

```
index.html         the page
assets/logo.svg    Maxxed "ALL." wordmark (hero)
assets/mark.svg    compact Maxxed mark (nav + footer)
vercel.json        clean URLs + cache headers
```

## Editing reviews (no code — for the client)

Reviews load live from a Google Sheet, so the client never touches the site.

1. Make a Google Sheet with these headers in row 1 (exactly):
   `quote | name | role | published`
2. Add one review per row. Put `TRUE` (or `yes` / `1` / `x`) in **published** to show it.
3. In Sheets: **File → Share → Publish to web** → pick the sheet + **Comma-separated
   values (.csv)** → **Publish** → copy the link.
4. Paste that link into `REVIEWS_CSV_URL` in the `<script>` at the bottom of `index.html`,
   then redeploy once. After that, edits to the sheet appear on the site automatically
   (Google caches the CSV for a few minutes).

Until `REVIEWS_CSV_URL` is set, the site shows three built-in sample reviews.

## Two links to fill in (bottom of `index.html`)

```
REGISTRATION_URL = ""   // where "Become a partner" goes (your real registration page)
REVIEWS_CSV_URL  = ""   // published Google Sheet CSV (see above)
TERMS_URL        = ""   // optional: footer T&C link
```

## Before launch

- Set `REGISTRATION_URL`, `REVIEWS_CSV_URL`, and `TERMS_URL`.
- Replace the hero video URL (currently the Framer CDN asset) with your own if desired.
