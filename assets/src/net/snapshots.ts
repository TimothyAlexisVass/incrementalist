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

// Applies whatever authoritative state the result contains, and leaves everything
// else unchanged. This matches the protocol: narrow command results should not
// force the server to resend a full snapshot just to update UI status.
export function applyResult(state: ServerState, result: ServerResult): void {
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

  if (result.type === "progress.claim_reward.result") {
    applyAuthoritativeData(state, result);
  }

  state.statusTone = result.status === "error" ? "error" : "ok";
  state.status = statusForResult(result);
}

import type { BigNum } from "../core/bignum";

export function applyAuthoritativeData(
  state: ServerState,
  data: {
    coins?: BigNum;
    exp?: BigNum;
    level?: number;
    shards?: BigNum;
    cores?: BigNum;
  }
) {
  if (!state.snapshot) return;

  if (data.coins !== undefined) state.snapshot.state.coins = data.coins;
  if (data.exp !== undefined) state.snapshot.state.exp = data.exp;
  if (data.level !== undefined) state.snapshot.state.level = data.level;
  if (data.shards !== undefined) state.snapshot.state.shards = data.shards;
  if (data.cores !== undefined) state.snapshot.state.cores = data.cores;
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

function statusForResult(result: ServerResult): string {
  if (result.status === "error") return result.reason || "Command rejected";
  if (result.type === "command.queued") return "Queued";
  if (result.type === "game.noop.result") return "Synced";
  if (result.type === "save_slots.list.result") return "Save files";
  if (result.type === "save_slot.switch.result") return "Save file loaded";
  if (result.type === "save_slot.reset.result") return "Save file reset";
  return "Ready";
}
