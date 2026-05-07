export default function MobileBottomNav({ data, activeView, onViewChange }) {
  const items = [
    { key: "overview", label: "Home", icon: "🏠" },
    { key: "recommendations", label: "Ideas", icon: "🎯" },
    { key: "training", label: "Train", icon: "🚀" },
    { key: "repertoire", label: "Tools", icon: "🧩" },
    { key: "feedback", label: "Feedback", icon: "💬" },
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
          onClick={() => handleClick(item.key)}
        >
          <span>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
