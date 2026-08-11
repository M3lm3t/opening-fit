import { App as CapacitorApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { restoreSessionFromAuthUrl } from "./authRedirect.js";
import { installExternalLinkHandler } from "./externalNavigation.js";
import { isAndroidApp, isNativeApp } from "./platform.js";

const APP_LINK_HOSTS = new Set(["openingfit.com", "www.openingfit.com"]);

function visibleDialog() {
  return [...document.querySelectorAll('[role="dialog"], dialog[open], [aria-modal="true"]')]
    .reverse()
    .find((element) => element.getClientRects().length && !element.hidden);
}

function closeVisibleDialog() {
  const dialog = visibleDialog();
  if (!dialog) return false;
  dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const close = dialog.querySelector('button[aria-label*="close" i], button[title*="close" i], [data-close]');
  close?.click();
  return true;
}

async function openAppUrl(url) {
  const target = new URL(url);
  if (!APP_LINK_HOSTS.has(target.hostname.toLowerCase())) return;
  try {
    await restoreSessionFromAuthUrl(target.toString());
  } catch (error) {
    console.warn("OpeningFit could not restore the authentication callback.", error);
  }
  const path = `${target.pathname || "/"}${target.searchParams.has("code") ? "" : target.search}${target.hash && !target.hash.includes("access_token") ? target.hash : ""}`;
  window.history.pushState({}, "", path || "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export async function initializeNativeAppShell() {
  if (!isNativeApp()) return () => {};
  document.documentElement.classList.add("of-native-app");
  if (isAndroidApp()) document.documentElement.classList.add("of-android-app");

  await StatusBar.setOverlaysWebView({ overlay: false });
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#F7F8FA" });
  await SplashScreen.hide();

  const listeners = await Promise.all([
    CapacitorApp.addListener("appUrlOpen", ({ url }) => void openAppUrl(url)),
    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (closeVisibleDialog()) return;
      if (canGoBack && window.history.length > 1) {
        window.history.back();
        return;
      }
      void CapacitorApp.exitApp();
    }),
  ]);
  const removeExternalHandler = installExternalLinkHandler();
  return () => {
    listeners.forEach((listener) => listener.remove());
    removeExternalHandler();
  };
}
