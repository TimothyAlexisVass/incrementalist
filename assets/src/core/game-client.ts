import { GameChannel } from "../net/game-channel";
import { ZERO } from "../core/bignum";
import {
  ackAppliedResult,
  confirmCloverfieldDiscovery,
  progressClaimIn,
  selectArea,
  shopPurchase
} from "../net/commands";
import { isAckableCommandResult, type AckableCommandResult, type ServerResult, type GameSnapshot } from "../net/protocol";
import { applyPushEvent, applyResult, clearShopHighlight, createServerState, type ServerState, View } from "../net/snapshots";
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
import { spawnQuestFameLevelUpBurst } from "../features/quests/fame-bar";
import {
  createFloatingTextState,
  getAvailableFloatingTextStackIndexes,
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
import { resetHammerSmashState } from "../features/bonustime/06-hammer-smash/interactions";
import {
  getResourceChecklistState,
  ResourceChecklistState,
  resetResourceChecklistState
} from "../features/bonustime/03-resource-checklist/interactions";
import { getResourceChecklistData } from "../features/bonustime/03-resource-checklist/view-model";
import {
  getItemChecklistState,
  ItemChecklistState,
  resetItemChecklistState
} from "../features/bonustime/11-item-checklist/interactions";
import { getItemChecklistData } from "../features/bonustime/11-item-checklist/view-model";
import { resetPlinkoState } from "../features/bonustime/05-plinko-drop/interactions";
import { resetJackpotState } from "../features/bonustime/14-jackpot-meter/interactions";
import { resetCoinRainState } from "../features/bonustime/04-coin-rain/interactions";
import { resetItsBonusTimeState } from "../features/bonustime/15-its-bonus-time/interactions";
import { resetCardPickState } from "../features/bonustime/09-card-pick/interactions";
import { resetLadderClimbState } from "../features/bonustime/08-ladder-climb/interactions";
import { resetLabyrinthState } from "../features/bonustime/07-reward-labyrinth/interactions";
import { getActiveGameId, getBonusTimeTooltipData } from "../features/bonustime/view-model";
import { resetMatchPairsState } from "../features/bonustime/13-match-pairs/interactions";
import { resetScratchCardState } from "../features/bonustime/12-scratch-card/interactions";
import { resetLuckyDiceState } from "../features/bonustime/10-lucky-dice/interactions";
import { RewardModalState, resolveRewardModalAction, renderRewardModal, getRewardModalLayout } from "../ui/components/modals/reward-modal";
import { Interactions, pointInRect } from "../ui/managers/interactions";
import { beginTooltipFrame, renderQueuedTooltips } from "../ui/components/tooltip";
import { InfoAcknowledgementModal } from "../ui/components/modals/confirmation-modal";
import {
  getCloverfieldViewModel,
  startCloverfieldBackgroundTransition
} from "../features/areas/cloverfield/view-model";
import { tickOrchardProjections } from "../features/areas/orchard/view-model";
import {
  NOTICE_LEAF_TAB_MENU_ANY_BUTTON,
  NOTICE_PARENT_MENU_MAIN,
  notices
} from "../ui/managers/notices";
import { setNetwork as setMainMenuNetwork } from "../ui/layout/main-menu/view-model";
import { getActiveWebGLRenderer } from "../renderer/webgl";
import { DISPLAY_AREA_X, DISPLAY_AREA_WIDTH, TOP_HUD_EXP_BAR_Y } from '../config';
import { COLORS } from '../colors';
import { resolveStableText } from "../renderer/stable-text";


// Cached snapshots are projection data. They make boot feel
// instant, but server command results remain the only source of durable truth.
const usernameKey = "incrementalist.playerUsername";
const tokenKey = "incrementalist.playerToken";
const MILESTONE_ANNOUNCEMENT_TYPE = "milestone_announcement";
const MILESTONE_ANNOUNCEMENT_LINE_GAP = 40;
let nextMilestoneAnnouncementGroupId = 1;

type MilestoneBaseline = {
  unlockedAchievementIds: Set<string>;
  readyQuestIds: Set<string>;
};

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
  private pendingCloseTransientUi = false;
  private readonly cloverDiscoveryModalQueue: Array<{ discoveryId: string; body: string }> = [];

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
        
        if (result.has_bonustime_token !== undefined) {
          this.store.state.snapshot.state.has_bonustime_token = result.has_bonustime_token;
        }
        if (result.bonustime !== undefined) {
          this.store.state.snapshot.state.bonustime = result.bonustime;
        }

        this.snapshotCache.save(this.store.state.snapshot);

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

    this.channel.onPushEvent = (event) => {
      applyPushEvent(this.store.state, event);
      if (this.store.state.snapshot) {
        notices.setSnapshot(this.store.state.snapshot);
        this.snapshotCache?.save(this.store.state.snapshot);
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
    if (this.channel?.status === "superseded") return null;

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
    const previousTrust = result.type === "quest.claim.result" ? this.snapshotTrust() : null;
    const milestoneBaseline = this.snapshotMilestoneBaseline();
    const previousCloverfieldStage = getCloverfieldViewModel().backgroundStage;
    applyResult(this.store.state, result);
    this.applyCloverfieldBackgroundTransition(result, previousCloverfieldStage);
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
      this.store.state.currentView = View.GAME;
      this.closeAllTransientUi();
    }

    this.applyProgressEffects(result, previousAmounts);
    this.applyQuestEffects(result, previousTrust);
    this.applyMilestoneEffects(milestoneBaseline);
    this.enqueueCloverDiscoveryModals(result);

    if (!isAckableCommandResult(result)) return;

    // Acknowledgement is the crash boundary. If the browser dies before this push,
    // reconnect will receive the same result again and apply it from the stored payload.
    let next = await ackAppliedResult(this.channel!, result.command_id);
    if (clearsCommandQueue(result)) this.channel!.clearCommandQueue();
    while (next) {
      const previousAmounts = next.type === "progress.claim_reward.result" ? this.snapshotAmounts() : null;
      const previousTrust = next.type === "quest.claim.result" ? this.snapshotTrust() : null;
      const milestoneBaseline = this.snapshotMilestoneBaseline();
      const previousCloverfieldStage = getCloverfieldViewModel().backgroundStage;
      applyResult(this.store.state, next);
      this.applyCloverfieldBackgroundTransition(next, previousCloverfieldStage);
      if (this.store.state.snapshot) {
        notices.setSnapshot(this.store.state.snapshot);
      }
      this.cacheSnapshotFromResult(next);
      this.applyProgressEffects(next, previousAmounts);
      this.applyQuestEffects(next, previousTrust);
      this.applyMilestoneEffects(milestoneBaseline);
      this.enqueueCloverDiscoveryModals(next);
      if (next.type === "game.reset.result") {
        this.closeAllTransientUi();
        if (this.store.state.snapshot) {
          getStateFromSnapshot(this.store.state.snapshot);
          syncHudInstantly(this.store.state.snapshot.state);
        }
      }
      if (next.type === "area.select.result") {
        this.store.state.currentView = View.GAME;
        this.closeAllTransientUi();
      }
      // The server releases at most one queued result per acknowledgement so the
      // client cannot accidentally skip over a command result.
      const applied = next;
      next = await ackAppliedResult(this.channel!, applied.command_id);
      if (clearsCommandQueue(applied)) this.channel!.clearCommandQueue();
    }
  }

  private applyCloverfieldBackgroundTransition(
    result: ServerResult,
    previousStage: number
  ) {
    if (result.type !== "cloverfield.search.result") return;
    if (!result.discoveries || result.discoveries.length === 0) return;

    const nextStage = getCloverfieldViewModel().backgroundStage;
    if (nextStage <= previousStage) return;

    startCloverfieldBackgroundTransition(previousStage, nextStage);
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

  private snapshotTrust(): number | null {
    const snapshot = this.store.state.snapshot;
    return snapshot ? snapshot.state.trust : null;
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
      result.type === "furnace.upgrade.result" ||
      result.type === "shop.purchase.result" ||
      result.type === "notice.event.result" ||
      result.type === "quest.claim.result" ||
      result.type === "stats.update.result" ||
      result.type === "cloverfield.search.result" ||
      result.type === "cloverfield.confirm_discovery.result" ||
      result.type === "bonustime.play.result" ||
      result.type === "game.reset.result" ||
      result.type === "orchard.unlock_plot.result" ||
      result.type === "orchard.plant_seed.result" ||
      result.type === "orchard.harvest_plot.result" ||
      result.type === "orchard.splice_seeds.result" ||
      result.type === "orchard.buy_seed.result") {
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

  private applyQuestEffects(result: ServerResult, previousTrust: number | null) {
    if (result.type !== "quest.claim.result") return;
    if (previousTrust === null) return;
    if (result.trust <= previousTrust) return;

    spawnQuestFameLevelUpBurst();
  }

  private snapshotMilestoneBaseline(): MilestoneBaseline {
    const baseline: MilestoneBaseline = {
      unlockedAchievementIds: new Set<string>(),
      readyQuestIds: new Set<string>()
    };

    const snapshot = this.store.state.snapshot;
    if (!snapshot) return baseline;

    for (const [achievementId, achievement] of Object.entries(snapshot.state.achievements)) {
      if (achievement.unlocked_at) {
        baseline.unlockedAchievementIds.add(achievementId);
      }
    }

    for (const [questId, quest] of Object.entries(snapshot.state.quests)) {
      if (quest.rank > quest.claimed_rank) {
        baseline.readyQuestIds.add(questId);
      }
    }

    return baseline;
  }

  private applyMilestoneEffects(previous: MilestoneBaseline) {
    const snapshot = this.store.state.snapshot;
    if (!snapshot) return;

    const announcements: Array<{ text: string; color: string }> = [];

    for (const [achievementId, achievement] of Object.entries(snapshot.state.achievements)) {
      if (achievement.unlocked_at && !previous.unlockedAchievementIds.has(achievementId)) {
        announcements.push({ text: achievement.name, color: COLORS.rewards.achievement });
      }
    }

    for (const [questId, quest] of Object.entries(snapshot.state.quests)) {
      const wasReady = previous.readyQuestIds.has(questId);
      const isReady = quest.rank > quest.claimed_rank;
      if (isReady && !wasReady) {
        announcements.push({ text: `Quest: ${quest.name}`, color: COLORS.rewards.questSummary });
      }
    }

    if (announcements.length === 0) return;

    const stackIndexes = getAvailableFloatingTextStackIndexes(
      this.floatingTexts,
      MILESTONE_ANNOUNCEMENT_TYPE,
      announcements.length
    );
    const baseX = DISPLAY_AREA_X + (DISPLAY_AREA_WIDTH / 2);
    const baseY = 40;
    const popupOptions = {
      lifeMs: 5000,
      riseSpeed: 2,
      font: 'bold 24px "Outfit"',
      textAlign: "center" as CanvasTextAlign,
      type: MILESTONE_ANNOUNCEMENT_TYPE
    };

    for (let i = 0; i < announcements.length; i += 1) {
      const announcement = announcements[i];
      const stackIndex = stackIndexes[i] ?? i;
      const groupId = nextMilestoneAnnouncementGroupId;
      nextMilestoneAnnouncementGroupId += 1;

      spawnFloatingText(
        this.floatingTexts,
        announcement.text,
        baseX,
        baseY + (stackIndex * MILESTONE_ANNOUNCEMENT_LINE_GAP),
        announcement.color,
        {
          ...popupOptions,
          stackGroupId: groupId,
          stackIndex
        }
      );
    }
  }

  private enqueueCloverDiscoveryModals(result: ServerResult) {
    if (result.type !== "cloverfield.search.result") return;
    if (!result.discoveries || result.discoveries.length === 0) return;

    for (const discoveryId of result.discoveries) {
      const body = cloverDiscoveryMessage(discoveryId);
      if (body) {
        this.cloverDiscoveryModalQueue.push({ discoveryId, body });
      }
    }
  }

  private openNextCloverDiscoveryModalIfReady() {
    if (this.cloverDiscoveryModalQueue.length === 0) return;
    if (this.ui.modals.isOpen()) return;

    const nextModal = this.cloverDiscoveryModalQueue.shift();
    if (!nextModal) return;

    this.ui.modals.open(
      new InfoAcknowledgementModal("Clover Hunt", nextModal.body, () => {
        this.ui.modals.close();

        if (!this.channel) return;
        this.runCommand(() => confirmCloverfieldDiscovery(this.channel!, nextModal.discoveryId));
      })
    );
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
    const renderer = getActiveWebGLRenderer();
    renderer?.beginFrame([0, 0, 0, 0]);

    if (this.channel?.status === "superseded") {
      if (renderer) {
        renderer.drawRect({
          x: 0,
          y: 0,
          width: this.canvas.width,
          height: this.canvas.height,
          color: [0, 0, 0, 1.0]
        });

        renderer.drawText({
          text: resolveStableText("session.superseded.title", "Session Ended", {
            font: "bold 48px 'Outfit'",
            color: "#ff4444",
            align: "center",
            baseline: "middle"
          }),
          x: this.canvas.width / 2,
          y: this.canvas.height / 2 - 30,
          font: "bold 48px 'Outfit'",
          color: "#ff4444",
          align: "center",
          baseline: "middle"
        });

        renderer.drawText({
          text: resolveStableText("session.superseded.desc", "Session Taken Over in Another Tab or Device", {
            font: "24px 'Outfit'",
            color: "#ffffff",
            align: "center",
            baseline: "middle"
          }),
          x: this.canvas.width / 2,
          y: this.canvas.height / 2 + 30,
          font: "24px 'Outfit'",
          color: "#ffffff",
          align: "center",
          baseline: "middle"
        });
      }
      return;
    }

    beginTooltipFrame();

    if (this.pendingCloseTransientUi) {
      this.closeAllTransientUi();
      this.pendingCloseTransientUi = false;
    }

    this.openNextCloverDiscoveryModalIfReady();

    // 1. Snapshot input state for this frame
    const { state: input, activity } = this.interactions.tick();

    const activeModal = this.ui.modals.getActiveModal();
    const modalMaskRect = activeModal?.getInteractionMaskRect?.(this.canvas) ?? null;
    const modalBlocking = activeModal?.isBlocking ?? (activeModal !== null);
    const overlayOpen = this.ui.overlays.isOpen();
    const isMainMenuOpen = this.ui.overlays.isActive(this.mainMenu);
    const pointerOverModalMask = modalMaskRect
      ? pointInRect(input.pointer, modalMaskRect) || pointInRect(input.pressStartPointer, modalMaskRect)
      : false;
    const closeOnOutsideClick = Boolean(
      activeModal &&
      activeModal.closeOnOutsideClick &&
      input.clicked &&
      input.pointer &&
      modalMaskRect &&
      !pointInRect(input.pointer, modalMaskRect)
    );

    if (closeOnOutsideClick) {
      this.ui.modals.close();
      input.consumed = true;
    }

    const uiBlocked = modalBlocking || overlayOpen;

    // Route gameplay interactions through inert input when blocked, or when
    // a non-blocking modal's interaction region is under the pointer.
    const sceneInput = (modalBlocking || pointerOverModalMask || closeOnOutsideClick)
      ? {
        ...input,
        pointer: null,
        pressStartPointer: null,
        clicked: false,
        isPressed: false,
        consumed: true
      }
      : input;

    if (sceneInput.clicked && sceneInput.pointer) {
      spawnGpuClickBurst(sceneInput.pointer.x, sceneInput.pointer.y);
    }

    // Advance client-side estimation of progress bar fill
    updateProjectedFill(dt);

    if (this.store.state.snapshot && this.store.state.snapshot.state.area === "orchard") {
      tickOrchardProjections(dt);
    }

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
      if (this.bonusRewardModal?.open && sceneInput.clicked && sceneInput.pointer) {
        const layout = getRewardModalLayout(this.canvas);
        if (resolveRewardModalAction(layout, sceneInput.pointer.x, sceneInput.pointer.y)) {
          this.bonusRewardModal.open = false;
          resetChestState();
          resetWheelState();
          resetResourceChecklistState();
          resetItemChecklistState();
          resetPlinkoState();
          resetJackpotState();
          resetCoinRainState();
          resetItsBonusTimeState();
          resetCardPickState();
          resetLadderClimbState();
          resetLabyrinthState();
          resetMatchPairsState();
          resetScratchCardState();
          resetLuckyDiceState();
          resetHammerSmashState();
          sceneInput.consumed = true;
        }
      }

      if (!sceneInput.consumed) {
        const interactionResult = handleBonusTimeInteractions(
          sceneInput,
          this.store.state,
          this.channel || undefined,
          (cmd) => this.runCommand(cmd)
        );
        if (interactionResult.type === 'open_last_reward' || interactionResult.type === 'open_chest_reward') {
          const db = this.store.state.snapshot?.state.bonustime;
          const activeGameId = getActiveGameId(this.store.state);
          const resourceChecklistData = activeGameId === "resource_checklist" ? getResourceChecklistData(this.store.state) : null;
          const itemChecklistData = activeGameId === "item_checklist" ? getItemChecklistData(this.store.state) : null;
          const checklistData = resourceChecklistData || itemChecklistData;
          const currentChecklistEntry = checklistData?.entries[checklistData.nextEntryIndex] || null;
          const isChecklistRewardReady =
            ((activeGameId === "resource_checklist" && getResourceChecklistState() === ResourceChecklistState.REVEALED) ||
             (activeGameId === "item_checklist" && getItemChecklistState() === ItemChecklistState.REVEALED)) &&
            currentChecklistEntry !== null;

          if (isChecklistRewardReady && currentChecklistEntry) {
            this.bonusRewardModal = {
              open: true,
              tier: currentChecklistEntry.tier,
              rarity: "Result",
              rewardAmount: ZERO
            };
          } else if (db?.last_result) {
            this.bonusRewardModal = {
              open: true,
              tier: db.last_result.tier,
              rarity: interactionResult.type === 'open_last_reward' ? "Last Reward" : "Result",
              rewardAmount: db.last_result.reward_amount
            };
          }
        }
      }

      renderBonusTimeOverview(this.canvas, this.store.state, this.bonusRewardModal, sceneInput);
    }

    renderProgressBar(this.canvas, sceneInput, modalBlocking);
    this.sisuControlLayout = this.store.state.snapshot
      ? renderSisuControl(this.canvas, sceneInput, this.store.state, modalBlocking)
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
      renderAreaSpecifics(this.canvas, sceneInput, this.store.state.snapshot.state.level, this.channel || undefined, (cmd) => this.runCommand(cmd), uiBlocked);
    }

    updateWebGLEffects(dt);
    // Keep orchard harvest particles in the world layer so they remain visible
    // through semi-transparent overlays but never on top of opaque modal panels.
    renderWebGLEffects({
      includeNonParticleEffects: false,
      particleRenderMode: 'harvest_only'
    });

    const amounts = this.snapshotAmounts();
    if (amounts) {
      updateHudViewModel(dt, amounts);
      renderTopHUD(this.canvas, dt);
    }

    updateFloatingTexts(this.floatingTexts, dt);

    // Render BottomHUD before game-world click handlers so its buttons take precedence.
    renderBottomHUD(this.canvas, sceneInput, amounts?.level ?? 1, isMainMenuOpen, () => {
      this.handleMenuButtonPress();
    }, () => {
      const hasTransientUiOpen = this.ui.overlays.isOpen() || this.ui.modals.isOpen();
      if (hasTransientUiOpen) {
        this.store.state.currentView = View.BONUSTIME;
        this.pendingCloseTransientUi = true;
        return;
      }

      this.store.state.currentView = this.store.state.currentView === View.BONUSTIME ? View.GAME : View.BONUSTIME;
    }, (areaKey) => {
      if (this.channel) {
        this.runCommand(() => selectArea(this.channel!, areaKey));
      }
    }, this.channel || undefined,
      this.store.state.snapshot?.state.has_bonustime_token,
      getBonusTimeTooltipData(this.store.state) || undefined,
      this.store.state.snapshot?.state.features.bonus_time_purchased,
      (cmd) => this.runCommand(cmd),
      this.store.state.snapshot);

    // 2. Handle specific UI element clicks before general activity collection.
    if (!uiBlocked && sceneInput.clicked && sceneInput.pointer && this.channel) {
      if (handleProgressClick(
        this.channel,
        this.canvas,
        sceneInput.pointer,
        (cmd) => this.runCommand(cmd),
        (itemId) => this.openShopAndHighlight(itemId)
      )) {
        sceneInput.consumed = true;
      }
    }

    if (!uiBlocked && sceneInput.clicked && sceneInput.pointer && this.sisuControlLayout && pointInRect(sceneInput.pointer, this.sisuControlLayout.controlRect)) {
      sceneInput.consumed = true;
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

    // Render non-harvest effects after UI so these bursts remain visible over overlays.
    renderWebGLEffects({ particleRenderMode: 'exclude_harvest' });

    renderFloatingTexts(this.floatingTexts);

    if (isMainMenuOpen) {
      renderAreaDropdownAboveMenu(this.canvas, sceneInput, (areaKey) => {
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

function cloverDiscoveryMessage(discoveryId: string): string | null {
  switch (discoveryId) {
    case "four_leaf_1":
      return "You found a 4-leaf clover!";
    case "four_leaf_2":
      return "You found another 4-leaf clover!";
    case "five_leaf_1":
      return "You found a 5-leaf clover!";
    case "five_leaf_2":
      return "You found another 5-leaf clover!";
    case "five_leaf_3":
      return "You found a third 5-leaf clover!";
    case "six_leaf_1":
      return "You found a 6-leaf clover!";
    default:
      return null;
  }
}
