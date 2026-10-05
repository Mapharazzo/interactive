# The KV cache, interactively

An interactive explainer of the key/value cache in transformer language models: why it exists, what it saves, and what it costs. A static site with no build step, ready for GitHub Pages.

## What's inside

1. **Generation:** why autoregressive decoding repeats work.
2. **Attention refresher:** click a token to make it the query and see its attention weights.
3. **Cache vs. no cache:** step through prefill and decode side by side. Type your own text, change the prompt length, and watch recomputed (wasted) vs. cached K/V. Both sides really compute, and the page checks that their outputs are identical.
4. **Only the last row is new:** the causal attention matrix, showing why K and V are cached but Q isn't.
5. **Savings:** cumulative work, O(n²) → O(n) for projections and O(n³) → O(n²) for attention scores.
6. **Memory calculator:** KV cache size for real model configs (Llama, Mistral, Qwen, Falcon, GPT-2), compared against weights and GPU memory.
7. **MHA → GQA → MQA:** how sharing KV heads shrinks the cache.
8. **Paging:** a simulation of contiguous max-length reservation vs. PagedAttention-style blocks.
9. **Quiz.**

The numbers in sections 2–4 come from a real (tiny) single-head attention layer running in the browser (d_model = 8, d_head = 4, seeded random weights). The predicted tokens are scripted.

## Run locally

ES modules need a web server (opening the file directly won't work):

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

Either option works:

- **GitHub Actions (included):** in *Settings → Pages*, set **Source** to **GitHub Actions**. Every push to `main` deploys via `.github/workflows/pages.yml` (you can also run it manually from the Actions tab).
- **Deploy from a branch:** in *Settings → Pages*, set **Source** to **Deploy from a branch**, then pick the branch and `/ (root)`.

The site will be at `https://<user>.github.io/interactive/`. All paths are relative, so it works under any sub-path.

## Layout

```
index.html          page content
css/style.css       styles (light and dark themes)
js/model.js         toy attention layer (seeded weights, softmax, causal attention)
js/explorer.js      §2 query explorer
js/stepper.js       §3 side-by-side generation
js/matrix.js        §4 attention matrix
js/compute.js       §5 savings chart
js/memory.js        §6 memory calculator and model presets
js/gqa.js           §7 MHA/GQA/MQA diagram
js/paged.js         §8 paging simulation
js/quiz.js          §9 quiz
js/main.js          wiring
```
