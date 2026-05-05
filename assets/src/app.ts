import { onClick } from "./core/input";
import { bindSaveSlotClicks } from "./features/save-slots/interactions";
import { renderSaveSlots } from "./features/save-slots/render";
import { createSaveSlotsViewModel } from "./features/save-slots/view-model";
import { GameChannel } from "./net/game-channel";
import { ackAppliedResult, listSaveSlots, resetSaveSlot, sendNoop, switchSaveSlot } from "./net/commands";
import { isAckableCommandResult, type AckableCommandResult, type ServerResult } from "./net/protocol";
import { applyResult, createServerState } from "./net/snapshots";
import { SnapshotCache } from "./net/snapshot-cache";
import { setButtonBusy } from "./ui/components/button";

// Cached snapshots are projection data. They make boot and slot switches feel
// instant, but server command results remain the only source of durable truth.
const tokenKey = "incrementalist.anonymousPlayerToken";
const statusLine = requiredElement<HTMLElement>("#status-line");
const levelValue = requiredElement<HTMLElement>("#level-value");
const slotValue = requiredElement<HTMLElement>("#slot-value");
const noopButton = requiredElement<HTMLButtonElement>("#noop-button");
const saveButton = requiredElement<HTMLButtonElement>("#save-button");
const resetButton = requiredElement<HTMLButtonElement>("#reset-button");
const slotList = requiredElement<HTMLElement>("#slot-list");

const serverState = createServerState();
let channel: GameChannel;
let snapshotCache: SnapshotCache;
let busy = false;

function renderDom() {
  const snapshot = serverState.snapshot;
  statusLine.textContent = serverState.loadingMessage ?? serverState.status;
  statusLine.dataset.tone = serverState.statusTone;
  levelValue.textContent = String(snapshot?.state.level ?? 1);
  slotValue.textContent = String((snapshot?.active_save_slot ?? 0) + 1);
  renderSaveSlots(slotList, createSaveSlotsViewModel(snapshot, serverState.slots));
  slotList.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    setButtonBusy(button, busy);
  });
}

async function applyAndAck(result: ServerResult) {
  hydrateSnapshotFromCache(result);
  applyResult(serverState, result);
  cacheSnapshotFromResult(result);
  renderDom();

  if (!isAckableCommandResult(result)) return;

  // Acknowledgement is the crash boundary. If the browser dies before this push,
  // reconnect will receive the same result again and apply it from the stored payload.
  let next = await ackAppliedResult(channel, result.command_id);
  if (clearsCommandQueue(result)) channel.clearCommandQueue();
  while (next) {
    hydrateSnapshotFromCache(next);
    applyResult(serverState, next);
    cacheSnapshotFromResult(next);
    renderDom();
    // The server releases at most one queued result per acknowledgement so the
    // client cannot accidentally skip over a command result.
    const applied = next;
    next = await ackAppliedResult(channel, applied.command_id);
    if (clearsCommandQueue(applied)) channel.clearCommandQueue();
  }
}

async function runCommand(command: () => Promise<ServerResult>, loadingMessage: string | null = null) {
  if (busy) return;
  // This guard is UI backpressure. Save-slot boundaries also rely on it so no
  // previous-slot command can be sent while the load/switch result is pending.
  busy = true;
  serverState.loadingMessage = loadingMessage;
  setButtonBusy(noopButton, true);
  setButtonBusy(saveButton, true);
  setButtonBusy(resetButton, true);
  renderDom();

  try {
    await applyAndAck(await command());
  } catch (error) {
    serverState.statusTone = "error";
    serverState.status = error instanceof Error ? error.message : "Command failed";
    renderDom();
  } finally {
    serverState.loadingMessage = null;
    busy = false;
    setButtonBusy(noopButton, false);
    setButtonBusy(saveButton, false);
    setButtonBusy(resetButton, false);
    renderDom();
  }
}

async function boot() {
  const token = window.localStorage.getItem(tokenKey);
  snapshotCache = new SnapshotCache(token);
  channel = new GameChannel(token, snapshotCache.cachedSlotIndexes());
  const bootResult = await channel.connect();

  if (bootResult.anonymous_player_token) {
    window.localStorage.setItem(tokenKey, bootResult.anonymous_player_token);
    snapshotCache = new SnapshotCache(bootResult.anonymous_player_token);
  }

  serverState.snapshot = bootResult.snapshot ?? snapshotCache.load(bootResult.active_save_slot);
  if (bootResult.snapshot) snapshotCache.save(bootResult.snapshot);
  serverState.slots = [bootResult.save_slot];
  serverState.status = "Ready";
  renderDom();

  if (bootResult.pending_result) {
    // The pending result belongs before any new local action; acknowledging it
    // first keeps the server queue and the rendered snapshot on the same boundary.
    await applyAndAck(bootResult.pending_result);
  }
}

onClick("#noop-button", () => runCommand(() => sendNoop(channel)));
onClick("#save-button", () => runCommand(() => listSaveSlots(channel)));
onClick("#reset-button", () => {
  if (window.confirm("Reset the active save file?")) {
    runCommand(() => resetSaveSlot(channel), "Loading save file...");
  }
});
bindSaveSlotClicks(slotList, (slotIndex) =>
  runCommand(() => switchSaveSlot(channel, slotIndex, Boolean(snapshotCache.load(slotIndex))), "Loading save file...")
);

function hydrateSnapshotFromCache(result: ServerResult) {
  if (result.type !== "save_slot.switch.result" || result.snapshot) return;

  const cachedSnapshot = snapshotCache.load(result.active_save_slot);
  if (cachedSnapshot) {
    serverState.snapshot = cachedSnapshot;
  }
}

function cacheSnapshotFromResult(result: ServerResult) {
  if ("snapshot" in result && result.snapshot) {
    snapshotCache.save(result.snapshot);
  }
}

function clearsCommandQueue(result: AckableCommandResult) {
  return result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result";
}

function requiredElement<TElement extends Element>(selector: string) {
  const element = document.querySelector<TElement>(selector);
  if (!element) throw new Error(`Game shell is missing required element: ${selector}`);
  return element;
}

boot().catch((error) => {
  serverState.statusTone = "error";
  serverState.status = error instanceof Error ? error.message : "Boot failed";
  renderDom();
});
