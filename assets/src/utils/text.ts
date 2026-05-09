export function parseFontSizePx(font: string, fallback = 16): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || '');
  if (!match) {
    return fallback;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}
