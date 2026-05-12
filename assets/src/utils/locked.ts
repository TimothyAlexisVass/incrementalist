import { getActiveWebGLRenderer } from "../renderer/webgl";

/**
 * Executes a draw callback with the appropriate global alpha for a locked state.
 * This is the core "locked elements helper" that manages visibility.
 */
export function withLockedAlpha<T>(
  isLocked: boolean,
  dimmingFactor: number,
  draw: () => T
): T {
  const renderer = getActiveWebGLRenderer();
  if (!isLocked) {
    return draw();
  }

  const prevAlpha = renderer.getGlobalAlpha();
  const targetAlpha = prevAlpha * (1.0 - dimmingFactor);
  
  renderer.setGlobalAlpha(targetAlpha);
  try {
    return draw();
  } finally {
    renderer.setGlobalAlpha(prevAlpha);
  }
}
