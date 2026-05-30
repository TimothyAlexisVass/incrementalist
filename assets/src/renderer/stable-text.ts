import { resolveUpdatingText } from '../utils/text';
import { getActiveWebGLRenderer, TextReadinessOptions } from './webgl';

export function resolveStableText(
  key: string | undefined | null,
  text: string,
  options: Omit<TextReadinessOptions, 'text'>
): string {
  if (!key) return text;
  return resolveUpdatingText(key, text, (candidate) => {
    const renderer = getActiveWebGLRenderer();
    if (!renderer) return true;
    return renderer.isTextReady({ ...options, text: candidate });
  });
}

export function resolveStableMultilineText(
  key: string | undefined | null,
  lines: string[],
  options: Omit<TextReadinessOptions, 'text'> & { lineFonts?: string[]; lineColors?: string[] }
): string[] {
  if (!key) return lines;
  const combined = lines.join('\n');
  const stableCombined = resolveUpdatingText(key, combined, (candidate) => {
    const candidateLines = candidate.split('\n');
    const renderer = getActiveWebGLRenderer();
    if (!renderer) return true;
    return candidateLines.every((line, i) => {
      const lineFont = (options.lineFonts && options.lineFonts[i]) || options.font;
      const lineColor = (options.lineColors && options.lineColors[i]) || options.color;
      return renderer.isTextReady({
        ...options,
        text: line,
        font: lineFont,
        color: lineColor,
      });
    });
  });
  return stableCombined.split('\n');
}
