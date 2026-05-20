# Maxxed Emails

Single-page editor for the 32 Maxxed CRM + transactional email templates.

## Local

Open `index.html` in any browser — it's fully self-contained.

## Deploy to Vercel

```bash
# from this folder
npx vercel              # first run: creates project, links, deploys preview
npx vercel --prod       # promote to production
```

The first time, the CLI will ask you to:

1. Log in (browser-based)
2. Confirm scope / team
3. Confirm the project name (e.g. `maxxed-emails`)
4. Use the current directory — yes

You'll get a preview URL immediately, and `--prod` gives you the production URL.

## Structure

```
index.html              the viewer
vercel.json             cache headers for /banners and /assets
assets/logo.svg         Maxxed wordmark used in every email header + footer
banners/                drop banner PNGs here, named by email ID (A-01.png, B-01.png, …)
creative-direction.md   art direction for the 14 banner illustrations
```

## Swapping banners

Three ways, in priority order:

1. **Viewer UI** — pick a file or paste a URL above the email preview. Saved in your browser.
2. **`BANNERS` map** in `index.html` JS — set `"B-01": "./banners/B-01.png"`. Production-ready.
3. **Drop file in `/banners/`** + the BANNERS map points at it. After `vercel --prod` it's live.
