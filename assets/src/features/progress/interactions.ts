import type { GameChannel } from "../../net/game-channel";
import { getViewModel } from "./view-model";

export function handleProgressLoop(channel: GameChannel): boolean {
  const vm = getViewModel();

  if (vm.state === "awaiting_server_confirmation" && vm.canClaimInMs === null) {
     return true;
  }
  return false;
}

export function tryClaimReward(channel: GameChannel): boolean {
  const vm = getViewModel();

  if (vm.state === "confirmed_collectible") {
    return true;
  }

  return false;
}
