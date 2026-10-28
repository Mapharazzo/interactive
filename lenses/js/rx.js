// Prescription decoder: explain each number, then load it into the lab.

import { dioptres, rxString } from "./optics.js";
import { set } from "./state.js";
import { readingAdd } from "./controls.js";

const fmtLen = (m) => (m >= 1 ? `${m.toFixed(1)} m` : `${Math.round(m * 100)} cm`);

export function createRx(root, onLoad) {
  const f = (n) => root.querySelector(`[name="${n}"]`);
  const fields = ["sph", "cyl", "axis", "add"].map(f);
  const explain = root.querySelector(".rx-explain");

  function read() {
    const [sph, cyl, axis, add] = fields.map((i) => +i.value || 0);
    return { sph, cyl: Math.min(0, cyl), axis: Math.max(0, Math.min(180, axis)), add: Math.max(0, add) };
  }

  function render() {
    const { sph, cyl, axis, add } = read();
    const items = [];
    if (sph < 0) {
      const worst = sph + cyl;
      items.push(["Sphere", `Nearsighted by ${Math.abs(sph).toFixed(2)} D. Without glasses, things beyond about ${fmtLen(1 / Math.abs(worst || sph))} start to blur. The minus sign means a lens that spreads light out.`]);
    } else if (sph > 0) {
      items.push(["Sphere", `Farsighted by ${sph.toFixed(2)} D. The eye has to focus an extra ${sph.toFixed(2)} D just to see far away, and that much more for anything close. The plus sign means a lens that converges light.`]);
    } else {
      items.push(["Sphere", "Zero (sometimes written plano or PL): no overall nearsightedness or farsightedness."]);
    }
    if (cyl < 0) {
      const across = (axis + 90) % 180;
      items.push(["Cylinder and axis", `Astigmatism of ${Math.abs(cyl).toFixed(2)} D. The lens has ${dioptres(sph)} D of power along the ${axis}° line and ${dioptres(sph + cyl)} D across it, at ${across}°. The axis only matters when there is a cylinder.`]);
    } else {
      items.push(["Cylinder and axis", "No cylinder, so no astigmatism to correct. The axis is left blank."]);
    }
    if (add > 0) {
      items.push(["Add", `Reading addition of ${dioptres(add)} D. The lower part of bifocals or progressives is ${dioptres(add)} D stronger (${dioptres(sph + add)} D in total) to take over close focusing. Usually needed from the mid-40s.`]);
    }
    const se = sph + cyl / 2;
    items.push(["In short", `${rxString({ sph, cyl, axis })}${add ? `, add ${dioptres(add)}` : ""}. The spherical equivalent (sphere + half the cylinder) is ${dioptres(se)} D, a single number for how far the eye is from sharp on average.`]);
    explain.replaceChildren(...items.flatMap(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      return [dt, dd];
    }));
  }

  fields.forEach((i) => i.addEventListener("input", render));
  root.querySelector(".rx-load").addEventListener("click", () => {
    const { sph, cyl, axis, add } = read();
    // Pick an age whose focusing range would call for this add.
    let age = 35;
    if (add > 0) {
      for (age = 40; age < 80 && readingAdd(age) < add; age++);
    }
    set({ eye: { sph, cyl, axis, age }, glasses: { on: false, sph, cyl, axis } });
    onLoad?.();
  });
  render();
}
