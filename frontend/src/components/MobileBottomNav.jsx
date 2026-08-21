import { ChartNoAxesCombined, Dumbbell, House, UserRound } from "lucide-react";
import { getAppSection } from "../appNavigation";
import { buildMobileNavigationItems, isMobileNavigationItemActive } from "../lib/mobileNavigation.js";
import { isNativeApp } from "../lib/platform.js";
import { canonicalAppDestination, isCanonicalDestinationActive } from "../lib/reportViews.js";

const ICONS = Object.freeze({
  home: House,
  report: ChartNoAxesCombined,
  train: Dumbbell,
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
    nativeApp: isNativeApp(),
  }).map((item) => ({ ...item, Icon: ICONS[item.key] }));

  function handleClick(event, item) {
    event.preventDefault();
    event.stopPropagation();
    const target = item.needsReport && !hasReport ? "analyse" : item.key;
    const canonical = canonicalAppDestination(target);
    if (canonical) { onNavigate?.(canonical); return; }
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
        const isActive = isCanonicalDestinationActive(item.key) || isMobileNavigationItemActive(item, activeView, activeSection) && !["home", "report", "train", "account"].includes(item.key);

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
