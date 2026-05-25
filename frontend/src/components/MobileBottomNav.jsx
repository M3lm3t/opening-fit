import { BarChart3, Dumbbell, Search, User } from "lucide-react";

export default function MobileBottomNav({ activeView, onViewChange }) {
  const sectionAliases = {
    import: "analyse",
    analyse: "analyse",
    analyze: "analyse",
    overview: "report",
    report: "report",
    repertoire: "report",
    openings: "report",
    weakspots: "report",
    recommendations: "report",
    training: "train",
    train: "train",
    data: "train",
    profile: "profile",
    account: "profile",
    upgrade: "profile",
    feedback: "profile",
  };
  const activeSection = sectionAliases[String(activeView || "").toLowerCase()] || "analyse";
  const items = [
    { key: "analyse", label: "Analyse", Icon: Search, target: "app-dashboard", path: "/" },
    { key: "report", label: "Report", Icon: BarChart3, target: "app-results", path: "/report" },
    { key: "train", label: "Train", Icon: Dumbbell, target: "training-plan", path: "/train" },
    { key: "profile", label: "Profile", Icon: User, target: "profile", path: "/account" },
  ];

  function scrollToTarget(targetId) {
    if (typeof window === "undefined") return;

    const target =
      document.getElementById(targetId) ||
      document.getElementById("app-results") ||
      document.getElementById("app-dashboard") ||
      document.querySelector(".appTabsCard");

    if (!target) return;

    const offset = window.innerWidth <= 760 ? 18 : 108;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function handleClick(event, item) {
    event.preventDefault();
    event.stopPropagation();

    if (typeof onViewChange === "function") {
      onViewChange(item.key);
    }

    if (typeof window !== "undefined") {
      const nextPath = item.path || "/";
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
    }

    [0, 90, 240, 520].forEach((delay) => {
      setTimeout(() => scrollToTarget(item.target), delay);
    });
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
