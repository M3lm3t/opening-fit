import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { legacyProductRedirect } from "../appNavigation.js";

test("legacy product URLs redirect to their retained secondary sections", () => {
  assert.equal(legacyProductRedirect("/repertoire"), "/report#report-repertoire");
  assert.equal(legacyProductRedirect("/progress", "?source=android"), "/account?source=android#account-progress");
  for (const path of ["/pricing", "/premium", "/upgrade"]) {
    assert.equal(legacyProductRedirect(path), "/account#account-membership");
  }
  assert.equal(legacyProductRedirect("/train"), null);
});

test("Report owns repertoire and Account owns progress and membership", () => {
  const app = fs.readFileSync(fileURLToPath(new URL("../App.jsx", import.meta.url)), "utf8");
  const navStart = app.indexOf("function AppPrimaryNav");
  const navEnd = app.indexOf("const items = isAppNavigation", navStart);
  const itemsEnd = app.indexOf("const brandAction", navEnd);
  const nav = app.slice(navEnd, itemsEnd);
  assert.match(nav, /label: "Home"/);
  assert.match(nav, /label: "Report"/);
  assert.match(nav, /label: "Train"/);
  assert.match(nav, /label: "Account"/);
  assert.doesNotMatch(nav, /label: "Repertoire"|label: "Progress"|label: "Pricing"/);
  assert.match(app, /id="account-progress"/);
  assert.match(app, /id="account-membership"/);
  assert.match(app, /<MyRepertoire[\s\S]*embedded/);
  assert.match(app, /<AccountPanel variant="membership"/);
});

test("Account exposes the same four-section hub on responsive web and Android", () => {
  const app = fs.readFileSync(fileURLToPath(new URL("../App.jsx", import.meta.url)), "utf8");
  const css = fs.readFileSync(fileURLToPath(new URL("../components/InformationArchitecture.css", import.meta.url)), "utf8");
  const navStart = app.indexOf('className="accountSectionNav"');
  const navEnd = app.indexOf("</div>", navStart);
  const nav = app.slice(navStart, navEnd);
  for (const section of ["Profile", "Preferences", "Membership", "Data & support"]) assert.match(app, new RegExp(`label: "${section.replace(" & support", " & support")}"`));
  for (const id of ["account-panel-profile", "account-panel-preferences", "account-panel-membership", "account-panel-data"]) assert.match(app, new RegExp(`id="${id}"`));
  assert.match(nav, /role="tablist"/);
  assert.match(app, /role="tabpanel"/);
  assert.match(app, /aria-selected=\{accountSection === section\.key\}/);
  for (const section of ["profile", "preferences", "membership", "data"]) {
    assert.match(app, new RegExp(`accountSection === "${section}" \\? <section id="account-panel-${section}`));
  }
  assert.doesNotMatch(app, /hidden=\{accountSection !==/);
  assert.match(app, /ArrowLeft.*ArrowRight.*Home.*End/);
  assert.match(app, /new URLSearchParams\(window\.location\.search\)\.get\("section"\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*accountSectionNav/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.accountHub > \[role="tabpanel"\][\s\S]*height: auto;[\s\S]*overflow: visible;/);
  assert.match(css, /\.accountHub \.simpleProfileCard,[\s\S]*max-height: none;[\s\S]*overflow: visible;/);
  assert.match(css, /\.accountHub \.accountPanel--profile[\s\S]*grid-auto-rows: max-content/);
});

test("Account separates ordinary profile controls from destructive actions", () => {
  const account = fs.readFileSync(fileURLToPath(new URL("../components/AccountPanel.jsx", import.meta.url)), "utf8");
  assert.match(account, /const isProfile = variant === "profile"/);
  assert.match(account, /const isDataSupport = variant === "data-support"/);
  assert.match(account, /!isProfile \? <div className="accountDangerZone">/);
  assert.match(account, /user && !isProfile \? <nav className="accountLegalLinks"/);
});

test("Membership upgrade controls are gated by resolved free entitlement", () => {
  const app = fs.readFileSync(fileURLToPath(new URL("../App.jsx", import.meta.url)), "utf8");
  const account = fs.readFileSync(fileURLToPath(new URL("../components/AccountPanel.jsx", import.meta.url)), "utf8");
  assert.match(app, /accountMembership\.canUpgrade \? <PremiumPanel compact/);
  assert.match(account, /membership\.canUpgrade \? <button/);
  assert.match(account, /No upgrade or billing action is shown until the status is resolved/);
});
