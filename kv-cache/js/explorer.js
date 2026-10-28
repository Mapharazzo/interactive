import { qkv, attend, fmt } from "./model.js";
import { h, vecEl } from "./util.js";

// Section 2: click a token to make it the query and see its attention.
export function createExplorer(root) {
  let tokens = [];
  let query = 0;

  function render() {
    root.replaceChildren();
    if (!tokens.length) return;
    const vecs = tokens.map((t, i) => qkv(t, i));
    const visible = vecs.slice(0, query + 1);
    const { scores, weights, out } = attend(vecs[query].q, visible.map((r) => r.k), visible.map((r) => r.v));

    const toks = h("div", { class: "explorer-toks", role: "group", "aria-label": "Pick a query token" },
      tokens.map((t, i) => {
        const masked = i > query;
        return h("button", {
          class: i === query ? "query" : masked ? "masked" : "",
          title: masked ? "Masked: a token can't attend to the future" : `weight ${(weights[i] * 100).toFixed(1)}%`,
          "aria-pressed": String(i === query),
          onclick: () => { query = i; render(); },
        }, t, !masked && h("span", { class: "w", style: `transform: scaleX(${weights[i]})` }));
      }));

    const bars = h("div", { class: "attn-bars" },
      visible.map((r, i) => h("div", { class: `attn-bar ${i === query ? "self" : ""}` },
        h("span", { class: "lbl" }, tokens[i]),
        h("span", { class: "track" }, h("span", { class: "fill", style: `width:${(weights[i] * 100).toFixed(1)}%` })),
        h("span", { class: "pct" }, `${(weights[i] * 100).toFixed(0)}%`))));

    root.append(
      toks,
      h("div", { class: "explorer-grid" },
        h("div", {},
          h("div", { class: "flow" }, "Query of ", h("b", {}, `"${tokens[query]}"`), vecEl(vecs[query].q, "q"),
            " · each key ", h("span", { class: "chip k" }, "K"), " → softmax"),
          bars),
        h("div", {},
          h("div", { class: "flow" }, "Output = Σ weight × value", vecEl(out, "v")),
          h("p", { class: "explorer-note" },
            `"${tokens[query]}" used ${query + 1} key${query ? "s" : ""} and ${query + 1} value${query ? "s" : ""}, but only its own query. `,
            query > 0 ? `Raw scores: ${scores.map((s) => fmt(s)).join(", ")}.` : "The first token can only attend to itself.",
            " Tokens after it are masked — they don't exist yet when it's generated."),
          h("p", { class: "explorer-note" },
            "Notice: the keys and values of earlier tokens are exactly the same no matter which token you pick as the query. ",
            h("b", {}, "That's what makes them cacheable.")))));
  }

  return {
    setTokens(t) { tokens = t; query = Math.min(tokens.length - 1, Math.max(query, Math.min(4, tokens.length - 1))); render(); },
  };
}
