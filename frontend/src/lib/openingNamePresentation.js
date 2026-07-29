const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export function formatOpeningNameForDisplay(value) {
  return text(value).replace(/\bDefense\b/g, "Defence").replace(/\bdefense\b/g, "defence");
}

