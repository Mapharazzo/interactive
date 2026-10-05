import { causalMatrix, fmt } from "./model.js";
import { $, h, weightColor, setTabs } from "./util.js";

// Section 4: the causal attention matrix, and which part each step actually needs.
export function createMatrix() {
  const els = { grid: $("#mx-grid"), stats: $("#mx-stats"), tip: $("#mx-tip"), t: $("#mx-t"), tOut: $("#mx-t-out"), nc: $("#mx-mode-nc"), c: $("#mx-mode-c") };
  let tokens = [], M = [], mode = "nocache";

  function render() {
    const n = tokens.length, last = +els.t.value, t = last + 1;
    els.tOut.textContent = `${last} (“${tokens[last]}”)`;
    const cw = window.innerWidth <= 480 ? 26 : 34;
    els.grid.style.gridTemplateColumns = `${cw === 26 ? 56 : 76}px repeat(${n}, ${cw}px)`;
    const cells = [h("span", { class: "mx-lbl" }, "q ↓  k →")];
    tokens.forEach((tok, j) => cells.push(h("span", { class: `mx-lbl col ${mode === "cache" && j < last ? "hl" : ""}`, title: `key ${j}: ${tok}` }, tok)));
    for (let i = 0; i < n; i++) {
      cells.push(h("span", { class: `mx-lbl row ${i === last ? "qhl" : ""}`, title: `query ${i}: ${tokens[i]}` }, tokens[i]));
      for (let j = 0; j < n; j++) {
        if (j > i) { cells.push(h("span", { class: "mx-cell masked", title: "masked (future)" })); continue; }
        const w = M[i].weights[j];
        let cls = "mx-cell";
        if (i > last) cls += " future";
        else if (i === last) cls += " computed needed";
        else cls += mode === "nocache" ? " computed" : " done";
        const cell = h("span", { class: cls, style: `background:${weightColor(w)}` }, Math.round(w * 100));
        cell.addEventListener("mouseenter", () => showTip(i, j));
        cell.addEventListener("focus", () => showTip(i, j));
        cell.tabIndex = i <= last ? 0 : -1;
        cells.push(cell);
      }
    }
    els.grid.replaceChildren(...cells);

    const rows = mode === "nocache"
      ? [["Queries computed", t, "bad"], ["Keys & values computed", t, "bad"], ["Keys & values read from cache", 0, ""], ["Attention scores computed", (t * (t + 1)) / 2, "bad"], ["…actually needed", t, ""]]
      : [["Queries computed", 1, "good"], ["Keys & values computed", 1, "good"], ["Keys & values read from cache", t - 1, ""], ["Attention scores computed", t, "good"], ["…actually needed", t, ""]];
    els.stats.replaceChildren(
      h("span", { class: "k", style: "grid-column: 1 / -1; font-weight:600; color: var(--fg)" }, `Producing the output for position ${last}:`),
      ...rows.flatMap(([k, v, c]) => [h("span", { class: "k" }, k), h("span", { class: `v ${c}` }, v)]),
      h("span", { class: "k", style: "grid-column: 1 / -1; margin-top:8px" },
        mode === "nocache"
          ? "Red outlines are scores recomputed for rows whose result was already used on earlier steps."
          : "Faded rows were computed on earlier steps and are never needed again. Highlighted key labels are served from the cache."));
  }

  function showTip(i, j) {
    const r = M[i];
    els.tip.replaceChildren(
      h("b", {}, `q(“${tokens[i]}”) · k(“${tokens[j]}”) / √d = ${fmt(r.scores[j])}`), h("br"),
      `after softmax over row ${i}: ${(r.weights[j] * 100).toFixed(1)}% of “${tokens[i]}”'s attention goes to “${tokens[j]}”.`);
  }

  function setMode(m) { mode = m; setTabs([els.nc, els.c], m === "nocache" ? els.nc : els.c); render(); }
  els.nc.addEventListener("click", () => setMode("nocache"));
  els.c.addEventListener("click", () => setMode("cache"));
  els.t.addEventListener("input", render);
  window.addEventListener("resize", () => tokens.length && render());

  return {
    setTokens(t) {
      tokens = t; M = causalMatrix(t);
      els.t.max = t.length - 1;
      if (+els.t.value > t.length - 1) els.t.value = t.length - 1;
      render();
    },
  };
}
