// One shared state object for the lab. Every widget reads from it and
// re-renders when it changes; presets in the text just patch it.

export const OBJECTS = {
  near: { label: "the phone", distance: 0.4 },
  room: { label: "the calendar", distance: 3 },
  far: { label: "the library sign", distance: 40 },
};

export const state = {
  eye: { sph: -2.5, cyl: 0, axis: 180, age: 30 },
  pupil: 4, // mm
  squint: false,
  glasses: { on: false, sph: -2.5, cyl: 0, axis: 180 },
  view: "scene", // "scene" | "chart"
  look: "far", // which scene object the eye focuses on
  chartDistance: 6, // metres
};

const listeners = new Set();
let queued = false;

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

// Shallow-merges nested objects one level deep: set({ eye: { sph: -3 } }).
export function set(patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(state[k], v);
    else state[k] = v;
  }
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    listeners.forEach((fn) => fn(state));
  });
}

export const lensOf = (s) => (s.glasses.on ? s.glasses : null);
export const pupilOf = (s) => s.pupil;
export const squintOf = (s) => (s.squint ? 0.3 : 1);
export const targetDistance = (s) => (s.view === "chart" ? s.chartDistance : OBJECTS[s.look].distance);

// The lab setup lives in the query string, so any setup can be linked to:
// ?eye=sph,cyl,axis,age&glasses=on,sph,cyl,axis&pupil=4&squint=0&view=scene&look=far&chart=6
export function readURL() {
  const q = new URLSearchParams(location.search);
  const nums = (k) => q.get(k)?.split(",").map(Number).filter((n) => Number.isFinite(n));
  const e = nums("eye"), g = nums("glasses");
  if (e?.length === 4) Object.assign(state.eye, { sph: e[0], cyl: e[1], axis: e[2], age: e[3] });
  if (g?.length === 4) Object.assign(state.glasses, { on: !!g[0], sph: g[1], cyl: g[2], axis: g[3] });
  if (q.has("pupil")) state.pupil = +q.get("pupil") || state.pupil;
  if (q.has("squint")) state.squint = q.get("squint") === "1";
  if (["scene", "chart"].includes(q.get("view"))) state.view = q.get("view");
  if (q.get("look") in OBJECTS) state.look = q.get("look");
  if (q.has("chart")) state.chartDistance = Math.min(6, Math.max(0.25, +q.get("chart") || 6));
}

let urlTimer;
export function writeURL(s) {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const { eye: e, glasses: g } = s;
    const q = `?eye=${e.sph},${e.cyl},${e.axis},${e.age}&glasses=${+g.on},${g.sph},${g.cyl},${g.axis}`
      + `&pupil=${s.pupil}&squint=${+s.squint}&view=${s.view}&look=${s.look}&chart=${s.chartDistance}`;
    history.replaceState(null, "", q + location.hash);
  }, 250);
}
