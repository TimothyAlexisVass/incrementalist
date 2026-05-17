import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { PrizeWheelData } from "./view-model";

export enum WheelState {
  IDLE,
  SPINNING,
  SPUN
}

let internalState = WheelState.IDLE;
let spinStartTime = 0;

export function getWheelState() { return internalState; }
export function resetWheelState() { internalState = WheelState.IDLE; }

export function handlePrizeWheelInteractions(
  input: InteractionState,
  data: PrizeWheelData,
  wheelRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const isHover = input.pointer &&
                  input.pointer.x >= wheelRect.x && input.pointer.x <= wheelRect.x + wheelRect.width &&
                  input.pointer.y >= wheelRect.y && input.pointer.y <= wheelRect.y + wheelRect.height;

  if (isHover && input.clicked && !input.consumed) {
    if (internalState === WheelState.IDLE && data.hasToken && channel) {
      internalState = WheelState.SPINNING;
      spinStartTime = performance.now();
      
      if (runCommand) {
        runCommand(() => playBonusTime(channel, "prize_wheel"));
      } else {
        playBonusTime(channel, "prize_wheel");
      }
      
      input.consumed = true;
    } else if (internalState === WheelState.SPUN) {
      input.consumed = true;
      return { type: 'open_modal' as const };
    }
  }

  // Transition from SPINNING to SPUN only when result is ready
  if (internalState === WheelState.SPINNING) {
    const elapsed = performance.now() - spinStartTime;
    if (elapsed > 1500 && data.lastTier !== null) {
      internalState = WheelState.SPUN;
    }
  }

  return null;
}
