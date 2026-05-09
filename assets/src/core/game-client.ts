import { COLORS } from "../colors";
import { GameChannel } from "../net/game-channel";
import { 
  ackAppliedResult, 
  switchSaveSlot, 
  resetSaveSlot, 
  progressClaimIn,
  selectArea,
  shopPurchase,
  noticeSee,
  noticeAck
} from "../net/commands";
import { ResetConfirmationModal, LoadingModal } from '../ui/components/modals/confirmation-modal';
import { isAckableCommandResult, type AckableCommandResult, type ServerResult } from "../net/protocol";
import { applyResult, createServerState, type ServerState } from "../net/snapshots";
import { SnapshotCache } from "../net/snapshot-cache";
import {
  updateProjectedFill,
  getStateFromSnapshot,
  applyProgressResult
} from "../features/progress-bar/view-model";
import { updateAreaViewModel } from "../features/areas/view-model";
import {
  handleProgressLoop,
  claimRewardOnAnyInput,
  getPendingClaimPopupPoint,
  clearPendingClaimPopupPoint
} from "../features/progress-bar/interactions";
import { renderProgressBar } from "../features/progress-bar/render";
import { renderAreaBackground, renderAreaSpecifics } from "../features/areas/render";
import { updateWebGLEffects, renderWebGLEffects } from "../render/webgl-effects";
import { createFloatingTextState, renderFloatingTexts, updateFloatingTexts } from "../render/effects";
import type { ResourceAmounts } from "../features/progress-bar/claim-effects";
import { updateHudViewModel, syncHudInstantly } from "../ui/layout/top-hud/view-model";
import { renderTopHUD } from "../ui/layout/top-hud/render";
import { renderBottomHUD } from "../ui/layout/bottom-hud/render";
import { Store } from "./store";
import { GameLoop } from "./game-loop";
import { UIManager } from "../ui/ui-manager";
import { MainMenu } from "../ui/layout/main-menu/render";
import { InteractionManager, InteractionState } from "../ui/interaction-manager";
import { noticeSystem } from "../ui/notice-system";
import { setNetwork as setMainMenuNetwork } from "../ui/layout/main-menu/view-model";

// Cached snapshots are projection data. They make boot and slot switches feel
// instant, but server command results remain the only source of durable truth.
const usernameKey = "incrementalist.playerUsername";

export class GameClient {
  private readonly store: Store<ServerState>;
  private channel: GameChannel | null = null;
  private snapshotCache: SnapshotCache | null = null;
  private readonly floatingTexts = createFloatingTextState();
  private readonly gameLoop: GameLoop;
  public readonly uiManager = new UIManager();
  private readonly mainMenu = new MainMenu();
  private readonly interactionManager: InteractionManager;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ctx: CanvasRenderingContext2D
  ) {
    this.store = new Store(createServerState());
    this.gameLoop = new GameLoop((dt) => this.tick(dt));
    this.interactionManager = new InteractionManager(canvas);
  }

  async boot() {
    // ... (rest of boot stays the same until start())
    const username = window.localStorage.getItem(usernameKey);
    this.snapshotCache = new SnapshotCache(username);
    this.channel = new GameChannel(username, this.snapshotCache.cachedSlotIndexes());

    // Initialize Save Slot Actions
    this.mainMenu.setActions({
      onSwitch: (index: number) => {
        if (!this.channel) return;
        this.uiManager.modalManager.open(new LoadingModal('Switching save slot...'));
        this.runCommand(() => switchSaveSlot(this.channel!, index, false)).then(() => {
          this.uiManager.modalManager.close();
          this.uiManager.overlayManager.close();
        });
      },
      onReset: (index: number) => {
        this.uiManager.modalManager.open(new ResetConfirmationModal(
          'Reset Save Slot',
          'Are you sure you want to delete this file?\nThis cannot be undone.',
          () => {
            if (!this.channel) return;
            this.uiManager.modalManager.open(new LoadingModal('Resetting save slot...'));
            this.runCommand(() => resetSaveSlot(this.channel!, index)).then(() => {
              this.uiManager.modalManager.close();
              this.uiManager.overlayManager.close();
            });
          },
          () => this.uiManager.modalManager.close()
        ));
      }
    });
    
    this.mainMenu.setShopActions({
      onPurchase: (itemId: string) => {
        if (!this.channel) return;
        this.runCommand(() => shopPurchase(this.channel!, itemId));
      },
      onSee: (itemId: string) => {
        if (!this.channel) return;
        this.runCommand(() => noticeSee(this.channel!, `shop:${itemId}`, ['shop_tab', 'menu_button']));
      }
    });

    setMainMenuNetwork(this.channel, (cmd) => this.runCommand(cmd));

    this.channel.onStatusChange = (status) => {
      this.store.state.status = status === "connected" ? "Ready" : status.charAt(0).toUpperCase() + status.slice(1);
      this.store.state.statusTone = status === "connected" ? "ok" : (status === "disconnected" ? "error" : "");
    };

    this.channel.onBootResult = async (result) => {
      window.localStorage.setItem(usernameKey, result.username);
      this.snapshotCache = new SnapshotCache(result.username);

      this.store.state.snapshot = result.snapshot ?? this.snapshotCache.load(result.active_save_slot);
      if (this.store.state.snapshot) {
        noticeSystem.setSnapshot(this.store.state.snapshot);
        updateAreaViewModel(this.store.state.snapshot.state);
      }
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
      // Fetch all save slots to ensure the UI shows all 4 slots immediately.
      // This is done after connect resolves to ensure the channel is fully ready.
      await this.runCommand(() => listSaveSlots(this.channel!));
    } catch (error) {
      this.store.state.statusTone = "error";
      this.store.state.status = error instanceof Error ? error.message : "Boot failed";
    }
  }

  start() {
    this.interactionManager.start((e) => this.onKeydown(e));
    this.gameLoop.start();
  }

  stop() {
    this.gameLoop.stop();
    this.interactionManager.stop();
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
    if (this.store.state.snapshot) {
      noticeSystem.setSnapshot(this.store.state.snapshot);
    }
    this.cacheSnapshotFromResult(result);

    if (result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result") {
      this.uiManager.modalManager.close();
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
      if (this.store.state.snapshot) {
        noticeSystem.setSnapshot(this.store.state.snapshot);
      }
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
    if (!this.store.state.snapshot) return;

    // Keep the boot cache aligned with any server-authored snapshot mutation.
    // Without this, reloads can resurrect an older cached projection until the
    // next full snapshot arrives.
    if (result.type === "progress.claim_reward.result" ||
        result.type === "area.select.result" ||
        result.type === "shop.purchase.result" ||
        result.type === "notice.see.result" ||
        result.type === "notice.ack.result" ||
        result.type === "save_slot.switch.result" ||
        result.type === "save_slot.reset.result") {
      this.snapshotCache!.save(this.store.state.snapshot);
      return;
    }

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

  private onKeydown(event: KeyboardEvent) {
    if (this.uiManager.modalManager.isOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      this.uiManager.overlayManager.toggle(this.mainMenu);
      event.preventDefault();
      return;
    }

    const key = event.key.toLowerCase();
    const overlay = this.uiManager.overlayManager.getActiveOverlay();
    const isMainMenuOpen = overlay === this.mainMenu;
    const isNoOverlayOpen = overlay === null;

    if (isNoOverlayOpen || isMainMenuOpen) {
      let targetTab: string | null = null;
      if (key === 's') targetTab = 'shop';
      if (key === 'q') targetTab = 'quest';
      if (key === 'a') targetTab = 'achievements';

      if (targetTab) {
        if (isMainMenuOpen && this.mainMenu.getActiveTabId() === targetTab) {
          this.uiManager.overlayManager.close();
        } else {
          this.mainMenu.setTab(targetTab);
          this.uiManager.overlayManager.open(this.mainMenu);
        }
        event.preventDefault();
        return;
      }
    }

    event.preventDefault();
  }

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  private tick(dt: number) {
    // 1. Snapshot input state for this frame
    const { state: input, activity } = this.interactionManager.tick();

    // Advance client-side estimation of progress bar fill
    updateProjectedFill(dt);

    // Check if projection expects bar to be full, and queue command if so
    if (this.channel && handleProgressLoop(this.channel)) {
      const channel = this.channel;
      this.runCommand(() => progressClaimIn(channel));
    }

    // Render the core 2D progress bar UI (fill ratio and text)
    this.ctx.fillStyle = COLORS.game.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    renderAreaBackground(this.ctx, this.canvas);
    
    renderProgressBar(this.ctx, this.canvas);
    
    if (this.store.state.snapshot) {
      renderAreaSpecifics(this.ctx, this.canvas, input, this.store.state.snapshot.state.level, this.channel || undefined, (cmd) => this.runCommand(cmd));
    }

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
      const isOpening = !this.uiManager.overlayManager.isActive(this.mainMenu);
      this.uiManager.overlayManager.toggle(this.mainMenu);
      
      if (isOpening && this.channel && noticeSystem.hasMenuNotice()) {
        this.runCommand(() => noticeAck(this.channel!, 'menu_button'));
      }
    }, (areaKey) => {
      if (this.channel) {
        this.runCommand(() => selectArea(this.channel!, areaKey));
        
        // Clear area unlock notice
        if (noticeSystem.hasLeafNotice(`area:${areaKey}`)) {
          this.runCommand(() => noticeSee(this.channel!, `area:${areaKey}`, ['area_dropdown', 'menu_button']));
        }
        
        // Special case: clicking Sage area also clears sage tips notice
        if (areaKey === 'sage' && noticeSystem.hasSageNotice()) {
          this.runCommand(() => noticeAck(this.channel!, 'area_dropdown'));
        }
      }
    });

    // The UI is drawn over the game world. It can consume clicks.
    this.uiManager.tick(dt, input);
    this.uiManager.render(this.ctx, this.canvas, input, this.store.state);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (no instance state)
// ---------------------------------------------------------------------------

function clearsCommandQueue(result: AckableCommandResult) {
  return result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result";
}

function listSaveSlots(channel: GameChannel): Promise<ServerResult> {
    return channel.push("save_slot.list", {});
}
