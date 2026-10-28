import { $, h, player } from "./util.js";

// Section 8: contiguous max-length reservation vs. paged (block) allocation.
const SLOTS = 64, MAX = 16, PAGE = 4, PAGES = SLOTS / PAGE;
const LENGTHS = [6, 13, 4, 9, 15, 5, 11, 3, 8, 7, 12, 4, 10, 6];
const color = (i) => `hsl(${(i * 137.5) % 360} 65% 50%)`;

function contiguousSim() {
  const owner = new Array(SLOTS).fill(-1);
  const st = { name: "contig", queue: LENGTHS.map((_, i) => i), running: [], finished: 0, steps: 0, preempt: 0 };
  st.admit = () => {
    while (st.queue.length) {
      let start = -1;
      for (let a = 0; a + MAX <= SLOTS; a++) if (owner.slice(a, a + MAX).every((o) => o === -1)) { start = a; break; }
      if (start < 0) break;
      const id = st.queue.shift();
      for (let i = start; i < start + MAX; i++) owner[i] = id;
      st.running.push({ id, len: LENGTHS[id], pos: 0, start });
    }
  };
  st.grow = (r) => { r.pos++; return true; };
  st.free = (r) => { for (let i = r.start; i < r.start + MAX; i++) owner[i] = -1; };
  st.slots = () => owner.map((id, i) => {
    if (id < 0) return { id };
    const r = st.running.find((x) => x.id === id);
    return { id, filled: i - r.start < r.pos };
  });
  return st;
}

function pagedSim() {
  const pageOwner = new Array(PAGES).fill(-1);
  const freeList = [...Array(PAGES).keys()];
  const st = { name: "paged", queue: LENGTHS.map((_, i) => i), running: [], finished: 0, steps: 0, preempt: 0 };
  const take = (r) => { const p = freeList.shift(); pageOwner[p] = r.id; r.pages.push(p); };
  st.admit = () => {
    // Keep one page of headroom so running requests can grow (a simple watermark).
    while (st.queue.length && freeList.length > 1) {
      const id = st.queue.shift();
      const r = { id, len: LENGTHS[id], pos: 0, pages: [] };
      take(r);
      st.running.push(r);
    }
  };
  st.free = (r) => { for (const p of r.pages) { pageOwner[p] = -1; freeList.push(p); } r.pages = []; };
  st.grow = (r) => {
    if (r.pos === r.pages.length * PAGE) {
      if (!freeList.length) {
        // Out of pages: preempt the most recently admitted other request (it will be recomputed later).
        const victim = [...st.running].reverse().find((x) => x !== r);
        if (!victim) return false;
        st.free(victim); victim.pos = 0;
        st.running.splice(st.running.indexOf(victim), 1);
        st.queue.unshift(victim.id); st.preempt++;
      }
      take(r);
    }
    r.pos++;
    return true;
  };
  st.slots = () => {
    const out = new Array(SLOTS).fill(null).map(() => ({ id: -1 }));
    for (const r of st.running) r.pages.forEach((p, k) => {
      for (let o = 0; o < PAGE; o++) out[p * PAGE + o] = { id: r.id, filled: k * PAGE + o < r.pos };
    });
    return out;
  };
  return st;
}

function tick(st) {
  if (!st.queue.length && !st.running.length) return false;
  st.steps++;
  st.admit();
  for (const r of [...st.running]) if (st.running.includes(r)) st.grow(r);
  for (const r of [...st.running]) if (r.pos >= r.len) { st.free(r); st.running.splice(st.running.indexOf(r), 1); st.finished++; }
  return true;
}

export function createPaged() {
  const els = { contig: $("#pg-contig"), contigStats: $("#pg-contig-stats"), paged: $("#pg-paged"), pagedStats: $("#pg-paged-stats"), queue: $("#pg-queue"), step: $("#pg-step"), play: $("#pg-play"), reset: $("#pg-reset") };
  let sims;

  function renderSim(st, grid, stats) {
    const slots = st.slots();
    grid.replaceChildren(...slots.map((sl, i) => {
      let style = "";
      if (sl.id >= 0) style = sl.filled ? `background:${color(sl.id)}` : `background: repeating-linear-gradient(45deg, ${color(sl.id)} 0 2px, transparent 2px 5px); opacity:.55`;
      return h("span", { class: `slot ${st.name === "paged" && i % PAGE === 0 ? "page-start" : ""}`, style, title: sl.id >= 0 ? `R${sl.id + 1}${sl.filled ? "" : " (reserved, empty)"}` : "free" });
    }));
    const used = slots.filter((x) => x.id >= 0 && x.filled).length;
    const reserved = slots.filter((x) => x.id >= 0 && !x.filled).length;
    const rows = [
      ["Step", st.steps, ""],
      ["Requests running at once", st.running.length, ""],
      ["Requests finished", `${st.finished} / ${LENGTHS.length}`, st.finished === LENGTHS.length ? "good" : ""],
      ["Slots holding real K/V", `${used} (${Math.round((used / SLOTS) * 100)}%)`, ""],
      ["Reserved but empty", reserved, reserved > 8 ? "bad" : ""],
    ];
    if (st.name === "paged") rows.push(["Preemptions (out of pages)", st.preempt, ""]);
    stats.replaceChildren(...rows.flatMap(([k, v, c]) => [h("span", { class: "k" }, k), h("span", { class: `v ${c}` }, v)]));
  }

  function render() {
    renderSim(sims[0], els.contig, els.contigStats);
    renderSim(sims[1], els.paged, els.pagedStats);
    els.queue.replaceChildren("Requests (final length unknown to the server):",
      ...LENGTHS.map((len, i) => h("span", { class: "req", style: `background:${color(i)}` }, `R${i + 1}·${len}`)));
    els.step.disabled = sims.every((s) => !s.queue.length && !s.running.length);
  }

  function step() {
    const a = tick(sims[0]), b = tick(sims[1]);
    render();
    return (a || b) && !els.step.disabled;
  }

  const play = player(els.play, step, 450);
  els.step.addEventListener("click", () => { play.stop(); step(); });
  els.reset.addEventListener("click", () => { play.stop(); sims = [contiguousSim(), pagedSim()]; render(); });
  sims = [contiguousSim(), pagedSim()];
  render();
}
