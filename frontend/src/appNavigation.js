export const APP_NAV_ROUTES = {
  today: { view: "dashboard", path: "/dashboard", target: "coach-dashboard", fallbackIds: ["app-dashboard"] },
  dashboard: { view: "dashboard", path: "/dashboard", target: "coach-dashboard", fallbackIds: ["app-dashboard"] },
  home: { view: "analyse", path: "/", target: "app-dashboard", fallbackIds: ["import"] },
  analyse: { view: "analyse", path: "/", target: "import" },
  import: { view: "analyse", path: "/", target: "import" },
  report: { view: "report", path: "/report", target: "app-results" },
  overview: { view: "report", path: "/report", target: "app-results" },
  recommendations: {
    view: "recommendations",
    path: "/report",
    target: "recommended-repertoire",
    fallbackIds: ["repertoire-map", "openingfit-verdict", "app-results"],
    reportMode: "full",
  },
  repertoire: {
    view: "repertoire",
    path: "/repertoire",
    target: "my-repertoire",
    fallbackIds: ["app-dashboard"],
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
  training: { view: "train", path: "/train", target: "opening-practice", fallbackIds: ["today-training", "training-plan"] },
  train: { view: "train", path: "/train", target: "opening-practice", fallbackIds: ["today-training", "training-plan"] },
  games: { view: "games", path: "/train", target: "game-replay", fallbackIds: ["today-training", "training-plan", "app-results"] },
  data: { view: "data", path: "/train", target: "game-replay", fallbackIds: ["today-training", "training-plan", "app-results"] },
  interactive: { view: "interactive", path: "/train", target: "opening-practice", fallbackIds: ["today-training", "training-plan", "app-results"] },
  practice: { view: "practice", path: "/train", target: "opening-practice", fallbackIds: ["today-training", "training-plan", "app-results"] },
  profile: { view: "profile", path: "/account", target: "profile" },
  account: { view: "account", path: "/account", target: "profile-account" },
  login: { view: "login", path: "/login", target: "login" },
  history: {
    view: "history",
    path: "/account",
    target: "report-history",
    fallbackIds: ["recommendation-history", "profile"],
  },
  progress: { view: "progress", path: "/progress", target: "openingfit-progress", fallbackIds: ["profile"] },
  journey: { view: "journey", path: "/journey", target: "journey-page", fallbackIds: ["app-dashboard"] },
  premium: { view: "premium", path: "/premium", target: "premium", fallbackIds: ["profile"] },
  feedback: { view: "feedback", path: "/", target: "feedback" },
};

export function getAppSection(view) {
  const aliases = {
    import: "analyse",
    dashboard: "analyse",
    home: "analyse",
    analyse: "analyse",
    analyze: "analyse",
    overview: "report",
    report: "report",
    repertoire: "repertoire",
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
    journey: "journey",
    premium: "premium",
    upgrade: "premium",
    feedback: "feedback",
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

  if (!target || !document.body.contains(target)) return false;

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
