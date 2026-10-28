# Interactive explainers

Interactive explanations of things, one page each, hosted on GitHub Pages. Static files only: no build step, no shared framework, and no shared stylesheet. Each explainer picks its own look to suit its subject.

| Explainer | Folder | What it covers |
|---|---|---|
| How glasses fix blurry vision | [`lenses/`](lenses/) | An eye you can break and fix: near/farsightedness, astigmatism, presbyopia, pupil size, and the lenses that correct them. |
| The KV cache | [`kv-cache/`](kv-cache/) | Why transformers cache keys and values, what it saves, and what it costs in memory. |

## Layout

```
index.html            home page: one link per explainer
<slug>/index.html     an explainer, fully self-contained
<slug>/thumb.svg      64×64 icon used on the home page and as the favicon
<slug>/css/, js/      whatever the explainer needs
_template/            starting point for a new explainer (not linked or listed)
```

Explainers never reference files outside their own folder, apart from `../` links back to the home page. That keeps each one free to change style, libraries or structure without affecting the others, and lets you move or delete a folder cleanly.

## Adding an explainer

1. `cp -r _template my-topic` and build it there. Use relative paths only (`css/x.css`, not `/css/x.css`); the site is served from `/interactive/`.
2. Replace `my-topic/thumb.svg` with a 64×64 icon.
3. Add an `<li>` for it at the top of the list in `index.html` and a row in the table above.

The deploy workflow fails if a folder with an `index.html` isn't linked from the home page. Folders starting with `_` are skipped.

## Run locally

ES modules need a web server (opening the file directly won't work):

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

- **GitHub Actions (included):** in *Settings → Pages*, set **Source** to **GitHub Actions**. Every push to `main` deploys via `.github/workflows/pages.yml`, or run it by hand from the Actions tab.
- **Deploy from a branch:** in *Settings → Pages*, pick the branch and `/ (root)`.

The site is at `https://<user>.github.io/interactive/`, and each explainer at `…/interactive/<slug>/`.

## Notes per explainer

**lenses/** models the eye as a "reduced eye" (one 60 D refracting surface) with the refractive error as a spectacle prescription, and represents every sphere/cylinder as a 2×2 dioptric power matrix, so astigmatism at any axis is just matrix addition. The view is blurred on the GPU (WebGL2) by convolving each depth layer with the image of the pupil on the retina, which is an ellipse given by the defocus matrix. It falls back to a plain CSS blur without WebGL2. The lab's state is kept in the URL query string, so any setup can be linked to. Model limits are listed at the bottom of the page.

**kv-cache/**: numbers in sections 2–4 come from a real (tiny) single-head attention layer running in the browser (d_model = 8, d_head = 4, seeded random weights).
