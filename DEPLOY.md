# WSJ Best Boards 2026 — dashboard (GitHub Pages bundle)

Self-contained static site. No build step, no server-side code, no raw/licensed data —
just the dashboard pages, the single rankings file (`compare/boards_dashboard_data.json`),
styles, and the two logos + fonts.

Pages:
- `index.html` — redirects to the Explorer
- `overview/` — Explore (landscape + bar + radar) — the main view
- `compare/` — full comparison tool (also hosts the shared JS + data the other pages load)
- `datatable/` — sortable/filterable data table
- `methodology/` — methodology + data-sources table

## Publish to your personal GitHub Pages

Create a new **public** repo (e.g. `best-boards`) under your account, then from this folder:

```bash
git init
git add .
git commit -m "WSJ Best Boards 2026 dashboard"
git branch -M main
git remote add origin https://github.com/paulrefalo/best-boards.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
Branch = `main`, folder = `/ (root)`. Save.

Your site will be live at:

```
https://paulrefalo.github.io/best-boards/
```

(The `.nojekyll` file is included so GitHub Pages serves every file as-is.)

## Updating the data later

Regenerate `compare/boards_dashboard_data.json` from the pipeline
(`2026/dashboard/build_dashboard_data.py`), drop the new file in `compare/`, commit, and push.

## Notes
- All third-party libraries (React, D3, Babel) load from CDNs; fonts use Typekit/Google + the
  local `resources/fonts/`. An internet connection is required to view the site.
- The pages are transpiled in the browser via Babel standalone (same as local dev).
