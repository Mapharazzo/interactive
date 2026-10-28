// The simulated view: draws the scene or chart, blurs each layer for the
// eye + glasses in the current state, and shows readouts for the object the
// eye is looking at.

import { W, H, FONT, drawChart, drawScene, hitTest, ANCHORS, SCENE_PX_PER_ARCMIN, CHART_PX_PER_ARCMIN } from "./scenes.js";
import { createRenderer } from "./blur.js";
import { solve, blurKernel, pixelKernel, marArcmin, snellen } from "./optics.js";
import { set, subscribe, OBJECTS, lensOf, squintOf } from "./state.js";

const LOG_MIN = 0.25, LOG_MAX = 6;
const toDist = (t) => LOG_MIN * (LOG_MAX / LOG_MIN) ** (t / 100);
const toT = (d) => (100 * Math.log(d / LOG_MIN)) / Math.log(LOG_MAX / LOG_MIN);

export function createView(root) {
  const $ = (s) => root.querySelector(s);
  const canvas = $("#view-canvas");
  canvas.width = W;
  canvas.height = H;
  const overlay = $("#view-overlay");
  const renderer = createRenderer(canvas);
  if (!renderer.webgl) root.classList.add("no-webgl");

  let scene, chart;
  function drawSources() {
    if (scene) Object.values(scene).forEach(renderer.forget);
    if (chart) renderer.forget(chart.canvas);
    scene = drawScene();
    chart = drawChart();
    buildChartLabels();
  }

  // Sharp labels next to the chart rows (annotations, not part of what the eye sees).
  const labels = document.createElement("div");
  labels.className = "chart-labels";
  overlay.append(labels);
  function buildChartLabels() {
    labels.replaceChildren(...chart.rows.map((r) => {
      const d = document.createElement("span");
      d.textContent = `20/${r.line}`;
      d.dataset.line = r.line;
      d.style.top = `${(r.y / H) * 100}%`;
      return d;
    }));
  }
  const marker = document.createElement("div");
  marker.className = "focus-marker";
  overlay.append(marker);

  // View tabs
  const tabs = [...root.querySelectorAll("[data-view]")];
  tabs.forEach((b) => b.addEventListener("click", () => set({ view: b.dataset.view })));
  // Look-at buttons
  const looks = [...root.querySelectorAll("[data-look]")];
  looks.forEach((b) => b.addEventListener("click", () => set({ look: b.dataset.look })));
  // Chart distance
  const dist = $("#chart-distance");
  const distOut = $("#chart-distance-out");
  dist.addEventListener("input", () => set({ chartDistance: Math.round(toDist(+dist.value) * 100) / 100 }));
  // Click on the scene to look at something
  canvas.addEventListener("click", (e) => {
    const view = root.dataset.view;
    if (view !== "scene") return;
    const r = canvas.getBoundingClientRect();
    set({ look: hitTest(scene, ((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H) });
  });
  // Glasses
  const gBtn = $("#glasses-toggle");
  let current;
  gBtn.addEventListener("click", () => set({ glasses: { on: !current.glasses.on } }));
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "g" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName) && document.activeElement.type !== "range") return;
    set({ glasses: { on: !current.glasses.on } });
  });

  const out = {
    acuity: $("#ro-acuity"), acuityMetric: $("#ro-acuity-metric"), acuityNote: $("#ro-acuity-note"),
    focus: $("#ro-focus"), effort: $("#ro-effort"), effortBar: $("#ro-effort-bar"), effortNote: $("#ro-effort-note"),
    target: $("#ro-target"),
  };

  function render(s) {
    current = s;
    root.dataset.view = s.view;
    tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === s.view)));
    looks.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.look === s.look)));
    gBtn.setAttribute("aria-pressed", String(s.glasses.on));
    gBtn.querySelector("span").textContent = s.glasses.on ? "Glasses on" : "Glasses off";
    dist.value = toT(s.chartDistance);
    distOut.textContent = s.chartDistance >= 1 ? `${s.chartDistance.toFixed(1)} m` : `${Math.round(s.chartDistance * 100)} cm`;

    const lens = lensOf(s), squint = squintOf(s), pupil = s.pupil;
    const targetD = s.view === "chart" ? s.chartDistance : OBJECTS[s.look].distance;
    const fix = solve(s.eye, lens, -1 / targetD);
    const kernelFor = (E, pxPerArcmin) => pixelKernel(blurKernel(E, pupil, squint), pxPerArcmin, pupil, squint);

    if (s.view === "chart") {
      renderer.render([{ canvas: chart.canvas, kernel: kernelFor(fix.E, CHART_PX_PER_ARCMIN) }]);
    } else {
      renderer.render(["far", "room", "near"].map((k) => {
        const sol = solve(s.eye, lens, -1 / OBJECTS[k].distance, fix.A); // same focus for the whole view
        return { canvas: scene[k], kernel: kernelFor(sol.E, SCENE_PX_PER_ARCMIN) };
      }));
      const a = ANCHORS[s.look];
      marker.style.left = `${(a.x / W) * 100}%`;
      marker.style.top = `${(a.y / H) * 100}%`;
    }

    // Readouts for the object being looked at.
    const mar = marArcmin(blurKernel(fix.E, pupil, squint), pupil, squint);
    const sn = snellen(mar);
    out.target.textContent = s.view === "chart" ? `the chart at ${distOut.textContent}` : `${OBJECTS[s.look].label} (${OBJECTS[s.look].distance >= 1 ? OBJECTS[s.look].distance + " m" : OBJECTS[s.look].distance * 100 + " cm"})`;
    out.acuity.textContent = sn.raw > 400 ? "worse than 20/400" : `20/${sn.feet}`;
    out.acuityMetric.textContent = sn.raw > 400 ? "" : `6/${sn.metric}`;
    out.acuityNote.textContent =
      sn.raw <= 21 ? "Sharp. This is normal vision or better."
      : sn.raw <= 42 ? "A little soft. Most places let you drive at 20/40."
      : sn.raw <= 200 ? "Blurry. Below the usual driving standard."
      : "Very blurry. Worse than the big E at the top of the chart.";
    const ahead = fix.frontOfRetinaMM;
    const where = (mm) => Math.abs(mm) < 0.02 ? "on the retina"
      : `${Math.abs(mm).toFixed(2)} mm ${mm > 0 ? "in front of" : "behind"} the retina`;
    const [z1, z2] = fix.focusMM.map((z) => fix.axialMM - z);
    out.focus.textContent = Math.abs(z1 - z2) > 0.04
      ? `Two focal lines: ${where(Math.max(z1, z2))} and ${where(Math.min(z1, z2))}`
      : where(ahead);
    out.effort.textContent = `${fix.A.toFixed(1)} of ${fix.amp.toFixed(1)} D`;
    out.effortBar.style.width = `${Math.min(100, (fix.A / fix.amp) * 100)}%`;
    out.effortBar.classList.toggle("maxed", fix.A >= fix.amp - 1e-6 && ahead < -0.02);
    out.effortNote.textContent =
      fix.A >= fix.amp - 1e-6 && ahead < -0.02 ? "Maxed out, and still not enough."
      : ahead > 0.02 ? "Focusing harder would only make it worse, so the eye relaxes."
      : fix.A / fix.amp > 0.66 ? "Working hard. This gets tiring."
      : fix.A > 0.05 ? "Comfortable." : "Fully relaxed.";

    // Chart: point at the smallest row this eye can make out.
    const lines = [...labels.children];
    const best = lines.map((l) => +l.dataset.line).filter((l) => l >= sn.raw * 0.97).sort((a, b) => a - b)[0];
    lines.forEach((l) => l.classList.toggle("readable", +l.dataset.line === best));
  }

  drawSources();
  subscribe(render);
  // Redraw once the web font is in, so canvas text uses it.
  document.fonts?.load(`700 30px ${FONT}`).then(() => document.fonts.ready).then(() => {
    drawSources();
    render(current);
  });
}
