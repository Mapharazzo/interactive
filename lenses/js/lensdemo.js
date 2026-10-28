// A single thin lens with parallel light coming in: converge or diverge.

import { dioptres } from "./optics.js";

const NS = "http://www.w3.org/2000/svg";
const X = 300, Y0 = 130, PX_PER_CM = 3;

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent.append(n);
  return n;
}

export function createLensDemo(root) {
  const svg = root.querySelector("svg");
  const input = root.querySelector("input");
  const out = root.querySelector("output");
  const note = root.querySelector(".lens-note");
  svg.setAttribute("viewBox", "0 0 900 260");

  function render() {
    const P = +input.value;
    svg.replaceChildren();
    el("line", { x1: 0, y1: Y0, x2: 900, y2: Y0, class: "axis" }, svg);

    // Lens outline: thick middle for plus, thick edges for minus.
    const half = 96, tc = P > 0 ? 6 + P * 2.2 : 6, te = P < 0 ? 6 - P * 2.2 : 6;
    const c = (side) => X + side * (tc - te / 2);
    el("path", {
      d: `M ${X - te / 2} ${Y0 - half} Q ${c(-1)} ${Y0} ${X - te / 2} ${Y0 + half} L ${X + te / 2} ${Y0 + half} Q ${c(1)} ${Y0} ${X + te / 2} ${Y0 - half} Z`,
      class: `spec ${P < 0 ? "minus" : "plus"}`,
    }, svg);

    const f = P === 0 ? Infinity : (100 / P) * PX_PER_CM; // focal length in px, signed
    for (let i = 0; i < 7; i++) {
      const y = (i / 6) * 2 - 1;
      const h = y * 78;
      const slope = Number.isFinite(f) ? -h / f : 0;
      el("polyline", { points: `0,${Y0 - h} ${X},${Y0 - h} 900,${Y0 - (h + slope * (900 - X))}`, class: "ray m1" }, svg);
      if (P < 0) el("line", { x1: X, y1: Y0 - h, x2: X + f, y2: Y0, class: "ray ghost m1" }, svg);
    }
    if (Number.isFinite(f) && Math.abs(f) < 600) {
      el("circle", { cx: X + f, cy: Y0, r: 5, class: "focus m1" }, svg);
      const t = el("text", { x: X + f, y: Y0 + 26, class: "lbl", "text-anchor": "middle" }, svg);
      t.textContent = P > 0 ? "focal point" : "virtual focal point";
    }

    out.textContent = `${dioptres(P)} D`;
    if (P === 0) note.textContent = "A flat piece of glass: light goes straight through.";
    else {
      const cm = Math.abs(100 / P);
      const len = cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${cm.toFixed(cm < 10 ? 1 : 0)} cm`;
      note.textContent = P > 0
        ? `Focal length 1 / ${P} = ${len}. Parallel light converges to a point ${len} behind the lens. Plus lenses like this correct farsightedness and make reading glasses.`
        : `Focal length 1 / ${P} = −${len}. Light spreads out as if it came from a point ${len} in front of the lens. Minus lenses like this correct nearsightedness.`;
    }
  }
  input.addEventListener("input", render);
  render();
}
