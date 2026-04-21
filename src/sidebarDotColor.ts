const FALLBACK_DOT_COLOR = "rgba(55, 53, 47, 0.35)";

function normalizeRgba(color: string): string | null {
  const m = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return null;
  const parts = m[1].split(",").map((s) => s.trim());
  if (parts.length < 3) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if (![r, g, b].every(Number.isFinite)) return null;
  const rawA = parts.length >= 4 ? Number(parts[3]) : 1;
  const a = Number.isFinite(rawA) ? rawA : 1;
  // Sidebar dots should be readable even when catalog tint uses very low alpha.
  const boostedA = Math.max(0.72, Math.min(1, a));
  return `rgba(${r}, ${g}, ${b}, ${boostedA})`;
}

export function toReadableSidebarDotColor(color?: string | null): string {
  const value = color?.trim();
  if (!value) return FALLBACK_DOT_COLOR;
  return normalizeRgba(value) ?? value;
}

