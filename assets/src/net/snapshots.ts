import type { GameSnapshot, SaveSlotSummary, ServerResult } from "./protocol";

export type ServerState = {
  snapshot: GameSnapshot | null;
  slots: SaveSlotSummary[];
  status: string;
  statusTone: "ok" | "error" | "";
  loadingMessage: string | null;
};

export function createServerState(): ServerState {
  return {
    snapshot: null,
    slots: [],
    status: "Connecting...",
    statusTone: "",
    loadingMessage: null
  };
}

// Applies whatever authoritative state the result contains, and leaves everything
// else unchanged. This matches the protocol: narrow command results should not
// force the server to resend a full snapshot just to update UI status.
export function applyResult(state: ServerState, result: ServerResult) {
  const snapshot = snapshotFromResult(result);

  if (snapshot) {
    state.snapshot = snapshot;
  }

  if ("slots" in result) {
    state.slots = result.slots;
  } else if (snapshot) {
    // Results are allowed to be partial. Keep previous slot summaries unless the
    // server sends replacements, and only patch the slot covered by a full snapshot.
    state.slots = upsertSlot(state.slots, snapshot.save_slot);
  }

  if (result.type === "progress.claim_reward.result" && state.snapshot) {
    state.snapshot.state.coins = result.coins;
    state.snapshot.state.exp = result.exp;
    state.snapshot.state.shards = result.shards;
    state.snapshot.state.cores = result.cores;
  }

  state.statusTone = result.status === "error" ? "error" : "ok";
  state.status = statusForResult(result);
}

function snapshotFromResult(result: ServerResult): GameSnapshot | null {
  if (result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result") {
    return result.snapshot ?? null;
  }

  return null;
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
