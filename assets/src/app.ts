import { onClick } from "./core/input";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config";
import { COLORS } from "./colors";
import { bindSaveSlotClicks } from "./features/save-slots/interactions";
import { renderSaveSlots } from "./features/save-slots/render";
import { createSaveSlotsViewModel } from "./features/save-slots/view-model";
import { GameChannel } from "./net/game-channel";
import { ackAppliedResult, listSaveSlots, resetSaveSlot, sendNoop, switchSaveSlot } from "./net/commands";
import { isAckableCommandResult, type AckableCommandResult, type ServerResult } from "./net/protocol";
import { applyResult, createServerState } from "./net/snapshots";
import { SnapshotCache } from "./net/snapshot-cache";
import { setButtonBusy } from "./ui/components/button";
import {
  updateProjectedFill,
  getStateFromSnapshot,
  handleClaimInResult,
  handleClaimRewardResult,
  handleClaimNotReadyError,
  beginAsyncClaimResolution,
  setPendingClaimIntent,
  hasPendingClaimIntent
} from "./features/progress/view-model";
import { handleProgressLoop, tryClaimReward } from "./features/progress/interactions";
import { renderProgressBar } from "./features/progress/render";
import { progressClaimIn, progressClaimReward } from "./net/commands";
import { initWebGLEffectsLayer, resizeWebGLEffectsLayer, updateWebGLEffects, renderWebGLEffects } from "./render/webgl-effects";
import { triggerProgressBarCollectionEffect } from "./features/progress/render";
import { createFloatingTextState, renderFloatingTexts, updateFloatingTexts } from "./render/effects";
import { spawnProgressClaimRewardEffects, type ResourceAmounts } from "./features/progress/claim-effects";

// Cached snapshots are projection data. They make boot and slot switches feel
// instant, but server command results remain the only source of durable truth.
const usernameKey = "incrementalist.playerUsername";
const statusLine = requiredElement<HTMLElement>("#status-line");
const levelValue = requiredElement<HTMLElement>("#level-value");
const slotValue = requiredElement<HTMLElement>("#slot-value");
const noopButton = requiredElement<HTMLButtonElement>("#noop-button");
const saveButton = requiredElement<HTMLButtonElement>("#save-button");
const resetButton = requiredElement<HTMLButtonElement>("#reset-button");
const slotList = requiredElement<HTMLElement>("#slot-list");
const canvas = requiredElement<HTMLCanvasElement>("#game-canvas");
const effectsCanvas = requiredElement<HTMLCanvasElement>("#effects-canvas");
const ctx = canvas.getContext("2d");

const serverState = createServerState();
let channel: GameChannel;
let snapshotCache: SnapshotCache;
let busy = false;
let claimResolutionInFlight = false;
const floatingTexts = createFloatingTextState();
let lastPointerPoint: { x: number; y: number } | null = null;
let pendingClaimPopupPoint: { x: number; y: number } | null = null;

// Initialize the WebGL layer
resizeGameCanvases();
initWebGLEffectsLayer(effectsCanvas, effectsCanvas.width, effectsCanvas.height);

window.addEventListener("resize", resizeGameCanvases);

function resizeGameCanvases() {
  if (canvas.width !== CANVAS_WIDTH) {
    canvas.width = CANVAS_WIDTH;
  }

  if (canvas.height !== CANVAS_HEIGHT) {
    canvas.height = CANVAS_HEIGHT;
  }

  if (effectsCanvas.width !== canvas.width) {
    effectsCanvas.width = canvas.width;
  }

  if (effectsCanvas.height !== canvas.height) {
    effectsCanvas.height = canvas.height;
  }

  resizeWebGLEffectsLayer(effectsCanvas.width, effectsCanvas.height);
}

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
  const previousAmounts = result.type === "progress.claim_reward.result" ? snapshotAmounts() : null;
  applyResult(serverState, result);
  cacheSnapshotFromResult(result);

  if (result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result") {
    if (serverState.snapshot) {
      getStateFromSnapshot(serverState.snapshot);
    }
  }

  applyProgressResultEffects(result, previousAmounts);

  renderDom();

  if (!isAckableCommandResult(result)) return;

  // Acknowledgement is the crash boundary. If the browser dies before this push,
  // reconnect will receive the same result again and apply it from the stored payload.
  let next = await ackAppliedResult(channel, result.command_id);
  if (clearsCommandQueue(result)) channel.clearCommandQueue();
  while (next) {
    hydrateSnapshotFromCache(next);
    const previousAmounts = next.type === "progress.claim_reward.result" ? snapshotAmounts() : null;
    applyResult(serverState, next);
    cacheSnapshotFromResult(next);
    applyProgressResultEffects(next, previousAmounts);
    if (next.type === "save_slot.switch.result" || next.type === "save_slot.reset.result") {
      if (serverState.snapshot) {
        getStateFromSnapshot(serverState.snapshot);
      }
    }
    renderDom();
    // The server releases at most one queued result per acknowledgement so the
    // client cannot accidentally skip over a command result.
    const applied = next;
    next = await ackAppliedResult(channel, applied.command_id);
    if (clearsCommandQueue(applied)) channel.clearCommandQueue();
  }
}

function snapshotAmounts(): ResourceAmounts | null {
  const snapshot = serverState.snapshot;
  if (!snapshot) return null;

  return {
    exp: snapshot.state.exp,
    coins: snapshot.state.coins,
    shards: snapshot.state.shards,
    cores: snapshot.state.cores
  };
}

function applyProgressResultEffects(result: ServerResult, previousAmounts: ResourceAmounts | null) {
  if (result.type === "progress.claim_in.result") {
    if (hasPendingClaimIntent()) {
      return;
    }
    handleClaimInResult(result);
  } else if (result.type === "progress.claim_reward.result") {
    handleClaimRewardResult();

    if (ctx && previousAmounts) {
      spawnProgressClaimRewardEffects(floatingTexts, canvas, ctx, previousAmounts, {
        exp: result.exp,
        coins: result.coins,
        shards: result.shards,
        cores: result.cores
      }, pendingClaimPopupPoint);
    }

    pendingClaimPopupPoint = null;
  } else if (result.type === "command.error" && result.reason === "claim_not_ready") {
    handleClaimNotReadyError(result.can_claim_in ?? null);
  }
}

async function runCommand(
  command: () => Promise<ServerResult>,
  loadingMessage: string | null = null
): Promise<ServerResult | null> {
  if (busy) return null;
  // This guard is UI backpressure. Save-slot boundaries also rely on it so no
  // previous-slot command can be sent while the load/switch result is pending.
  busy = true;
  serverState.loadingMessage = loadingMessage;
  setButtonBusy(noopButton, true);
  setButtonBusy(saveButton, true);
  setButtonBusy(resetButton, true);
  renderDom();

  try {
    const result = await command();
    await applyAndAck(result);
    return result;
  } catch (error) {
    serverState.statusTone = "error";
    serverState.status = error instanceof Error ? error.message : "Command failed";
    renderDom();
    return null;
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
  const username = window.localStorage.getItem(usernameKey);
  snapshotCache = new SnapshotCache(username);
  channel = new GameChannel(username, snapshotCache.cachedSlotIndexes());
  const bootResult = await channel.connect();

  window.localStorage.setItem(usernameKey, bootResult.username);
  snapshotCache = new SnapshotCache(bootResult.username);

  serverState.snapshot = bootResult.snapshot ?? snapshotCache.load(bootResult.active_save_slot);
  if (bootResult.snapshot) snapshotCache.save(bootResult.snapshot);
  serverState.slots = [bootResult.save_slot];
  serverState.status = "Ready";

  if (serverState.snapshot) {
    getStateFromSnapshot(serverState.snapshot);
  }

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
    getStateFromSnapshot(cachedSnapshot);
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

function claimRewardOnAnyInput(clickPoint: { x: number; y: number } | null = null) {
  if (!channel) {
    return;
  }

  if (!tryClaimReward(channel)) {
    return;
  }

  pendingClaimPopupPoint = clickPoint;
  triggerProgressBarCollectionEffect(canvas);
  beginAsyncClaimResolution();
  void resolveClaimAsync();
}

function handleClick(event: MouseEvent) {
  const point = getCanvasPointFromInputEvent(event, canvas);
  lastPointerPoint = point;
  claimRewardOnAnyInput(point);
}

function handleMouseMove(event: MouseEvent) {
  const point = getCanvasPointFromInputEvent(event, canvas);
  lastPointerPoint = point;
  claimRewardOnAnyInput(point);
}

function handleKeydown(event: KeyboardEvent) {
  claimRewardOnAnyInput(lastPointerPoint);
  event.preventDefault();
}

document.addEventListener("click", handleClick);
document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("keydown", handleKeydown);
canvas.addEventListener("mouseleave", () => {
  lastPointerPoint = null;
});

let lastTime = performance.now();

function gameLoop(time: number) {
  requestAnimationFrame(gameLoop);

  const dt = time - lastTime;
  lastTime = time;

  // Advance client-side estimation of progress bar fill
  updateProjectedFill(dt);

  // Check if projection expects bar to be full, and queue command if so
  if (channel && handleProgressLoop(channel)) {
     runCommand(() => progressClaimIn(channel));
  }

  // Render the core 2D progress bar UI (fill ratio and text)
  if (ctx && canvas) {
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     ctx.fillStyle = COLORS.game.background;
     ctx.fillRect(0, 0, canvas.width, canvas.height);
     renderProgressBar(ctx, canvas);
  }

  updateFloatingTexts(floatingTexts, dt);

  // Update and render reward collection effects
  updateWebGLEffects(dt);
  renderWebGLEffects();

  if (ctx) {
    renderFloatingTexts(ctx, floatingTexts);
  }
}

requestAnimationFrame(gameLoop);

async function resolveClaimAsync() {
  if (!channel || claimResolutionInFlight) return;
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

function getCanvasPointFromInputEvent(
  event: Event,
  targetCanvas: HTMLCanvasElement
): { x: number; y: number } | null {
  const rect = targetCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  let clientX: number | null = null;
  let clientY: number | null = null;

  if (event instanceof MouseEvent || event instanceof PointerEvent) {
    clientX = event.clientX;
    clientY = event.clientY;
  } else if (event instanceof TouchEvent && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  }

  if (clientX === null || clientY === null) return null;

  const scaleX = targetCanvas.width / rect.width;
  const scaleY = targetCanvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  return {
    x: Math.min(Math.max(0, x), targetCanvas.width),
    y: Math.min(Math.max(0, y), targetCanvas.height)
  };
}

boot().catch((error) => {
  serverState.statusTone = "error";
  serverState.status = error instanceof Error ? error.message : "Boot failed";
  renderDom();
});
