import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("analysis settings precede the main CTA and explain paid ranges", async () => {
  const source = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const form = source.slice(source.indexOf('className="searchRow topBar appActionPanel heroImportFlow"'), source.indexOf('className="compactTrustRow"'));
  assert.ok(form.indexOf('className="landingAdvancedOptions"') < form.indexOf("Get my opening report"));
  assert.match(form, /Six- and twelve-month history are included with OpeningFit Plus/);
  assert.match(form, /href="\/premium"/);
});

test("landing trust notes are semantic information rather than controls", async () => {
  const source = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../App.css", import.meta.url), "utf8");
  const trust = source.slice(source.indexOf('className="usernameTrustStrip"'), source.indexOf("</ul>", source.indexOf('className="usernameTrustStrip"')) + 5);
  assert.match(trust, /^className="usernameTrustStrip"/);
  assert.equal((trust.match(/<li>/g) || []).length, 3);
  assert.doesNotMatch(trust, /button|tabIndex|onClick|aria-pressed/);
  assert.match(styles, /\.usernameTrustStrip li[\s\S]*?cursor:\s*default/);
});

test("the fictional preview stays labelled and varies generic opening examples", async () => {
  const source = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(source, /Illustrative example using fictional data/);
  assert.match(source, /<span>Best fit<\/span><strong>Vienna Game<\/strong>/);
});
