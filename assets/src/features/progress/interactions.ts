import type { GameChannel } from "../../net/game-channel";
import type { ServerResult } from "../../net/protocol";
import { progressClaimReward } from "../../net/commands";
import { triggerProgressBarCollectionEffect } from "./render";
import { getViewModel, shouldSendClaimIn, beginAsyncClaimResolution, setPendingClaimIntent } from "./view-model";

let claimResolutionInFlight = false;
let pendingClaimPopupPoint: { x: number; y: number } | null = null;

export function getPendingClaimPopupPoint() {
  return pendingClaimPopupPoint;
}

export function clearPendingClaimPopupPoint() {
  pendingClaimPopupPoint = null;
}

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

export function claimRewardOnAnyInput(
  channel: GameChannel,
  canvas: HTMLCanvasElement,
  clickPoint: { x: number; y: number } | null,
  runCommand: (cmd: () => Promise<ServerResult>) => Promise<ServerResult | null>
) {
  if (!tryClaimReward(channel)) return;

  pendingClaimPopupPoint = clickPoint;
  triggerProgressBarCollectionEffect(canvas);
  beginAsyncClaimResolution();
  void resolveClaimAsync(channel, runCommand);
}

async function resolveClaimAsync(
  channel: GameChannel,
  runCommand: (cmd: () => Promise<ServerResult>) => Promise<ServerResult | null>
) {
  if (claimResolutionInFlight) return;
  claimResolutionInFlight = true;

  try {
    // Claim first once local projection reaches ACT!.
    // If server says "not ready", hold at 0% and retry after can_claim_in.
    let reward = await runCommand(() => progressClaimReward(channel));
    while (
      reward &&
      reward.type === "command.error" &&
      reward.reason === "claim_not_ready" &&
      typeof reward.can_claim_in === "number" &&
      reward.can_claim_in > 0
    ) {
      await sleep(reward.can_claim_in);
      reward = await runCommand(() => progressClaimReward(channel));
    }
  } finally {
    setPendingClaimIntent(false);
    claimResolutionInFlight = false;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, Math.max(0, ms));
  });
}
