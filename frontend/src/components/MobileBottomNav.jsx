import { Crown, Dumbbell, Gamepad2, Home, Target } from "lucide-react";

export default function MobileBottomNav({ data, activeView, onViewChange }) {
  const items = [
    { key: "overview", label: "Home", Icon: Home },
    { key: "recommendations", label: "Openings", Icon: Target },
    { key: "training", label: "Plan", Icon: Dumbbell },
    { key: "games", label: "Games", Icon: Gamepad2 },
    { key: "upgrade", label: "Upgrade", Icon: Crown },
  ];

  function handleClick(key) {
    onViewChange(key);

    if (typeof window !== "undefined") {
      const nextPath = key === "upgrade" ? "/upgrade" : "/";
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
    }

    setTimeout(() => {
      const target =
        document.getElementById("app-results") ||
        document.getElementById("app-dashboard") ||
        document.querySelector(".appTabsCard");

      if (target) {
        const offset = 82;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 80);
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
          onClick={() => handleClick(item.key)}
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
