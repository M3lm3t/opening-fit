import { Browser } from "@capacitor/browser";
import { isNativeApp } from "./platform.js";

export async function openExternalUrl(url, options = {}) {
  const target = String(url || "").trim();
  if (!/^https:\/\//i.test(target)) throw new Error("OpeningFit only opens secure external links.");
  if (isNativeApp()) {
    await Browser.open({ url: target, presentationStyle: options.presentationStyle || "popover" });
    return true;
  }
  if (options.replaceCurrentPage) {
    window.location.assign(target);
    return true;
  }
  return Boolean(window.open(target, "_blank", "noopener,noreferrer"));
}

export function installExternalLinkHandler() {
  if (!isNativeApp() || typeof document === "undefined") return () => {};
  const handleClick = (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor || event.defaultPrevented) return;
    const href = anchor.getAttribute("href") || "";
    if (!/^https:\/\//i.test(href)) return;
    event.preventDefault();
    void openExternalUrl(href);
  };
  document.addEventListener("click", handleClick);
  return () => document.removeEventListener("click", handleClick);
}
