// Side view of the eye with a lens in front: real paraxial focusing inside
// the eye (to scale), exaggerated angles outside it so you can see them.

import { solve, rxMatrix, blurKernel, kernelEllipse, diffractionArcmin, rxString } from "./optics.js";
import { lensOf, squintOf, targetDistance, OBJECTS } from "./state.js";

const NS = "http://www.w3.org/2000/svg";
const S = 11; // px per mm inside the eye
const Y0 = 150; // optical axis
const XG = 400; // glasses
const XC = 490; // cornea
const K_OUT = 0.002; // drawn slope per (px of height × diopter) outside the eye

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}
function text(parent, x, y, str, cls, anchor = "start") {
  const t = el("text", { x, y, class: cls, "text-anchor": anchor }, parent);
  t.textContent = str;
  return t;
}
const f1 = (x) => x.toFixed(1);

// Power of a symmetric matrix along direction `a` (radians).
const along = ([p, q, r], a) => p * Math.cos(a) ** 2 + 2 * q * Math.sin(a) * Math.cos(a) + r * Math.sin(a) ** 2;

function lensPath(x, power, half = 66) {
  const edge = 5, centre = 5;
  const tc = power > 0 ? centre + power * 1.6 : centre;
  const te = power < 0 ? edge - power * 1.6 : edge;
  const ctl = (side) => x + side * (tc - te / 2); // puts the curve's midpoint at ±tc/2
  return `M ${x - te / 2} ${Y0 - half} Q ${ctl(-1)} ${Y0} ${x - te / 2} ${Y0 + half}`
    + ` L ${x + te / 2} ${Y0 + half} Q ${ctl(1)} ${Y0} ${x + te / 2} ${Y0 - half} Z`;
}

function distanceLabel(d) {
  return d >= 1 ? `${d % 1 ? d.toFixed(1) : d} m` : `${Math.round(d * 100)} cm`;
}

export function createBench(svg, caption) {
  svg.setAttribute("viewBox", "0 0 960 300");

  return function render(state) {
    svg.replaceChildren();
    const lens = lensOf(state);
    const dist = targetDistance(state);
    const V = -1 / dist;
    const sol = solve(state.eye, lens, V);
    const squint = squintOf(state);
    const aperture = state.pupil * squint; // vertical opening seen from the side

    // Eye geometry, to scale.
    const L = sol.axialMM * S;
    const left = XC + 14, right = XC + L;
    const cx = (left + right) / 2, rx = (right - left) / 2, ry = 12 * S;
    const g = el("g", { class: "eye" }, svg);
    el("ellipse", { cx, cy: Y0, rx, ry, class: "sclera" }, g);
    const yc = 5.6 * S;
    const xe = cx - rx * Math.sqrt(1 - (yc / ry) ** 2);
    el("path", { d: `M ${xe} ${Y0 - yc} Q ${2 * XC - xe} ${Y0} ${xe} ${Y0 + yc}`, class: "cornea" }, g);
    const t0 = -0.95, t1 = 0.95;
    el("path", {
      d: `M ${cx + rx * Math.cos(t0)} ${Y0 + ry * Math.sin(t0)} A ${rx} ${ry} 0 0 1 ${cx + rx * Math.cos(t1)} ${Y0 + ry * Math.sin(t1)}`,
      class: "retina",
    }, g);
    // Iris and crystalline lens (rounder when focusing up close)
    const xi = XC + 3.2 * S, ap = (aperture / 2) * S;
    el("line", { x1: xi, y1: Y0 - ap - 1, x2: xi, y2: Y0 - 6 * S, class: "iris" }, g);
    el("line", { x1: xi, y1: Y0 + ap + 1, x2: xi, y2: Y0 + 6 * S, class: "iris" }, g);
    el("ellipse", { cx: XC + 6 * S, cy: Y0, rx: (1.8 + sol.A * 0.14) * S, ry: (4.5 - sol.A * 0.05) * S, class: "crystalline" }, g);
    text(g, right - 8, Y0 + ry - 6, "retina", "lbl retina-lbl", "end");
    el("circle", { cx: right, cy: Y0, r: 3, class: "fovea" }, g);

    // Glasses
    if (lens) {
      const avg = lens.sph + lens.cyl / 2;
      el("path", { d: lensPath(XG, avg), class: `spec ${avg < 0 ? "minus" : "plus"}` }, svg);
      text(svg, XG, Y0 + 92, rxString(lens), "lbl spec-lbl", "middle");
    }

    // Object
    const xObj = XG - 1 / (Math.abs(V) * K_OUT);
    const objInView = xObj > 24;
    const objName = state.view === "chart" ? "eye chart" : OBJECTS[state.look].label.replace(/^the /, "");
    if (objInView) {
      el("circle", { cx: xObj, cy: Y0, r: 5, class: "object" }, svg);
      text(svg, xObj, Y0 - 16, `${objName}, ${distanceLabel(dist)}`, "lbl", "middle");
    } else {
      text(svg, 12, 26, `Light from the ${objName}, ${distanceLabel(dist)} away`, "lbl");
    }

    // Principal meridians of the whole system (eye + glasses).
    const astig = Math.abs(sol.focusMM[0] - sol.focusMM[1]) > 0.04;
    const P = lens ? rxMatrix(lens) : [0, 0, 0];
    const fans = astig
      ? [{ z: sol.focusMM[0], a: sol.focusAngle, cls: "m1" }, { z: sol.focusMM[1], a: sol.focusAngle + Math.PI / 2, cls: "m2" }]
      : [{ z: (sol.focusMM[0] + sol.focusMM[1]) / 2, a: Math.PI / 2, cls: "m1" }];

    const rays = el("g", { class: "rays" }, svg);
    const marks = el("g", {}, svg);
    const n = 7;
    for (const fan of fans) {
      const Pm = along(P, fan.a);
      const zPx = fan.z * S;
      const fx = XC + zPx;
      for (let i = 0; i < n; i++) {
        const y = ((i / (n - 1)) * 2 - 1) * ap * 0.92; // height at the cornea (up = +)
        if (Math.abs(y) < 0.01 && fans.length > 1 && fan.cls === "m2") continue;
        const denom = Math.max(0.15, 1 - (V + Pm) * K_OUT * (XC - XG));
        const yg = y / denom;
        const sIn = -yg * V * K_OUT;
        const x0 = objInView ? xObj : 0;
        const y0 = objInView ? 0 : yg - sIn * XG;
        // Retina hit: line from (XC, y) toward (fx, 0) against the eye ellipse.
        const m = y / zPx;
        const q = y - m * (cx - XC);
        const A = 1 / rx ** 2 + (m * m) / ry ** 2, B = (-2 * q * m) / ry ** 2, C = (q * q) / ry ** 2 - 1;
        const X = (-B + Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A);
        const xh = cx + X, yh = y - m * (xh - XC);
        const pts = [[x0, y0], [XG, yg], [XC, y], [xh, yh]];
        el("polyline", { points: pts.map(([px, py]) => `${f1(px)},${f1(Y0 - py)}`).join(" "), class: `ray ${fan.cls}` }, rays);
        if (fx > xh + 1) el("line", { x1: xh, y1: Y0 - yh, x2: Math.min(fx, 958), y2: Y0 - (y - m * (Math.min(fx, 958) - XC)), class: `ray ghost ${fan.cls}` }, rays);
      }
      if (fx < 956) {
        el("circle", { cx: fx, cy: Y0, r: 4.5, class: `focus ${fan.cls}` }, marks);
      }
    }

    // The patch of light one point makes on the retina, seen face-on.
    const K = blurKernel(sol.E, state.pupil, squint);
    const e = kernelEllipse(K);
    const d = diffractionArcmin(state.pupil * Math.sqrt(squint));
    const a = Math.hypot(e.a, d), b = Math.hypot(e.b, d);
    const sc = Math.min(2.2, 46 / Math.max(a, b, 1e-6));
    const psf = el("g", { transform: "translate(898 64)" }, svg);
    el("rect", { x: -56, y: -54, width: 112, height: 112, rx: 8, class: "psf-box" }, psf);
    el("ellipse", {
      rx: Math.max(1.5, a * sc), ry: Math.max(1.5, b * sc),
      transform: `rotate(${(-e.angle * 180) / Math.PI})`, class: "psf",
    }, psf);
    text(svg, 898, 136, "one point of light,", "lbl small", "middle");
    text(svg, 898, 150, "as it lands", "lbl small", "middle");

    text(svg, 12, 290, "Inside the eye is to scale; angles outside it are exaggerated.", "lbl small");

    // Caption: say what the picture shows in words.
    const ahead = sol.frontOfRetinaMM;
    let msg;
    if (astig) {
      const deg = (r) => Math.round((((r * 180) / Math.PI) % 180 + 180) % 180);
      msg = `Astigmatism: light spreading along the ${deg(fans[0].a)}° line focuses at a different depth from light along the ${deg(fans[1].a)}° line, so there are two focal lines (yellow and blue) and no single sharp point.`;
    } else if (Math.abs(ahead) < 0.03) {
      msg = "The light comes to a point right on the retina: a sharp image.";
    } else if (ahead > 0) {
      msg = `The light comes to a point ${ahead.toFixed(2)} mm in front of the retina and spreads out again before it lands, so each point becomes a blurry disk.`;
    } else {
      msg = `The light would come to a point ${(-ahead).toFixed(2)} mm behind the retina, so it lands while still spread out.`;
    }
    if (sol.A > 0.05) msg += ` The eye is focusing by ${sol.A.toFixed(2)} D, which makes its lens rounder.`;
    caption.textContent = msg;
  };
}
