import { useEffect, useState } from "react";

export default function OpeningFitPolishToast() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = (event) => {
      setMessage(event.detail || "Copied.");
      window.clearTimeout(window.__openingfitToastTimer);
      window.__openingfitToastTimer = window.setTimeout(() => setMessage(""), 2200);
    };

    window.addEventListener("openingfit-toast", handler);
    return () => window.removeEventListener("openingfit-toast", handler);
  }, []);

  if (!message) return null;

  return <div className="ofToast">{message}</div>;
}
