import { $, h } from "./util.js";

const QUESTIONS = [
  {
    q: "Why do we cache keys and values, but not queries?",
    opts: ["Queries are too large to store", "Past queries are never used again — only the newest token's query is needed", "Queries change every step, so caching them would be wrong", "We do cache queries, in a separate Q cache"],
    a: 1,
    why: "A past token's query only produced that token's own output, which was already used. Every new token needs all past keys and values, but only its own query.",
  },
  {
    q: "Why are cached K and V still correct after new tokens are appended?",
    opts: ["They're approximations that are periodically refreshed", "Because of the causal mask: an earlier token can't see later tokens, so its hidden state — and its K/V at every layer — never changes", "Because the weights are frozen during inference", "Because softmax is renormalised every step"],
    a: 1,
    why: "Frozen weights alone aren't enough (bidirectional models like BERT can't use a KV cache). It's the causal mask that makes position i's computation depend only on tokens ≤ i.",
  },
  {
    q: "Llama 2 7B has 32 layers, 32 KV heads and head dim 128. In fp16, how big is its KV cache per token?",
    opts: ["64 KB", "512 KB", "4 MB", "14 GB"],
    a: 1,
    why: "2 × 32 × 32 × 128 × 2 bytes = 524,288 bytes = 512 KB. A 4,096-token context is therefore 2 GB per sequence.",
  },
  {
    q: "A model switches from 32 KV heads (MHA) to 8 KV heads (GQA). What happens to the KV cache?",
    opts: ["Nothing; the query heads determine its size", "It becomes 4× smaller", "It becomes 2× smaller", "It disappears"],
    a: 1,
    why: "Cache size is proportional to the number of KV heads: 32 → 8 is a 4× reduction.",
  },
  {
    q: "With a KV cache, what usually limits the speed of the decode phase?",
    opts: ["Floating-point throughput (FLOPs)", "Memory bandwidth — reading weights and the cache for every token", "Tokenization", "Network latency"],
    a: 1,
    why: "Each decode step does little arithmetic per byte it reads. Batching more sequences together amortises reading the weights, which is why serving systems fight so hard for KV cache memory.",
  },
];

export function createQuiz() {
  const root = $("#quiz-root");
  QUESTIONS.forEach((item, qi) => {
    const explain = h("div", { class: "q-explain" }, item.why);
    const opts = h("div", { class: "q-opts" });
    item.opts.forEach((o, i) => opts.append(h("button", {
      onclick: (e) => {
        [...opts.children].forEach((b) => b.classList.remove("wrong"));
        if (i === item.a) { e.currentTarget.classList.add("right"); explain.classList.add("show"); }
        else e.currentTarget.classList.add("wrong");
      },
    }, o)));
    root.append(h("div", { class: "q-card" }, h("p", {}, `${qi + 1}. ${item.q}`), opts, explain));
  });
}
