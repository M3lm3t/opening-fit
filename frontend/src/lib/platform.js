import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function isAndroidApp() {
  return isNativeApp() && Capacitor.getPlatform() === "android";
}

export function isWebApp() {
  return !isNativeApp();
}
