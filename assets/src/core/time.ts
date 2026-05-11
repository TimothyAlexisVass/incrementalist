let serverTimeDelta = 0;

/**
 * Synchronizes the client clock with the server time.
 * @param serverTimeIso The ISO8601 string returned by the server.
 */
export function synchronize(serverTimeIso: string | null | undefined) {
  if (!serverTimeIso) return;

  const serverMs = Date.parse(serverTimeIso);
  if (isNaN(serverMs)) return;

  const localMs = Date.now();
  serverTimeDelta = serverMs - localMs;
}

/**
 * Returns the current time in UTC milliseconds, synchronized with the server.
 */
export function getServerNow(): number {
  return Date.now() + serverTimeDelta;
}
