import { ChartNoAxesCombined, Dumbbell, Home, Search, User } from "lucide-react";
import { getAppSection } from "../appNavigation";

export default function MobileBottomNav({ activeView, hasReport = false, onNavigate }) {
  const activeSection = getAppSection(activeView);
  const items = [
    { key: "home", label: "Today", Icon: Home, activeViews: ["home", "dashboard"], activePaths: ["/", "/dashboard"] },
    { key: "analyse", label: "Analyse", Icon: Search, activeViews: ["analyse", "import"] },
    {
      key: "training",
      label: "Train",
      Icon: Dumbbell,
      activeViews: ["train", "training", "interactive", "practice"],
    },
    {
      key: "report",
      label: "Report",
      Icon: ChartNoAxesCombined,
      activeSections: ["report", "repertoire"],
      activeViews: ["report", "recommendations", "repertoire", "openings", "weakspots", "verdicts", "progress"],
    },
    { key: "profile", label: "Profile", Icon: User, activeViews: ["profile", "account", "login"] },
  ];

  function handleClick(event, item) {
    event.preventDefault();
    event.stopPropagation();
    const target = item.needsReport && !hasReport ? "analyse" : item.key;
    if (target === "training") {
      onNavigate?.({ view: "train", path: "/train", target: "opening-practice" });
      return;
    }
    if (target === "report") {
      onNavigate?.({ view: "report", path: "/report", target: "app-results" });
      return;
    }
    if (target === "home") {
      onNavigate?.({ view: "dashboard", path: "/dashboard", target: "coach-dashboard", fallbackIds: ["app-dashboard"] });
      return;
    }
    onNavigate?.(target);
  }

  return (
    <nav className="mobileBottomNav of-mobile-bottom-nav" aria-label="Mobile app navigation">
      {items.map((item) => {
        const isReportPrompt = item.needsReport && !hasReport;
        const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
        const isPremiumPath = currentPath === "/premium" || currentPath === "/upgrade";
        const isActive =
          activeView === item.key ||
          item.activeViews?.includes(activeView) ||
          (item.key !== "home" && item.key !== "profile" && item.activeSections?.includes(activeSection)) ||
          (item.key === "profile" && !isPremiumPath && item.activeSections?.includes(activeSection)) ||
          (item.key === "home" && ["home", "dashboard"].includes(activeView) && item.activePaths?.includes(currentPath)) ||
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
