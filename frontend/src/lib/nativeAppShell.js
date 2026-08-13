import { App as CapacitorApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isAuthCallbackUrl, restoreSessionFromAuthUrl } from "./authRedirect.js";
import { installExternalLinkHandler } from "./externalNavigation.js";
import { isAndroidApp, isNativeApp } from "./platform.js";

const APP_LINK_HOSTS = new Set(["openingfit.com", "www.openingfit.com"]);
let nativeLaunchUrlPromise;

async function getNativeLaunchUrl() {
  if (!isNativeApp()) return null;
  nativeLaunchUrlPromise ||= CapacitorApp.getLaunchUrl();
  return nativeLaunchUrlPromise;
}

export async function getNativeLaunchPath() {
  const launch = await getNativeLaunchUrl();
  if (!launch?.url) return null;
  const target = new URL(launch.url);
  if (!APP_LINK_HOSTS.has(target.hostname.toLowerCase())) return null;
  return target.pathname || "/";
}

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

export async function openAppUrl(url) {
  const target = new URL(url);
  if (!APP_LINK_HOSTS.has(target.hostname.toLowerCase())) return;
  const authCallback = isAuthCallbackUrl(target.toString());
  try {
    if (authCallback) await restoreSessionFromAuthUrl(target.toString());
  } catch (error) {
    console.warn("OpeningFit could not restore the authentication callback.", error);
  }
  const path = authCallback
    ? target.pathname || "/account"
    : `${target.pathname || "/"}${target.search}${target.hash}`;
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
  const launch = await getNativeLaunchUrl();
  if (launch?.url) await openAppUrl(launch.url);
  await SplashScreen.hide();
  const removeExternalHandler = installExternalLinkHandler();
  return () => {
    listeners.forEach((listener) => listener.remove());
    removeExternalHandler();
  };
}
