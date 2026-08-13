export function resolveNativeStartupRoute({
  native = false,
  authResolved = false,
  authenticated = false,
  currentPath = "/",
  launchPath = null,
  handled = false,
} = {}) {
  if (!native || !authResolved || handled) return { handled, destination: null };
  if (currentPath !== "/" || (launchPath && launchPath !== "/")) {
    return { handled: true, destination: null };
  }
  return { handled: true, destination: authenticated ? "/account" : null };
}

export function nativeLogoutRoute({ native = false, hadUser = false, authenticated = false } = {}) {
  return native && hadUser && !authenticated ? "/" : null;
}
