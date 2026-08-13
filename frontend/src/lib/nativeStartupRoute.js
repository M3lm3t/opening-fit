export function resolveNativeStartupRoute({
  native = false,
  authResolved = false,
  authenticated = false,
  reportAvailable = false,
  currentPath = "/",
  launchPath = null,
  handled = false,
} = {}) {
  if (!native || !authResolved || handled) return { handled, destination: null };
  if (currentPath !== "/" || (launchPath && launchPath !== "/")) {
    return { handled: true, destination: null };
  }
  if (!authenticated) return { handled: true, destination: null };
  return { handled: true, destination: reportAvailable ? "/report" : "/account" };
}

export function nativeLogoutRoute({ native = false, hadUser = false, authenticated = false } = {}) {
  return native && hadUser && !authenticated ? "/" : null;
}
