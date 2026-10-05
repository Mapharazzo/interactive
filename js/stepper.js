import { qkv, attend } from "./model.js";
import { $, h, vecEl, nf, replay, player } from "./util.js";

// Section 3: side-by-side generation with and without a KV cache.
// The "with cache" side keeps a real cache array; the "without" side really
// recomputes every K and V from scratch, and we check both give the same output.
export function createStepper() {
  const els = {
    plen: $("#st-plen"), plenOut: $("#st-plen-out"), seq: $("#st-sequence"), phase: $("#st-phase"),
    back: $("#st-back"), step: $("#st-step"), play: $("#st-play"), reset: $("#st-reset"),
    nc: $("#st-nocache"), ncStats: $("#st-nocache-stats"),
    c: $("#st-cache"), cStats: $("#st-cache-stats"), out: $("#st-output"),
  };
  let tokens = [];
  let P = 4;     // prompt length
  let s = 0;     // step: 0 = nothing yet, 1 = prefill, 2.. = decode steps
  let cache = { k: [], v: [] };

  const maxStep = () => tokens.length - P;           // last step predicts the final token
  const tAt = (step) => (step === 0 ? 0 : P + step - 1); // tokens processed after `step`
  const newAt = (step) => (step === 1 ? [...Array(P).keys()] : step > 1 ? [tAt(step) - 1] : []);

  // Analytic per-step costs (one layer, one head).
  const cost = {
    nocache: (step) => { const t = tAt(step); return { kv: t, scores: (t * (t + 1)) / 2, waste: step > 1 ? t - 1 : 0 }; },
    cache: (step) => {
      const t = tAt(step);
      return step === 1 ? { kv: P, scores: (P * (P + 1)) / 2, waste: 0 } : { kv: step ? 1 : 0, scores: step ? t : 0, waste: 0 };
    },
  };
  const total = (mode, key) => { let x = 0; for (let i = 1; i <= s; i++) x += cost[mode](i)[key]; return x; };

  function advanceCache(step) {
    for (const i of newAt(step)) { const r = qkv(tokens[i], i); cache.k.push(r.k); cache.v.push(r.v); }
  }
  function rebuildCache() {
    cache = { k: [], v: [] };
    for (let i = 1; i <= s; i++) advanceCache(i);
  }

  function header() {
    return h("div", { class: "kv-head" }, h("span", {}, "token"), h("span", { class: "kh" }, "key"), h("span", { class: "vh" }, "value"), h("span", { style: "text-align:right" }, "status"));
  }

  function renderTable(root, mode, animate) {
    root.replaceChildren();
    const t = tAt(s);
    if (!t) { root.append(h("div", { class: "empty-note" }, "Press Step to run prefill on the prompt.")); return; }
    const fresh = new Set(newAt(s));
    root.append(header());
    for (let i = 0; i < t; i++) {
      let cls, tag, k, v;
      if (mode === "nocache") {
        ({ k, v } = qkv(tokens[i], i)); // genuinely recomputed every render
        cls = fresh.has(i) ? "new" : "waste";
        tag = fresh.has(i) ? "new" : "wasted ✗";
      } else {
        k = cache.k[i]; v = cache.v[i];
        cls = fresh.has(i) ? "new" : "cached";
        tag = fresh.has(i) ? "new → cache" : "cached";
      }
      const row = h("div", { class: `kv-row ${cls}` },
        h("span", { class: "lbl", title: tokens[i] }, h("span", { class: "sm" }, i), tokens[i]),
        vecEl(k, "k"), vecEl(v, "v"), h("span", { class: "tag" }, tag));
      root.append(row);
      if (animate) {
        if (cls === "new") replay(row, "anim-new");
        if (cls === "waste") replay(row, "anim-waste");
      }
    }
  }

  function renderStats(root, mode) {
    const c = s ? cost[mode](s) : { kv: 0, scores: 0, waste: 0 };
    const rows = mode === "nocache"
      ? [
          ["K/V vectors computed this step", nf.format(c.kv), c.waste ? "bad" : ""],
          ["…of which wasted", nf.format(c.waste), c.waste ? "bad" : ""],
          ["Attention scores this step", nf.format(c.scores), ""],
          ["Total K/V computed so far", nf.format(total(mode, "kv")), ""],
          ["Total attention scores so far", nf.format(total(mode, "scores")), ""],
          ["Memory held between steps", "0 vectors", ""],
        ]
      : [
          ["K/V vectors computed this step", nf.format(c.kv), "good"],
          ["…of which wasted", "0", "good"],
          ["Attention scores this step", nf.format(c.scores), ""],
          ["Total K/V computed so far", nf.format(total(mode, "kv")), "good"],
          ["Total attention scores so far", nf.format(total(mode, "scores")), "good"],
          ["Memory held between steps", `${cache.k.length} K + ${cache.v.length} V`, ""],
        ];
    root.replaceChildren(...rows.flatMap(([k, v, cls]) => [h("span", { class: "k" }, k), h("span", { class: `v ${cls}` }, v)]));
  }

  function renderSequence() {
    const t = tAt(s);
    els.seq.replaceChildren(...tokens.map((tok, i) => {
      let cls = i < P ? "prompt" : i < t ? "gen" : i === t && s > 0 ? "gen" : "future";
      if (i === t && s > 0) cls += " just";
      return h("span", { class: `tok ${cls}`, title: i < P ? "prompt token" : i <= t && s ? "generated token" : "not generated yet" },
        h("span", { class: "sm" }, i), tok);
    }));
  }

  function renderOutput() {
    const t = tAt(s);
    els.out.replaceChildren();
    if (!t) {
      els.out.append(h("h3", {}, "Next-token computation"),
        h("p", { class: "hint" }, "After prefill, this shows the newest token's query attending over all keys — computed both ways."));
      return;
    }
    const last = t - 1;
    // No cache: recompute every K, V from scratch.
    const fresh = tokens.slice(0, t).map((tok, i) => qkv(tok, i));
    const a = attend(fresh[last].q, fresh.map((r) => r.k), fresh.map((r) => r.v));
    // Cache: only the newest query is computed; K and V come from the cache.
    const q = qkv(tokens[last], last).q;
    const b = attend(q, cache.k, cache.v);
    const delta = Math.max(...a.out.map((x, i) => Math.abs(x - b.out[i])));
    const next = tokens[t];

    els.out.append(
      h("h3", {}, `Step ${s}: "${tokens[last]}" (position ${last}) attends over ${t} cached key${t > 1 ? "s" : ""}`),
      h("div", { class: "flow" }, "new query", vecEl(q, "q"), "→ softmax(q·K / √d) →"),
      h("div", { class: "attn-bars" }, b.weights.map((w, i) => h("div", { class: `attn-bar ${i === last ? "self" : ""}` },
        h("span", { class: "lbl" }, tokens[i]),
        h("span", { class: "track" }, h("span", { class: "fill", style: `width:${(w * 100).toFixed(1)}%` })),
        h("span", { class: "pct" }, `${(w * 100).toFixed(0)}%`)))),
      h("div", { class: "match" },
        h("span", { class: "flow" }, "output without cache", vecEl(a.out, "v")),
        h("span", { class: "flow" }, "output with cache", vecEl(b.out, "v")),
        h("span", { class: delta < 1e-12 ? "ok" : "" }, delta < 1e-12 ? `✓ identical (max |Δ| = ${delta.toExponential(1)})` : `max |Δ| = ${delta.toExponential(2)}`)),
      h("p", { class: "hint", style: "margin-top:10px" },
        next ? `→ the rest of the network turns this into a prediction: "${next}" (scripted for the demo).` : "→ end of text."));
  }

  function render(animate = false) {
    const ms = maxStep();
    els.back.disabled = s === 0;
    els.step.disabled = s >= ms;
    els.phase.className = "phase-badge " + (s === 1 ? "prefill" : s > 1 ? "decode" : "");
    els.phase.textContent = s === 0 ? "ready" : s === 1 ? `prefill · ${P} prompt tokens` : `decode step ${s - 1} of ${ms - 1}`;
    renderSequence();
    renderTable(els.nc, "nocache", animate);
    renderTable(els.c, "cache", animate);
    renderStats(els.ncStats, "nocache");
    renderStats(els.cStats, "cache");
    renderOutput();
  }

  function step() {
    if (s >= maxStep()) return false;
    s++; advanceCache(s); render(true);
    return s < maxStep();
  }

  const play = player(els.play, step);
  els.step.addEventListener("click", () => { play.stop(); step(); });
  els.back.addEventListener("click", () => { play.stop(); if (s > 0) { s--; rebuildCache(); render(); } });
  els.reset.addEventListener("click", () => { play.stop(); s = 0; rebuildCache(); render(); });
  els.plen.addEventListener("input", () => {
    play.stop(); P = +els.plen.value; els.plenOut.textContent = P; s = 0; rebuildCache(); render();
  });

  return {
    setTokens(t) {
      play.stop();
      tokens = t;
      els.plen.max = Math.max(1, tokens.length - 2);
      P = Math.min(+els.plen.value, +els.plen.max);
      els.plen.value = P; els.plenOut.textContent = P;
      s = 0; rebuildCache(); render();
    },
  };
}
