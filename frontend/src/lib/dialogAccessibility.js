import { useEffect } from "react";

let activeDialogId = null;
const dialogListeners = new Set();

function publishDialog() {
  dialogListeners.forEach((listener) => listener(activeDialogId));
}

export function requestExclusiveDialog(dialogId) {
  if (!dialogId || activeDialogId === dialogId) return activeDialogId;
  activeDialogId = dialogId;
  publishDialog();
  return activeDialogId;
}

export function releaseExclusiveDialog(dialogId) {
  if (activeDialogId !== dialogId) return activeDialogId;
  activeDialogId = null;
  publishDialog();
  return activeDialogId;
}

export function subscribeExclusiveDialog(listener) {
  dialogListeners.add(listener);
  listener(activeDialogId);
  return () => dialogListeners.delete(listener);
}

export function getActiveDialogId() {
  return activeDialogId;
}

export function activateAccessibleDialog({ dialog, onClose, documentRef = document, windowRef = window }) {
  if (!dialog || !documentRef || !windowRef) return () => {};
  const previousFocus = documentRef.activeElement;
  const background = Array.from(documentRef.querySelectorAll?.("main.appShell, .appPrimaryNav, .mobileBottomNav") || []).map((element) => ({
    element,
    inert: element.hasAttribute?.("inert") || false,
    ariaHidden: element.getAttribute?.("aria-hidden"),
  }));
  const previousOverflow = documentRef.body?.style?.overflow || "";
  background.forEach(({ element }) => {
    element.setAttribute("inert", "");
    element.setAttribute("aria-hidden", "true");
  });
  if (documentRef.body?.style) documentRef.body.style.overflow = "hidden";

  const focusable = () => Array.from(dialog.querySelectorAll?.("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") || []);
  const focusTimer = windowRef.setTimeout(() => focusable()[0]?.focus?.(), 0);
  const keydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault?.();
      onClose?.();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && documentRef.activeElement === first) {
      event.preventDefault?.();
      last.focus?.();
    } else if (!event.shiftKey && documentRef.activeElement === last) {
      event.preventDefault?.();
      first.focus?.();
    }
  };
  windowRef.addEventListener("keydown", keydown, true);

  return () => {
    windowRef.clearTimeout?.(focusTimer);
    windowRef.removeEventListener("keydown", keydown, true);
    background.forEach(({ element, inert, ariaHidden }) => {
      if (!inert) element.removeAttribute("inert");
      if (ariaHidden === null || ariaHidden === undefined) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    });
    if (documentRef.body?.style) documentRef.body.style.overflow = previousOverflow;
    if (previousFocus && documentRef.contains?.(previousFocus)) previousFocus.focus?.();
  };
}

export function useAccessibleDialog(dialogRef, open, onClose) {
  useEffect(() => {
    if (!open || !dialogRef.current) return undefined;
    return activateAccessibleDialog({ dialog: dialogRef.current, onClose });
  }, [dialogRef, onClose, open]);
}
