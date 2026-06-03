import { BarChart3, Dumbbell, Gamepad2, Home, User } from "lucide-react";
import { getAppSection } from "../appNavigation";

export default function MobileBottomNav({ activeView, hasReport = false, onNavigate }) {
  const activeSection = getAppSection(activeView);
  const items = [
    { key: "home", label: "Home", Icon: Home, activeSections: ["analyse"] },
    { key: "report", label: "Report", Icon: BarChart3, needsReport: true, activeSections: ["report"] },
    {
      key: "training",
      label: "Training",
      Icon: Dumbbell,
      needsReport: true,
      activeViews: ["train", "training", "interactive", "practice"],
    },
    { key: "games", label: "Games", Icon: Gamepad2, needsReport: true, activeViews: ["games", "data"] },
    { key: "profile", label: "Profile", Icon: User, activeSections: ["profile"] },
  ];

  function handleClick(event, item) {
    event.preventDefault();
    event.stopPropagation();
    onNavigate?.(item.needsReport && !hasReport ? "analyse" : item.key);
  }

  return (
    <nav className="mobileBottomNav" aria-label="Mobile app navigation">
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
