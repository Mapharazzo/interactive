// A tiny, deterministic single-head "transformer layer" used by every demo.
// Numbers are real: embeddings and weights come from a seeded PRNG, and the
// attention math is exactly what a real model does (just with tiny sizes).

export const D_MODEL = 8;
export const D_HEAD = 4;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function randMatrix(rows, cols, rand, scale) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (rand() * 2 - 1) * scale));
}

const rand = mulberry32(1337);
export const W = {
  q: randMatrix(D_MODEL, D_HEAD, rand, 1.25),
  k: randMatrix(D_MODEL, D_HEAD, rand, 1.25),
  v: randMatrix(D_MODEL, D_HEAD, rand, 0.6),
};

export function embed(token, pos) {
  const r = mulberry32(hashStr(token.toLowerCase()));
  return Array.from({ length: D_MODEL }, (_, i) => {
    const freq = 1 / Math.pow(100, (2 * Math.floor(i / 2)) / D_MODEL);
    const pe = i % 2 === 0 ? Math.sin(pos * freq) : Math.cos(pos * freq);
    return (r() * 2 - 1) + 0.35 * pe;
  });
}

export function project(x, M) {
  const out = new Array(M[0].length).fill(0);
  for (let i = 0; i < x.length; i++)
    for (let j = 0; j < out.length; j++) out[j] += x[i] * M[i][j];
  return out;
}

export function qkv(token, pos) {
  const x = embed(token, pos);
  return { q: project(x, W.q), k: project(x, W.k), v: project(x, W.v) };
}

export const dot = (a, b) => a.reduce((s, ai, i) => s + ai * b[i], 0);

export function softmax(xs) {
  const m = Math.max(...xs);
  const e = xs.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

// One query attending over a list of keys/values.
export function attend(q, keys, values) {
  const scores = keys.map((k) => dot(q, k) / Math.sqrt(D_HEAD));
  const weights = softmax(scores);
  const out = new Array(values[0].length).fill(0);
  weights.forEach((w, i) => values[i].forEach((v, j) => (out[j] += w * v)));
  return { scores, weights, out };
}

// Full causal attention matrix (what a no-cache forward pass computes).
export function causalMatrix(tokens) {
  const vecs = tokens.map((t, i) => qkv(t, i));
  return vecs.map((row, i) =>
    attend(row.q, vecs.slice(0, i + 1).map((r) => r.k), vecs.slice(0, i + 1).map((r) => r.v)));
}

export function tokenize(text) {
  return (text.match(/[\p{L}\p{N}'’-]+|[^\s\p{L}\p{N}]/gu) || []).slice(0, 16);
}

export const fmt = (x, d = 2) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
