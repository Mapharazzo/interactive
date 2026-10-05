import { tokenize } from "./model.js";
import { $ } from "./util.js";
import { createExplorer } from "./explorer.js";
import { createStepper } from "./stepper.js";
import { createMatrix } from "./matrix.js";
import { createCompute } from "./compute.js";
import { createMemory } from "./memory.js";
import { createGQA } from "./gqa.js";
import { createPaged } from "./paged.js";
import { createQuiz } from "./quiz.js";

const explorer = createExplorer($("#attn-explorer"));
const stepper = createStepper();
const matrix = createMatrix();
createCompute();
createMemory();
createGQA();
createPaged();
createQuiz();

// The text box in section 3 drives sections 2–4.
const input = $("#st-text");
let last = "";
function applyText() {
  const tokens = tokenize(input.value);
  if (tokens.length < 3) return;
  const key = tokens.join("\u0000");
  if (key === last) return;
  last = key;
  explorer.setTokens(tokens);
  stepper.setTokens(tokens);
  matrix.setTokens(tokens);
}
let timer;
input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(applyText, 300); });
applyText();
