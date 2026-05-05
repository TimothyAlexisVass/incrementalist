import { GameLoop } from "./core/game-loop";
import { onClick } from "./core/input";
import { bindSaveSlotClicks } from "./features/save-slots/interactions";
import { renderSaveSlots } from "./features/save-slots/render";
import { createSaveSlotsViewModel } from "./features/save-slots/view-model";
import { GameChannel } from "./net/game-channel";
import { ackAppliedResult, listSaveSlots, resetSaveSlot, sendNoop, switchSaveSlot } from "./net/commands";
import type { ServerResult } from "./net/protocol";
import { applyResult, createServerState } from "./net/snapshots";
import { resizeCanvas, renderHudCanvas, type CanvasState } from "./render/canvas/hud";
import { setButtonBusy } from "./ui/components/button";

const tokenKey = "incrementalist.anonymousPlayerToken";
const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const statusLine = document.querySelector<HTMLElement>("#status-line");
const levelValue = document.querySelector<HTMLElement>("#level-value");
const slotValue = document.querySelector<HTMLElement>("#slot-value");
const noopButton = document.querySelector<HTMLButtonElement>("#noop-button");
const saveButton = document.querySelector<HTMLButtonElement>("#save-button");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button");
const slotList = document.querySelector<HTMLElement>("#slot-list");

if (!canvas || !statusLine || !levelValue || !slotValue || !noopButton || !saveButton || !resetButton || !slotList) {
  throw new Error("Game shell is missing required elements");
}

const context = canvas.getContext("2d");
if (!context) throw new Error("Canvas 2D context unavailable");

const serverState = createServerState();
const canvasState: CanvasState = { width: 0, height: 0, pixelRatio: 1 };
let channel: GameChannel;
let busy = false;

function renderDom() {
  const snapshot = serverState.snapshot;
  statusLine.textContent = serverState.status;
  statusLine.dataset.tone = serverState.statusTone;
  levelValue.textContent = String(snapshot?.state.level ?? 1);
  slotValue.textContent = String((snapshot?.active_save_slot ?? 0) + 1);
  renderSaveSlots(slotList, createSaveSlotsViewModel(snapshot, serverState.slots));
}

async function applyAndAck(result: ServerResult) {
  applyResult(serverState, result);
  renderDom();

  if (!result.requires_ack) return;

  let next = await ackAppliedResult(channel);
  while (next) {
    applyResult(serverState, next);
    renderDom();
    next = next.requires_ack ? await ackAppliedResult(channel) : null;
  }
}

async function runCommand(command: () => Promise<ServerResult>) {
  if (busy) return;
  busy = true;
  setButtonBusy(noopButton, true);
  setButtonBusy(saveButton, true);
  setButtonBusy(resetButton, true);

  try {
    await applyAndAck(await command());
  } catch (error) {
    serverState.statusTone = "error";
    serverState.status = error instanceof Error ? error.message : "Command failed";
    renderDom();
  } finally {
    busy = false;
    setButtonBusy(noopButton, false);
    setButtonBusy(saveButton, false);
    setButtonBusy(resetButton, false);
  }
}

async function boot() {
  resizeCanvas(canvas, canvasState);
  window.addEventListener("resize", () => resizeCanvas(canvas, canvasState));

  channel = new GameChannel(window.localStorage.getItem(tokenKey));
  const bootResult = await channel.connect();

  if (bootResult.anonymous_player_token) {
    window.localStorage.setItem(tokenKey, bootResult.anonymous_player_token);
  }

  serverState.snapshot = bootResult.snapshot;
  serverState.slots = [bootResult.snapshot.save_slot];
  serverState.status = "Ready";
  renderDom();

  if (bootResult.pending_result) {
    await applyAndAck(bootResult.pending_result);
  }

  new GameLoop((time) => renderHudCanvas(context, canvasState, serverState, time)).start();
}

onClick("#noop-button", () => runCommand(() => sendNoop(channel)));
onClick("#save-button", () => runCommand(() => listSaveSlots(channel)));
onClick("#reset-button", () => {
  if (window.confirm("Reset the active save file?")) {
    runCommand(() => resetSaveSlot(channel));
  }
});
bindSaveSlotClicks(slotList, (slotIndex) => runCommand(() => switchSaveSlot(channel, slotIndex)));

boot().catch((error) => {
  serverState.statusTone = "error";
  serverState.status = error instanceof Error ? error.message : "Boot failed";
  renderDom();
});
