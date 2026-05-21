import { Crown, Dumbbell, Gamepad2, Home, Target } from "lucide-react";

export default function MobileBottomNav({ data, activeView, onViewChange }) {
  const items = [
    { key: "overview", label: "Home", Icon: Home, target: "app-results", path: "/" },
    {
      key: "recommendations",
      label: "Openings",
      Icon: Target,
      target: "section-recommendations",
      path: "/",
    },
    { key: "training", label: "Plan", Icon: Dumbbell, target: "section-training", path: "/" },
    { key: "games", label: "Games", Icon: Gamepad2, target: "section-replay", path: "/" },
    { key: "upgrade", label: "Upgrade", Icon: Crown, target: "premium", path: "/upgrade" },
  ];

  function scrollToTarget(targetId) {
    if (typeof window === "undefined") return;

    const target =
      document.getElementById(targetId) ||
      document.getElementById("app-results") ||
      document.getElementById("app-dashboard") ||
      document.querySelector(".appTabsCard");

    if (!target) return;

    const offset = window.innerWidth <= 760 ? 88 : 108;
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

  if (!data && activeView !== "feedback") return null;

  return (
    <nav className="mobileBottomNav" aria-label="Mobile app navigation">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={activeView === item.key ? "mobileBottomNavActive" : ""}
          aria-current={activeView === item.key ? "page" : undefined}
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
