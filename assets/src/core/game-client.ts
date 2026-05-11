import { GameChannel } from "../net/game-channel";
import { 
  ackAppliedResult, 
  switchSaveSlot, 
  resetSaveSlot, 
  progressClaimIn,
  selectArea,
  shopPurchase,
  listSaveSlots
} from "../net/commands";
import { ResetConfirmationModal, LoadingModal } from '../ui/components/modals/confirmation-modal';
import { isAckableCommandResult, type AckableCommandResult, type ServerResult, type GameSnapshot } from "../net/protocol";
import { applyResult, createServerState, type ServerState } from "../net/snapshots";
import { SnapshotCache } from "../net/snapshot-cache";
import {
  updateProjectedFill,
  getStateFromSnapshot,
  applyProgressResult
} from "../features/progress-bar/view-model";
import { createSisuGeneratorModal, renderSisuControl, type SisuControlLayout } from "../features/sisu/render";
import { updateAreaViewModel } from "../features/areas/view-model";
import {
  handleProgressLoop,
  claimRewardInIdleMode,
  claimRewardOnAnyInput,
  handleProgressClick,
  getPendingClaimPopupPoint,
  clearPendingClaimPopupPoint
} from "../features/progress-bar/interactions";
import { renderProgressBar } from "../features/progress-bar/render";
import { renderAreaBackground, renderAreaSpecifics } from "../features/areas/render";
import { updateWebGLEffects, renderWebGLEffects } from "../render/webgl-effects";
import { 
  createFloatingTextState, 
  renderFloatingTexts, 
  updateFloatingTexts, 
} from "../render/effects";
import type { ResourceAmounts } from "../features/progress-bar/claim-effects";
import { updateHudViewModel, syncHudInstantly } from "../ui/layout/top-hud/view-model";
import { renderTopHUD } from "../ui/layout/top-hud/render";
import { renderBottomHUD } from "../ui/layout/bottom-hud/render";
import { Store } from "./store";
import { synchronize } from "./time";
import { GameLoop } from "./game-loop";
import { UserInterface } from "../ui/managers/user-interface";
import { MainMenu } from "../ui/layout/main-menu/render";
import { Interactions, InteractionState, pointInRect } from "../ui/managers/interactions";
import {
  NOTICE_LEAF_TAB_MENU_ANY_BUTTON,
  NOTICE_PARENT_MENU_MAIN,
  notices
} from "../ui/managers/notices";
import { setNetwork as setMainMenuNetwork } from "../ui/layout/main-menu/view-model";
import { getActiveWebGLRenderer } from "../renderer/webgl";

// Cached snapshots are projection data. They make boot and slot switches feel
// instant, but server command results remain the only source of durable truth.
const usernameKey = "incrementalist.playerUsername";
const tokenKey = "incrementalist.playerToken";

export class GameClient {
  private readonly store: Store<ServerState>;
  private channel: GameChannel | null = null;
  private snapshotCache: SnapshotCache | null = null;
  private readonly floatingTexts = createFloatingTextState();
  private readonly gameLoop: GameLoop;
  public readonly ui = new UserInterface();
  private readonly mainMenu = new MainMenu();
  private readonly interactions: Interactions;
  private sisuControlLayout: SisuControlLayout | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ctx: CanvasRenderingContext2D
  ) {
    this.store = new Store(createServerState());
    this.gameLoop = new GameLoop((dt) => this.tick(dt));
    this.interactions = new Interactions(canvas);
  }

  async boot() {
    // ... (rest of boot stays the same until start())
    const username = window.localStorage.getItem(usernameKey);
    const token = window.localStorage.getItem(tokenKey);
    this.snapshotCache = new SnapshotCache(username);
    this.channel = new GameChannel(username, token, this.snapshotCache.cachedSlotIndexes());

    // Initialize Save Slot Actions
    this.mainMenu.setActions({
      onSwitch: (index: number) => {
        if (!this.channel) return;
        this.ui.modals.open(new LoadingModal('Switching save slot...'));
        this.runCommand(() => switchSaveSlot(this.channel!, index, false)).then(() => {
          this.ui.modals.close();
          this.ui.overlays.close();
        });
      },
      onReset: (index: number) => {
        this.ui.modals.open(new ResetConfirmationModal(
          'Reset Save Slot',
          'Are you sure you want to delete this file?\nThis cannot be undone.',
          () => {
            if (!this.channel) return;
            this.ui.modals.open(new LoadingModal('Resetting save slot...'));
            this.runCommand(() => resetSaveSlot(this.channel!)).then(() => {
              this.ui.modals.close();
              this.ui.overlays.close();
            });
          },
          () => this.ui.modals.close()
        ));
      }
    });
    
    this.mainMenu.setShopActions({
      onPurchase: (itemId: string) => {
        if (!this.channel) return;
        this.runCommand(() => shopPurchase(this.channel!, itemId));
      },
      onNoticeClick: (itemId: string) => {
        notices.reportLeafClicked(`leaf.shop_item.${itemId}.purchase_button`, this.channel || undefined, (cmd) => this.runCommand(cmd));
      },
      onNoticeVisible: (itemId: string) => {
        notices.reportLeafVisible(`leaf.shop_item.${itemId}.purchase_button`, true, this.channel || undefined, (cmd) => this.runCommand(cmd));
      }
    });

    setMainMenuNetwork(this.channel, (cmd) => this.runCommand(cmd));

    this.channel.onStatusChange = (status) => {
      this.store.state.status = status === "connected" ? "Ready" : status.charAt(0).toUpperCase() + status.slice(1);
      this.store.state.statusTone = status === "connected" ? "ok" : (status === "disconnected" ? "error" : "");
    };

    this.channel.onBootResult = async (result) => {
      window.localStorage.setItem(usernameKey, result.username);
      if (result.token) {
        window.localStorage.setItem(tokenKey, result.token);
      }
      this.snapshotCache = new SnapshotCache(result.username);

      synchronize(result.server_time);
      this.store.state.snapshot = result.snapshot ?? this.snapshotCache.load(result.active_save_slot);

      if (this.store.state.snapshot) {
        // Ensure the bar projection is up to date even if the snapshot was cached
        this.store.state.snapshot.state.projection_params = result.projection_params;
        this.store.state.snapshot.state.idle_mode = result.idle_mode;

        notices.setSnapshot(this.store.state.snapshot);
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
    this.interactions.start((e) => this.onKeydown(e));
    this.gameLoop.start();
  }

  stop() {
    this.gameLoop.stop();
    this.interactions.stop();
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
      notices.setSnapshot(this.store.state.snapshot);
    }
    this.cacheSnapshotFromResult(result);

    if (result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result") {
      this.ui.modals.close();
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
        notices.setSnapshot(this.store.state.snapshot);
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
        result.type === "progress.set_idle_mode.result" ||
        result.type === "progress.claim_in.result" ||
        result.type === "sisu.refill.result" ||
        result.type === "sisu.upgrade_max.result" ||
        result.type === "area.select.result" ||
        result.type === "shop.purchase.result" ||
        result.type === "notice.event.result" ||
        result.type === "save_slot.switch.result" ||
        result.type === "save_slot.reset.result") {
      this.snapshotCache!.save(this.store.state.snapshot);
      return;
    }

    if ("snapshot" in result && result.snapshot && typeof result.snapshot === 'object' && 'type' in result.snapshot) {
      this.snapshotCache!.save(result.snapshot as GameSnapshot);
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
    if (this.ui.modals.isOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      const isOpening = !this.ui.overlays.isActive(this.mainMenu);
      this.ui.overlays.toggle(this.mainMenu);
      if (isOpening) {
        notices.reportParentVisibleViaPseudoLeaf(
          NOTICE_LEAF_TAB_MENU_ANY_BUTTON,
          NOTICE_PARENT_MENU_MAIN,
          true,
          this.channel || undefined,
          (cmd) => this.runCommand(cmd)
        );
      }
      event.preventDefault();
      return;
    }

    const key = event.key.toLowerCase();
    const overlay = this.ui.overlays.getActiveOverlay();
    const isMainMenuOpen = overlay === this.mainMenu;
    const isNoOverlayOpen = overlay === null;

    if (isNoOverlayOpen || isMainMenuOpen) {
      let targetTab: string | null = null;
      if (key === 's') targetTab = 'shop';
      if (key === 'q') targetTab = 'quest';
      if (key === 'a') targetTab = 'achievements';

      if (targetTab) {
        if (isMainMenuOpen && this.mainMenu.getActiveTabId() === targetTab) {
          this.ui.overlays.close();
        } else {
          this.mainMenu.setTab(targetTab);
          this.ui.overlays.open(this.mainMenu);
          notices.reportParentVisibleViaPseudoLeaf(
            NOTICE_LEAF_TAB_MENU_ANY_BUTTON,
            NOTICE_PARENT_MENU_MAIN,
            true,
            this.channel || undefined,
            (cmd) => this.runCommand(cmd)
          );
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
    getActiveWebGLRenderer()?.beginFrame([0, 0, 0, 0]);

    // 1. Snapshot input state for this frame
    const { state: input, activity } = this.interactions.tick();

    // Advance client-side estimation of progress bar fill
    updateProjectedFill(dt);

    // Check if projection expects bar to be full, and queue command if so
    if (this.channel && handleProgressLoop(this.channel)) {
      const channel = this.channel;
      this.runCommand(() => progressClaimIn(channel));
    }

    if (this.channel) {
      claimRewardInIdleMode(
        this.channel,
        this.canvas,
        (cmd) => this.runCommand(cmd)
      );
    }

    renderAreaBackground(this.ctx, this.canvas);
    
    renderProgressBar(this.ctx, this.canvas);
    this.sisuControlLayout = this.store.state.snapshot
      ? renderSisuControl(this.ctx, this.canvas, this.store.state)
      : null;

    if (this.store.state.snapshot && !this.store.state.snapshot.state.features.idle_mode_purchased) {
      notices.reportLeafVisible(
        "leaf.feature.idle_mode.locked_text",
        true,
        this.channel || undefined,
        (cmd) => this.runCommand(cmd)
      );
    }

    if (this.store.state.snapshot && !this.store.state.snapshot.state.features.sisu_generator_purchased) {
      notices.reportLeafVisible(
        "leaf.feature.sisu_generator.locked_text",
        true,
        this.channel || undefined,
        (cmd) => this.runCommand(cmd)
      );
    }
    
    if (this.store.state.snapshot) {
      renderAreaSpecifics(this.ctx, this.canvas, input, this.store.state.snapshot.state.level, this.channel || undefined, (cmd) => this.runCommand(cmd));
    }

    const amounts = this.snapshotAmounts();
    if (amounts) {
      updateHudViewModel(dt, amounts);
      renderTopHUD(this.ctx, this.canvas, dt);
    }

    updateFloatingTexts(this.floatingTexts, dt);

    // Update and render reward collection effects.
    updateWebGLEffects(dt);
    renderWebGLEffects();

    renderFloatingTexts(this.ctx, this.floatingTexts);

    // 2. Handle specific UI element clicks before general activity collection.
    const modalOpen = this.ui.modals.isOpen();

    if (!modalOpen && input.clicked && input.pointer && this.channel) {
      if (handleProgressClick(
        this.channel, 
        this.canvas, 
        input.pointer, 
        (cmd) => this.runCommand(cmd),
        (itemId) => this.openShopAndHighlight(itemId)
      )) {
        input.consumed = true;
      }
    }

    if (!modalOpen && input.clicked && input.pointer && this.sisuControlLayout && pointInRect(input.pointer, this.sisuControlLayout.controlRect)) {
      input.consumed = true;
      if (this.store.state.snapshot?.state.features.sisu_generator_purchased && this.channel) {
        this.ui.modals.open(
          createSisuGeneratorModal(
            () => this.store.state,
            this.channel,
            (cmd) => this.runCommand(cmd),
            () => this.ui.modals.close()
          )
        );
      } else {
        this.openShopAndHighlight("sisu_generator");
      }
    }

    // Any activity collects the progress bar if it's ready, even with a modal
    // open or after another UI element consumed the click.
    // This collection path must never block or swallow the original interaction.
    if (activity && this.channel) {
      claimRewardOnAnyInput(this.channel, this.canvas, input.pointer, (cmd) => this.runCommand(cmd));
    }

    // Render BottomHUD before overlays so its buttons can consume input and 
    // toggle overlays without being immediately countered by "click-outside" logic.
    const isMainMenuOpen = this.ui.overlays.isActive(this.mainMenu);
    renderBottomHUD(this.ctx, this.canvas, input, isMainMenuOpen, () => {
      const isOpening = !this.ui.overlays.isActive(this.mainMenu);
      this.ui.overlays.toggle(this.mainMenu);

      if (isOpening) {
        notices.reportParentVisibleViaPseudoLeaf(
          NOTICE_LEAF_TAB_MENU_ANY_BUTTON,
          NOTICE_PARENT_MENU_MAIN,
          true,
          this.channel || undefined,
          (cmd) => this.runCommand(cmd)
        );
      }
    }, (areaKey) => {
      if (this.channel) {
        this.runCommand(() => selectArea(this.channel!, areaKey));
      }
    }, this.channel || undefined, (cmd) => this.runCommand(cmd));

    // The UI is drawn over the game world. It can consume clicks.
    this.ui.tick(dt, input);
    this.ui.render(this.ctx, this.canvas, input, this.store.state);
  }

  private openShopAndHighlight(itemId: string) {
    this.store.state.uiHints.highlightedShopItemId = itemId;
    this.mainMenu.setTab("shop");
    this.ui.overlays.open(this.mainMenu);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (no instance state)
// ---------------------------------------------------------------------------

function clearsCommandQueue(result: AckableCommandResult) {
  return result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result";
}
