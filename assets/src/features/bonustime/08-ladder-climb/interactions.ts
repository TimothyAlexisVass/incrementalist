import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { InteractionState } from "../../../ui/managers/interactions";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  isPointInRect,
  shouldOpenBonusTimeRewardModal
} from "../flow";
import {
  LadderClimbData,
  getLadderClimbAnimationDurationMs
} from "./view-model";

export enum LadderClimbState {
  IDLE,
  PREPARING,
  REVEALING,
  REVEALED
}

let internalState = LadderClimbState.IDLE;
let waitingForResult = false;
let animationStartedAt = 0;
let completedStepCount = 0;
let previousPlayedAt: string | null = null;
let resolvedPlayedAt: string | null = null;
let rewardModalStartTime = 0;

export function getLadderClimbState() {
  return internalState;
}

export function getLadderClimbAnimationStartedAt() {
  return animationStartedAt;
}

export function getLadderClimbCompletedStepCount() {
  return completedStepCount;
}

export function getRewardWaitStartedAt() {
  return rewardModalStartTime;
}

export function resetLadderClimbState() {
  internalState = LadderClimbState.IDLE;
  waitingForResult = false;
  animationStartedAt = 0;
  completedStepCount = 0;
  previousPlayedAt = null;
  resolvedPlayedAt = null;
  rewardModalStartTime = 0;
}

export function getLadderClimbBoardRect(rect: { x: number; y: number; width: number; height: number }) {
  const verticalPadding = Math.max(16, Math.round(rect.height * 0.03));
  const boardHeight = Math.max(240, rect.height - (verticalPadding * 2));
  const boardWidth = Math.min(
    rect.width - 48,
    Math.max(140, Math.round(boardHeight * 0.28))
  );

  return {
    x: rect.x + Math.round((rect.width - boardWidth) / 2),
    y: rect.y + verticalPadding,
    width: boardWidth,
    height: boardHeight
  };
}

export function handleLadderClimbInteractions(
  input: InteractionState,
  data: LadderClimbData,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
    cardWidth: 500,
    cardHeight: 330,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  if (internalState === LadderClimbState.IDLE) {
    const isOverBtn = isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout);

    if (isOverBtn && input.clicked && !input.consumed && data.hasToken && channel) {
      internalState = LadderClimbState.PREPARING;
      waitingForResult = true;
      animationStartedAt = 0;
      completedStepCount = 0;
      rewardModalStartTime = 0;
      previousPlayedAt = data.lastPlayedAt;
      resolvedPlayedAt = null;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "ladder_climb"));
      } else {
        playBonusTime(channel, "ladder_climb");
      }

      input.consumed = true;
    }
  }

  if (internalState === LadderClimbState.PREPARING || internalState === LadderClimbState.REVEALING) {
    const hasFreshResult =
      !!data.lastPlayedAt &&
      data.lastPlayedAt !== previousPlayedAt &&
      data.lastPlayedAt !== resolvedPlayedAt &&
      data.path.length > 0;

    if (waitingForResult && hasFreshResult) {
      waitingForResult = false;
      resolvedPlayedAt = data.lastPlayedAt;
      completedStepCount = 0;
      rewardModalStartTime = 0;
      internalState = LadderClimbState.REVEALING;
    }

    if (
      internalState === LadderClimbState.REVEALING &&
      !waitingForResult &&
      animationStartedAt <= 0 &&
      completedStepCount < data.path.length
    ) {
      const boardRect = getLadderClimbBoardRect(rect);
      const isOverBoard = isPointInRect(input.pointer, boardRect);

      if (isOverBoard && input.clicked && !input.consumed) {
        animationStartedAt = performance.now();
        input.consumed = true;
      }
    }

    if (!waitingForResult && animationStartedAt > 0) {
      const elapsed = performance.now() - animationStartedAt;
      if (elapsed >= getLadderClimbAnimationDurationMs(data)) {
        completedStepCount += 1;
        animationStartedAt = 0;

        if (completedStepCount >= data.path.length) {
          internalState = LadderClimbState.REVEALED;
          rewardModalStartTime = performance.now();
        }
      }
    }
  } else if (internalState === LadderClimbState.REVEALED) {
    if (shouldOpenBonusTimeRewardModal(rewardModalStartTime, performance.now())) {
      return { type: "open_modal" as const };
    }
  }

  return null;
}
