import { Blocks, Dumbbell, Home, MessageCircle, Target } from "lucide-react";

export default function MobileBottomNav({ data, activeView, onViewChange }) {
  const items = [
    { key: "overview", label: "Home", Icon: Home },
    { key: "recommendations", label: "Ideas", Icon: Target },
    { key: "training", label: "Train", Icon: Dumbbell },
    { key: "repertoire", label: "Tools", Icon: Blocks },
    { key: "feedback", label: "Feedback", Icon: MessageCircle },
  ];

  function handleClick(key) {
    onViewChange(key);

    setTimeout(() => {
      const target =
        key === "feedback"
          ? document.getElementById("feedback")
          : document.getElementById("app-results") || document.getElementById("app-dashboard");

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
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
