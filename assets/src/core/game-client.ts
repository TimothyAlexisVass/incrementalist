import { GameChannel } from "../net/game-channel";
import {
  ackAppliedResult,
  resetGame,
  progressClaimIn,
  selectArea,
  shopPurchase
} from "../net/commands";
import { ResetConfirmationModal, LoadingModal } from '../ui/components/modals/confirmation-modal';
import { isAckableCommandResult, type AckableCommandResult, type ServerResult, type GameSnapshot } from "../net/protocol";
import { applyResult, clearShopHighlight, createServerState, type ServerState, View } from "../net/snapshots";
import { SnapshotCache } from "../net/snapshot-cache";
import {
  updateProjectedFill,
  getStateFromSnapshot,
  applyProgressResult
} from "../features/progress-bar/view-model";
import {
  createSisuGeneratorModal,
  renderSisuControl,
  renderSisuGlassBallOverlay,
  type SisuControlLayout
} from "../features/sisu/render";
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
import { closeAreaDropdown, renderAreaBackground, renderAreaSpecifics, renderAreaDropdownAboveMenu } from "../features/areas/render";
import { updateWebGLEffects, renderWebGLEffects, spawnGpuClickBurst } from "../render/webgl-effects";
import {
  createFloatingTextState,
  renderFloatingTexts,
  spawnFloatingText,
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
import { renderBonusTimeOverview } from "../features/bonustime/render";
import { handleBonusTimeInteractions } from "../features/bonustime/interactions";
import { resetChestState } from "../features/bonustime/01-chest-draw/interactions";
import { resetWheelState } from "../features/bonustime/02-prize-wheel/interactions";
import { getBonusTimeTooltipData } from "../features/bonustime/view-model";
import { RewardModalState, resolveRewardModalAction, renderRewardModal, getRewardModalLayout } from "../ui/components/modals/reward-modal";
import { Interactions, InteractionState, pointInRect } from "../ui/managers/interactions";
import { beginTooltipFrame, renderQueuedTooltips } from "../ui/components/tooltip";
import {
  NOTICE_LEAF_TAB_MENU_ANY_BUTTON,
  NOTICE_PARENT_MENU_MAIN,
  notices
} from "../ui/managers/notices";
import { setNetwork as setMainMenuNetwork } from "../ui/layout/main-menu/view-model";
import { getActiveWebGLRenderer } from "../renderer/webgl";
import { DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT } from '../config';
import { COLORS } from '../colors';


// Cached snapshots are projection data. They make boot feel
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
  private bonusRewardModal: RewardModalState | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement
  ) {
    this.store = new Store(createServerState());
    this.gameLoop = new GameLoop((dt) => this.tick(dt));
    this.interactions = new Interactions(canvas);
  }

  async boot() {
    const username = window.localStorage.getItem(usernameKey);
    const token = window.localStorage.getItem(tokenKey);
    this.snapshotCache = new SnapshotCache(username);
    const hasCachedSnapshot = this.snapshotCache.hasCachedSnapshot();

    if (hasCachedSnapshot) {
      const cached = this.snapshotCache.load();
      if (cached) {
        this.store.state.snapshot = cached;
        getStateFromSnapshot(cached);
        notices.setSnapshot(cached);
        updateAreaViewModel(cached.state);
        syncHudInstantly(cached.state);
      }
    }

    this.channel = new GameChannel(username, token, hasCachedSnapshot);

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
      this.store.state.snapshot = result.snapshot ?? this.snapshotCache.load();
      if (this.store.state.snapshot) {
        // Ensure the bar projection is up to date even if the snapshot was cached
        this.store.state.snapshot.state.projection_params = result.projection_params;
        this.store.state.snapshot.state.idle_mode = result.idle_mode;

        notices.setSnapshot(this.store.state.snapshot);
        updateAreaViewModel(this.store.state.snapshot.state);
      }

      if (this.store.state.snapshot) {
        getStateFromSnapshot(this.store.state.snapshot);
        syncHudInstantly(this.store.state.snapshot.state);
      }

      if (result.pending_result) {
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
    const previousAmounts = result.type === "progress.claim_reward.result" ? this.snapshotAmounts() : null;
    const previousAchievements = this.store.state.snapshot ? Object.keys(this.store.state.snapshot.state.achievements).filter(k => this.store.state.snapshot!.state.achievements[k].unlocked_at) : [];
    applyResult(this.store.state, result);
    if (this.store.state.snapshot) {
      notices.setSnapshot(this.store.state.snapshot);
    }
    this.cacheSnapshotFromResult(result);

    if (result.type === "game.reset.result") {
      this.closeAllTransientUi();
      if (this.store.state.snapshot) {
        getStateFromSnapshot(this.store.state.snapshot);
        syncHudInstantly(this.store.state.snapshot.state);
      }
    }

    if (result.type === "area.select.result") {
      this.closeAllTransientUi();
    }

    this.applyProgressEffects(result, previousAmounts);
    this.applyAchievementEffects(result, previousAchievements);

    if (!isAckableCommandResult(result)) return;

    // Acknowledgement is the crash boundary. If the browser dies before this push,
    // reconnect will receive the same result again and apply it from the stored payload.
    let next = await ackAppliedResult(this.channel!, result.command_id);
    if (clearsCommandQueue(result)) this.channel!.clearCommandQueue();
    while (next) {
      const previousAmounts = next.type === "progress.claim_reward.result" ? this.snapshotAmounts() : null;
      const previousAchievements = this.store.state.snapshot ? Object.keys(this.store.state.snapshot.state.achievements).filter(k => this.store.state.snapshot!.state.achievements[k].unlocked_at) : [];
      applyResult(this.store.state, next);
      if (this.store.state.snapshot) {
        notices.setSnapshot(this.store.state.snapshot);
      }
      this.cacheSnapshotFromResult(next);
      this.applyProgressEffects(next, previousAmounts);
      this.applyAchievementEffects(next, previousAchievements);
      if (next.type === "game.reset.result") {
        this.closeAllTransientUi();
        if (this.store.state.snapshot) {
          getStateFromSnapshot(this.store.state.snapshot);
          syncHudInstantly(this.store.state.snapshot.state);
        }
      }
      if (next.type === "area.select.result") {
        this.closeAllTransientUi();
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
      cores: snapshot.state.cores,
      charge_crystals: snapshot.state.charge_crystals
    };
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
      result.type === "quest.claim.result" ||
      result.type === "stats.update.result" ||
      result.type === "bonustime.play.result" ||
      result.type === "game.reset.result") {
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
      popupPoint: getPendingClaimPopupPoint()
    });
    clearPendingClaimPopupPoint();
  }

  private applyAchievementEffects(result: ServerResult, previousAchievements: string[]) {
    if (!this.store.state.snapshot) return;

    const currentAchievements = Object.keys(this.store.state.snapshot.state.achievements).filter(
      k => this.store.state.snapshot!.state.achievements[k].unlocked_at
    );

    const newlyUnlocked = currentAchievements.filter(id => !previousAchievements.includes(id));

    if (newlyUnlocked.length > 0) {
      const popupOptions = {
        lifeMs: 5000,
        riseSpeed: 2,
        font: 'bold 24px "Outfit"',
        textAlign: "center" as CanvasTextAlign,
        type: "achievement_unlock"
      };

      const baseX = DISPLAY_AREA_X + (DISPLAY_AREA_WIDTH / 2);
      const baseY = DISPLAY_AREA_Y + (DISPLAY_AREA_HEIGHT / 10);

      newlyUnlocked.forEach((id, index) => {
        const achievement = this.store.state.snapshot!.state.achievements[id];
        if (achievement) {
          spawnFloatingText(
            this.floatingTexts,
            achievement.name,
            baseX,
            baseY + (index * 40),
            COLORS.rewards.achievement,
            popupOptions
          );
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  private onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.store.state.currentView === View.BONUSTIME) {
        this.store.state.currentView = View.GAME;
        event.preventDefault();
        return;
      }
      this.handleMenuButtonPress();
      event.preventDefault();
      return;
    }

    if (this.ui.modals.isOpen()) {
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
    beginTooltipFrame();

    // 1. Snapshot input state for this frame
    const { state: input, activity } = this.interactions.tick();

    const activeModal = this.ui.modals.getActiveModal();
    const modalBlocking = activeModal?.isBlocking ?? (activeModal !== null);
    const overlayOpen = this.ui.overlays.isOpen();
    const uiBlocked = modalBlocking || overlayOpen;

    if (input.clicked && input.pointer) {
      spawnGpuClickBurst(input.pointer.x, input.pointer.y);
    }

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

    renderAreaBackground(this.canvas);

    if (this.store.state.currentView === View.BONUSTIME) {
      if (this.bonusRewardModal?.open && input.clicked && input.pointer) {
        const layout = getRewardModalLayout(this.canvas);
        if (resolveRewardModalAction(layout, input.pointer.x, input.pointer.y)) {
          this.bonusRewardModal.open = false;
          resetChestState();
          resetWheelState();
          input.consumed = true;
        }
      }

      if (!input.consumed) {
        const interactionResult = handleBonusTimeInteractions(
          input,
          this.store.state,
          this.channel || undefined,
          (cmd) => this.runCommand(cmd)
        );
        if (interactionResult.type === 'open_last_reward' || interactionResult.type === 'open_chest_reward') {
          const db = this.store.state.snapshot?.state.bonustime;
          if (db?.last_result) {
            this.bonusRewardModal = {
              open: true,
              tier: db.last_result.tier,
              rarity: interactionResult.type === 'open_last_reward' ? "Last Reward" : "Result",
              rewardAmount: db.last_result.reward_amount
            };
          }
        }
      }

      renderBonusTimeOverview(this.canvas, this.store.state, this.bonusRewardModal, input);
    }

    renderProgressBar(this.canvas, input, uiBlocked);
    this.sisuControlLayout = this.store.state.snapshot
      ? renderSisuControl(this.canvas, input, this.store.state, uiBlocked)
      : null;
    renderSisuGlassBallOverlay(this.canvas, this.store.state);

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

    if (this.store.state.snapshot && this.store.state.currentView === View.GAME) {
      renderAreaSpecifics(this.canvas, input, this.store.state.snapshot.state.level, this.channel || undefined, (cmd) => this.runCommand(cmd), uiBlocked);
    }

    const amounts = this.snapshotAmounts();
    if (amounts) {
      updateHudViewModel(dt, amounts);
      renderTopHUD(this.canvas, dt);
    }

    updateFloatingTexts(this.floatingTexts, dt);

    // Render BottomHUD before game-world click handlers so its buttons take precedence.
    const isMainMenuOpen = this.ui.overlays.isActive(this.mainMenu);
    renderBottomHUD(this.canvas, input, amounts?.level ?? 1, isMainMenuOpen, () => {
      this.handleMenuButtonPress();
    }, () => {
      this.store.state.currentView = this.store.state.currentView === View.BONUSTIME ? View.GAME : View.BONUSTIME;
    }, (areaKey) => {
      if (this.channel) {
        this.runCommand(() => selectArea(this.channel!, areaKey));
      }
    }, this.channel || undefined,
      this.store.state.snapshot?.state.has_bonustime_token,
      getBonusTimeTooltipData(this.store.state) || undefined,
      this.store.state.snapshot?.state.features.bonus_time_purchased,
      (cmd) => this.runCommand(cmd));

    // 2. Handle specific UI element clicks before general activity collection.
    if (!uiBlocked && input.clicked && input.pointer && this.channel) {
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

    if (!uiBlocked && input.clicked && input.pointer && this.sisuControlLayout && pointInRect(input.pointer, this.sisuControlLayout.controlRect)) {
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

    // The UI is drawn over the game world. It can consume clicks.
    this.ui.tick(dt, input);
    this.ui.render(this.canvas, input, this.store.state);

    // Update and render reward collection effects (including Sisu particles and click bursts)
    // These are rendered AFTER the UI to appear on top of modals.
    updateWebGLEffects(dt);
    renderWebGLEffects();

    renderFloatingTexts(this.floatingTexts);

    if (isMainMenuOpen) {
      renderAreaDropdownAboveMenu(this.canvas, input, (areaKey) => {
        if (this.channel) {
          this.runCommand(() => selectArea(this.channel!, areaKey));
        }
      }, amounts?.level ?? 1, this.channel || undefined, (cmd) => this.runCommand(cmd));
    }
    renderQueuedTooltips();
  }

  private openShopAndHighlight(itemId: string) {
    this.store.state.uiHints.highlightedShopItemId = itemId;
    this.mainMenu.setTab("shop");
    this.ui.overlays.open(this.mainMenu);
  }

  private closeAllTransientUi() {
    closeAreaDropdown();
    this.ui.closeAll();
    clearShopHighlight(this.store.state);
  }

  private handleMenuButtonPress(): boolean {
    const activeModal = this.ui.modals.getActiveModal();
    if (activeModal) {
      if (!activeModal.closeOnMenuButton) {
        return false;
      }

      this.ui.modals.close();
      return true;
    }

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

    return true;
  }

}

// ---------------------------------------------------------------------------
// Pure helpers (no instance state)
// ---------------------------------------------------------------------------

function clearsCommandQueue(result: AckableCommandResult) {
  return result.type === "game.reset.result";
}
