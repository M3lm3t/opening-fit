import { BarChart3, Dumbbell, Search, User } from "lucide-react";
import { getAppSection } from "../appNavigation";

export default function MobileBottomNav({ activeView, onNavigate }) {
  const activeSection = getAppSection(activeView);
  const items = [
    { key: "analyse", label: "Analyse", Icon: Search },
    { key: "report", label: "Report", Icon: BarChart3 },
    { key: "training", label: "Train", Icon: Dumbbell },
    { key: "profile", label: "Profile", Icon: User },
  ];

  function handleClick(event, item) {
    event.preventDefault();
    event.stopPropagation();
    onNavigate?.(item.key);
  }

  return (
    <nav className="mobileBottomNav" aria-label="Mobile app navigation">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={activeSection === item.key ? "mobileBottomNavActive" : ""}
          aria-current={activeSection === item.key ? "page" : undefined}
          title={item.label}
          onClick={(event) => handleClick(event, item)}
        >
          <span aria-hidden="true">
            <item.Icon size={19} strokeWidth={2.4} />
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
