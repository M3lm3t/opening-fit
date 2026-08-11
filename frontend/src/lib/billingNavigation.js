import { openExternalUrl } from "./externalNavigation.js";

export async function openSubscriptionCheckout(url) {
  return openExternalUrl(url, { replaceCurrentPage: true });
}

export async function openBillingManagement(url) {
  return openExternalUrl(url, { replaceCurrentPage: true });
}
