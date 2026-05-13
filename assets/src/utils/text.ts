export function parseFontSizePx(font: string, fallback = 16): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || '');
  if (!match) {
    return fallback;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type UpdatingTextState = {
  displayedText: string;
  pendingText: string | null;
  queuedText: string | null;
};

const updatingTextStateByKey = new Map<string, UpdatingTextState>();

type TextReadyCheck = (text: string) => boolean;

export function resolveUpdatingText(key: string, nextText: string, isTextReady: TextReadyCheck): string {
  const normalizedNext = String(nextText ?? "");
  const current = updatingTextStateByKey.get(key);

  if (!current) {
    updatingTextStateByKey.set(key, {
      displayedText: normalizedNext,
      pendingText: null,
      queuedText: null
    });
    return normalizedNext;
  }

  if (current.pendingText !== null) {
    tryCommitPendingText(current, isTextReady);
  }

  if (normalizedNext === current.displayedText) {
    return current.displayedText;
  }

  if (current.pendingText === null) {
    current.pendingText = normalizedNext;
    tryCommitPendingText(current, isTextReady);
    return current.displayedText;
  }

  current.queuedText = normalizedNext;
  return current.displayedText;
}

export function clearUpdatingTextKey(key: string) {
  updatingTextStateByKey.delete(key);
}

export function clearUpdatingTextKeysByPrefix(prefix: string) {
  for (const key of updatingTextStateByKey.keys()) {
    if (key.startsWith(prefix)) {
      updatingTextStateByKey.delete(key);
    }
  }
}

function tryCommitPendingText(state: UpdatingTextState, isTextReady: TextReadyCheck) {
  let safety = 0;
  while (state.pendingText !== null && safety < 4) {
    const pending = state.pendingText;
    if (!isTextReady(pending)) {
      return;
    }
    state.displayedText = pending;
    state.pendingText = state.queuedText;
    state.queuedText = null;
    safety += 1;
  }
}
