import type { ServerResult } from "./protocol";
import type { GameChannel } from "./game-channel";

export function sendNoop(channel: GameChannel) {
  return channel.push("game.noop");
}

export function listSaveSlots(channel: GameChannel) {
  return channel.push("save_slots.list");
}

export function switchSaveSlot(channel: GameChannel, slotIndex: number) {
  return channel.push("save_slot.switch", { slot_index: slotIndex });
}

export function resetSaveSlot(channel: GameChannel) {
  return channel.push("save_slot.reset");
}

export async function ackAppliedResult(channel: GameChannel): Promise<ServerResult | null> {
  const ack = await channel.push("command.ack");
  return ack.next_result ?? null;
}
