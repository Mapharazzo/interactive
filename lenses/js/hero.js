// The hero: an eye chart headline, out of focus, with a lens that brings
// whatever is under it back into focus.

export function createHero(root) {
  const lens = root.querySelector(".loupe");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let touched = false;

  function place(px, py) {
    root.style.setProperty("--x", `${px}px`);
    root.style.setProperty("--y", `${py}px`);
  }
  function fromEvent(e) {
    const r = root.getBoundingClientRect();
    place(e.clientX - r.left, e.clientY - r.top);
  }
  root.addEventListener("pointermove", (e) => { touched = true; fromEvent(e); });
  root.addEventListener("pointerdown", (e) => { touched = true; fromEvent(e); });

  // Keyboard: the lens is focusable and moves with the arrow keys.
  lens.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 60 : 20;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    touched = true;
    const cs = getComputedStyle(root);
    place(parseFloat(cs.getPropertyValue("--x")) + d[0], parseFloat(cs.getPropertyValue("--y")) + d[1]);
  });

  // Start over the second row; sweep once across the chart on load.
  const r = root.getBoundingClientRect();
  const row = root.querySelector(".sharp .r2").getBoundingClientRect();
  const yy = row.top - r.top + row.height / 2;
  const from = r.width * 0.18, to = r.width * 0.5;
  place(reduce ? to : from, yy);
  if (reduce) return;
  const t0 = performance.now(), dur = 1800;
  (function tick(t) {
    if (touched) return;
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - (1 - k) ** 3;
    place(from + (to - from) * e, yy);
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}
