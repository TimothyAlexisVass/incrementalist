import { COLORS } from "../colors";
import { GameChannel } from "../net/game-channel";
import { ackAppliedResult } from "../net/commands";
import { isAckableCommandResult, type AckableCommandResult, type ServerResult } from "../net/protocol";
import { applyResult, createServerState, type ServerState } from "../net/snapshots";
import { SnapshotCache } from "../net/snapshot-cache";
import {
  updateProjectedFill,
  getStateFromSnapshot,
  applyProgressResult
} from "../features/progress/view-model";
import {
  handleProgressLoop,
  claimRewardOnAnyInput,
  getPendingClaimPopupPoint,
  clearPendingClaimPopupPoint
} from "../features/progress/interactions";
import { renderProgressBar } from "../features/progress/render";
import { progressClaimIn } from "../net/commands";
import { updateWebGLEffects, renderWebGLEffects } from "../render/webgl-effects";
import { createFloatingTextState, renderFloatingTexts, updateFloatingTexts } from "../render/effects";
import type { ResourceAmounts } from "../features/progress/claim-effects";
import { updateHudViewModel, syncHudInstantly } from "../features/hud/view-model";
import { renderTopHUD, renderBottomHUD } from "../features/hud/render";
import { Store } from "./store";
import { GameLoop } from "./game-loop";
import { UIManager } from "../ui/ui-manager";
import { MenuShell } from "../ui/menu/menu-shell";
import { InputState } from "../ui/input";

// Cached snapshots are projection data. They make boot and slot switches feel
// instant, but server command results remain the only source of durable truth.
const usernameKey = "incrementalist.playerUsername";

export class GameClient {
  private readonly store: Store<ServerState>;
  private channel: GameChannel | null = null;
  private snapshotCache: SnapshotCache | null = null;
  private readonly floatingTexts = createFloatingTextState();
  private lastPointerPoint: { x: number; y: number } | null = null;
  private readonly gameLoop: GameLoop;
  public readonly uiManager = new UIManager();
  private readonly menuShell = new MenuShell();
  private pendingClick = false;
  private currentPointer: { x: number; y: number } | null = null;
  private hasActivityThisFrame = false;

  // Bound event handlers for add/removeEventListener symmetry.
  private readonly onClickBound = (e: MouseEvent) => this.onClick(e);
  private readonly onMouseMoveBound = (e: MouseEvent) => this.onMouseMove(e);
  private readonly onKeydownBound = (e: KeyboardEvent) => this.onKeydown(e);
  private readonly onMouseLeaveBound = () => { this.lastPointerPoint = null; };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ctx: CanvasRenderingContext2D
  ) {
    this.store = new Store(createServerState());
    this.gameLoop = new GameLoop((dt) => this.tick(dt));
  }

  async boot() {
    const username = window.localStorage.getItem(usernameKey);
    this.snapshotCache = new SnapshotCache(username);
    this.channel = new GameChannel(username, this.snapshotCache.cachedSlotIndexes());

    this.channel.onStatusChange = (status) => {
      this.store.state.status = status === "connected" ? "Ready" : status.charAt(0).toUpperCase() + status.slice(1);
      this.store.state.statusTone = status === "connected" ? "ok" : (status === "disconnected" ? "error" : "");
    };

    this.channel.onBootResult = async (result) => {
      window.localStorage.setItem(usernameKey, result.username);
      this.snapshotCache = new SnapshotCache(result.username);

      this.store.state.snapshot = result.snapshot ?? this.snapshotCache.load(result.active_save_slot);
      if (result.snapshot) this.snapshotCache.save(result.snapshot);
      this.store.state.slots = [result.save_slot];

      if (this.store.state.snapshot) {
        getStateFromSnapshot(this.store.state.snapshot);
        syncHudInstantly(this.store.state.snapshot.state);
      }


      if (result.pending_result) {
        // The pending result belongs before any new local action; acknowledging it
        // first keeps the server queue and the rendered snapshot on the same boundary.
        await this.applyAndAck(result.pending_result);
      }
    };

    try {
      await this.channel.connect();
    } catch (error) {
      this.store.state.statusTone = "error";
      this.store.state.status = error instanceof Error ? error.message : "Boot failed";
    }
  }

  start() {
    document.addEventListener("click", this.onClickBound);
    document.addEventListener("mousemove", this.onMouseMoveBound);
    document.addEventListener("keydown", this.onKeydownBound);
    this.canvas.addEventListener("mouseleave", this.onMouseLeaveBound);
    this.gameLoop.start();
  }

  stop() {
    this.gameLoop.stop();
    document.removeEventListener("click", this.onClickBound);
    document.removeEventListener("mousemove", this.onMouseMoveBound);
    document.removeEventListener("keydown", this.onKeydownBound);
    this.canvas.removeEventListener("mouseleave", this.onMouseLeaveBound);
  }

  // ---------------------------------------------------------------------------
  // Command execution
  // ---------------------------------------------------------------------------

  private async runCommand(
    command: () => Promise<ServerResult>
  ): Promise<ServerResult | null> {
    try {
      const result = await command();
      await this.applyAndAck(result);
      return result;
    } catch (error) {
      this.store.state.statusTone = "error";
      this.store.state.status = error instanceof Error ? error.message : "Command failed";
      return null;
    }
  }

  private async applyAndAck(result: ServerResult) {
    this.hydrateSnapshotFromCache(result);
    const previousAmounts = result.type === "progress.claim_reward.result" ? this.snapshotAmounts() : null;
    applyResult(this.store.state, result);
    this.cacheSnapshotFromResult(result);

    if (result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result") {
      if (this.store.state.snapshot) {
        getStateFromSnapshot(this.store.state.snapshot);
        syncHudInstantly(this.store.state.snapshot.state);
      }
    }


    this.applyProgressEffects(result, previousAmounts);


    if (!isAckableCommandResult(result)) return;

    // Acknowledgement is the crash boundary. If the browser dies before this push,
    // reconnect will receive the same result again and apply it from the stored payload.
    let next = await ackAppliedResult(this.channel!, result.command_id);
    if (clearsCommandQueue(result)) this.channel!.clearCommandQueue();
    while (next) {
      this.hydrateSnapshotFromCache(next);
      const previousAmounts = next.type === "progress.claim_reward.result" ? this.snapshotAmounts() : null;
      applyResult(this.store.state, next);
      this.cacheSnapshotFromResult(next);
      this.applyProgressEffects(next, previousAmounts);
      if (next.type === "save_slot.switch.result" || next.type === "save_slot.reset.result") {
        if (this.store.state.snapshot) {
          getStateFromSnapshot(this.store.state.snapshot);
          syncHudInstantly(this.store.state.snapshot.state);
        }
      }
      // The server releases at most one queued result per acknowledgement so the
      // client cannot accidentally skip over a command result.
      const applied = next;
      next = await ackAppliedResult(this.channel!, applied.command_id);
      if (clearsCommandQueue(applied)) this.channel!.clearCommandQueue();
    }
  }

  // ---------------------------------------------------------------------------
  // Snapshot helpers
  // ---------------------------------------------------------------------------

  private snapshotAmounts(): ResourceAmounts | null {
    const snapshot = this.store.state.snapshot;
    if (!snapshot) return null;

    return {
      exp: snapshot.state.exp,
      level: snapshot.state.level,
      coins: snapshot.state.coins,
      shards: snapshot.state.shards,
      cores: snapshot.state.cores
    };
  }

  private hydrateSnapshotFromCache(result: ServerResult) {
    if (result.type !== "save_slot.switch.result" || result.snapshot) return;

    const cachedSnapshot = this.snapshotCache!.load(result.active_save_slot);
    if (cachedSnapshot) {
      this.store.state.snapshot = cachedSnapshot;
      getStateFromSnapshot(cachedSnapshot);
    }
  }

  private cacheSnapshotFromResult(result: ServerResult) {
    if ("snapshot" in result && result.snapshot) {
      this.snapshotCache!.save(result.snapshot);
    }
  }

  private applyProgressEffects(result: ServerResult, previousAmounts: ResourceAmounts | null) {
    applyProgressResult(result, previousAmounts, {
      floatingTexts: this.floatingTexts,
      canvas: this.canvas,
      ctx: this.ctx,
      popupPoint: getPendingClaimPopupPoint()
    });
    clearPendingClaimPopupPoint();
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  private onClick(event: MouseEvent) {
    this.currentPointer = getCanvasPointFromInputEvent(event, this.canvas);
    this.pendingClick = true;
    this.hasActivityThisFrame = true;
  }

  private onMouseMove(event: MouseEvent) {
    this.currentPointer = getCanvasPointFromInputEvent(event, this.canvas);
    this.hasActivityThisFrame = true;
  }

  private onKeydown(event: KeyboardEvent) {
    this.hasActivityThisFrame = true;
    if (event.key === 'Escape') {
      this.uiManager.overlayManager.toggle(this.menuShell);
      event.preventDefault();
      return;
    }

    if (this.channel) {
      // For keyboard, we don't know if UI consumed it yet without waiting for tick,
      // but previously it claimed immediately. We'll leave it to the tick fallback.
    }
    event.preventDefault();
  }

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  private tick(dt: number) {
    // 1. Snapshot input state for this frame
    const input: InputState = { 
      pointer: this.currentPointer, 
      clicked: this.pendingClick,
      consumed: false 
    };
    this.pendingClick = false;
    const activity = this.hasActivityThisFrame;
    this.hasActivityThisFrame = false;

    // Advance client-side estimation of progress bar fill
    updateProjectedFill(dt);

    // Check if projection expects bar to be full, and queue command if so
    if (this.channel && handleProgressLoop(this.channel)) {
      const channel = this.channel;
      this.runCommand(() => progressClaimIn(channel));
    }

    // Render the core 2D progress bar UI (fill ratio and text)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = COLORS.game.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    renderProgressBar(this.ctx, this.canvas);

    const amounts = this.snapshotAmounts();
    if (amounts) {
      updateHudViewModel(dt, amounts);
      renderTopHUD(this.ctx, this.canvas);
    }

    updateFloatingTexts(this.floatingTexts, dt);

    // Update and render reward collection effects.
    updateWebGLEffects(dt);
    renderWebGLEffects();

    renderFloatingTexts(this.ctx, this.floatingTexts);

    // Any activity collects the progress bar if it's ready. input.consumed is
    // intentionally NOT set here so nothing else is blocked.
    if (activity && this.channel) {
      claimRewardOnAnyInput(this.channel, this.canvas, input.pointer, (cmd) => this.runCommand(cmd));
    }

    // Render BottomHUD before overlays so its buttons can consume input and 
    // toggle overlays without being immediately countered by "click-outside" logic.
    renderBottomHUD(this.ctx, this.canvas, input, () => {
      this.uiManager.overlayManager.toggle(this.menuShell);
    });

    // The UI is drawn over the game world. It can consume clicks.
    this.uiManager.tick(dt);
    this.uiManager.render(this.ctx, this.canvas, input);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (no instance state)
// ---------------------------------------------------------------------------

function clearsCommandQueue(result: AckableCommandResult) {
  return result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result";
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
