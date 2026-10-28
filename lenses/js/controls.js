// The lab's control panel: the eye on one side, the glasses on the other.

import { amplitude, dioptres, rxString } from "./optics.js";
import { set, subscribe } from "./state.js";

export const EYE_PRESETS = [
  { name: "Sharp", eye: { sph: 0, cyl: 0, axis: 180, age: 25 } },
  { name: "Nearsighted", eye: { sph: -2.5, cyl: 0, axis: 180, age: 30 } },
  { name: "Farsighted", eye: { sph: 2.5, cyl: 0, axis: 180, age: 40 } },
  { name: "Astigmatism", eye: { sph: 0, cyl: -1.75, axis: 180, age: 30 } },
  { name: "Aging eyes", eye: { sph: 0, cyl: 0, axis: 180, age: 60 } },
];

export function readingAdd(age) {
  return Math.max(0.75, Math.round((2.5 - amplitude(age) / 2) * 4) / 4);
}

function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}

const pupilNote = (p) => (p <= 2.5 ? "bright sun" : p <= 4 ? "indoors" : p <= 6 ? "dim room" : "night");

export function createControls(panel) {
  const syncs = [];
  let st;

  function slider({ id, label, min, max, step, get, put, fmt, track = "", hint }) {
    const input = h("input", { type: "range", id, min, max, step, class: track });
    if (track === "signed") input.style.setProperty("--zero", `${(-min / (max - min)) * 100}%`);
    const out = h("output", { for: id });
    input.addEventListener("input", () => put(+input.value));
    const row = h("div", { class: "ctl" },
      h("label", { for: id }, h("span", {}, label), out),
      input,
      hint ? h("div", { class: "ends" }, ...hint.map((t) => h("span", {}, t))) : "");
    syncs.push((s) => {
      input.value = get(s);
      out.textContent = fmt(get(s), s);
    });
    return row;
  }
  const chips = (items) => h("div", { class: "chips" }, ...items.map(([text, fn, title]) => h("button", { type: "button", class: "chip", onclick: fn, title: title || "" }, text)));

  // ---- Eye
  const eyeSet = (patch) => set({ eye: patch });
  const eye = h("fieldset", { class: "group" },
    h("legend", {}, "Your eye"),
    chips(EYE_PRESETS.map((p) => [p.name, () => set({ eye: p.eye, glasses: { on: false, sph: p.eye.sph, cyl: p.eye.cyl, axis: p.eye.axis }, squint: false })])),
    slider({ id: "c-sph", label: "Focusing error", min: -10, max: 6, step: 0.25, track: "signed",
      get: (s) => s.eye.sph, put: (v) => eyeSet({ sph: v }), fmt: (v) => `${dioptres(v)} D`,
      hint: ["nearsighted", "farsighted"] }),
    slider({ id: "c-cyl", label: "Astigmatism", min: -4, max: 0, step: 0.25,
      get: (s) => s.eye.cyl, put: (v) => eyeSet({ cyl: v }), fmt: (v) => (v === 0 ? "none" : `${dioptres(v)} D`) }),
    slider({ id: "c-axis", label: "Astigmatism axis", min: 0, max: 180, step: 5,
      get: (s) => s.eye.axis, put: (v) => eyeSet({ axis: v }), fmt: (v) => `${v}°` }),
    slider({ id: "c-age", label: "Age", min: 8, max: 80, step: 1,
      get: (s) => s.eye.age, put: (v) => eyeSet({ age: v }),
      fmt: (v) => `${v}, can focus ${amplitude(v).toFixed(1)} D` }),
    slider({ id: "c-pupil", label: "Pupil", min: 2, max: 8, step: 0.5,
      get: (s) => s.pupil, put: (v) => set({ pupil: v }), fmt: (v) => `${v.toFixed(1)} mm, ${pupilNote(v)}` }),
    h("label", { class: "check" },
      h("input", { type: "checkbox", id: "c-squint", onchange: (e) => set({ squint: e.target.checked }) }),
      h("span", {}, "Squint")),
  );
  syncs.push((s) => {
    eye.querySelector("#c-squint").checked = s.squint;
    eye.querySelector("#c-axis").disabled = s.eye.cyl === 0;
  });

  // ---- Glasses
  const gSet = (patch) => set({ glasses: { on: true, ...patch } });
  const rxOut = h("p", { class: "rx-out" });
  const switchBtn = h("button", { type: "button", class: "switch", role: "switch", onclick: () => set({ glasses: { on: !st.glasses.on } }) }, h("span", {}, "Wearing them"));
  const readingBtn = h("button", { type: "button", class: "chip" });
  const glasses = h("fieldset", { class: "group" },
    h("legend", {}, "Your glasses"),
    switchBtn,
    chips([
      ["Match my eye", () => gSet({ sph: st.eye.sph, cyl: st.eye.cyl, axis: st.eye.axis }), "Glasses that cancel the eye's error for distance"],
      ["Too strong", () => gSet({ sph: st.eye.sph + (st.eye.sph > 0 ? 1.25 : -1.25), cyl: st.eye.cyl, axis: st.eye.axis })],
      ["Opposite", () => gSet({ sph: -st.eye.sph, cyl: 0 }), "A lens bending light the wrong way"],
    ]),
    slider({ id: "g-sph", label: "Lens power", min: -10, max: 6, step: 0.25, track: "signed",
      get: (s) => s.glasses.sph, put: (v) => gSet({ sph: v }), fmt: (v) => `${dioptres(v)} D`,
      hint: ["spreads light (−)", "converges light (+)"] }),
    slider({ id: "g-cyl", label: "Cylinder", min: -4, max: 0, step: 0.25,
      get: (s) => s.glasses.cyl, put: (v) => gSet({ cyl: v }), fmt: (v) => (v === 0 ? "none" : `${dioptres(v)} D`) }),
    slider({ id: "g-axis", label: "Cylinder axis", min: 0, max: 180, step: 5,
      get: (s) => s.glasses.axis, put: (v) => gSet({ axis: v }), fmt: (v) => `${v}°` }),
    rxOut,
  );
  glasses.querySelector(".chips").append(readingBtn);
  readingBtn.addEventListener("click", () => {
    const add = readingAdd(st.eye.age);
    gSet({ sph: st.eye.sph + add, cyl: st.eye.cyl, axis: st.eye.axis });
  });
  syncs.push((s) => {
    switchBtn.setAttribute("aria-checked", String(s.glasses.on));
    glasses.classList.toggle("off", !s.glasses.on);
    glasses.querySelector("#g-axis").disabled = s.glasses.cyl === 0;
    readingBtn.textContent = `Reading (${dioptres(readingAdd(s.eye.age))} add)`;
    rxOut.textContent = `Lens prescription: ${rxString(s.glasses)}`;
  });

  panel.append(eye, glasses);
  subscribe((s) => {
    st = s;
    syncs.forEach((f) => f(s));
  });
}
