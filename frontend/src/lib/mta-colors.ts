// Pastel dashboard palette - softer, more subtle MTA colors
export const MTA_COLORS: Record<string, string> = {
  // Blue line (A/C/E) - soft periwinkle
  A: "#7ba3d4",
  C: "#7ba3d4",
  E: "#7ba3d4",
  // Orange line (B/D/F/M) - soft peach
  B: "#f4a683",
  D: "#f4a683",
  F: "#f4a683",
  M: "#f4a683",
  // Green line (G) - soft mint
  G: "#8ed4a0",
  // Brown line (J/Z) - soft tan
  J: "#c9a87c",
  Z: "#c9a87c",
  // Gray line (L) - soft silver
  L: "#b8bcc4",
  // Yellow line (N/Q/R/W) - soft gold
  N: "#e8d07a",
  Q: "#e8d07a",
  R: "#e8d07a",
  W: "#e8d07a",
  // Red line (1/2/3) - soft coral
  "1": "#e88a87",
  "2": "#e88a87",
  "3": "#e88a87",
  // Green line (4/5/6) - soft sage
  "4": "#6bb87f",
  "5": "#6bb87f",
  "6": "#6bb87f",
  // Purple line (7) - soft lavender
  "7": "#c78ac5",
  // Shuttles - soft gray
  S: "#a8aaad",
  SIR: "#7ba3d4",
};

export function getLineColor(line: string): string {
  return MTA_COLORS[line.toUpperCase()] ?? "#808183";
}

/**
 * Get desaturated MTA color for route path overlays
 * Reduces saturation by 40% and lightness by 30% for a muted appearance
 * Examples:
 * - A train base: #7ba3d4 → A train path: #5c7ba8
 */
export function getDesaturatedLineColor(line: string): string {
  const baseColor = getLineColor(line);

  // Parse hex color to RGB
  const hex = baseColor.substring(1);
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Apply desaturation: reduce saturation by 40%, lightness by 30%
  s = Math.max(0, s - 0.4);
  const newL = Math.max(0.2, l - 0.3);

  // Convert HSL back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let newR, newG, newB;

  if (s === 0) {
    newR = newG = newB = newL;
  } else {
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
    const p = 2 * newL - q;
    newR = hue2rgb(p, q, h + 1 / 3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1 / 3);
  }

  // Convert back to hex
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}
