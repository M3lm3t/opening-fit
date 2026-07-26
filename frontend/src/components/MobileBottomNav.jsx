import { BookOpenCheck, ChartNoAxesCombined, Crown, Dumbbell, TrendingUp, UserRound } from "lucide-react";
import { getAppSection } from "../appNavigation";
import { buildMobileNavigationItems } from "../lib/mobileNavigation.js";

const ICONS = Object.freeze({
  report: ChartNoAxesCombined,
  repertoire: BookOpenCheck,
  train: Dumbbell,
  progress: TrendingUp,
  premium: Crown,
  account: UserRound,
});

export default function MobileBottomNav({
  activeView,
  hasReport = false,
  accountUser = null,
  entitlement = null,
  entitlementState = "loading",
  onNavigate,
}) {
  const activeSection = getAppSection(activeView);
  const items = buildMobileNavigationItems({
    authenticated: Boolean(accountUser?.id),
    entitlement,
    entitlementState,
  }).map((item) => ({ ...item, Icon: ICONS[item.key] }));

  function handleClick(event, item) {
    event.preventDefault();
    event.stopPropagation();
    const target = item.needsReport && !hasReport ? "analyse" : item.key;
    if (target === "train") {
      onNavigate?.({ view: "train", path: "/train", target: "opening-practice" });
      return;
    }
    if (target === "report") {
      onNavigate?.({ view: "report", path: "/report", target: "app-results" });
      return;
    }
    if (target === "repertoire") {
      onNavigate?.({ view: "repertoire", path: "/repertoire", target: "my-repertoire", fallbackIds: ["app-dashboard"] });
      return;
    }
    if (target === "progress") {
      onNavigate?.({ view: "progress", path: "/progress", target: "openingfit-progress", fallbackIds: ["profile"] });
      return;
    }
    if (target === "premium") {
      onNavigate?.({ view: "premium", path: "/premium", target: "premium" });
      return;
    }
    if (target === "account") {
      onNavigate?.({ view: "account", path: "/account", target: "profile-account", fallbackIds: ["profile"] });
      return;
    }
    onNavigate?.(target);
  }

  return (
    <nav
      className="mobileBottomNav of-mobile-bottom-nav"
      aria-label="Mobile app navigation"
      style={{ "--mobile-nav-items": items.length }}
    >
      {items.map((item) => {
        const isReportPrompt = item.needsReport && !hasReport;
        const isActive =
          activeView === item.key ||
          item.activeViews?.includes(activeView) ||
          item.activeSections?.includes(activeSection) ||
          (!item.activeViews && !item.activeSections && activeSection === getAppSection(item.key));

        return (
          <button
            key={item.key}
            type="button"
            className={[
              isActive ? "mobileBottomNavActive" : "",
              isReportPrompt ? "mobileBottomNavNeedsReport" : "",
            ].filter(Boolean).join(" ")}
            aria-current={isActive ? "page" : undefined}
            aria-label={isReportPrompt ? `${item.label}: analyse first` : item.label}
            title={isReportPrompt ? "Analyse first" : item.label}
            onClick={(event) => handleClick(event, item)}
          >
            <span aria-hidden="true">
              <item.Icon size={19} strokeWidth={2.4} />
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
