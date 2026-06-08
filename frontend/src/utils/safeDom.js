export function safeScrollToId(id, options = {}) {
  if (!id || typeof document === "undefined") return false;

  const node = document.getElementById(id);
  if (!node || !document.body.contains(node)) {
    console.warn("OpeningFit safeScrollToId skipped: node missing", { id });
    return false;
  }

  try {
    node.scrollIntoView({
      behavior: options.behavior || "smooth",
      block: options.block || "start",
      inline: options.inline || "nearest",
    });
    return true;
  } catch (error) {
    console.warn("OpeningFit safeScrollToId failed", { id, error });
    return false;
  }
}

export function safeFocusById(id, options = {}) {
  if (!id || typeof document === "undefined") return false;

  const node = document.getElementById(id);
  if (!node || !document.body.contains(node)) {
    console.warn("OpeningFit safeFocusById skipped: node missing", { id });
    return false;
  }

  try {
    if (typeof node.focus === "function") {
      node.focus(options);
      return true;
    }
    return false;
  } catch (error) {
    console.warn("OpeningFit safeFocusById failed", { id, error });
    return false;
  }
}

export function safeScrollToElement(node, options = {}) {
  if (!node || typeof document === "undefined" || !document.body.contains(node)) {
    return false;
  }

  try {
    node.scrollIntoView({
      behavior: options.behavior || "smooth",
      block: options.block || "start",
      inline: options.inline || "nearest",
    });
    return true;
  } catch (error) {
    console.warn("OpeningFit safeScrollToElement failed", { error });
    return false;
  }
}
