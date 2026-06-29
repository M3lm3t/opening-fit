import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./InfoHint.css";

const TOOLTIP_WIDTH = 280;
const TOOLTIP_MAX_HEIGHT = 360;
const EDGE_GAP = 12;

let activeInfoHint = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function InfoHint({ label, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: EDGE_GAP, top: EDGE_GAP });
  const id = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const bubbleRef = useRef(null);
  const pointerFocusRef = useRef(false);
  const openedByHoverRef = useRef(false);
  const bubbleHoverRef = useRef(false);
  const closeTimerRef = useRef(null);
  const closeActiveHint = useCallback(() => setOpen(false), []);
  const closeRef = useRef(closeActiveHint);

  useEffect(() => {
    closeRef.current = closeActiveHint;
  }, [closeActiveHint]);

  const openHint = useCallback(() => {
    if (activeInfoHint && activeInfoHint !== closeRef.current) {
      activeInfoHint();
    }
    activeInfoHint = closeRef.current;
    setOpen(true);
  }, []);

  const closeHint = useCallback(({ restoreFocus = false } = {}) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    bubbleHoverRef.current = false;
    openedByHoverRef.current = false;
    setOpen(false);
    if (activeInfoHint === closeRef.current) {
      activeInfoHint = null;
    }
    if (restoreFocus) {
      buttonRef.current?.focus();
    }
  }, []);

  const scheduleHoverClose = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (!bubbleHoverRef.current) {
        closeHint();
      }
    }, 120);
  }, [closeHint]);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - EDGE_GAP * 2);
    const bubbleHeight = Math.min(
      bubbleRef.current?.offsetHeight || 96,
      TOOLTIP_MAX_HEIGHT,
      window.innerHeight - EDGE_GAP * 2
    );
    const left = clamp(
      rect.left + rect.width / 2 - width / 2,
      EDGE_GAP,
      window.innerWidth - width - EDGE_GAP
    );
    const spaceBelow = window.innerHeight - rect.bottom - EDGE_GAP;
    const spaceAbove = rect.top - EDGE_GAP;
    const top =
      spaceBelow >= bubbleHeight + 8 || spaceBelow >= spaceAbove
        ? Math.min(rect.bottom + 8, window.innerHeight - bubbleHeight - EDGE_GAP)
        : Math.max(EDGE_GAP, rect.top - bubbleHeight - 8);

    setPosition({ left, top, width });
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, children, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        closeHint();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeHint({ restoreFocus: true });
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeHint]);

  useEffect(() => {
    return () => {
      if (activeInfoHint === closeRef.current) {
        activeInfoHint = null;
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <span
      ref={rootRef}
      className={`infoHint ${className}`.trim()}
      onMouseEnter={() => {
        openedByHoverRef.current = true;
        openHint();
      }}
      onMouseLeave={scheduleHoverClose}
    >
      <button
        ref={buttonRef}
        type="button"
        className="infoHintButton"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onPointerDown={() => {
          pointerFocusRef.current = true;
          window.setTimeout(() => {
            pointerFocusRef.current = false;
          }, 0);
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (open && openedByHoverRef.current) {
            openedByHoverRef.current = false;
            openHint();
            return;
          }
          if (open) {
            closeHint();
          } else {
            openedByHoverRef.current = false;
            openHint();
          }
        }}
        onFocus={() => {
          if (!pointerFocusRef.current) {
            openedByHoverRef.current = false;
            openHint();
          }
        }}
        onBlur={() => closeHint()}
      >
        i
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <span
          ref={bubbleRef}
          id={id}
          role="tooltip"
          className="infoHintBubble"
          onMouseEnter={() => {
            bubbleHoverRef.current = true;
            if (closeTimerRef.current) {
              window.clearTimeout(closeTimerRef.current);
              closeTimerRef.current = null;
            }
          }}
          onMouseLeave={() => closeHint()}
          style={{
            left: `${position.left}px`,
            top: `${position.top}px`,
            width: position.width ? `${position.width}px` : undefined,
          }}
        >
          {children}
        </span>,
        document.body
      ) : null}
    </span>
  );
}
