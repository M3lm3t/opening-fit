import { useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl } from "../lib/apiBase";
import "./GameAnalysisCount.css";

const COUNT_ENDPOINT = "/api/public/games-analysed-count";

function formatCount(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.floor(Number(value) || 0)));
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function GameAnalysisCount({
  className = "",
  copy = "short",
  minimumCount = 1,
}) {
  const [count, setCount] = useState(null);
  const [displayCount, setDisplayCount] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);
  const rootRef = useRef(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      try {
        const response = await fetch(buildApiUrl(COUNT_ENDPOINT), {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return;

        const payload = await response.json();
        const nextCount = Number(payload?.count);

        if (!cancelled && Number.isFinite(nextCount) && nextCount >= minimumCount) {
          setCount(Math.floor(nextCount));
        }
      } catch {
        if (!cancelled) setCount(null);
      }
    }

    loadCount();

    return () => {
      cancelled = true;
    };
  }, [minimumCount]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || count === null) return undefined;

    if (typeof IntersectionObserver !== "function") {
      setHasEntered(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [count]);

  useEffect(() => {
    if (count === null || !hasEntered || animatedRef.current) return undefined;

    animatedRef.current = true;

    if (prefersReducedMotion()) {
      setDisplayCount(count);
      return undefined;
    }

    const duration = 800;
    const start = performance.now();
    let frameId = 0;

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCount(Math.round(count * eased));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [count, hasEntered]);

  const rendered = useMemo(() => {
    const formatted = formatCount(displayCount || count || 0);

    if (copy === "sentence") {
      return {
        label: `OpeningFit has analysed ${formatted}+ games`,
        prefix: "OpeningFit has analysed",
        number: `${formatted}+`,
        suffix: "games",
      };
    }

    if (copy === "testing") {
      return {
        label: `Built and tested across ${formatted}+ analysed games`,
        prefix: "Built and tested across",
        number: `${formatted}+`,
        suffix: "analysed games",
      };
    }

    return {
      label: `${formatted}+ games analysed`,
      prefix: "",
      number: `${formatted}+`,
      suffix: "games analysed",
    };
  }, [copy, count, displayCount]);

  if (count === null) return null;

  return (
    <div ref={rootRef} className={`gameAnalysisCount ${className}`.trim()} aria-label={rendered.label}>
      {rendered.prefix ? <span className="gameAnalysisCount__prefix">{rendered.prefix}</span> : null}
      <span className="gameAnalysisCount__number">{rendered.number}</span>
      <span className="gameAnalysisCount__copy">{rendered.suffix}</span>
    </div>
  );
}
