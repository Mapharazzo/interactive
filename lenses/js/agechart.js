// Accommodation amplitude by age, linked to the lab's age. Drag or click to set it.

import { amplitude } from "./optics.js";
import { set, subscribe } from "./state.js";

const NS = "http://www.w3.org/2000/svg";
const Wd = 640, Ht = 270, M = { l: 44, r: 16, t: 16, b: 38 };
const A0 = 8, A1 = 80, D1 = 14;
const x = (age) => M.l + ((age - A0) / (A1 - A0)) * (Wd - M.l - M.r);
const y = (d) => M.t + (1 - d / D1) * (Ht - M.t - M.b);
const ageAt = (px) => Math.round(A0 + ((px - M.l) / (Wd - M.l - M.r)) * (A1 - A0));

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent.append(n);
  return n;
}
function label(parent, px, py, str, cls, anchor = "middle") {
  const t = el("text", { x: px, y: py, class: cls, "text-anchor": anchor }, parent);
  t.textContent = str;
  return t;
}
const nearPoint = (age) => {
  const cm = 100 / amplitude(age);
  return cm >= 100 ? `${(cm / 100).toFixed(1)} m` : `${Math.round(cm)} cm`;
};

export function createAgeChart(root) {
  const svg = root.querySelector("svg");
  const tip = root.querySelector(".tip");
  svg.setAttribute("viewBox", `0 0 ${Wd} ${Ht}`);

  // Static layer: grid, axes, threshold, curve.
  const grid = el("g", { class: "grid" }, svg);
  for (let d = 0; d <= 12; d += 4) {
    el("line", { x1: M.l, x2: Wd - M.r, y1: y(d), y2: y(d) }, grid);
    label(grid, M.l - 8, y(d) + 4, `${d} D`, "tick", "end");
  }
  for (let a = 10; a <= 80; a += 10) label(grid, x(a), Ht - M.b + 20, String(a), "tick");
  label(grid, Wd - M.r, Ht - 4, "age", "tick", "end");
  el("line", { x1: M.l, x2: Wd - M.r, y1: y(2.5), y2: y(2.5), class: "threshold" }, svg);
  label(svg, Wd - M.r, y(2.5) - 8, "2.5 D: enough to read at 40 cm", "note", "end");
  const pts = [];
  for (let a = A0; a <= A1; a += 0.5) pts.push(`${x(a).toFixed(1)},${y(amplitude(a)).toFixed(1)}`);
  el("polyline", { points: pts.join(" "), class: "curve" }, svg);

  // Current age marker
  const you = el("g", { class: "you" }, svg);
  const youLine = el("line", { y1: M.t, y2: Ht - M.b }, you);
  const youDot = el("circle", { r: 6 }, you);
  // Hover crosshair
  const hover = el("g", { class: "hover", visibility: "hidden" }, svg);
  const hLine = el("line", { y1: M.t, y2: Ht - M.b }, hover);
  const hDot = el("circle", { r: 5 }, hover);
  const hit = el("rect", { x: M.l, y: 0, width: Wd - M.l - M.r, height: Ht, class: "hit" }, svg);

  const toAge = (e) => {
    const r = svg.getBoundingClientRect();
    return Math.max(A0, Math.min(A1, ageAt(((e.clientX - r.left) / r.width) * Wd)));
  };
  let dragging = false;
  hit.addEventListener("pointerdown", (e) => { dragging = true; hit.setPointerCapture(e.pointerId); set({ eye: { age: toAge(e) } }); });
  hit.addEventListener("pointerup", () => (dragging = false));
  hit.addEventListener("pointermove", (e) => {
    const age = toAge(e);
    if (dragging) set({ eye: { age } });
    hover.setAttribute("visibility", "visible");
    hLine.setAttribute("x1", x(age)); hLine.setAttribute("x2", x(age));
    hDot.setAttribute("cx", x(age)); hDot.setAttribute("cy", y(amplitude(age)));
    tip.hidden = false;
    tip.textContent = `Age ${age}: ${amplitude(age).toFixed(1)} D, nearest sharp point ${nearPoint(age)}`;
    const r = svg.getBoundingClientRect();
    tip.style.left = `${(x(age) / Wd) * r.width}px`;
    tip.style.top = `${(y(amplitude(age)) / Ht) * r.height}px`;
  });
  hit.addEventListener("pointerleave", () => { hover.setAttribute("visibility", "hidden"); tip.hidden = true; });

  const readout = root.querySelector(".age-readout");
  subscribe((s) => {
    const a = s.eye.age;
    youLine.setAttribute("x1", x(a)); youLine.setAttribute("x2", x(a));
    youDot.setAttribute("cx", x(a)); youDot.setAttribute("cy", y(amplitude(a)));
    readout.textContent = `Lab age ${a}: the eye can add ${amplitude(a).toFixed(1)} D, so with no other focusing error it sees sharply from infinity down to ${nearPoint(a)}.`;
  });
}
