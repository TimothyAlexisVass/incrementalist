import type { GameChannel } from "../../net/game-channel";
import { getViewModel, shouldSendClaimIn } from "./view-model";

export function handleProgressLoop(channel: GameChannel): boolean {
  void channel;
  return shouldSendClaimIn(Date.now());
}

export function tryClaimReward(channel: GameChannel): boolean {
  const vm = getViewModel();

  if (vm.state === "confirmed_collectible") {
    return true;
  }

  return false;
}
