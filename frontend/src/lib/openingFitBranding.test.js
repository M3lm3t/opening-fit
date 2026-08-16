import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentUrls = [
  "../App.jsx",
  "../components/ChessOpeningSeoPage.jsx",
  "../components/OpeningLandingPage.jsx",
  "../components/SeoGuidePages.jsx",
  "../components/SeoLandingPage.jsx",
];

test("user-facing branding never uses standalone OF initials", () => {
  for (const relativeUrl of componentUrls) {
    const source = readFileSync(new URL(relativeUrl, import.meta.url), "utf8");
    assert.doesNotMatch(source, />\s*OF\s*</, `${relativeUrl} renders standalone OF text`);
    assert.doesNotMatch(source, /["']OF["']/, `${relativeUrl} uses OF as a UI fallback`);
  }
});

test("compact brand and account surfaces use established icons with accessible labels", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /<UserRound size=\{15\}/);
  assert.match(app, /aria-label=\{accountAction\.label \|\| "Account"\}/);
  assert.match(app, /aria-label="Account status and profile"/);

  for (const relativeUrl of componentUrls.slice(1)) {
    const source = readFileSync(new URL(relativeUrl, import.meta.url), "utf8");
    assert.match(source, /openingfit-icon\.svg/);
    assert.match(source, /alt=""[^>]*aria-hidden="true"/);
  }
});
