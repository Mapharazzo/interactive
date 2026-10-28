import { $, h, compact, nf, setTabs } from "./util.js";

// Section 5: cumulative work with and without a cache.
const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

const metrics = {
  kv: { label: "K/V projections", nc: (n) => (n * (n + 1)) / 2, c: (n) => n, ncBig: "O(n²)", cBig: "O(n)" },
  attn: { label: "attention scores", nc: (n) => (n * (n + 1) * (n + 2)) / 6, c: (n) => (n * (n + 1)) / 2, ncBig: "O(n³)", cBig: "O(n²)" },
};

export function createCompute() {
  const els = { n: $("#cp-n"), nOut: $("#cp-n-out"), kv: $("#cp-m-kv"), attn: $("#cp-m-attn"), log: $("#cp-log"), chart: $("#cp-chart"), sum: $("#cp-summary") };
  let metric = "kv", hoverX = null;
  const W = 760, H = 300, pad = { l: 58, r: 110, t: 16, b: 36 };

  function draw() {
    const N = Math.round(2 ** +els.n.value);
    els.nOut.textContent = nf.format(N);
    const m = metrics[metric], log = els.log.checked;
    const ymax = m.nc(N), ymin = 1;
    const x = (n) => pad.l + ((n - 1) / Math.max(1, N - 1)) * (W - pad.l - pad.r);
    const y = (v) => {
      const f = log ? Math.log10(Math.max(v, 1)) / Math.log10(ymax) : v / ymax;
      return H - pad.b - f * (H - pad.t - pad.b);
    };
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Cumulative ${m.label} vs tokens generated` });

    const ticks = log
      ? Array.from({ length: Math.floor(Math.log10(ymax)) + 1 }, (_, i) => 10 ** i)
      : [0, 0.25, 0.5, 0.75, 1].map((f) => f * ymax);
    for (const tv of ticks) {
      svg.append(s("line", { class: "gridline", x1: pad.l, x2: W - pad.r, y1: y(tv), y2: y(tv) }));
      svg.append(s("text", { x: pad.l - 8, y: y(tv) + 4, "text-anchor": "end" }, compact(tv)));
    }
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const n = Math.max(1, Math.round(1 + f * (N - 1)));
      svg.append(s("text", { x: x(n), y: H - pad.b + 18, "text-anchor": "middle" }, compact(n)));
    }
    svg.append(s("line", { class: "axis", x1: pad.l, x2: W - pad.r, y1: H - pad.b, y2: H - pad.b }));
    svg.append(s("text", { x: (pad.l + W - pad.r) / 2, y: H - 4, "text-anchor": "middle" }, "tokens generated"));

    const pts = (fn) => {
      const k = 160, out = [];
      for (let i = 0; i <= k; i++) { const n = 1 + (i / k) * (N - 1); out.push(`${x(n).toFixed(1)},${y(fn(n)).toFixed(1)}`); }
      return out.join(" ");
    };
    svg.append(s("polyline", { class: "l-nc", points: pts(m.nc) }));
    svg.append(s("polyline", { class: "l-c", points: pts(m.c) }));
    svg.append(s("text", { class: "lab-nc", x: W - pad.r + 6, y: y(m.nc(N)) + 4 }, `no cache ${m.ncBig}`));
    svg.append(s("text", { class: "lab-c", x: W - pad.r + 6, y: Math.min(H - pad.b, y(m.c(N)) + 4) }, `KV cache ${m.cBig}`));

    if (hoverX != null) {
      const n = Math.max(1, Math.min(N, Math.round(1 + ((hoverX - pad.l) / (W - pad.l - pad.r)) * (N - 1))));
      svg.append(s("line", { class: "hover-line", x1: x(n), x2: x(n), y1: pad.t, y2: H - pad.b }));
      svg.append(s("circle", { cx: x(n), cy: y(m.nc(n)), r: 4, fill: "var(--waste)" }));
      svg.append(s("circle", { cx: x(n), cy: y(m.c(n)), r: 4, fill: "var(--new)" }));
      const tx = x(n) > W / 2 ? x(n) - 8 : x(n) + 8, anchor = x(n) > W / 2 ? "end" : "start";
      svg.append(s("text", { x: tx, y: pad.t + 12, "text-anchor": anchor }, `n = ${nf.format(n)}`));
      svg.append(s("text", { class: "lab-nc", x: tx, y: pad.t + 28, "text-anchor": anchor }, compact(m.nc(n))));
      svg.append(s("text", { class: "lab-c", x: tx, y: pad.t + 44, "text-anchor": anchor }, compact(m.c(n))));
    }

    els.chart.replaceChildren(svg);

    const nc = m.nc(N), c = m.c(N);
    els.sum.replaceChildren(
      stat(`No cache: total ${m.label}`, compact(nc), "bad"),
      stat(`KV cache: total ${m.label}`, compact(c), "good"),
      stat("Work saved", `${compact(nc / c)}×`, "accent"),
      stat("Cost of the last step (no cache → cache)", metric === "kv" ? `${compact(N)} → 1` : `${compact((N * (N + 1)) / 2)} → ${compact(N)}`, ""));
  }

  const stat = (lab, val, cls) => h("div", { class: "big-stat" }, h("div", { class: "lab" }, lab), h("div", { class: `val ${cls}` }, val));
  const setMetric = (m) => { metric = m; setTabs([els.kv, els.attn], m === "kv" ? els.kv : els.attn); draw(); };
  els.kv.addEventListener("click", () => setMetric("kv"));
  els.attn.addEventListener("click", () => setMetric("attn"));
  els.n.addEventListener("input", draw);
  els.log.addEventListener("change", draw);
  els.chart.addEventListener("pointermove", (e) => {
    const r = els.chart.firstChild.getBoundingClientRect();
    hoverX = ((e.clientX - r.left) / r.width) * W;
    draw();
  });
  els.chart.addEventListener("pointerleave", () => { hoverX = null; draw(); });
  draw();
}
