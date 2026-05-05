import type { GameSnapshot, SaveSlotSummary, ServerResult } from "./protocol";

export type ServerState = {
  snapshot: GameSnapshot | null;
  slots: SaveSlotSummary[];
  status: string;
  statusTone: "ok" | "error" | "";
};

export function createServerState(): ServerState {
  return {
    snapshot: null,
    slots: [],
    status: "Connecting...",
    statusTone: ""
  };
}

export function applyResult(state: ServerState, result: ServerResult) {
  if (result.snapshot) {
    state.snapshot = result.snapshot;
  }

  if (result.slots) {
    state.slots = result.slots;
  } else if (result.snapshot?.save_slot) {
    state.slots = upsertSlot(state.slots, result.snapshot.save_slot);
  }

  state.statusTone = result.status === "error" ? "error" : "ok";
  state.status = statusForResult(result);
}

function upsertSlot(slots: SaveSlotSummary[], slot: SaveSlotSummary) {
  const next = slots.filter((candidate) => candidate.slot_index !== slot.slot_index);
  next.push(slot);
  return next.sort((a, b) => a.slot_index - b.slot_index);
}

function statusForResult(result: ServerResult) {
  if (result.status === "error") return result.reason || "Command rejected";
  if (result.type === "command.queued") return "Queued";
  if (result.type === "game.noop.result") return "Synced";
  if (result.type === "save_slots.list.result") return "Save files";
  if (result.type === "save_slot.switch.result") return "Save file loaded";
  if (result.type === "save_slot.reset.result") return "Save file reset";
  return "Ready";
}
