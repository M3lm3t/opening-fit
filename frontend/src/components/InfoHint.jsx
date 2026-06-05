import { useEffect, useId, useRef, useState } from "react";
import "./InfoHint.css";

const TOOLTIP_WIDTH = 280;
const ESTIMATED_TOOLTIP_HEIGHT = 180;
const EDGE_GAP = 12;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function InfoHint({ label, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: EDGE_GAP, top: EDGE_GAP });
  const id = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - EDGE_GAP * 2);
      const left = clamp(
        rect.left + rect.width / 2 - width / 2,
        EDGE_GAP,
        window.innerWidth - width - EDGE_GAP
      );
      const shouldOpenAbove = rect.bottom + ESTIMATED_TOOLTIP_HEIGHT > window.innerHeight;
      const top = shouldOpenAbove
        ? Math.max(EDGE_GAP, rect.top - ESTIMATED_TOOLTIP_HEIGHT - 8)
        : rect.bottom + 8;
      setPosition({ left, top, width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={`infoHint ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        className="infoHintButton"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onFocus={() => setOpen(true)}
      >
        i
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="infoHintBubble"
          style={{
            left: `${position.left}px`,
            top: `${position.top}px`,
            width: position.width ? `${position.width}px` : undefined,
          }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
