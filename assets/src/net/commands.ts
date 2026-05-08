import type {
  AckableCommandResult,
  CommandErrorResult,
  CommandPushResult,
  SaveSlotResetResult,
  SaveSlotsListResult,
  SaveSlotSwitchResult,
  ProgressClaimInResult,
  ProgressClaimRewardResult,
  AreaSelectResult
} from "./protocol";
import type { GameChannel } from "./game-channel";

// Save file commands
export function listSaveSlots(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<SaveSlotsListResult>>("save_slots.list");
}

export function switchSaveSlot(channel: GameChannel, slotIndex: number, hasCachedSnapshot: boolean) {
  return channel.pushCommand<CommandPushResult<SaveSlotSwitchResult | CommandErrorResult>>("save_slot.switch", {
    slot_index: slotIndex,
    has_cached_snapshot: hasCachedSnapshot
  });
}

export function resetSaveSlot(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<SaveSlotResetResult>>("save_slot.reset");
}

export function progressClaimIn(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<ProgressClaimInResult>>("progress.claim_in");
}

export function progressClaimReward(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<ProgressClaimRewardResult | CommandErrorResult>>("progress.claim_reward");
}

export function selectArea(channel: GameChannel, areaKey: string) {
  return channel.pushCommand<CommandPushResult<AreaSelectResult | CommandErrorResult>>("area.select", { area: areaKey });
}

export async function ackAppliedResult(
  channel: GameChannel,
  commandId: number
): Promise<AckableCommandResult | null> {
  const ack = await channel.ackCommand(commandId);
  return ack.released_result;
}
