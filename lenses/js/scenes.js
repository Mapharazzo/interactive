// Draws the source images the simulator blurs. Each "layer" is a canvas
// with a distance; the renderer blurs each one for its own distance.

export const W = 1200;
export const H = 750;
export const FONT = '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif';

// Angular scale of each view. The scene is a ~16° wide view; the chart is
// zoomed in so that 20/20 letters (5 arcmin tall) are 15 pixels tall.
export const SCENE_PX_PER_ARCMIN = 1.25;
export const CHART_PX_PER_ARCMIN = 3;

function canvas() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------------------------------------------------------------- eye chart

export const CHART_ROWS = [
  { line: 200, letters: "E" },
  { line: 100, letters: "FP" },
  { line: 70, letters: "TOZ" },
  { line: 50, letters: "LPED" },
  { line: 40, letters: "PECFD" },
  { line: 30, letters: "EDFCZP" },
  { line: 25, letters: "FELOPZD" },
  { line: 20, letters: "DEFPOTEC" },
  { line: 15, letters: "LEFODPCT" },
];

export function drawChart() {
  const c = canvas();
  const ctx = c.getContext("2d");
  // A dim exam room around a backlit chart.
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 760);
  g.addColorStop(0, "#3a4148");
  g.addColorStop(1, "#1a1e22");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const boardW = 600, boardX = (W - boardW) / 2;
  ctx.fillStyle = "#c9ced3";
  rr(ctx, boardX - 10, 0, boardW + 20, H, 4);
  ctx.fill();
  ctx.fillStyle = "#fbfcfc";
  ctx.fillRect(boardX, 0, boardW, H);

  ctx.font = `700 100px ${FONT}`;
  const capRatio = ctx.measureText("E").actualBoundingBoxAscent / 100 || 0.7;

  const heights = CHART_ROWS.map((r) => (r.line / 20) * 5 * CHART_PX_PER_ARCMIN);
  const gaps = heights.map((h) => 0.42 * h + 12);
  const total = heights.reduce((a, b) => a + b, 0) + gaps.slice(0, -1).reduce((a, b) => a + b, 0);
  let y = (H - total) / 2;
  const rows = [];
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  CHART_ROWS.forEach((row, i) => {
    const h = heights[i];
    ctx.font = `700 ${h / capRatio}px ${FONT}`;
    const pitch = h * 1.9;
    const n = row.letters.length;
    const x0 = W / 2 - ((n - 1) * pitch) / 2;
    for (let j = 0; j < n; j++) ctx.fillText(row.letters[j], x0 + j * pitch, y + h);
    // A thin red/green line under 20/40 and 20/20, as on many real charts.
    if (row.line === 40 || row.line === 20) {
      ctx.fillStyle = row.line === 40 ? "#c0392b" : "#1e8449";
      ctx.fillRect(boardX + 40, y + h + gaps[i] / 2 - 1, boardW - 80, 2);
      ctx.fillStyle = "#111";
    }
    rows.push({ line: row.line, y: y + h / 2, h });
    y += h + gaps[i];
  });
  return { canvas: c, rows };
}

// ------------------------------------------------------------ window scene

export const WIN = { x: 120, y: 60, w: 660, h: 470 };

// Where each object sits in the picture (for the focus marker).
export const ANCHORS = {
  far: { x: 445, y: 238 },
  room: { x: 985, y: 250 },
  near: { x: 835, y: 560 },
};

function drawFar() {
  const c = canvas();
  const ctx = c.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, "#7fa9d1");
  sky.addColorStop(0.7, "#cddff0");
  sky.addColorStop(1, "#f0dcc2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Distant skyline with window grids: fine detail that shows blur well.
  const towers = [
    [90, 250, 90, "#8b9cb0"], [175, 190, 70, "#7c8ea4"], [240, 280, 60, "#94a4b6"],
    [610, 200, 80, "#7f91a6"], [690, 150, 70, "#8a9bb0"], [755, 240, 60, "#97a7b8"],
  ];
  for (const [x, top, w, col] of towers) {
    ctx.fillStyle = col;
    ctx.fillRect(x, top, w, 520 - top);
    ctx.fillStyle = "rgba(255, 244, 214, 0.75)";
    for (let wy = top + 10; wy < 500; wy += 14)
      for (let wx = x + 7; wx < x + w - 8; wx += 12) if ((wx * 7 + wy * 3) % 5) ctx.fillRect(wx, wy, 5, 7);
  }

  // The library.
  ctx.fillStyle = "#d8cbb3";
  ctx.fillRect(300, 210, 290, 310);
  ctx.fillStyle = "#c4b597";
  ctx.beginPath();
  ctx.moveTo(285, 212); ctx.lineTo(445, 150); ctx.lineTo(605, 212);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#efe6d4";
  for (let i = 0; i < 6; i++) ctx.fillRect(318 + i * 46, 300, 16, 200);
  ctx.fillStyle = "#5b4a3a";
  ctx.fillRect(420, 420, 50, 80);
  // Sign board
  ctx.fillStyle = "#1f3a5a";
  ctx.fillRect(322, 222, 246, 66);
  ctx.fillStyle = "#f6f1e4";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 31px ${FONT}`;
  ctx.fillText("CITY LIBRARY", 445, 256);
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText("Open today until 9 pm", 445, 278);

  // Street level: trees and a bus stop.
  ctx.fillStyle = "#6f7c72";
  ctx.fillRect(0, 500, W, 40);
  for (const [x, r] of [[150, 46], [250, 38], [650, 50], [745, 40]]) {
    ctx.fillStyle = "#5a4636";
    ctx.fillRect(x - 4, 470, 8, 40);
    ctx.fillStyle = "#4f7a4a";
    ctx.beginPath(); ctx.arc(x, 455 - r / 3, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#62905a";
    ctx.beginPath(); ctx.arc(x - r / 3, 445 - r / 3, r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#3d4650";
  ctx.fillRect(552, 410, 4, 100);
  ctx.fillStyle = "#c0392b";
  ctx.beginPath(); ctx.arc(554, 404, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 15px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("42", 554, 405);
  return c;
}

function drawRoom() {
  const c = canvas();
  const ctx = c.getContext("2d");
  const wall = ctx.createLinearGradient(0, 0, W, 0);
  wall.addColorStop(0, "#b7c2b4");
  wall.addColorStop(1, "#cbd3c5");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  // Wainscot below the sill
  ctx.fillStyle = "#a8b3a5";
  ctx.fillRect(0, 600, W, H - 600);
  ctx.fillStyle = "#97a294";
  ctx.fillRect(0, 600, W, 5);

  // Window: frame, mullions, then cut the glass out.
  const { x, y, w, h } = WIN;
  ctx.fillStyle = "#f3f1ea";
  ctx.fillRect(x - 18, y - 18, w + 36, h + 36);
  ctx.clearRect(x, y, w, h);
  ctx.fillRect(x + w / 2 - 6, y, 12, h);
  ctx.fillRect(x, y + h * 0.36 - 6, w, 12);
  // Sill
  ctx.fillStyle = "#e7e3d8";
  ctx.fillRect(x - 34, y + h + 14, w + 68, 22);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(x - 34, y + h + 36, w + 68, 8);

  // Plant on the sill
  ctx.fillStyle = "#3e6b3a";
  for (const [lx, ly, rx, ry, rot] of [[668, 470, 16, 46, -0.5], [692, 462, 15, 52, 0.1], [716, 474, 15, 44, 0.6], [680, 488, 12, 32, -1.1], [706, 488, 12, 32, 1.1]]) {
    ctx.beginPath(); ctx.ellipse(lx, ly, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#b5653f";
  ctx.beginPath();
  ctx.moveTo(660, 505); ctx.lineTo(724, 505); ctx.lineTo(716, 545); ctx.lineTo(668, 545);
  ctx.closePath(); ctx.fill();

  // Curtain
  const cur = ctx.createLinearGradient(30, 0, 170, 0);
  for (let i = 0; i <= 6; i++) cur.addColorStop(i / 6, i % 2 ? "#8e5f72" : "#a87588");
  ctx.fillStyle = cur;
  ctx.beginPath();
  ctx.moveTo(30, 20); ctx.lineTo(175, 20);
  ctx.quadraticCurveTo(150, 330, 185, 600); ctx.lineTo(30, 600);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#6c6259";
  ctx.fillRect(10, 14, 820, 8);

  // Wall calendar
  const cx = 870, cy = 95, cw = 230, ch = 320;
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(cx + 5, cy + 6, cw, ch);
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(cx, cy, cw, ch);
  ctx.fillStyle = "#b8392f";
  ctx.fillRect(cx, cy, cw, 52);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("October", cx + cw / 2, cy + 27);
  ctx.fillStyle = "#555";
  ctx.font = `700 11px ${FONT}`;
  "MTWTFSS".split("").forEach((d, i) => ctx.fillText(d, cx + 22 + i * 31, cy + 70));
  ctx.font = `600 15px ${FONT}`;
  for (let d = 1; d <= 31; d++) {
    const k = d + 2; // October starts on a Thursday
    const col = k % 7, row = Math.floor(k / 7);
    ctx.fillStyle = col >= 5 ? "#b8392f" : "#222";
    ctx.fillText(String(d), cx + 22 + col * 31, cy + 98 + row * 42);
  }
  ctx.strokeStyle = "#b8392f";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx + 22 + 2 * 31, cy + 98 + 4 * 42, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#555";
  ctx.beginPath(); ctx.arc(cx + cw / 2, cy - 12, 4, 0, Math.PI * 2); ctx.fill();
  return c;
}

function drawNear() {
  const c = canvas();
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(835, 640);
  ctx.rotate(-0.12);
  const pw = 300, ph = 560;
  // Fingers behind the left edge
  ctx.fillStyle = "#d79e7e";
  for (let i = 0; i < 3; i++) { rr(ctx, -pw / 2 - 26, -40 + i * 62, 60, 50, 25); ctx.fill(); }
  ctx.fillStyle = "#16191d";
  rr(ctx, -pw / 2, -ph / 2, pw, ph, 38); ctx.fill();
  ctx.fillStyle = "#f5f6f8";
  rr(ctx, -pw / 2 + 11, -ph / 2 + 11, pw - 22, ph - 22, 28); ctx.fill();

  const left = -pw / 2 + 28, right = pw / 2 - 28, top = -ph / 2 + 24;
  ctx.fillStyle = "#222";
  ctx.font = `700 14px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("9:41", left + 6, top + 10);
  ctx.textAlign = "center";
  ctx.font = `700 17px ${FONT}`;
  ctx.fillText("Sam", 0, top + 50);
  ctx.fillStyle = "#dde1e6";
  ctx.fillRect(-pw / 2 + 11, top + 70, pw - 22, 1.5);

  const bubbles = [
    ["l", ["Are you still coming", "tonight?"]],
    ["r", ["Yes! Running about", "ten minutes late"]],
    ["l", ["No rush. We got a", "table by the window."]],
  ];
  let y = top + 92;
  ctx.font = `500 17px ${FONT}`;
  for (const [side, lines] of bubbles) {
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28;
    const bh = lines.length * 23 + 18;
    const bx = side === "l" ? left - 6 : right + 6 - bw;
    ctx.fillStyle = side === "l" ? "#e4e7eb" : "#2f6fd6";
    rr(ctx, bx, y, bw, bh, 18); ctx.fill();
    ctx.fillStyle = side === "l" ? "#1b1d22" : "#fff";
    ctx.textAlign = "left";
    lines.forEach((l, i) => ctx.fillText(l, bx + 14, y + 20 + i * 23));
    y += bh + 14;
  }
  ctx.restore();
  // Thumb across the lower right
  ctx.fillStyle = "#d79e7e";
  ctx.beginPath(); ctx.ellipse(1010, 735, 70, 34, -0.7, 0, Math.PI * 2); ctx.fill();
  return c;
}

export function drawScene() {
  return {
    far: drawFar(),
    room: drawRoom(),
    near: drawNear(),
  };
}

// Which object is at a picture position (topmost opaque layer wins).
export function hitTest(layers, x, y) {
  for (const key of ["near", "room", "far"]) {
    const ctx = layers[key].getContext("2d", { willReadFrequently: true });
    if (ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data[3] > 128) return key;
  }
  return "far";
}
