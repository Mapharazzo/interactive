// Optics model: a "reduced eye" (one refracting surface, n = 1.336) with the
// refractive error expressed as a spectacle prescription, plus a thin lens in
// front of it. Glasses are treated as sitting right at the eye (no vertex
// distance), which is accurate to a few percent below about ±5 D.
//
// Powers are 2×2 symmetric "dioptric power matrices" stored as [a, b, c] for
// [[a, b], [b, c]], with x = horizontal and y = vertical (up). This handles
// sphere and cylinder at any axis with plain matrix addition.

export const N_EYE = 1.336;
export const EYE_POWER = 60; // diopters, a typical emmetropic eye
export const ARCMIN_PER_RAD = 10800 / Math.PI;
const WAVELENGTH = 555e-9;

export const I = [1, 0, 1];
export const add = (m, n) => [m[0] + n[0], m[1] + n[1], m[2] + n[2]];
export const scale = (m, k) => [m[0] * k, m[1] * k, m[2] * k];

// Sphere / minus-cylinder × axis (degrees) → power matrix. The cylinder adds
// power perpendicular to its axis and none along it.
export function rxMatrix({ sph, cyl, axis }) {
  const a = (axis * Math.PI) / 180;
  const s = Math.sin(a), c = Math.cos(a);
  return [sph + cyl * s * s, -cyl * s * c, sph + cyl * c * c];
}

// Eigen-decomposition of a symmetric matrix: principal powers and the
// direction (radians, from horizontal) of the first.
export function eigen([a, b, c]) {
  const m = (a + c) / 2;
  const d = Math.hypot((a - c) / 2, b);
  return { l1: m + d, l2: m - d, angle: 0.5 * Math.atan2(2 * b, a - c), mean: m, j: d };
}

// Accommodation amplitude by age, in diopters. Roughly the lower edge of the
// normal range (after Hofstetter), floored at the ~0.5 D that depth of focus
// gives back even with no focusing ability left.
export function amplitude(age) {
  return Math.max(0.5, 15 - 0.25 * age);
}

// Everything needed to describe how the eye sees one object.
//   eye     {sph, cyl, axis, age}  the eye's own prescription
//   lens    {sph, cyl, axis} | null
//   V       object vergence at the eye (−1 / distance in metres)
//   A       accommodation in use; omit to let the eye choose (it focuses on this object)
export function solve(eye, lens, V, A) {
  const R = rxMatrix(eye);
  const P = lens ? rxMatrix(lens) : [0, 0, 0];
  const amp = amplitude(eye.age);
  // Defocus with no accommodation. Positive = too much converging power
  // (focus falls in front of the retina, the myopic direction).
  const E0 = add(add(scale(I, V), P), scale(R, -1));
  if (A == null) {
    // Accommodation can only add converging power, so it can rescue a focus
    // behind the retina but never one in front of it.
    const m0 = (E0[0] + E0[2]) / 2;
    A = Math.min(amp, Math.max(0, -m0));
  }
  const E = add(E0, scale(I, A));
  const e = eigen(E);

  // Where the light actually focuses inside the eye, per principal meridian.
  const seR = eye.sph + eye.cyl / 2;
  const axial = N_EYE / (EYE_POWER + seR); // metres
  const cornea = add(scale(I, EYE_POWER + seR), scale(R, -1)); // F = 60 − (R − SE)
  const total = add(add(scale(I, V + A), P), cornea);
  const t = eigen(total);
  const z1 = N_EYE / t.l1, z2 = N_EYE / t.l2, zMean = N_EYE / t.mean;

  return {
    E, eig: e, A, amp, V,
    blur: Math.hypot(e.mean, e.j), // blur strength (D)
    axialMM: axial * 1000,
    focusMM: [z1 * 1000, z2 * 1000],
    focusAngle: t.angle,
    focusPower: [t.l1, t.l2],
    // + means the (average) focus lies in front of the retina
    frontOfRetinaMM: (axial - zMean) * 1000,
  };
}

// The retinal blur patch: a linear map from the unit disk to an angular
// offset (arcmin). A point source through a pupil point p lands E·p away from
// the sharp image. A squint narrows the pupil vertically into a slit.
export function blurKernel(E, pupilMM, squint = 1) {
  const r = (pupilMM / 2) / 1000; // radius in metres
  const k = r * ARCMIN_PER_RAD;
  const [a, b, c] = E;
  // K = E · diag(r, r·squint), as a general 2×2 [[k00, k01], [k10, k11]]
  return [a * k, b * k * squint, b * k, c * k * squint];
}

// Ellipse covariance-like form S = K·Kᵀ → semi-axes and angle.
export function kernelEllipse(K) {
  const [k00, k01, k10, k11] = K;
  const S = [k00 * k00 + k01 * k01, k00 * k10 + k01 * k11, k10 * k10 + k11 * k11];
  const e = eigen(S);
  return { a: Math.sqrt(Math.max(0, e.l1)), b: Math.sqrt(Math.max(0, e.l2)), angle: e.angle };
}

// Diffraction blur (arcmin) for a pupil, scaled to roughly match how much it
// limits acuity rather than the full Airy radius.
export function diffractionArcmin(pupilMM) {
  return 0.6 * 1.22 * WAVELENGTH / (pupilMM / 1000) * ARCMIN_PER_RAD;
}

// Kernel in pixels for the shader, with diffraction folded in. Returns a 2×2
// matrix that maps the unit disk onto the final blur ellipse.
export function pixelKernel(K, pxPerArcmin, pupilMM, squint) {
  const el = kernelEllipse(K);
  const d = diffractionArcmin(pupilMM * Math.sqrt(squint));
  const a = Math.hypot(el.a, d) * pxPerArcmin;
  const b = Math.hypot(el.b, d) * pxPerArcmin;
  const c = Math.cos(el.angle), s = Math.sin(el.angle);
  // R(angle) · diag(a, b), in canvas coordinates (y down): flip the angle.
  return [c * a, s * b, -s * a, c * b];
}

// Smallest readable letter detail (minimum angle of resolution, arcmin).
// Calibrated so that 1 D of blur through a 3 mm pupil gives about 20/50,
// in line with clinical rules of thumb.
export function marArcmin(K, pupilMM, squint) {
  const el = kernelEllipse(K);
  const rms = Math.sqrt((el.a * el.a + el.b * el.b) / 2);
  const pEff = pupilMM * Math.sqrt(squint);
  return Math.sqrt(0.75 ** 2 + (1.38 / pEff) ** 2 + (0.465 * rms) ** 2);
}

const LINES = [10, 12.5, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 125, 160, 200, 400];
export function snellen(mar) {
  const d = 20 * mar;
  let best = LINES[0];
  for (const l of LINES) if (Math.abs(Math.log(l / d)) < Math.abs(Math.log(best / d))) best = l;
  return { feet: best, metric: Math.round((best * 6) / 20 * 10) / 10, raw: d };
}

// Formatting helpers for prescriptions.
export function dioptres(x, digits = 2) {
  if (Math.abs(x) < 0.005) return (0).toFixed(digits);
  return (x > 0 ? "+" : "−") + Math.abs(x).toFixed(digits);
}
export function rxString({ sph, cyl, axis }) {
  if (Math.abs(cyl) < 0.005) return `${dioptres(sph)} DS`;
  return `${dioptres(sph)} / ${dioptres(cyl)} × ${String(Math.round(axis)).padStart(3, "0")}`;
}
