const configuredSupportEmail = String(import.meta.env?.VITE_SUPPORT_EMAIL || "").trim();

export const SUPPORT_EMAIL = configuredSupportEmail || "support@openingfit.com";

export function supportMailto(subject = "OpeningFit support") {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
