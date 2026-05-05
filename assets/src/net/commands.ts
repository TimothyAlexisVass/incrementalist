import type {
  AckableCommandResult,
  CommandAckResult,
  CommandErrorResult,
  CommandPushResult,
  GameNoopResult,
  SaveSlotResetResult,
  SaveSlotsListResult,
  SaveSlotSwitchResult
} from "./protocol";
import type { GameChannel } from "./game-channel";

// Command helpers send player intent only. The client does not attach command
// ids, active save slot, snapshot version, or queue position.
export function sendNoop(channel: GameChannel) {
  return channel.push<CommandPushResult<GameNoopResult>>("game.noop");
}

export function listSaveSlots(channel: GameChannel) {
  return channel.push<CommandPushResult<SaveSlotsListResult>>("save_slots.list");
}

export function switchSaveSlot(channel: GameChannel, slotIndex: number, hasCachedSnapshot: boolean) {
  return channel.push<CommandPushResult<SaveSlotSwitchResult | CommandErrorResult>>("save_slot.switch", {
    slot_index: slotIndex,
    has_cached_snapshot: hasCachedSnapshot
  });
}

export function resetSaveSlot(channel: GameChannel) {
  return channel.push<CommandPushResult<SaveSlotResetResult>>("save_slot.reset");
}

export async function ackAppliedResult(channel: GameChannel): Promise<AckableCommandResult | null> {
  // The current blocking result is selected by the server. Sending an id here
  // would let the browser claim queue position it does not own.
  const ack = await channel.push<CommandAckResult>("command.ack");
  return ack.released_result;
}
