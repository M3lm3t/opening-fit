import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../components/MissionExperience.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../components/MissionExperience.css", import.meta.url), "utf8");
const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");

test("missions integrate into existing surfaces without a navigation tab", () => {
  assert.match(app, /MissionEvidencePanel/);
  assert.match(app, /MissionTrainingPanel/);
  assert.doesNotMatch(app, /label:\s*["']Missions/);
});

test("board interaction submits UCI and waits for server authority", () => {
  assert.match(component, /submitTrainingAttempt/);
  assert.match(component, /const uci = `\$\{move\.from\}\$\{move\.to\}/);
  assert.doesNotMatch(component, /evaluatePersonalTrainingMove/);
  assert.match(component, /phase !== "submitting"/);
});

test("future answers are hidden and offline moves are blocked", () => {
  assert.match(component, /Reconnect to submit this training move/);
  assert.match(component, /currentExercise/);
  assert.doesNotMatch(component, /exercise\.acceptedMoves/);
});

test("responsive board, safe areas, focus, and reduced motion are explicit", () => {
  assert.match(styles, /aspect-ratio:1/);
  assert.match(styles, /touch-action:none/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("every Mission state uses shared light and dark semantic theme tokens", () => {
  for (const token of ["--color-bg-elevated", "--color-bg-subtle", "--color-text-primary", "--color-text-secondary", "--color-text-muted", "--color-border-subtle", "--color-border-strong", "--color-accent", "--color-danger", "--color-success"]) {
    assert.match(styles, new RegExp(token));
  }
  assert.doesNotMatch(styles, /var\(--surface,#fff\)|var\(--text-color,#152033\)|background:#fff|color:#fff/i);
  assert.match(component, /no_candidate/);
  assert.match(component, /below_confidence/);
  assert.match(component, /unavailable/);
  assert.match(component, /missionCard--\$\{mission\.status\}/);
  assert.match(styles, /missionFeedback--correct/);
});
