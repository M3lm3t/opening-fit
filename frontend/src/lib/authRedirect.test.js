import assert from "node:assert/strict";
import test from "node:test";
import { getAuthRedirectUrl, isAuthCallbackUrl, PRODUCTION_AUTH_ORIGIN } from "./authRedirect.js";

test("web and native-compatible OAuth use the canonical HTTPS Account callback", () => {
  assert.equal(getAuthRedirectUrl(), `${PRODUCTION_AUTH_ORIGIN}/account`);
});

test("Supabase PKCE and implicit callback URLs are recognised", () => {
  assert.equal(isAuthCallbackUrl("https://www.openingfit.com/account?code=pkce-code"), true);
  assert.equal(isAuthCallbackUrl("https://www.openingfit.com/account#access_token=access&refresh_token=refresh"), true);
  assert.equal(isAuthCallbackUrl("https://www.openingfit.com/account?error=access_denied"), true);
});

test("ordinary explicit App Links are not mistaken for auth callbacks", () => {
  assert.equal(isAuthCallbackUrl("https://www.openingfit.com/progress"), false);
  assert.equal(isAuthCallbackUrl("https://www.openingfit.com/report?view=evidence"), false);
});
