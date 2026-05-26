import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { JackpotMeterData } from "./view-model";
import { fitRectWithinBonusTimeArea } from "../layout";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  shouldOpenBonusTimeRewardModal
} from "../flow";

export enum JackpotState {
  IDLE,
  ROLLING,
  REVEALED
}

const JACKPOT_ROLL_DURATION_MS = 3333;

let internalState = JackpotState.IDLE;
let rollStartTime = 0;
let rewardModalStartTime = 0;
let rollBaselinePlayedAt: string | null = null;

export function getJackpotState() { return internalState; }
export function getRewardWaitStartedAt() { return rewardModalStartTime; }
export function resetJackpotState() {
  internalState = JackpotState.IDLE;
  rollStartTime = 0;
  rewardModalStartTime = 0;
  rollBaselinePlayedAt = null;
}

export function handleJackpotMeterInteractions(
  input: InteractionState,
  data: JackpotMeterData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void | Promise<any>
) {
  const layout = fitRectWithinBonusTimeArea(gameRect, 300, 300);
  const welcomeLayout = getBonusTimeWelcomeLayout(gameRect, {
    cardWidth: 520,
    cardHeight: 320,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  // Play Button at the bottom of the fitted area
  const btnWidth = 180 * layout.scale;
  const btnHeight = 40 * layout.scale;
  const btnX = layout.x + (layout.width - btnWidth) / 2;
  const btnY = layout.y + layout.height - btnHeight - 20 * layout.scale;

  const isHoverBtn = input.pointer &&
                     input.pointer.x >= btnX && input.pointer.x <= btnX + btnWidth &&
                     input.pointer.y >= btnY && input.pointer.y <= btnY + btnHeight;

  if (internalState === JackpotState.IDLE) {
    if (isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) && input.clicked && !input.consumed && data.hasToken && channel) {
      internalState = JackpotState.ROLLING;
      rollStartTime = performance.now();
      rollBaselinePlayedAt = data.lastPlayedAt;

      if (runCommand) {
        const maybeResult = runCommand(() => playBonusTime(channel, "jackpot_meter"));
        if (maybeResult && typeof (maybeResult as Promise<any>).then === "function") {
          (maybeResult as Promise<any>)
            .then((result) => {
              if (internalState !== JackpotState.ROLLING) return;
              if (!result || result.type === "command.error") {
                resetJackpotState();
              }
            })
            .catch(() => {
              if (internalState === JackpotState.ROLLING) {
                resetJackpotState();
              }
            });
        }
      } else {
        playBonusTime(channel, "jackpot_meter")
          .then((result) => {
            if (internalState !== JackpotState.ROLLING) return;
            if (!result || result.type === "command.error") {
              resetJackpotState();
            }
          })
          .catch(() => {
            if (internalState === JackpotState.ROLLING) {
              resetJackpotState();
            }
          });
      }

      input.consumed = true;
    }
  }

  // Transition from ROLLING to REVEALED only when a new jackpot result is ready
  // and the 5-second rolling window has elapsed.
  if (internalState === JackpotState.ROLLING) {
    const elapsed = performance.now() - rollStartTime;
    const hasFreshResult =
      data.lastTier !== null &&
      data.lastPlayedAt !== null &&
      data.lastPlayedAt !== rollBaselinePlayedAt;

    if (elapsed >= JACKPOT_ROLL_DURATION_MS && hasFreshResult) {
      internalState = JackpotState.REVEALED;
      rewardModalStartTime = performance.now();
    }
  } else if (internalState === JackpotState.REVEALED) {
    if (shouldOpenBonusTimeRewardModal(rewardModalStartTime, performance.now())) {
      return { type: 'open_modal' as const };
    }
  }

  return null;
}
