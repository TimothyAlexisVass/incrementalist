import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { claimLuckyDice, throwLuckyDice } from "../../../net/commands";
import { LuckyDiceData } from "./view-model";
import {
  getBonusTimeWelcomeLayout,
  isPointInRect,
  isPointInBonusTimeWelcomeButton,
  shouldOpenBonusTimeRewardModal
} from "../flow";

export interface LuckyDiceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LuckyDiceLayout {
  startButtonRect: LuckyDiceRect;
  rollButtonRect: LuckyDiceRect;
  claimButtonRect: LuckyDiceRect;
  diceRects: LuckyDiceRect[];
  outcomesRect: LuckyDiceRect;
}

export enum LuckyDiceState {
  IDLE,
  LOADING,
  PLAYING,
  FINAL_REVEALING,
  REVEALED
}

let internalState = LuckyDiceState.IDLE;
let hoveredDieIndex: number | null = null;
let heldIndexes: number[] = [];
let heldSessionStartedAt: string | null = null;
let boardRevealSessionStartedAt: string | null = null;
let boardRevealed = false;
let finalRevealStartedAt = 0;
let runStartPlayedAt: string | null = null;

export const LUCKY_DICE_WELCOME_LAYOUT_OPTIONS = {
  cardWidth: 640,
  cardHeight: 380,
  buttonWidth: 260,
  buttonHeight: 52,
  cardYOffset: -10,
  buttonOffsetY: 88
} as const;

export function getLuckyDiceState() { return internalState; }
export function getLuckyDiceHoveredDieIndex() { return hoveredDieIndex; }
export function getLuckyDiceHeldIndexes() { return heldIndexes; }
export function getLuckyDiceBoardRevealed() { return boardRevealed; }
export function getLuckyDiceFinalRevealStartedAt() { return finalRevealStartedAt; }

export function resetLuckyDiceState() {
  internalState = LuckyDiceState.IDLE;
  hoveredDieIndex = null;
  heldIndexes = [];
  heldSessionStartedAt = null;
  boardRevealSessionStartedAt = null;
  boardRevealed = false;
  finalRevealStartedAt = 0;
  runStartPlayedAt = null;
}

export function getLuckyDiceLayout(
  gameRect: { x: number; y: number; width: number; height: number }
): LuckyDiceLayout {
  const centerX = gameRect.x + gameRect.width / 2;
  const diceAreaWidth = Math.min(gameRect.width - 160, 860);
  const dieGap = 12;
  const dieSize = Math.floor((diceAreaWidth - (dieGap * 6)) / 7);
  const totalDiceWidth = (dieSize * 7) + (dieGap * 6);
  const diceStartX = centerX - (totalDiceWidth / 2);
  const diceY = gameRect.y + 170;
  const diceRects: LuckyDiceRect[] = [];

  for (let i = 0; i < 7; i += 1) {
    diceRects.push({
      x: diceStartX + (i * (dieSize + dieGap)),
      y: diceY,
      width: dieSize,
      height: dieSize
    });
  }

  const actionRowY = diceY + dieSize + 34;
  const outcomesWidth = Math.min(760, Math.max(320, gameRect.width - 80));
  const outcomesHeight = 164;
  const outcomesX = centerX - (outcomesWidth / 2);
  const outcomesY = Math.min(actionRowY + 70, gameRect.y + gameRect.height - outcomesHeight - 24);

  return {
    startButtonRect: { x: centerX - 130, y: gameRect.y + 360, width: 260, height: 52 },
    rollButtonRect: { x: centerX - 220, y: actionRowY, width: 200, height: 52 },
    claimButtonRect: { x: centerX + 20, y: actionRowY, width: 200, height: 52 },
    diceRects,
    outcomesRect: { x: outcomesX, y: outcomesY, width: outcomesWidth, height: outcomesHeight }
  };
}

function isPointerInRect(pointer: { x: number; y: number } | null | undefined, rect: LuckyDiceRect): boolean {
  return !!pointer &&
    pointer.x >= rect.x &&
    pointer.x <= rect.x + rect.width &&
    pointer.y >= rect.y &&
    pointer.y <= rect.y + rect.height;
}

function syncHeldIndexes(session: LuckyDiceData["session"]) {
  if (!session || session.currentDice.length === 0) {
    heldIndexes = [];
    heldSessionStartedAt = session?.startedAt ?? null;
    return;
  }

  if (heldSessionStartedAt !== session.startedAt) {
    heldIndexes = [...session.heldIndexes];
    heldSessionStartedAt = session.startedAt;
  }
}

function syncBoardReveal(session: LuckyDiceData["session"]) {
  if (!session) return;

  if (boardRevealSessionStartedAt !== session.startedAt) {
    boardRevealSessionStartedAt = session.startedAt;
    boardRevealed = false;
  }
}

function toggleHeldIndex(index: number) {
  if (heldIndexes.includes(index)) {
    heldIndexes = heldIndexes.filter((value) => value !== index);
    return;
  }

  heldIndexes = [...heldIndexes, index].sort((left, right) => left - right);
}

export function getLuckyDiceThrowButtonRect(
  layout: LuckyDiceLayout,
  gameRect: { x: number; y: number; width: number; height: number },
  centerButton: boolean
) {
  if (!centerButton) return layout.rollButtonRect;

  return {
    ...layout.rollButtonRect,
    x: (gameRect.x + (gameRect.width / 2)) - (layout.rollButtonRect.width / 2)
  };
}

export function getLuckyDiceDieFaceValue(
  state: LuckyDiceState,
  session: LuckyDiceData["session"],
  lastResult: LuckyDiceData["lastResult"],
  index: number
) {
  if (state === LuckyDiceState.FINAL_REVEALING || state === LuckyDiceState.REVEALED) {
    return lastResult?.dice?.[index] ?? null;
  }

  if (!session || session.currentDice.length === 0) {
    return 7;
  }

  if (!boardRevealed) {
    return 7;
  }

  return session.currentDice[index] ?? 7;
}

export function shouldShowLuckyDiceCurrentHand(session: LuckyDiceData["session"]) {
  if (!boardRevealed) return false;
  if (!session || session.currentDice.length !== 7) return false;
  if (!Number.isInteger(session.currentTier) || session.currentTier === null) return false;
  return true;
}

export function shouldShowLuckyDiceClaimButton(session: LuckyDiceData["session"]) {
  if (!boardRevealed) return false;
  if (!session || session.currentDice.length !== 7) return false;
  if (!Number.isInteger(session.currentTier) || session.currentTier === null) return false;
  return session.throwsRemaining > 0;
}

export function shouldCenterLuckyDiceActionButton(session: LuckyDiceData["session"]) {
  if (!boardRevealed) return true;
  if (!session) return true;
  if (session.currentDice.length === 0) return true;
  return !shouldShowLuckyDiceClaimButton(session);
}

export function handleLuckyDiceInteractions(
  input: InteractionState,
  data: LuckyDiceData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const now = performance.now();
  const layout = getLuckyDiceLayout(gameRect);
  const welcomeLayout = getBonusTimeWelcomeLayout(gameRect, LUCKY_DICE_WELCOME_LAYOUT_OPTIONS);
  const session = data.session;
  hoveredDieIndex = null;

  syncHeldIndexes(session);
  syncBoardReveal(session);

  const hasBoard = boardRevealed && !!session && session.currentDice.length === 7;
  const showClaimButton = shouldShowLuckyDiceClaimButton(session);
  const rollRect = getLuckyDiceThrowButtonRect(layout, gameRect, shouldCenterLuckyDiceActionButton(session));

  if (session) {
    internalState = LuckyDiceState.PLAYING;
  } else if (
    data.lastResult &&
    data.lastResult.played_at !== runStartPlayedAt &&
    (internalState === LuckyDiceState.LOADING || internalState === LuckyDiceState.PLAYING)
  ) {
    finalRevealStartedAt = now;
    runStartPlayedAt = data.lastResult.played_at ?? null;
    internalState = LuckyDiceState.FINAL_REVEALING;
  } else if (
    internalState !== LuckyDiceState.LOADING &&
    internalState !== LuckyDiceState.FINAL_REVEALING &&
    internalState !== LuckyDiceState.REVEALED
  ) {
    internalState = LuckyDiceState.IDLE;
  }

  if (internalState === LuckyDiceState.IDLE) {
    if (
      isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) &&
      input.clicked &&
      !input.consumed &&
      data.hasToken &&
      channel
    ) {
      internalState = LuckyDiceState.LOADING;
      boardRevealed = false;
      heldIndexes = [];
      finalRevealStartedAt = 0;
      runStartPlayedAt = data.lastResult?.played_at ?? null;

      if (runCommand) {
        runCommand(() => throwLuckyDice(channel, []));
      } else {
        throwLuckyDice(channel, []);
      }

      input.consumed = true;
    }

    return null;
  }

  if (internalState === LuckyDiceState.FINAL_REVEALING) {
    if (shouldOpenBonusTimeRewardModal(finalRevealStartedAt, now)) {
      internalState = LuckyDiceState.REVEALED;
    }

    return internalState === LuckyDiceState.REVEALED ? { type: "open_modal" as const } : null;
  }

  if (internalState === LuckyDiceState.PLAYING && session) {
    const claimRect = layout.claimButtonRect;

    if (
      !boardRevealed &&
      isPointInRect(input.pointer, rollRect) &&
      input.clicked &&
      !input.consumed
    ) {
      boardRevealed = true;
      input.consumed = true;
      return null;
    }

    if (hasBoard && input.pointer) {
      for (let i = 0; i < layout.diceRects.length; i += 1) {
        if (isPointerInRect(input.pointer, layout.diceRects[i])) {
          hoveredDieIndex = i;
          break;
        }
      }
    }

    if (
      hoveredDieIndex !== null &&
      input.clicked &&
      !input.consumed &&
      hasBoard
    ) {
      const dieIndex = hoveredDieIndex;
      toggleHeldIndex(dieIndex);
      input.consumed = true;
      return null;
    }

    if (boardRevealed && isPointerInRect(input.pointer, rollRect) && input.clicked && !input.consumed && channel) {
      if (runCommand) {
        runCommand(() => throwLuckyDice(channel, heldIndexes));
      } else {
        throwLuckyDice(channel, heldIndexes);
      }
      input.consumed = true;
      return null;
    }

    if (
      showClaimButton &&
      isPointerInRect(input.pointer, claimRect) &&
      input.clicked &&
      !input.consumed &&
      channel
    ) {
      if (runCommand) {
        runCommand(() => claimLuckyDice(channel));
        runCommand(() => throwLuckyDice(channel, []));
      } else {
        claimLuckyDice(channel);
        throwLuckyDice(channel, []);
      }
      input.consumed = true;
      return null;
    }

    return null;
  }

  if (internalState === LuckyDiceState.REVEALED) {
    return { type: "open_modal" as const };
  }

  return null;
}
