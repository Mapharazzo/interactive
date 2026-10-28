export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// Diverging color for a vector component: blue for negative, orange for positive.
export function cellColor(x) {
  const a = Math.min(1, Math.abs(Math.tanh(x / 1.4)));
  const rgb = x >= 0 ? "var(--pos)" : "var(--neg)";
  return `rgba(${rgb}, ${(0.12 + 0.88 * a).toFixed(3)})`;
}

export function vecEl(vec, kind) {
  return h("span", { class: `vec ${kind}`, title: `${kind.toUpperCase()} = [${vec.map((x) => x.toFixed(2)).join(", ")}]` },
    vec.map((x) => h("span", { class: "cell", style: `background:${cellColor(x)}` })));
}

export function weightColor(w) {
  return `color-mix(in srgb, var(--k) ${Math.round(8 + w * 92)}%, transparent)`;
}

export const nf = new Intl.NumberFormat("en-US");

export function compact(n) {
  if (n < 1e4) return nf.format(Math.round(n));
  const units = [[1e15, "P"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [d, u] of units) if (n >= d) return (n / d).toFixed(n / d < 10 ? 2 : n / d < 100 ? 1 : 0) + u;
  return String(n);
}

export function bytes(b) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b < 10 && i > 0 ? 2 : b < 100 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// Restart a CSS animation on an element.
export function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

export function setTabs(buttons, active) {
  buttons.forEach((b) => b.setAttribute("aria-selected", String(b === active)));
}

export function player(button, tick, ms = 1100) {
  let timer = null;
  const stop = () => { clearInterval(timer); timer = null; button.textContent = "▶ Play"; };
  const start = () => {
    button.textContent = "❚❚ Pause";
    timer = setInterval(() => { if (!tick()) stop(); }, ms);
  };
  button.addEventListener("click", () => (timer ? stop() : (tick() ? start() : null)));
  return { stop, get playing() { return !!timer; } };
}
