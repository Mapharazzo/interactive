import { set, subscribe, readURL, writeURL } from "./state.js";
import { createView } from "./view.js";
import { createControls } from "./controls.js";
import { createBench } from "./bench.js";
import { createLensDemo } from "./lensdemo.js";
import { createAgeChart } from "./agechart.js";
import { createRx } from "./rx.js";
import { createHero } from "./hero.js";

const $ = (s) => document.querySelector(s);

readURL();
createHero($(".hero-chart"));
createView($("#lab"));
createControls($("#panel"));
subscribe(createBench($("#bench"), $("#bench-caption")));
createLensDemo($("#lens-demo"));
createAgeChart($("#age-chart"));

// "Show me" buttons in the text load a full lab setup and jump to the lab,
// leaving a way back to where the reader was.
const BASE = { pupil: 4, squint: false, view: "scene", look: "far", chartDistance: 6 };
const back = $("#back-to-text");
let origin = null;

function goToLab(from) {
  origin = from;
  back.hidden = !from;
  if (from) back.querySelector("span").textContent = `Back to “${from.closest("section").querySelector("h2").textContent}”`;
  $("#lab").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

document.querySelectorAll("[data-preset]").forEach((b) => {
  b.addEventListener("click", () => {
    const p = JSON.parse(b.dataset.preset);
    set({ ...BASE, ...p, glasses: { on: false, ...p.glasses } });
    goToLab(b);
  });
});
back.addEventListener("click", () => {
  origin?.scrollIntoView({ behavior: "smooth", block: "center" });
  origin?.focus({ preventScroll: true });
  back.hidden = true;
});
// Hide the chip once the reader is back where they left off.
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting && e.target === origin) back.hidden = true;
});
document.querySelectorAll("[data-preset], .rx-load").forEach((b) => io.observe(b));

let first = true;
subscribe((s) => (first ? (first = false) : writeURL(s)));

createRx($("#rx"), () => goToLab($("#rx .rx-load")));
