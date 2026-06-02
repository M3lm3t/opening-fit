export const APP_NAV_ROUTES = {
  home: { view: "analyse", path: "/", target: "app-dashboard", fallbackIds: ["import"] },
  analyse: { view: "analyse", path: "/", target: "import" },
  import: { view: "analyse", path: "/", target: "import" },
  report: { view: "report", path: "/report", target: "app-results" },
  overview: { view: "report", path: "/report", target: "app-results" },
  recommendations: {
    view: "report",
    path: "/report",
    target: "recommended-repertoire",
    fallbackIds: ["repertoire-map", "openingfit-verdict", "app-results"],
    reportMode: "full",
  },
  repertoire: {
    view: "report",
    path: "/report",
    target: "recommended-repertoire",
    fallbackIds: ["repertoire-map", "openingfit-verdict", "app-results"],
    reportMode: "full",
  },
  openings: {
    view: "report",
    path: "/report",
    target: "evidence-table",
    fallbackIds: ["app-results"],
    reportMode: "table",
  },
  weakspots: { view: "report", path: "/report", target: "weak-lines", fallbackIds: ["analysis-next-steps", "app-results"] },
  verdicts: {
    view: "report",
    path: "/report",
    target: "full-report-highlights",
    fallbackIds: ["openingfit-verdict", "app-results"],
    reportMode: "full",
  },
  training: { view: "train", path: "/train", target: "training-plan" },
  train: { view: "train", path: "/train", target: "training-plan" },
  games: { view: "games", path: "/train", target: "game-replay", fallbackIds: ["training-plan", "app-results"] },
  data: { view: "games", path: "/train", target: "game-replay", fallbackIds: ["training-plan", "app-results"] },
  interactive: { view: "train", path: "/train", target: "opening-practice", fallbackIds: ["training-plan", "app-results"] },
  practice: { view: "train", path: "/train", target: "opening-practice", fallbackIds: ["training-plan", "app-results"] },
  profile: { view: "profile", path: "/account", target: "profile" },
  account: { view: "profile", path: "/account", target: "profile-account" },
  login: { view: "profile", path: "/login", target: "login" },
  history: {
    view: "profile",
    path: "/account",
    target: "recommendation-history",
    fallbackIds: ["report-history", "profile"],
  },
  progress: { view: "profile", path: "/account", target: "openingfit-progress" },
  premium: { view: "profile", path: "/premium", target: "premium", fallbackIds: ["profile"] },
  feedback: { view: "feedback", path: "/", target: "feedback" },
};

export function getAppSection(view) {
  const aliases = {
    import: "analyse",
    home: "analyse",
    analyse: "analyse",
    analyze: "analyse",
    overview: "report",
    report: "report",
    repertoire: "report",
    openings: "report",
    weakspots: "report",
    recommendations: "report",
    verdicts: "report",
    training: "train",
    train: "train",
    games: "train",
    data: "train",
    interactive: "train",
    practice: "train",
    profile: "profile",
    account: "profile",
    login: "profile",
    history: "profile",
    progress: "profile",
    premium: "profile",
    upgrade: "profile",
    feedback: "profile",
  };

  return aliases[String(view || "").toLowerCase()] || "analyse";
}

function getStickyOffset() {
  if (typeof window === "undefined" || typeof document === "undefined") return 96;

  const primaryNav = document.querySelector(".appPrimaryNav");
  const commandBar = document.querySelector(".reportCommandBar");
  const primaryHeight = primaryNav?.getBoundingClientRect?.().height || 0;
  const commandHeight = commandBar?.getBoundingClientRect?.().height || 0;
  const base = window.innerWidth <= 760 ? 16 : 18;
  const stickyHeight = Math.max(primaryHeight, commandHeight);

  return Math.round(stickyHeight + base);
}

export function scrollToAppTarget(targetId, options = {}) {
  if (typeof document === "undefined" || typeof window === "undefined") return false;

  const fallbackIds = options.fallbackIds || [
    "app-results",
    "app-dashboard",
  ];
  const target =
    document.getElementById(targetId) ||
    fallbackIds.map((id) => document.getElementById(id)).find(Boolean) ||
    document.querySelector(".appShell");

  if (!target) return false;

  const offset = options.offset ?? getStickyOffset();
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: options.behavior || "smooth",
  });

  return true;
}

export function navigateApp(routeOrKey, options = {}) {
  if (typeof window === "undefined") return;

  const requested =
    typeof routeOrKey === "string"
      ? APP_NAV_ROUTES[routeOrKey] || { target: routeOrKey }
      : routeOrKey || {};
  const route = {
    ...requested,
    ...(requested.key && APP_NAV_ROUTES[requested.key] ? APP_NAV_ROUTES[requested.key] : {}),
  };

  if (route.view && typeof options.setView === "function") {
    options.setView(route.view);
  }

  if (route.path && window.location.pathname !== route.path) {
    window.history.pushState({}, "", route.path);
  }

  if (route.reportMode) {
    window.dispatchEvent(
      new CustomEvent("openingfit:set-report-mode", {
        detail: { mode: route.reportMode },
      })
    );
  }

  const target = route.target || route.key || routeOrKey || "app-dashboard";
  const delays = options.delays || [90, 240, 520];

  delays.forEach((delay) => {
    window.setTimeout(() => {
      scrollToAppTarget(target, {
        fallbackIds: route.fallbackIds || options.fallbackIds,
        offset: options.offset,
      });
    }, delay);
  });
}
