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

## Before launch

- Wire the apply form to a real endpoint / CRM (currently a client-side stub).
- Swap the placeholder testimonials for real quotes.
- Replace the hero video URL (currently the Framer CDN asset) with your own if desired.
