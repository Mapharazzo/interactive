import { $, h, bytes } from "./util.js";

// Section 7: how query heads share KV heads.
const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const OPTIONS = [8, 4, 2, 1];
const PALETTE = ["#2563eb", "#9333ea", "#0891b2", "#16a34a", "#d97706", "#db2777", "#4f46e5", "#65a30d"];

export function createGQA() {
  const els = { kv: $("#gqa-kv"), out: $("#gqa-out"), name: $("#gqa-name"), svg: $("#gqa-svg"), stats: $("#gqa-stats") };

  function render() {
    const kv = OPTIONS[+els.kv.value], Q = 8, group = Q / kv;
    els.out.textContent = kv;
    els.name.textContent = kv === 8 ? "MHA · multi-head" : kv === 1 ? "MQA · multi-query" : `GQA · groups of ${group}`;

    const narrow = els.svg.clientWidth < 520;
    const W = narrow ? 400 : 760, H = 230, bw = narrow ? 40 : 64, bh = 38;
    const qx = (i) => (narrow ? 4 : 40) + i * ((W - (narrow ? 8 : 80) - bw) / (Q - 1));
    const kvx = (g) => { const a = qx(g * group), b = qx(g * group + group - 1); return (a + b) / 2; };
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${Q} query heads sharing ${kv} key/value heads` });
    svg.append(s("text", { class: "lbl", x: 0, y: 14 }, "query heads (not cached)"));
    svg.append(s("text", { class: "lbl", x: 0, y: H - 4 }, "key/value heads (cached)"));
    for (let i = 0; i < Q; i++) {
      const g = Math.floor(i / group);
      svg.append(s("line", { class: "link", x1: qx(i) + bw / 2, y1: 30 + bh, x2: kvx(g) + bw / 2, y2: 160 }));
    }
    for (let i = 0; i < Q; i++) {
      svg.append(s("rect", { class: "qh", x: qx(i), y: 30, width: bw, height: bh, rx: 8, opacity: 0.9 }));
      svg.append(s("text", { class: "in", x: qx(i) + bw / 2, y: 30 + bh / 2 + 4, "text-anchor": "middle" }, `Q${i}`));
    }
    for (let g = 0; g < kv; g++) {
      svg.append(s("rect", { x: kvx(g), y: 160, width: bw, height: bh, rx: 8, fill: PALETTE[g % PALETTE.length] }));
      svg.append(s("text", { class: "in", x: kvx(g) + bw / 2, y: 160 + bh / 2 + 4, "text-anchor": "middle" }, `KV${g}`));
    }
    els.svg.replaceChildren(svg);

    // Example: 32 layers, 32 query heads, head_dim 128, fp16, 8K context.
    const kvHeads = 32 * (kv / 8), perTok = 2 * 32 * kvHeads * 128 * 2, ctx = 8192;
    const stat = (lab, val, cls = "") => h("div", { class: "big-stat" }, h("div", { class: "lab" }, lab), h("div", { class: `val ${cls}` }, val));
    els.stats.replaceChildren(
      stat("Cache size vs. MHA", `${((kv / 8) * 100).toFixed(1).replace(/\.0$/, "")}%`, kv < 8 ? "good" : ""),
      stat("Query heads per KV head", group),
      stat("7B-class model (32 layers × 32 q-heads), per token", bytes(perTok)),
      stat("…at 8K context", bytes(perTok * ctx), "accent"));
  }

  els.kv.addEventListener("input", render);
  window.addEventListener("resize", render);
  render();
}
