import type {
  AckableCommandResult,
  CommandErrorResult,
  CommandPushResult,
  GameNoopResult,
  SaveSlotResetResult,
  SaveSlotsListResult,
  SaveSlotSwitchResult,
  ProgressClaimInResult,
  ProgressClaimRewardResult
} from "./protocol";
import type { GameChannel } from "./game-channel";

// Command helpers send player intent plus the client command id owned by
// GameChannel's small local queue. The id is transport correlation only; rules
// still execute from server state.
export function sendNoop(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<GameNoopResult>>("game.noop");
}

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

export async function ackAppliedResult(
  channel: GameChannel,
  commandId: number
): Promise<AckableCommandResult | null> {
  const ack = await channel.ackCommand(commandId);
  return ack.released_result;
}
