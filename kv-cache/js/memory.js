import { $, h, bytes, nf, compact } from "./util.js";

// Section 6: KV cache memory calculator.
const PRESETS = [
  { name: "Llama 3.1 8B", layers: 32, q: 32, kv: 8, hd: 128, params: 8.03e9, ctx: 131072 },
  { name: "Llama 2 7B (MHA)", layers: 32, q: 32, kv: 32, hd: 128, params: 6.74e9, ctx: 4096 },
  { name: "Mistral 7B", layers: 32, q: 32, kv: 8, hd: 128, params: 7.24e9, ctx: 32768 },
  { name: "Qwen2.5 7B", layers: 28, q: 28, kv: 4, hd: 128, params: 7.62e9, ctx: 131072 },
  { name: "Falcon 7B (MQA)", layers: 32, q: 71, kv: 1, hd: 64, params: 7.2e9, ctx: 2048 },
  { name: "GPT-2 small", layers: 12, q: 12, kv: 12, hd: 64, params: 0.124e9, ctx: 1024 },
  { name: "Llama 2 70B", layers: 80, q: 64, kv: 8, hd: 128, params: 69e9, ctx: 4096 },
  { name: "Llama 3.1 70B", layers: 80, q: 64, kv: 8, hd: 128, params: 70.6e9, ctx: 131072 },
  { name: "Llama 3.1 405B", layers: 126, q: 128, kv: 8, hd: 128, params: 405e9, ctx: 131072 },
];

export function createMemory() {
  const ids = ["preset", "layers", "qheads", "kvheads", "hdim", "dtype", "seq", "batch", "gpu"];
  const els = Object.fromEntries(ids.map((id) => [id, $(`#mem-${id}`)]));
  const outs = Object.fromEntries(["layers", "qheads", "kvheads", "hdim", "seq", "batch"].map((id) => [id, $(`#mem-${id}-out`)]));
  const formula = $("#mem-formula"), out = $("#mem-out"), bar = $("#mem-bar");
  let params = PRESETS[0].params;

  PRESETS.forEach((p, i) => els.preset.append(h("option", { value: i }, p.name)));
  els.preset.append(h("option", { value: "custom" }, "Custom"));

  function applyPreset(i) {
    const p = PRESETS[i];
    els.layers.value = p.layers; els.qheads.value = p.q; els.kvheads.value = p.kv; els.hdim.value = p.hd;
    els.seq.value = Math.log2(p.ctx); params = p.params;
    render();
  }

  function render() {
    const L = +els.layers.value, Q = +els.qheads.value;
    if (+els.kvheads.value > Q) els.kvheads.value = Q;
    const KV = +els.kvheads.value, D = +els.hdim.value, B = +els.dtype.value;
    const seq = Math.round(2 ** +els.seq.value), batch = 2 ** +els.batch.value;
    const gpu = +els.gpu.value * 1024 ** 3;
    outs.layers.textContent = L; outs.qheads.textContent = Q; outs.kvheads.textContent = KV;
    outs.seq.textContent = nf.format(seq); outs.batch.textContent = batch;

    const perToken = 2 * L * KV * D * B;
    const total = perToken * seq * batch;
    const weights = params * 2;
    const mhaTotal = 2 * L * Q * D * B * seq * batch;

    formula.innerHTML =
      `2 <span style="color:var(--muted)">(K and V)</span> × ${L} layers × ${KV} KV heads × ${D} dims × ${B} B ` +
      `= <b>${bytes(perToken)}</b> per token` +
      `<br>× ${nf.format(seq)} tokens × ${batch} sequence${batch > 1 ? "s" : ""} = <b style="color:var(--v)">${bytes(total)}</b>`;

    const free = gpu - weights;
    const maxTokens = free > 0 ? Math.floor(free / perToken) : 0;
    out.replaceChildren(h("div", { class: "big-stats" },
      stat("KV cache per token", bytes(perToken), ""),
      stat("KV cache total", bytes(total), "accent"),
      stat("Model weights (bf16)", bytes(weights), ""),
      stat("Cache ÷ weights", `${(total / weights).toFixed(total / weights < 10 ? 2 : 0)}×`, total > weights ? "bad" : "good"),
      stat("Tokens of cache that fit next to the weights", free > 0 ? compact(maxTokens) : "weights don't fit", free > 0 ? "" : "bad"),
      KV < Q ? stat(`Saved vs. full MHA (${Q} KV heads)`, `${(Q / KV).toFixed(Q % KV ? 1 : 0)}× smaller`, "good") : stat("Using full multi-head attention", "no KV sharing", "")));

    const used = weights + total;
    const scale = Math.max(gpu, used);
    const pct = (x) => `${((x / scale) * 100).toFixed(2)}%`;
    const over = used > gpu;
    bar.replaceChildren(
      h("div", { class: "bar-track", role: "img", "aria-label": `Weights ${bytes(weights)}, KV cache ${bytes(total)}, GPU ${bytes(gpu)}` },
        h("div", { class: "bar-seg w", style: `width:${pct(Math.min(weights, scale))}` }, weights / scale > 0.12 ? "weights" : ""),
        h("div", { class: "bar-seg kv", style: `width:${pct(total)}` }, total / scale > 0.12 ? "KV cache" : "")),
      h("div", { class: "bar-legend" },
        h("span", {}, `GPU: ${bytes(gpu)}`), h("span", {}, `used: ${bytes(used)} (${((used / gpu) * 100).toFixed(0)}%)`),
        KV < Q && h("span", {}, `with MHA the cache would be ${bytes(mhaTotal)}`)),
      h("div", { class: `bar-note ${over ? "bad" : ""}` },
        over
          ? `Doesn't fit on one GPU: ${bytes(used - gpu)} over. You'd need to shard across GPUs, shrink the batch or context, or quantize the cache.`
          : `Fits, with ${bytes(gpu - used)} to spare (ignoring activations and framework overhead).`));
    bar.firstChild.style.outline = over ? "2px solid var(--waste)" : "";
  }

  const stat = (lab, val, cls) => h("div", { class: "big-stat" }, h("div", { class: "lab" }, lab), h("div", { class: `val ${cls}` }, val));

  els.preset.addEventListener("change", () => { if (els.preset.value !== "custom") applyPreset(+els.preset.value); });
  for (const id of ["layers", "qheads", "kvheads", "hdim"]) els[id].addEventListener("input", () => { els.preset.value = "custom"; render(); });
  for (const id of ["dtype", "seq", "batch", "gpu"]) els[id].addEventListener("input", render);
  applyPreset(0);
}
