export async function auditPageContrast(page) {
  return page.evaluate(() => {
    const parse = (value) => {
      const match = String(value || "").match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
    };
    const composite = (top, bottom) => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (alpha <= 0) return [0, 0, 0, 0];
      return [
        (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / alpha,
        (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / alpha,
        (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / alpha,
        alpha,
      ];
    };
    const luminance = (rgb) => {
      const channels = rgb.slice(0, 3).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ratio = (one, two) => {
      const a = luminance(one);
      const b = luminance(two);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const selector = (element) => {
      const parts = [];
      let current = element;
      while (current && current !== document.body && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.id) part += `#${current.id}`;
        else if (current.classList.length) part += `.${[...current.classList].slice(0, 2).join(".")}`;
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(" > ");
    };
    const effectiveBackground = (element) => {
      const layers = [];
      let current = element;
      while (current) {
        const style = getComputedStyle(current);
        const colour = parse(style.backgroundColor);
        if (colour && colour[3] > 0) layers.push(colour);
        current = current.parentElement;
      }
      let result = document.documentElement.dataset.theme === "light" ? [248, 250, 252, 1] : [3, 8, 20, 1];
      for (const layer of layers.reverse()) result = composite(layer, result);
      return result;
    };
    const hasBackgroundImageAncestor = (element) => {
      let current = element;
      while (current && current !== document.documentElement) {
        const style = getComputedStyle(current);
        if (style.backgroundImage !== "none") return true;
        const colour = parse(style.backgroundColor);
        if (colour?.[3] >= 0.98) return false;
        current = current.parentElement;
      }
      return false;
    };

    const failures = [];
    const seen = new Set();
    for (const element of document.body.querySelectorAll("body *")) {
      if (["SCRIPT", "STYLE", "SVG", "PATH", "IMG", "CANVAS"].includes(element.tagName)) continue;
      const directText = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || "").join(" ").replace(/\s+/g, " ").trim();
      if (!directText || !element.checkVisibility()) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width < 1 || rect.height < 1 || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.25) continue;
      // Gradient and image backgrounds need pixel sampling rather than CSS colour
      // composition, so they are covered by the visual regression sweep.
      if (hasBackgroundImageAncestor(element)) continue;
      const foreground = parse(style.color);
      if (!foreground) continue;
      const background = effectiveBackground(element);
      const renderedForeground = composite(foreground, background);
      const contrast = ratio(renderedForeground, background);
      const fontSize = Number.parseFloat(style.fontSize) || 16;
      const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
      const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const disabled = element.matches(":disabled,[aria-disabled='true']") || Boolean(element.closest(":disabled,[aria-disabled='true']"));
      const minimum = disabled ? 3 : largeText ? 3 : 4.5;
      if (contrast + 0.05 >= minimum) continue;
      const key = `${selector(element)}|${directText.slice(0, 80)}|${contrast.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push({
        selector: selector(element),
        text: directText.slice(0, 100),
        contrast: Number(contrast.toFixed(2)),
        minimum,
        foreground: style.color,
        background: `rgb(${background.slice(0, 3).map(Math.round).join(", ")})`,
      });
    }
    return failures;
  });
}
