import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_EVENTS, deviceCategory, normalizeProductEvent, safeAnalyticsProperties } from "./productAnalytics.js";
test("event model contains the complete core funnel", () => { for (const event of ["homepage_viewed", "analysis_completed", "report_viewed", "training_session_completed", "entitlement_confirmed"]) assert.ok(PRODUCT_EVENTS.includes(event)); });
test("legacy events map to stable replacements", () => { assert.equal(normalizeProductEvent("frontend_import_started"), "analysis_started"); assert.equal(normalizeProductEvent("unknown_event"), null); });
test("analytics properties remove personal and sensitive data", () => { const safe = safeAnalyticsProperties({ platform: "lichess", route: "/report", email: "private@example.com", accessToken: "secret", pgn: "1. e4", username: "player" }); assert.deepEqual(safe, { platform: "lichess", route: "/report" }); });
test("device category is deterministic", () => { assert.equal(deviceCategory(390), "mobile"); assert.equal(deviceCategory(800), "tablet"); assert.equal(deviceCategory(1400), "desktop"); });
