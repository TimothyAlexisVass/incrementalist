(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/core/input.ts
  function onClick(selector, callback) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing element ${selector}`);
    element.addEventListener("click", callback);
    return element;
  }

  // src/config.ts
  var NEW_PLAYER_BONUS_WINDOW_MS = 25e3;
  var NEW_PLAYER_BONUS_FILL_MULTIPLIER = 2.5;
  var NEW_PLAYER_BONUS_FILL_BONUS = 20;
  var LATE_NEW_PLAYER_BONUS_FILL_MULTIPLIER = 7.25;
  var BASE_IDLE_MODE_OFF_FILL_RATE = 0.8;
  var BASE_IDLE_MODE_ON_FILL_RATE = 0.24;
  var BAR_RESET_LERP_SPEED = 7;
  var BAR_FULL_PULSE_SPEED = 0.3;
  var BAR_COLLECTION_GLOW_FADE_MULTIPLIER = 5;
  var REWARD_POPUP_HOLD_MS = 2e3;
  var REWARD_POPUP_FLY_MS = 500;
  var REWARD_POPUP_HOLD_RISE_SPEED = 12;
  var GENERIC_FLOAT_LIFE_MS = 2500;
  var GENERIC_FLOAT_RISE_SPEED = 16;
  var REWARD_POPUP_FONT = "25px Arial";
  var PROGRESS_PERCENT_FONT = "bold 16px Arial";
  var IDLE_TOGGLE_FONT = "bold 11px Arial";
  var CANVAS_WIDTH = 1280;
  var CANVAS_HEIGHT = 760;
  var TOP_HUD_HEIGHT = 50;
  var BOTTOM_HUD_HEIGHT = 50;
  var DISPLAY_AREA_X = 20;
  var DISPLAY_AREA_Y = TOP_HUD_HEIGHT;
  var DISPLAY_AREA_WIDTH = 1112;
  var DISPLAY_AREA_HEIGHT = CANVAS_HEIGHT - TOP_HUD_HEIGHT - BOTTOM_HUD_HEIGHT;
  var TOP_HUD_EXP_BAR_X = DISPLAY_AREA_X;
  var TOP_HUD_EXP_BAR_Y = 15;
  var TOP_HUD_EXP_BAR_WIDTH = 300;
  var TOP_HUD_LEVEL_X = TOP_HUD_EXP_BAR_X * 2 + TOP_HUD_EXP_BAR_WIDTH;
  var TOP_HUD_EXP_COUNTER_X = TOP_HUD_EXP_BAR_X + TOP_HUD_EXP_BAR_WIDTH / 2;
  var TOP_HUD_EXP_COUNTER_Y = TOP_HUD_EXP_BAR_Y + 15;
  var TOP_HUD_CURRENCY_ICON_SIZE = 32;
  var TOP_HUD_CURRENCY_ICON_Y = Math.floor((TOP_HUD_HEIGHT - TOP_HUD_CURRENCY_ICON_SIZE) / 2);
  var TOP_HUD_COIN_COUNTER_Y = 30;
  var TOP_HUD_COINS_COUNTER_RIGHT = 350;
  var TOP_HUD_SHARDS_COUNTER_RIGHT = 180;
  var TOP_HUD_CORES_COUNTER_RIGHT = 10;
  var PROGRESS_BAR_WIDTH = 40;

  // src/colors.ts
  var COLORS = Object.freeze({
    app: {
      background: "#0f0f1a",
      canvasBorder: "#333",
      canvasShadow: "rgba(0, 0, 0, 0.5)"
    },
    game: {
      background: "#1a1a2e"
    },
    bar: {
      track: "#0f1b30",
      border: "#5b6f93",
      progress: {
        fillStart: [255, 107, 107],
        // #FF6B6B
        fillMid: [255, 230, 109],
        // #FFE66D
        fillEnd: [78, 205, 196]
        // #4ECDC4
      },
      exp: {
        fillStart: "#934caf",
        fillEnd: "#e753ec"
      },
      quest: {
        readyStart: "#34a853",
        readyEnd: "#7ce89a",
        pendingStart: "#4b72c2",
        pendingEnd: "#6ea9ff"
      }
    },
    sisu: {
      darkBlue: "#0B1F4D",
      blue: "#1E90FF",
      yellow: "#FFD700",
      purple: "#9932CC",
      decay: "#ffa1a1"
    },
    button: {
      surface: {
        active: "#2c6fb3",
        inactive: "#2b3f60"
      },
      border: {
        active: "#cfe7ff",
        inactive: "#4d678f"
      },
      text: "#f5f8ff",
      secondary: {
        surface: "#2a3f61",
        border: "#93b3d8",
        text: "#dbe8ff"
      },
      toggle: {
        on: "#4CAF50",
        off: "#777"
      }
    },
    hud: {
      panel: "#16213e",
      textPrimary: "#FFFFFF",
      coins: "#FFD700",
      shards: "#FF8C1A",
      cores: "#FF4D4D",
      whiteCoins: "#1E90FF",
      questTokens: "#FF6B6B",
      bonusText: "#6BC2FF"
    },
    rewards: {
      achievement: "#6BC2FF",
      expGain: "#c951f8",
      coins: "#FFD700",
      shards: "#FF8C1A",
      cores: "#FF4D4D",
      whiteCoins: "#1E90FF",
      totalBonus: "#6BC2FF",
      questSummary: "#FF9B6A",
      questSummaryOverflow: "#D2DEF0",
      questTokenGain: "#FF6B6B",
      eventTokenGain: "#6BC2FF",
      saveNotice: "#7CE89A"
    },
    coinRain: {
      bucket: "#8B4513",
      itemCoins: "#FFD700",
      itemReward: "#FF00FF",
      timerText: "#FFFFFF",
      countdownText: "#FFFFFF"
    },
    overlay: {
      backdrop: "rgba(0, 0, 0, 0.72)",
      panel: "#111f34",
      panelBorder: "#3a5273",
      titleText: "#dbe8ff",
      starsText: "#ffd966",
      unlockedStateText: "#dbe8ff",
      statusUnlocked: "#7fe38e",
      statusLocked: "#ff8c8c",
      bodyText: "#f5f8ff",
      questTokenText: "#ffd2a8",
      questBonusText: "#9be8a9",
      questRowBackground: "#1a2d4a",
      questRowBorder: "#2f4f79",
      questRankText: "#f4ca64",
      questProgressReadyText: "#9be8a9",
      questProgressPendingText: "#dbe8ff",
      optionsTitleText: "#dbe8ff",
      optionsCheckboxCheckmark: "#dbe8ff",
      optionsDropdownBackground: "#2b3f60",
      optionsDropdownBorder: "#4d678f"
    }
  });
  var CSS_COLOR_VARIABLES = Object.freeze({
    "--app-bg-color": COLORS.app.background,
    "--canvas-border-color": COLORS.app.canvasBorder,
    "--canvas-shadow-color": COLORS.app.canvasShadow
  });

  // src/features/save-slots/interactions.ts
  function bindSaveSlotClicks(container, onSelect) {
    container.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-slot-index]");
      if (!button) return;
      const slotIndex = Number(button.dataset.slotIndex);
      if (Number.isInteger(slotIndex)) onSelect(slotIndex);
    });
  }

  // src/features/save-slots/render.ts
  function renderSaveSlots(container, viewModel) {
    container.replaceChildren(
      ...viewModel.slots.map((slot) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "slot-button";
        button.dataset.slotIndex = String(slot.slot_index);
        button.dataset.current = String(slot.is_current || slot.slot_index === viewModel.activeSlot);
        const title = document.createElement("span");
        title.textContent = `File ${slot.slot_index + 1}`;
        const level = document.createElement("strong");
        level.textContent = slot.has_data ? `Level ${slot.level}` : "Empty";
        const rewards = document.createElement("small");
        rewards.textContent = `Rewards ${slot.rewards_claimed}`;
        button.append(title, level, rewards);
        return button;
      })
    );
  }

  // src/features/save-slots/view-model.ts
  function createSaveSlotsViewModel(snapshot, slots) {
    const activeSlot = snapshot?.active_save_slot ?? 0;
    if (slots.length > 0) {
      return { activeSlot, slots };
    }
    return {
      activeSlot,
      slots: [0, 1, 2, 3].map((slotIndex) => ({
        slot_index: slotIndex,
        file_index: slotIndex,
        is_current: slotIndex === activeSlot,
        has_data: slotIndex === activeSlot,
        level: snapshot?.state.level ?? 1,
        rewards_claimed: snapshot?.state.progress_bar.rewards_claimed ?? 0,
        saved_at: snapshot?.save_slot.saved_at ?? null
      }))
    };
  }

  // src/net/game-channel.ts
  var heartbeatIntervalMs = 25e3;
  var commandQueueLimit = 10;
  var GameChannel = class {
    constructor(token, cachedSaveSlots = []) {
      this.token = token;
      this.cachedSaveSlots = cachedSaveSlots;
      __publicField(this, "socket", null);
      __publicField(this, "ref", 0);
      __publicField(this, "joinRef", null);
      __publicField(this, "waiters", /* @__PURE__ */ new Map());
      __publicField(this, "heartbeatId", 0);
      __publicField(this, "commandQueue", Array(commandQueueLimit).fill(false));
    }
    connect() {
      const params = new URLSearchParams({ vsn: "2.0.0" });
      if (this.token) params.set("anonymous_player_token", this.token);
      if (this.cachedSaveSlots.length > 0) params.set("cached_save_slots", this.cachedSaveSlots.join(","));
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      this.socket = new WebSocket(`${scheme}://${window.location.host}/socket/websocket?${params}`);
      return new Promise((resolve, reject) => {
        if (!this.socket) return reject(new Error("Socket unavailable"));
        this.socket.addEventListener("open", () => {
          this.startHeartbeat();
          this.join().then(resolve, reject);
        });
        this.socket.addEventListener("message", (event) => this.handleMessage(event));
        this.socket.addEventListener("error", () => reject(new Error("Socket error")));
        this.socket.addEventListener("close", () => this.stopHeartbeat());
      });
    }
    push(event, payload = {}) {
      return this.send("game", event, payload);
    }
    pushCommand(event, payload = {}) {
      const commandId = this.reserveCommandId();
      return this.send("game", event, { ...payload, command_id: commandId }).then(
        (response) => {
          this.trackCommandResult(response);
          return response;
        },
        (error) => {
          this.forgetCommand(commandId);
          throw error;
        }
      );
    }
    async ackCommand(commandId) {
      const ack = await this.send("game", "command.ack", commandId);
      this.forgetCommand(commandId);
      if (ack.released_result) this.trackCommandResult(ack.released_result);
      return ack;
    }
    close() {
      this.stopHeartbeat();
      this.socket?.close();
      this.socket = null;
    }
    join() {
      this.joinRef = this.nextRef();
      return this.send("game", "phx_join", {}, this.joinRef);
    }
    send(topic, event, payload, joinRef = this.joinRef) {
      const ref = this.nextRef();
      const message = [joinRef, ref, topic, event, payload];
      return new Promise((resolve, reject) => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
          reject(new Error("Channel is not connected"));
          return;
        }
        this.waiters.set(ref, { resolve, reject });
        this.socket.send(JSON.stringify(message));
      });
    }
    handleMessage(event) {
      const message = JSON.parse(event.data);
      const [_joinRef, ref, _topic, eventName, payload] = message;
      if (eventName !== "phx_reply" || !ref) return;
      const waiter = this.waiters.get(ref);
      if (!waiter) return;
      this.waiters.delete(ref);
      const reply = payload;
      if (reply.status === "ok") {
        waiter.resolve(reply.response);
      } else {
        waiter.reject(new Error("Channel command failed"));
      }
    }
    nextRef() {
      this.ref += 1;
      return String(this.ref);
    }
    reserveCommandId() {
      const commandId = this.commandQueue.findIndex((waitingForResult) => waitingForResult === false);
      if (commandId < 0) throw new Error("Command queue is full");
      this.commandQueue[commandId] = true;
      return commandId;
    }
    trackCommandResult(result) {
      if (!("command_id" in result)) return;
      if (result.command_id < 0 || result.command_id >= commandQueueLimit) return;
      this.commandQueue[result.command_id] = result.type === "command.queued";
    }
    forgetCommand(commandId) {
      if (commandId < 0 || commandId >= commandQueueLimit) return;
      this.commandQueue[commandId] = false;
    }
    clearCommandQueue() {
      this.commandQueue.fill(false);
    }
    startHeartbeat() {
      this.stopHeartbeat();
      this.heartbeatId = window.setInterval(() => {
        this.send("phoenix", "heartbeat", {}).catch(() => {
        });
      }, heartbeatIntervalMs);
    }
    stopHeartbeat() {
      if (this.heartbeatId) window.clearInterval(this.heartbeatId);
      this.heartbeatId = 0;
    }
  };

  // src/net/commands.ts
  function sendNoop(channel2) {
    return channel2.pushCommand("game.noop");
  }
  function listSaveSlots(channel2) {
    return channel2.pushCommand("save_slots.list");
  }
  function switchSaveSlot(channel2, slotIndex, hasCachedSnapshot) {
    return channel2.pushCommand("save_slot.switch", {
      slot_index: slotIndex,
      has_cached_snapshot: hasCachedSnapshot
    });
  }
  function resetSaveSlot(channel2) {
    return channel2.pushCommand("save_slot.reset");
  }
  function progressClaimIn(channel2) {
    return channel2.pushCommand("progress.claim_in");
  }
  function progressClaimReward(channel2) {
    return channel2.pushCommand("progress.claim_reward");
  }
  async function ackAppliedResult(channel2, commandId) {
    const ack = await channel2.ackCommand(commandId);
    return ack.released_result;
  }

  // src/net/protocol.ts
  function isAckableCommandResult(result) {
    return result.type === "game.noop.result" || result.type === "save_slots.list.result" || result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result" || result.type === "progress.claim_in.result" || result.type === "progress.claim_reward.result" || result.type === "command.error";
  }

  // src/net/snapshots.ts
  function createServerState() {
    return {
      snapshot: null,
      slots: [],
      status: "Connecting...",
      statusTone: "",
      loadingMessage: null
    };
  }
  function applyResult(state, result) {
    const snapshot = snapshotFromResult(result);
    if (snapshot) {
      state.snapshot = snapshot;
    }
    if ("slots" in result) {
      state.slots = result.slots;
    } else if (snapshot) {
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
  function snapshotFromResult(result) {
    if (result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result") {
      return result.snapshot ?? null;
    }
    return null;
  }
  function upsertSlot(slots, slot) {
    const next = slots.filter((candidate) => candidate.slot_index !== slot.slot_index);
    next.push(slot);
    return next.sort((a, b) => a.slot_index - b.slot_index);
  }
  function statusForResult(result) {
    if (result.status === "error") return result.reason || "Command rejected";
    if (result.type === "command.queued") return "Queued";
    if (result.type === "game.noop.result") return "Synced";
    if (result.type === "save_slots.list.result") return "Save files";
    if (result.type === "save_slot.switch.result") return "Save file loaded";
    if (result.type === "save_slot.reset.result") return "Save file reset";
    return "Ready";
  }

  // src/net/snapshot-cache.ts
  var slotCount = 4;
  var SnapshotCache = class {
    constructor(token) {
      this.token = token;
    }
    cachedSlotIndexes() {
      if (!this.token) return [];
      const indexes = [];
      for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
        if (this.load(slotIndex)) {
          indexes.push(slotIndex);
        }
      }
      return indexes;
    }
    load(slotIndex) {
      if (!this.token) return null;
      try {
        const encoded = window.localStorage.getItem(this.key(slotIndex));
        if (!encoded) return null;
        const snapshot = JSON.parse(encoded);
        if (!isUsableSnapshot(snapshot, slotIndex)) {
          window.localStorage.removeItem(this.key(slotIndex));
          return null;
        }
        return snapshot;
      } catch {
        return null;
      }
    }
    save(snapshot) {
      if (!this.token) return;
      window.localStorage.setItem(this.key(snapshot.active_save_slot), JSON.stringify(snapshot));
    }
    key(slotIndex) {
      return `incrementalist.snapshot.${this.token}.${slotIndex}`;
    }
  };
  function isUsableSnapshot(snapshot, slotIndex) {
    if (!snapshot || snapshot.type !== "game.snapshot") return false;
    if (snapshot.active_save_slot !== slotIndex) return false;
    if (!snapshot.state || typeof snapshot.state !== "object") return false;
    if (typeof snapshot.state.level !== "number") return false;
    if (typeof snapshot.state.idle_mode !== "boolean") return false;
    if (!("first_played_at" in snapshot.state)) return false;
    return true;
  }

  // src/ui/components/button.ts
  function setButtonBusy(button, busy2) {
    button.disabled = busy2;
    button.setAttribute("aria-busy", String(busy2));
  }

  // src/features/progress/view-model.ts
  var currentViewModel = {
    state: "projecting",
    projectedFill: 0,
    sisu: 1,
    rewardMultiplier: 1,
    level: 1,
    firstPlayedAtMs: 0,
    idleMode: false,
    canClaimInMs: null,
    nextVerifyAtMs: 0,
    pendingClaimIntent: false
  };
  function updateProjectedFill(deltaTimeMs) {
    if (currentViewModel.state !== "projecting" && currentViewModel.state !== "awaiting_server_confirmation") {
      return;
    }
    if (currentViewModel.state === "awaiting_server_confirmation") {
      if (currentViewModel.canClaimInMs !== null) {
        currentViewModel.canClaimInMs -= deltaTimeMs;
        if (currentViewModel.canClaimInMs <= 0) {
          currentViewModel.canClaimInMs = null;
          currentViewModel.nextVerifyAtMs = Date.now();
          currentViewModel.projectedFill = 100;
        }
        return;
      }
      return;
    }
    if (currentViewModel.canClaimInMs !== null) {
      const before = currentViewModel.canClaimInMs;
      currentViewModel.canClaimInMs = Math.max(0, before - deltaTimeMs);
      const duration = getCycleDurationMs();
      const completed = Math.max(0, duration - currentViewModel.canClaimInMs);
      currentViewModel.projectedFill = Math.min(100, completed / duration * 100);
      if (currentViewModel.canClaimInMs <= 0) {
        currentViewModel.state = "confirmed_collectible";
        currentViewModel.canClaimInMs = 0;
        currentViewModel.nextVerifyAtMs = 0;
        currentViewModel.projectedFill = 100;
      }
    }
  }
  function getStateFromSnapshot(snapshot) {
    currentViewModel.state = "awaiting_server_confirmation";
    currentViewModel.projectedFill = 0;
    currentViewModel.sisu = snapshot.state.progress_bar.sisu;
    currentViewModel.rewardMultiplier = snapshot.state.progress_bar.reward_multiplier;
    currentViewModel.level = snapshot.state.level;
    currentViewModel.firstPlayedAtMs = parseTimestamp(snapshot.state.first_played_at, snapshot.server_time);
    currentViewModel.idleMode = snapshot.state.idle_mode;
    currentViewModel.canClaimInMs = null;
    currentViewModel.nextVerifyAtMs = 0;
    currentViewModel.pendingClaimIntent = false;
  }
  function handleClaimInResult(result) {
    if (result.can_claim_in <= 100) {
      currentViewModel.state = "confirmed_collectible";
      currentViewModel.canClaimInMs = 0;
      currentViewModel.projectedFill = 100;
      currentViewModel.nextVerifyAtMs = 0;
    } else {
      const duration = getCycleDurationMsFromRate(Date.now());
      if (currentViewModel.projectedFill <= 1e-3) {
        const cycleDurationMs2 = Math.max(1, result.can_claim_in);
        setCycleDurationMs(cycleDurationMs2);
        currentViewModel.canClaimInMs = cycleDurationMs2;
        currentViewModel.state = "projecting";
        currentViewModel.projectedFill = 0;
        currentViewModel.nextVerifyAtMs = 0;
        return;
      }
      currentViewModel.canClaimInMs = result.can_claim_in;
      setCycleDurationMs(Math.max(duration, currentViewModel.canClaimInMs));
      currentViewModel.state = "awaiting_server_confirmation";
      currentViewModel.nextVerifyAtMs = Date.now() + result.can_claim_in;
      currentViewModel.projectedFill = 100;
    }
  }
  function handleClaimRewardResult() {
    currentViewModel.state = "awaiting_server_confirmation";
    currentViewModel.projectedFill = 0;
    currentViewModel.canClaimInMs = null;
    currentViewModel.nextVerifyAtMs = 0;
    currentViewModel.pendingClaimIntent = false;
  }
  function beginAsyncClaimResolution() {
    currentViewModel.state = "awaiting_server_confirmation";
    currentViewModel.projectedFill = 0;
    currentViewModel.canClaimInMs = null;
    currentViewModel.nextVerifyAtMs = Number.MAX_SAFE_INTEGER;
    currentViewModel.pendingClaimIntent = true;
  }
  function handleClaimNotReadyError(canClaimInMs = null) {
    currentViewModel.state = "awaiting_server_confirmation";
    currentViewModel.projectedFill = 0;
    currentViewModel.canClaimInMs = null;
    const delay = canClaimInMs && canClaimInMs > 0 ? canClaimInMs : 110;
    currentViewModel.nextVerifyAtMs = Date.now() + delay;
  }
  function getViewModel() {
    return currentViewModel;
  }
  function shouldSendClaimIn(nowMs) {
    if (currentViewModel.pendingClaimIntent) return false;
    if (currentViewModel.state !== "awaiting_server_confirmation") return false;
    if (currentViewModel.canClaimInMs !== null) return false;
    if (nowMs < currentViewModel.nextVerifyAtMs) return false;
    currentViewModel.nextVerifyAtMs = nowMs + 110;
    return true;
  }
  function setPendingClaimIntent(value) {
    currentViewModel.pendingClaimIntent = value;
  }
  function hasPendingClaimIntent() {
    return currentViewModel.pendingClaimIntent;
  }
  function getProgressBarFillRate(viewModel, nowMs) {
    const sisuMultiplier = Math.max(1, Number(viewModel.sisu) || 1);
    const baseRate = (viewModel.idleMode ? BASE_IDLE_MODE_ON_FILL_RATE : BASE_IDLE_MODE_OFF_FILL_RATE) * sisuMultiplier;
    if (viewModel.idleMode) {
      return baseRate;
    }
    const gameAgeMs = nowMs - viewModel.firstPlayedAtMs;
    if (gameAgeMs < NEW_PLAYER_BONUS_WINDOW_MS) {
      return baseRate * NEW_PLAYER_BONUS_FILL_MULTIPLIER + NEW_PLAYER_BONUS_FILL_BONUS;
    }
    if (viewModel.level < 35) {
      return baseRate * LATE_NEW_PLAYER_BONUS_FILL_MULTIPLIER;
    }
    return baseRate;
  }
  function parseTimestamp(value, serverTime) {
    if (!value) return conservativeFallbackFirstPlayedAt(serverTime);
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return conservativeFallbackFirstPlayedAt(serverTime);
    return parsed;
  }
  function conservativeFallbackFirstPlayedAt(serverTime) {
    const parsedServerTime = serverTime ? Date.parse(serverTime) : Number.NaN;
    const safeNow = Number.isFinite(parsedServerTime) ? parsedServerTime : Date.now();
    return safeNow - NEW_PLAYER_BONUS_WINDOW_MS;
  }
  var DEFAULT_CYCLE_DURATION_MS = 1e4;
  var cycleDurationMs = DEFAULT_CYCLE_DURATION_MS;
  function getCycleDurationMs() {
    return cycleDurationMs;
  }
  function setCycleDurationMs(value) {
    cycleDurationMs = Math.max(1, Math.floor(value));
  }
  function getCycleDurationMsFromRate(nowMs) {
    const rate = getProgressBarFillRate(currentViewModel, nowMs);
    if (rate <= 0) return DEFAULT_CYCLE_DURATION_MS;
    return Math.max(1, Math.floor(100 * 1e3 / rate));
  }

  // src/features/progress/interactions.ts
  function handleProgressLoop(channel2) {
    void channel2;
    return shouldSendClaimIn(Date.now());
  }
  function tryClaimReward(channel2) {
    const vm = getViewModel();
    if (vm.state === "confirmed_collectible") {
      return true;
    }
    return false;
  }

  // src/format.ts
  function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function formatNumber(value, fallback = 0) {
    const number = toFiniteNumber(value, fallback);
    const sign = number < 0 ? "-" : "";
    const absolute = Math.abs(number);
    if (absolute < 1e3) {
      return `${sign}${Math.floor(absolute)}`;
    }
    const tier = Math.floor(Math.log10(absolute) / 3);
    const suffix = getSuffix(tier);
    const scaled = absolute / 10 ** (tier * 3);
    return `${sign}${Math.round(scaled * 1e3) / 1e3}${suffix}`;
  }
  function getSuffix(tier) {
    const base = [
      "",
      "K",
      "M",
      "B",
      "T",
      "Qa",
      "Qi",
      "Sx",
      "Sp",
      "Oc",
      "No",
      "Dc"
    ];
    if (tier < base.length) return base[tier];
    const ones = ["", "U", "D", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
    const tens = ["", "Dc", "Vg", "Tg", "Qag", "Qig", "Sxg", "Spg", "Ocg", "Nog"];
    const n = tier - 10;
    const one = n % 10;
    const ten = Math.floor(n / 10);
    return ten < tens.length ? `${ones[one]}${tens[ten]}` : `e${tier * 3}`;
  }
  function formatSignedNumber(value) {
    return `+${formatNumber(value)}`;
  }
  function formatPercent(value, decimals = 2, fallback = 0) {
    return `${toFiniteNumber(value, fallback).toFixed(decimals)}%`;
  }

  // src/utils.ts
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function lerpColor(c1, c2, t) {
    return [
      Math.floor(lerp(c1[0], c2[0], t)),
      Math.floor(lerp(c1[1], c2[1], t)),
      Math.floor(lerp(c1[2], c2[2], t))
    ];
  }

  // src/render/webgl-effects.ts
  var MAX_GPU_PARTICLES = 4096;
  var MAX_GPU_LIQUID_BUBBLES = 96;
  var MAX_GPU_LASER_RECTS = 384;
  var PARTICLE_FLOATS = 7;
  var BUBBLE_FLOATS = 4;
  var LASER_RECT_FLOATS = 12;
  var LASER_RECT_VERTICES = 6;
  var LASER_RECT_LOCAL_POINTS = Object.freeze([
    -1,
    -1,
    1,
    -1,
    -1,
    1,
    -1,
    1,
    1,
    -1,
    1,
    1
  ]);
  var TWO_PI = Math.PI * 2;
  var DEFAULT_CLICK_COLORS = Object.freeze([
    COLORS.rewards.coins,
    COLORS.rewards.shards,
    COLORS.rewards.cores,
    COLORS.rewards.achievement,
    COLORS.rewards.questSummary
  ]);
  var VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute vec4 a_color;

  uniform vec2 u_resolution;

  varying vec4 v_color;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    gl_PointSize = a_size;
    v_color = a_color;
  }
`;
  var FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying vec4 v_color;

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float distanceFromCenter = length(point);

    float core = smoothstep(0.32, 0.0, distanceFromCenter);
    float halo = smoothstep(0.86, 0.12, distanceFromCenter);
    float outerGlow = smoothstep(1.0, 0.35, distanceFromCenter);
    float alpha = (core * 0.95 + halo * 0.52 + outerGlow * 0.2) * v_color.a;
    vec3 color = v_color.rgb * (1.35 + core * 0.95);

    gl_FragColor = vec4(color, alpha);
  }
`;
  var BUBBLE_VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute float a_alpha;

  uniform vec2 u_resolution;

  varying float v_alpha;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    gl_PointSize = a_size;
    v_alpha = a_alpha;
  }
`;
  var BUBBLE_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying float v_alpha;

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float distanceFromCenter = length(point);

    if (distanceFromCenter > 1.0) {
      discard;
    }

    float shell = smoothstep(1.0, 0.7, distanceFromCenter) * smoothstep(0.42, 0.72, distanceFromCenter);
    float softFill = smoothstep(0.96, 0.0, distanceFromCenter) * 0.18;
    float innerShine = smoothstep(0.82, 0.08, distanceFromCenter) * 0.12;
    float highlight = smoothstep(0.25, 0.0, length(point - vec2(-0.34, -0.38))) * 0.95;
    float alpha = (shell * 1.34 + softFill + innerShine + highlight) * v_alpha;

    gl_FragColor = vec4(vec3(1.0), alpha);
  }
`;
  var GLOW_VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;

  uniform vec2 u_resolution;

  varying vec2 v_position;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    v_position = a_position;
  }
`;
  var GLOW_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  uniform vec4 u_rect;
  uniform vec3 u_color;
  uniform float u_intensity;
  uniform float u_radius;

  varying vec2 v_position;

  void main() {
    vec2 rectMin = u_rect.xy;
    vec2 rectMax = u_rect.xy + u_rect.zw;
    vec2 outsideDelta = max(max(rectMin - v_position, v_position - rectMax), vec2(0.0));
    float outsideDistance = length(outsideDelta);
    float outsideGlow = 1.0 - smoothstep(0.0, u_radius * 1.55, outsideDistance);

    float insideEdge = min(
      min(v_position.x - rectMin.x, rectMax.x - v_position.x),
      min(v_position.y - rectMin.y, rectMax.y - v_position.y)
    );
    float insideGlow = (1.0 - smoothstep(0.0, u_radius * 0.48, insideEdge)) * step(0.0, insideEdge);
    float softBody = 1.0 - smoothstep(0.0, u_radius * 2.0, outsideDistance);
    float alpha = (outsideGlow * 0.78 + insideGlow * 0.32 + softBody * 0.12) * u_intensity;
    vec3 color = u_color * (1.15 + outsideGlow * 0.85);

    gl_FragColor = vec4(color, alpha);
  }
`;
  var LASER_RECT_VERTEX_SHADER_SOURCE = `
  attribute vec2 a_center;
  attribute vec2 a_axis;
  attribute vec2 a_perp;
  attribute vec2 a_local;
  attribute vec4 a_color;

  uniform vec2 u_resolution;

  varying vec2 v_local;
  varying vec4 v_color;

  void main() {
    vec2 position = a_center + a_axis * a_local.x + a_perp * a_local.y;
    vec2 zeroToOne = position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    v_local = a_local;
    v_color = a_color;
  }
`;
  var LASER_RECT_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying vec2 v_local;
  varying vec4 v_color;

  void main() {
    float edgeDistance = max(abs(v_local.x), abs(v_local.y));
    float edge = smoothstep(0.62, 1.0, edgeDistance);
    float body = 1.0 - smoothstep(0.0, 1.0, edgeDistance);
    float alpha = (body * 0.44 + edge * 0.74) * v_color.a;
    vec3 color = v_color.rgb * (1.18 + edge * 1.1);

    gl_FragColor = vec4(color, alpha);
  }
`;
  var WEBGL_EFFECTS = {
    canvas: null,
    gl: null,
    program: null,
    bubbleProgram: null,
    glowProgram: null,
    laserRectProgram: null,
    buffer: null,
    bubbleBuffer: null,
    glowBuffer: null,
    laserRectBuffer: null,
    particles: [],
    laserBursts: [],
    liquidBubbles: [],
    liquidBubbleSpawnAccumulator: 0,
    liquidClipRect: null,
    progressBarGlow: null,
    data: new Float32Array(MAX_GPU_PARTICLES * PARTICLE_FLOATS),
    bubbleData: new Float32Array(MAX_GPU_LIQUID_BUBBLES * BUBBLE_FLOATS),
    glowData: new Float32Array(12),
    laserRectData: new Float32Array(MAX_GPU_LASER_RECTS * LASER_RECT_VERTICES * LASER_RECT_FLOATS),
    attributes: null,
    bubbleAttributes: null,
    glowAttributes: null,
    laserRectAttributes: null,
    uniforms: null,
    bubbleUniforms: null,
    glowUniforms: null,
    laserRectUniforms: null,
    ready: false
  };
  function initWebGLEffectsLayer(canvas2, width, height) {
    if (!canvas2) {
      return false;
    }
    WEBGL_EFFECTS.canvas = canvas2;
    resizeWebGLEffectsLayer(width, height);
    const gl = canvas2.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false
    });
    if (!gl) {
      canvas2.hidden = true;
      return false;
    }
    const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    if (!program) {
      canvas2.hidden = true;
      return false;
    }
    const bubbleProgram = createProgram(gl, BUBBLE_VERTEX_SHADER_SOURCE, BUBBLE_FRAGMENT_SHADER_SOURCE);
    const glowProgram = createProgram(gl, GLOW_VERTEX_SHADER_SOURCE, GLOW_FRAGMENT_SHADER_SOURCE);
    const laserRectProgram = createProgram(gl, LASER_RECT_VERTEX_SHADER_SOURCE, LASER_RECT_FRAGMENT_SHADER_SOURCE);
    WEBGL_EFFECTS.gl = gl;
    WEBGL_EFFECTS.program = program;
    WEBGL_EFFECTS.bubbleProgram = bubbleProgram;
    WEBGL_EFFECTS.glowProgram = glowProgram;
    WEBGL_EFFECTS.laserRectProgram = laserRectProgram;
    WEBGL_EFFECTS.buffer = gl.createBuffer();
    WEBGL_EFFECTS.bubbleBuffer = gl.createBuffer();
    WEBGL_EFFECTS.glowBuffer = gl.createBuffer();
    WEBGL_EFFECTS.laserRectBuffer = gl.createBuffer();
    WEBGL_EFFECTS.attributes = {
      position: gl.getAttribLocation(program, "a_position"),
      size: gl.getAttribLocation(program, "a_size"),
      color: gl.getAttribLocation(program, "a_color")
    };
    WEBGL_EFFECTS.uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution")
    };
    WEBGL_EFFECTS.bubbleAttributes = bubbleProgram ? {
      position: gl.getAttribLocation(bubbleProgram, "a_position"),
      size: gl.getAttribLocation(bubbleProgram, "a_size"),
      alpha: gl.getAttribLocation(bubbleProgram, "a_alpha")
    } : null;
    WEBGL_EFFECTS.bubbleUniforms = bubbleProgram ? {
      resolution: gl.getUniformLocation(bubbleProgram, "u_resolution")
    } : null;
    WEBGL_EFFECTS.glowAttributes = glowProgram ? {
      position: gl.getAttribLocation(glowProgram, "a_position")
    } : null;
    WEBGL_EFFECTS.glowUniforms = glowProgram ? {
      resolution: gl.getUniformLocation(glowProgram, "u_resolution"),
      rect: gl.getUniformLocation(glowProgram, "u_rect"),
      color: gl.getUniformLocation(glowProgram, "u_color"),
      intensity: gl.getUniformLocation(glowProgram, "u_intensity"),
      radius: gl.getUniformLocation(glowProgram, "u_radius")
    } : null;
    WEBGL_EFFECTS.laserRectAttributes = laserRectProgram ? {
      center: gl.getAttribLocation(laserRectProgram, "a_center"),
      axis: gl.getAttribLocation(laserRectProgram, "a_axis"),
      perp: gl.getAttribLocation(laserRectProgram, "a_perp"),
      local: gl.getAttribLocation(laserRectProgram, "a_local"),
      color: gl.getAttribLocation(laserRectProgram, "a_color")
    } : null;
    WEBGL_EFFECTS.laserRectUniforms = laserRectProgram ? {
      resolution: gl.getUniformLocation(laserRectProgram, "u_resolution")
    } : null;
    WEBGL_EFFECTS.ready = true;
    canvas2.hidden = false;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.viewport(0, 0, canvas2.width, canvas2.height);
    return true;
  }
  function resizeWebGLEffectsLayer(width, height) {
    const canvas2 = WEBGL_EFFECTS.canvas;
    if (!canvas2) return;
    const nextWidth = Math.max(1, Math.floor(Number(width) || canvas2.width || 1));
    const nextHeight = Math.max(1, Math.floor(Number(height) || canvas2.height || 1));
    if (canvas2.width !== nextWidth) {
      canvas2.width = nextWidth;
    }
    if (canvas2.height !== nextHeight) {
      canvas2.height = nextHeight;
    }
    if (WEBGL_EFFECTS.gl) {
      WEBGL_EFFECTS.gl.viewport(0, 0, nextWidth, nextHeight);
    }
  }
  function updateWebGLEffects(deltaTime) {
    const particles = WEBGL_EFFECTS.particles;
    const laserBursts = WEBGL_EFFECTS.laserBursts;
    if (particles.length === 0 && laserBursts.length === 0) return;
    updateGpuLaserBursts(deltaTime);
    if (particles.length === 0) return;
    const deltaSeconds = deltaTime / 1e3;
    let writeIndex = 0;
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      particle.elapsedMs += deltaTime;
      if (particle.elapsedMs >= particle.lifeMs) {
        continue;
      }
      const drag = Math.pow(particle.drag, deltaTime / 16.67);
      particle.vx *= drag;
      particle.vy = particle.vy * drag + (particle.gravity || 0) * deltaSeconds;
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particles[writeIndex] = particle;
      writeIndex += 1;
    }
    particles.length = writeIndex;
  }
  function renderWebGLEffects(options = {}) {
    if (!WEBGL_EFFECTS.ready) return;
    const gl = WEBGL_EFFECTS.gl;
    const particles = WEBGL_EFFECTS.particles;
    const uniforms = WEBGL_EFFECTS.uniforms;
    const visible = options.visible !== false;
    if (!gl || !uniforms?.resolution) {
      return;
    }
    gl.viewport(0, 0, WEBGL_EFFECTS.canvas.width, WEBGL_EFFECTS.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!visible) {
      return;
    }
    renderProgressBarGlow(gl);
    renderLiquidBubbles(gl);
    renderLaserBursts(gl);
    if (particles.length === 0) {
      return;
    }
    const drawCount = Math.min(particles.length, MAX_GPU_PARTICLES);
    const data = WEBGL_EFFECTS.data;
    let offset = 0;
    for (let i = 0; i < drawCount; i += 1) {
      const particle = particles[i];
      const lifeProgress = particle.elapsedMs / particle.lifeMs;
      const alpha = particle.alpha * Math.pow(Math.max(0, 1 - lifeProgress), particle.fadePower);
      const size = particle.size * (0.86 + alpha * 0.34);
      data[offset] = particle.x;
      data[offset + 1] = particle.y;
      data[offset + 2] = size;
      data[offset + 3] = particle.r;
      data[offset + 4] = particle.g;
      data[offset + 5] = particle.b;
      data[offset + 6] = alpha;
      offset += PARTICLE_FLOATS;
    }
    gl.useProgram(WEBGL_EFFECTS.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, WEBGL_EFFECTS.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, drawCount * PARTICLE_FLOATS), gl.DYNAMIC_DRAW);
    bindParticleAttributes(gl);
    gl.uniform2f(
      uniforms.resolution,
      WEBGL_EFFECTS.canvas.width,
      WEBGL_EFFECTS.canvas.height
    );
    gl.drawArrays(gl.POINTS, 0, drawCount);
  }
  function setGpuProgressBarGlow(options = {}) {
    if (!WEBGL_EFFECTS.ready || !WEBGL_EFFECTS.glowProgram) {
      return false;
    }
    if (!options.active) {
      WEBGL_EFFECTS.progressBarGlow = null;
      return true;
    }
    const color = normalizeColor(options.color || [255, 255, 255]);
    WEBGL_EFFECTS.progressBarGlow = {
      x: Number(options.x) || 0,
      y: Number(options.y) || 0,
      width: Math.max(0, Number(options.width) || 0),
      height: Math.max(0, Number(options.height) || 0),
      radius: Math.max(1, Number(options.radius) || 34),
      intensity: Math.min(Math.max(Number(options.intensity) || 0, 0), 1.4),
      color
    };
    return true;
  }
  function spawnGpuProgressCompletionBurst(barX, barY, barWidth, barHeight, colors, options = {}) {
    if (!WEBGL_EFFECTS.ready) {
      return false;
    }
    const countMultiplier = Math.max(1, Number(options.countMultiplier) || 1);
    const gravity = Math.max(0, Number(options.gravity) || 0);
    const lifeMultiplier = Math.max(1, Number(options.lifeMultiplier) || 1);
    const centerX = barX + barWidth / 2;
    const centerY = barY + barHeight / 2;
    for (let i = 0; i < Math.round(54 * countMultiplier); i += 1) {
      const originX = barX + Math.random() * barWidth;
      const originY = barY + Math.random() * barHeight;
      const outwardAngle = Math.atan2(originY - centerY, originX - centerX);
      const angle = outwardAngle + (Math.random() - 0.5) * 0.95;
      const speed = 55 + Math.random() * 155;
      const color = normalizeColor(colors[Math.floor(Math.random() * colors.length)]);
      pushGpuParticle({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.94 + Math.random() * 0.03,
        size: 16 + Math.random() * 18,
        color,
        alpha: 0.96,
        fadePower: 1.2,
        gravity,
        lifeMs: (680 + Math.random() * 620) * lifeMultiplier
      });
    }
    for (let i = 0; i < Math.round(18 * countMultiplier); i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 90 + Math.random() * 165;
      const color = normalizeColor(colors[Math.floor(Math.random() * colors.length)]);
      pushGpuParticle({
        x: barX + Math.random() * barWidth,
        y: barY + Math.random() * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.93 + Math.random() * 0.03,
        size: 14 + Math.random() * 15,
        color,
        alpha: 0.96,
        fadePower: 1.18,
        gravity,
        lifeMs: (640 + Math.random() * 540) * lifeMultiplier
      });
    }
    trimGpuParticles();
    return true;
  }
  function spawnGpuProgressCollectionLaserBurst(barX, barY, barWidth, barHeight, colors) {
    if (!WEBGL_EFFECTS.ready || !WEBGL_EFFECTS.laserRectProgram) {
      return false;
    }
    const colorList = Array.isArray(colors) && colors.length > 0 ? colors : [[255, 255, 255]];
    const centerX = Number(barX) + Number(barWidth) / 2;
    const centerY = Number(barY) + Number(barHeight) / 2;
    const burstHeight = Math.max(1, Number(barHeight) || 1);
    const burstWidth = Math.max(1, Number(barWidth) || 1);
    pushGpuLaserRect({
      originX: centerX,
      originY: centerY,
      angle: -Math.PI / 2,
      baseLength: burstHeight,
      growLength: burstHeight * 0.28,
      baseThickness: burstWidth,
      growThickness: burstWidth * 4.64,
      travel: 0,
      color: normalizeColor(colorList[0]),
      alpha: 0.24,
      growDurationScale: 2.2,
      lifeMs: 882
    });
    trimGpuLaserBursts();
    return true;
  }
  function renderLiquidBubbles(gl) {
    const bubbles = WEBGL_EFFECTS.liquidBubbles;
    const clipRect = WEBGL_EFFECTS.liquidClipRect;
    const bubbleUniforms = WEBGL_EFFECTS.bubbleUniforms;
    if (!WEBGL_EFFECTS.bubbleProgram || !bubbleUniforms?.resolution || !clipRect || bubbles.length === 0 || clipRect.width <= 0 || clipRect.height <= 0) {
      return;
    }
    const drawCount = Math.min(bubbles.length, MAX_GPU_LIQUID_BUBBLES);
    const data = WEBGL_EFFECTS.bubbleData;
    let offset = 0;
    for (let i = 0; i < drawCount; i += 1) {
      const bubble = bubbles[i];
      const bottomFade = Math.min(Math.max((clipRect.y + clipRect.height - bubble.y + bubble.radius * 2) / Math.max(1, bubble.radius * 8), 0), 1);
      const topFade = Math.min(Math.max((bubble.y - clipRect.y) / Math.max(1, bubble.radius * 8), 0), 1);
      const shimmer = 0.9 + Math.sin(bubble.ageMs / 1e3 * 2.1 + bubble.phase) * 0.08;
      const alpha = bubble.alpha * Math.min(bottomFade, topFade) * shimmer;
      data[offset] = bubble.x;
      data[offset + 1] = bubble.y;
      data[offset + 2] = bubble.radius * 3.2;
      data[offset + 3] = alpha;
      offset += BUBBLE_FLOATS;
    }
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      Math.floor(clipRect.x),
      Math.floor(WEBGL_EFFECTS.canvas.height - clipRect.y - clipRect.height),
      Math.ceil(clipRect.width),
      Math.ceil(clipRect.height)
    );
    gl.useProgram(WEBGL_EFFECTS.bubbleProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, WEBGL_EFFECTS.bubbleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, drawCount * BUBBLE_FLOATS), gl.DYNAMIC_DRAW);
    bindBubbleAttributes(gl);
    gl.uniform2f(
      bubbleUniforms.resolution,
      WEBGL_EFFECTS.canvas.width,
      WEBGL_EFFECTS.canvas.height
    );
    gl.drawArrays(gl.POINTS, 0, drawCount);
    gl.disable(gl.SCISSOR_TEST);
  }
  function renderProgressBarGlow(gl) {
    const glow = WEBGL_EFFECTS.progressBarGlow;
    const glowUniforms = WEBGL_EFFECTS.glowUniforms;
    const glowAttributes = WEBGL_EFFECTS.glowAttributes;
    if (!WEBGL_EFFECTS.glowProgram || !glowUniforms?.resolution || !glowUniforms.rect || !glowUniforms.color || !glowUniforms.intensity || !glowUniforms.radius || glowAttributes?.position == null || !glow || glow.width <= 0 || glow.height <= 0 || glow.intensity <= 0) {
      return;
    }
    const radius = glow.radius;
    const drawPadding = radius * 2.1 + 2;
    const x1 = glow.x - drawPadding;
    const y1 = glow.y - drawPadding;
    const x2 = glow.x + glow.width + drawPadding;
    const y2 = glow.y + glow.height + drawPadding;
    const data = WEBGL_EFFECTS.glowData;
    data[0] = x1;
    data[1] = y1;
    data[2] = x2;
    data[3] = y1;
    data[4] = x1;
    data[5] = y2;
    data[6] = x1;
    data[7] = y2;
    data[8] = x2;
    data[9] = y1;
    data[10] = x2;
    data[11] = y2;
    gl.useProgram(WEBGL_EFFECTS.glowProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, WEBGL_EFFECTS.glowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(glowAttributes.position);
    gl.vertexAttribPointer(glowAttributes.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(
      glowUniforms.resolution,
      WEBGL_EFFECTS.canvas.width,
      WEBGL_EFFECTS.canvas.height
    );
    gl.uniform4f(glowUniforms.rect, glow.x, glow.y, glow.width, glow.height);
    gl.uniform3f(glowUniforms.color, glow.color[0], glow.color[1], glow.color[2]);
    gl.uniform1f(glowUniforms.intensity, glow.intensity);
    gl.uniform1f(glowUniforms.radius, radius);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function updateGpuLaserBursts(deltaTime) {
    const laserBursts = WEBGL_EFFECTS.laserBursts;
    if (laserBursts.length === 0) return;
    let writeIndex = 0;
    for (let i = 0; i < laserBursts.length; i += 1) {
      const rect = laserBursts[i];
      rect.elapsedMs += deltaTime;
      if (rect.elapsedMs >= rect.delayMs + rect.lifeMs) {
        continue;
      }
      laserBursts[writeIndex] = rect;
      writeIndex += 1;
    }
    laserBursts.length = writeIndex;
  }
  function renderLaserBursts(gl) {
    const laserBursts = WEBGL_EFFECTS.laserBursts;
    const laserRectUniforms = WEBGL_EFFECTS.laserRectUniforms;
    if (!WEBGL_EFFECTS.laserRectProgram || !laserRectUniforms?.resolution || laserBursts.length === 0) {
      return;
    }
    const data = WEBGL_EFFECTS.laserRectData;
    let offset = 0;
    let vertexCount = 0;
    for (let i = 0; i < laserBursts.length; i += 1) {
      const rect = laserBursts[i];
      const activeMs = rect.elapsedMs - rect.delayMs;
      if (activeMs <= 0) continue;
      const progress = Math.min(Math.max(activeMs / rect.lifeMs, 0), 1);
      if (progress >= 1) continue;
      const growProgress = Math.min(progress / rect.growDurationScale, 1);
      const grow = 1 - Math.pow(1 - growProgress, 3);
      const attack = Math.min(progress / 0.08, 1);
      const alpha = rect.alpha * attack * Math.pow(1 - progress, 1.48);
      if (alpha <= 4e-3) continue;
      const length = rect.baseLength + rect.growLength * grow;
      const thickness = rect.baseThickness + rect.growThickness * grow;
      const directionX = Math.cos(rect.angle);
      const directionY = Math.sin(rect.angle);
      const halfLength = Math.max(0.5, length * 0.5);
      const halfThickness = Math.max(0.5, thickness * 0.5);
      const axisX = directionX * halfLength;
      const axisY = directionY * halfLength;
      const perpX = -directionY * halfThickness;
      const perpY = directionX * halfThickness;
      const centerX = rect.originX + rect.travelX * grow;
      const centerY = rect.originY + rect.travelY * grow;
      for (let vertex = 0; vertex < LASER_RECT_VERTICES; vertex += 1) {
        if (vertexCount >= MAX_GPU_LASER_RECTS * LASER_RECT_VERTICES) {
          break;
        }
        const localOffset = vertex * 2;
        data[offset] = centerX;
        data[offset + 1] = centerY;
        data[offset + 2] = axisX;
        data[offset + 3] = axisY;
        data[offset + 4] = perpX;
        data[offset + 5] = perpY;
        data[offset + 6] = LASER_RECT_LOCAL_POINTS[localOffset];
        data[offset + 7] = LASER_RECT_LOCAL_POINTS[localOffset + 1];
        data[offset + 8] = rect.color[0];
        data[offset + 9] = rect.color[1];
        data[offset + 10] = rect.color[2];
        data[offset + 11] = alpha;
        offset += LASER_RECT_FLOATS;
        vertexCount += 1;
      }
      if (vertexCount >= MAX_GPU_LASER_RECTS * LASER_RECT_VERTICES) {
        break;
      }
    }
    if (vertexCount === 0) return;
    gl.useProgram(WEBGL_EFFECTS.laserRectProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, WEBGL_EFFECTS.laserRectBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, offset), gl.DYNAMIC_DRAW);
    bindLaserRectAttributes(gl);
    gl.uniform2f(
      laserRectUniforms.resolution,
      WEBGL_EFFECTS.canvas.width,
      WEBGL_EFFECTS.canvas.height
    );
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }
  function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) {
      return null;
    }
    const program = gl.createProgram();
    if (!program) {
      return null;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("WebGL effects program failed to link:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("WebGL effects shader failed to compile:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  function bindParticleAttributes(gl) {
    const stride = PARTICLE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
    const attributes = WEBGL_EFFECTS.attributes;
    if (!attributes) return;
    gl.enableVertexAttribArray(attributes.position);
    gl.vertexAttribPointer(attributes.position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attributes.size);
    gl.vertexAttribPointer(attributes.size, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(attributes.color);
    gl.vertexAttribPointer(attributes.color, 4, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
  }
  function bindBubbleAttributes(gl) {
    const stride = BUBBLE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
    const attributes = WEBGL_EFFECTS.bubbleAttributes;
    if (!attributes) return;
    gl.enableVertexAttribArray(attributes.position);
    gl.vertexAttribPointer(attributes.position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attributes.size);
    gl.vertexAttribPointer(attributes.size, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(attributes.alpha);
    gl.vertexAttribPointer(attributes.alpha, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
  }
  function bindLaserRectAttributes(gl) {
    const stride = LASER_RECT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
    const attributes = WEBGL_EFFECTS.laserRectAttributes;
    if (!attributes) return;
    gl.enableVertexAttribArray(attributes.center);
    gl.vertexAttribPointer(attributes.center, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attributes.axis);
    gl.vertexAttribPointer(attributes.axis, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(attributes.perp);
    gl.vertexAttribPointer(attributes.perp, 2, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(attributes.local);
    gl.vertexAttribPointer(attributes.local, 2, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(attributes.color);
    gl.vertexAttribPointer(attributes.color, 4, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT);
  }
  function pushGpuParticle(options) {
    const color = toRgbTuple(options.color);
    WEBGL_EFFECTS.particles.push({
      x: options.x,
      y: options.y,
      vx: options.vx,
      vy: options.vy,
      drag: options.drag,
      size: options.size,
      r: color[0],
      g: color[1],
      b: color[2],
      alpha: options.alpha ?? 1,
      fadePower: options.fadePower ?? 1,
      gravity: Math.max(0, Number(options.gravity) || 0),
      elapsedMs: 0,
      lifeMs: options.lifeMs
    });
  }
  function pushGpuLaserRect(options) {
    const color = toRgbTuple(options.color);
    WEBGL_EFFECTS.laserBursts.push({
      originX: Number(options.originX) || 0,
      originY: Number(options.originY) || 0,
      angle: Number(options.angle) || 0,
      baseLength: Math.max(0.5, Number(options.baseLength) || 0.5),
      growLength: Math.max(0, Number(options.growLength) || 0),
      baseThickness: Math.max(0.5, Number(options.baseThickness) || 0.5),
      growThickness: Math.max(0, Number(options.growThickness) || 0),
      travelX: Number.isFinite(Number(options.travelX)) ? Number(options.travelX) : Math.cos(Number(options.angle) || 0) * (Number(options.travel) || 0),
      travelY: Number.isFinite(Number(options.travelY)) ? Number(options.travelY) : Math.sin(Number(options.angle) || 0) * (Number(options.travel) || 0),
      color,
      alpha: Math.min(Math.max(Number(options.alpha) || 0, 0), 1.4),
      delayMs: Math.max(0, Number(options.delayMs) || 0),
      elapsedMs: 0,
      growDurationScale: Math.max(0.1, Number(options.growDurationScale) || 1),
      lifeMs: Math.max(16, Number(options.lifeMs) || 280)
    });
  }
  function trimGpuParticles() {
    const particles = WEBGL_EFFECTS.particles;
    if (particles.length <= MAX_GPU_PARTICLES) return;
    particles.splice(0, particles.length - MAX_GPU_PARTICLES);
  }
  function trimGpuLaserBursts() {
    const laserBursts = WEBGL_EFFECTS.laserBursts;
    if (laserBursts.length <= MAX_GPU_LASER_RECTS) return;
    laserBursts.splice(0, laserBursts.length - MAX_GPU_LASER_RECTS);
  }
  function normalizeColor(color) {
    if (Array.isArray(color)) {
      return [
        clampColorChannel(color[0] / 255),
        clampColorChannel(color[1] / 255),
        clampColorChannel(color[2] / 255)
      ];
    }
    if (typeof color === "string" && color.startsWith("#")) {
      const hex = color.slice(1);
      const expanded = hex.length === 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex;
      const value = Number.parseInt(expanded, 16);
      if (Number.isFinite(value)) {
        return [
          (value >> 16 & 255) / 255,
          (value >> 8 & 255) / 255,
          (value & 255) / 255
        ];
      }
    }
    return [1, 1, 1];
  }
  function toRgbTuple(color) {
    if (Array.isArray(color)) {
      return [color[0], color[1], color[2]];
    }
    if (typeof color === "string") {
      const normalized = normalizeColor(color);
      return [normalized[0] * 255, normalized[1] * 255, normalized[2] * 255];
    }
    return [1, 1, 1];
  }
  function clampColorChannel(value) {
    return Math.min(Math.max(Number(value) || 0, 0), 1);
  }

  // src/features/progress/render.ts
  var TWO_PI2 = Math.PI * 2;
  var PROGRESS_VISUAL_STATE = {
    wasFull: false,
    fullStartedAt: 0,
    lastTimestamp: 0,
    completionParticles: [],
    liquidBubbles: [],
    liquidBubbleSpawnAccumulator: 0,
    usesGpuLiquidBubbles: false,
    displayedFillRatio: 0,
    collectionGlowStartedAt: 0
  };
  var FULL_PULSE_MAX = 1.6;
  var COLLECTION_GLOW_FADE_MS = Math.PI * 165 / (BAR_FULL_PULSE_SPEED * BAR_COLLECTION_GLOW_FADE_MULTIPLIER);
  var MAX_PROGRESS_COMPLETION_PARTICLES = 512;
  var MAX_PROGRESS_LIQUID_BUBBLES = 58;
  var LIQUID_SURFACE_WAVE_HEIGHT = 2.2;
  var COMPLETION_BURST_COLORS = Object.freeze([
    COLORS.bar.progress.fillStart,
    COLORS.bar.progress.fillMid,
    COLORS.bar.progress.fillEnd,
    [255, 255, 255],
    [142, 246, 255]
  ]);
  var COLLECTION_LASER_BURST_COLORS = Object.freeze([
    COLORS.bar.progress.fillEnd,
    [255, 255, 255],
    COLORS.bar.progress.fillMid,
    [142, 246, 255],
    COLORS.bar.progress.fillStart
  ]);
  function triggerProgressBarCollectionEffect(canvas2 = null) {
    PROGRESS_VISUAL_STATE.displayedFillRatio = 1;
    PROGRESS_VISUAL_STATE.collectionGlowStartedAt = getNowMs();
    if (!canvas2) {
      return;
    }
    const {
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight
    } = getProgressBarLayout(canvas2);
    spawnGpuProgressCollectionLaserBurst(
      barX,
      barY,
      barWidth,
      barHeight,
      COLLECTION_LASER_BURST_COLORS
    );
  }
  function renderProgressBar(ctx2, canvas2) {
    if (!ctx2 || !canvas2) return;
    const state = getViewModel();
    const {
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight
    } = getProgressBarLayout(canvas2);
    const now = getNowMs();
    const deltaTime = getProgressVisualDelta(now);
    const fillValue = clampNumber(Number(state?.projectedFill) || 0, 0, 100);
    const fillRatio = fillValue / 100;
    const displayedFillRatio = updateDisplayedProgressFill(fillRatio, deltaTime);
    const displayedFillValue = displayedFillRatio * 100;
    const isFull = state?.state === "confirmed_collectible";
    const collectionPulse = getCollectionGlowPulse(now);
    if (isFull && !PROGRESS_VISUAL_STATE.wasFull) {
      PROGRESS_VISUAL_STATE.fullStartedAt = now;
      spawnProgressCompletionBurst(barX, barY, barWidth, barHeight);
    }
    if (!isFull) {
      PROGRESS_VISUAL_STATE.fullStartedAt = 0;
    }
    PROGRESS_VISUAL_STATE.wasFull = isFull;
    updateProgressCompletionParticles(deltaTime);
    ctx2.fillStyle = COLORS.bar.track;
    ctx2.fillRect(barX, barY, barWidth, barHeight);
    const fillHeight = displayedFillRatio * barHeight;
    const fillY = barY + barHeight - fillHeight;
    PROGRESS_VISUAL_STATE.usesGpuLiquidBubbles = false;
    updateProgressLiquidBubbles(deltaTime, barX, barY, barWidth, barHeight, displayedFillRatio, now);
    const pulse = isFull ? getFullPulse(now) : 1;
    const hasCollectionGlow = collectionPulse > 0;
    const collectionGlowFade = hasCollectionGlow ? clampNumber(collectionPulse / FULL_PULSE_MAX, 0, 1) : 0;
    const glowColor = hasCollectionGlow ? COLORS.bar.progress.fillEnd : getProgressColorArray(displayedFillRatio * 100);
    const gpuGlowFillY = hasCollectionGlow ? barY : fillY;
    const gpuGlowFillHeight = hasCollectionGlow ? barHeight : fillHeight;
    const gpuFillCharge = Math.pow(displayedFillRatio, 0.85);
    const gpuBaseIntensity = isFull ? 0.34 + pulse * 0.14 : gpuFillCharge * 0.08 + displayedFillRatio * 0.1;
    const gpuCollectionIntensity = hasCollectionGlow ? collectionGlowFade * 0.34 + collectionPulse * 0.14 : 0;
    const gpuBaseRadius = isFull ? 26 + pulse * 6 : 14 + displayedFillRatio * 10;
    const gpuCollectionRadius = hasCollectionGlow ? 26 + FULL_PULSE_MAX * 6 : 0;
    setGpuProgressBarGlow({
      active: hasCollectionGlow ? collectionGlowFade > 0 : displayedFillRatio > 0,
      x: barX,
      y: gpuGlowFillY,
      width: barWidth,
      height: gpuGlowFillHeight,
      color: glowColor,
      radius: Math.max(gpuBaseRadius, gpuCollectionRadius),
      intensity: hasCollectionGlow ? gpuCollectionIntensity : gpuBaseIntensity
    });
    renderLiquidProgressFill(ctx2, barX, barY, barWidth, barHeight, fillY, fillHeight, displayedFillRatio, now);
    renderProgressGlow(ctx2, barX, barY, barWidth, barHeight, displayedFillRatio, isFull, now, collectionPulse);
    if (isFull) {
      renderRisingEnergy(ctx2, barX, barY, barWidth, barHeight, now);
    }
    ctx2.save();
    if (isFull) {
      const pulse2 = getFullPulse(now);
      ctx2.shadowColor = rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0.22 * pulse2);
      ctx2.shadowBlur = 2 + 2 * pulse2;
    }
    ctx2.strokeStyle = COLORS.bar.border;
    ctx2.lineWidth = 2;
    ctx2.strokeRect(barX, barY, barWidth, barHeight);
    ctx2.restore();
    renderProgressCompletionParticles(ctx2);
    const progressPercent = Math.floor(displayedFillValue);
    ctx2.save();
    ctx2.fillStyle = getProgressColor(progressPercent);
    ctx2.font = PROGRESS_PERCENT_FONT;
    ctx2.textAlign = "center";
    ctx2.fillText(formatPercent(progressPercent, 0), barX + barWidth / 2, barY - 8);
    ctx2.restore();
    if (isFull) {
      const pulse2 = getFullPulse(now);
      ctx2.save();
      ctx2.font = IDLE_TOGGLE_FONT;
      ctx2.fillStyle = rgbaArrayToCss([255, 255, 255], 0.78 + 0.22 * pulse2);
      ctx2.shadowColor = rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0.22);
      ctx2.shadowBlur = 2;
      ctx2.textAlign = "center";
      ctx2.fillText("ACT!", barX + barWidth / 2, barY + barHeight + 16);
      ctx2.restore();
    }
  }
  function rgbArrayToCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }
  function rgbaArrayToCss(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampNumber(alpha, 0, 1)})`;
  }
  function getProgressColorArray(percent) {
    const start = COLORS.bar.progress.fillStart;
    const mid = COLORS.bar.progress.fillMid;
    const end = COLORS.bar.progress.fillEnd;
    const clampedPercent = clampNumber(percent, 0, 100);
    let color;
    if (clampedPercent < 50) {
      const t = clampedPercent / 50;
      color = lerpColor(start, mid, t);
    } else {
      const t = (clampedPercent - 50) / 50;
      color = lerpColor(mid, end, t);
    }
    return color;
  }
  function getProgressColor(percent) {
    const color = getProgressColorArray(percent);
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }
  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function getNowMs() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }
  function getProgressVisualDelta(now) {
    if (!PROGRESS_VISUAL_STATE.lastTimestamp) {
      PROGRESS_VISUAL_STATE.lastTimestamp = now;
      return 16.67;
    }
    const deltaTime = clampNumber(now - PROGRESS_VISUAL_STATE.lastTimestamp, 0, 80);
    PROGRESS_VISUAL_STATE.lastTimestamp = now;
    return deltaTime;
  }
  function updateDisplayedProgressFill(targetFillRatio, deltaTime) {
    const target = clampNumber(targetFillRatio, 0, 1);
    const current = clampNumber(PROGRESS_VISUAL_STATE.displayedFillRatio, 0, 1);
    if (target >= current) {
      PROGRESS_VISUAL_STATE.displayedFillRatio = target;
      return target;
    }
    const deltaSeconds = Math.max(0, deltaTime) / 1e3;
    const lerpAmount = 1 - Math.exp(-BAR_RESET_LERP_SPEED * deltaSeconds);
    const next = current + (target - current) * lerpAmount;
    PROGRESS_VISUAL_STATE.displayedFillRatio = Math.abs(next - target) < 1e-3 ? target : next;
    return PROGRESS_VISUAL_STATE.displayedFillRatio;
  }
  function getFullPulse(now, speed = BAR_FULL_PULSE_SPEED) {
    const pulseSpeed = clampNumber(Number(speed) || BAR_FULL_PULSE_SPEED, 0.1, 4);
    const elapsed = Math.max(0, now - (PROGRESS_VISUAL_STATE.fullStartedAt || now));
    return 0.55 + (Math.cos(elapsed * pulseSpeed / 165) + 1) / 2 * 1.05;
  }
  function getCollectionGlowPulse(now) {
    const startedAt = PROGRESS_VISUAL_STATE.collectionGlowStartedAt;
    if (!startedAt) {
      return 0;
    }
    const progress = clampNumber((now - startedAt) / COLLECTION_GLOW_FADE_MS, 0, 1);
    if (progress >= 1) {
      PROGRESS_VISUAL_STATE.collectionGlowStartedAt = 0;
      return 0;
    }
    return FULL_PULSE_MAX * Math.cos(progress * Math.PI * 0.5);
  }
  function renderLiquidProgressFill(ctx2, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
    if (fillHeight <= 0) return;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(barX, barY, barWidth, barHeight);
    ctx2.clip();
    ctx2.save();
    traceLiquidPath(ctx2, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
    ctx2.clip();
    const progressGradient = ctx2.createLinearGradient(0, barY, 0, barY + barHeight);
    progressGradient.addColorStop(0, rgbArrayToCss(COLORS.bar.progress.fillEnd));
    progressGradient.addColorStop(0.5, rgbArrayToCss(COLORS.bar.progress.fillMid));
    progressGradient.addColorStop(1, rgbArrayToCss(COLORS.bar.progress.fillStart));
    ctx2.fillStyle = progressGradient;
    ctx2.fillRect(barX, barY, barWidth, barHeight);
    if (!PROGRESS_VISUAL_STATE.usesGpuLiquidBubbles) {
      renderLiquidBubbles2(ctx2, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
    }
    ctx2.restore();
    renderLiquidSurfaceHighlight(ctx2, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
    ctx2.restore();
  }
  function traceLiquidPath(ctx2, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
    const bottomY = barY + barHeight;
    const step = 2;
    ctx2.beginPath();
    ctx2.moveTo(barX, bottomY);
    ctx2.lineTo(barX + barWidth, bottomY);
    for (let x = barX + barWidth; x >= barX; x -= step) {
      ctx2.lineTo(
        x,
        getLiquidSurfaceY(x, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now)
      );
    }
    ctx2.lineTo(
      barX,
      getLiquidSurfaceY(barX, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now)
    );
    ctx2.closePath();
  }
  function getLiquidSurfaceY(x, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
    const waveHeight = getLiquidWaveHeight(fillHeight, fillRatio, barHeight);
    if (waveHeight <= 0) {
      return clampNumber(fillY, barY, barY + barHeight);
    }
    const xRatio = (x - barX) / Math.max(1, barWidth);
    const primaryWave = Math.sin(xRatio * TWO_PI2 * 0.7 + now * 32e-4);
    const secondaryWave = Math.sin(xRatio * TWO_PI2 * 1.35 - now * 24e-4);
    const surfaceY = fillY + primaryWave * waveHeight + secondaryWave * waveHeight * 0.22;
    return clampNumber(surfaceY, barY, barY + barHeight);
  }
  function getLiquidWaveHeight(fillHeight, fillRatio, barHeight) {
    const topClearance = Math.max(0, (1 - fillRatio) * barHeight * 0.55);
    return Math.min(LIQUID_SURFACE_WAVE_HEIGHT, fillHeight * 0.08, topClearance);
  }
  function updateProgressLiquidBubbles(deltaTime, barX, barY, barWidth, barHeight, fillRatio, now) {
    const bubbles = PROGRESS_VISUAL_STATE.liquidBubbles;
    const fillHeight = fillRatio * barHeight;
    const fillY = barY + barHeight - fillHeight;
    if (fillRatio <= 0.02 || fillHeight < 8) {
      bubbles.length = 0;
      PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator = 0;
      return;
    }
    const deltaSeconds = deltaTime / 1e3;
    let writeIndex = 0;
    for (let i = 0; i < bubbles.length; i += 1) {
      const bubble = bubbles[i];
      bubble.ageMs += deltaTime;
      bubble.y -= bubble.speed * deltaSeconds;
      const bubbleX = getLiquidBubbleX(bubble);
      const surfaceY = getLiquidSurfaceY(
        bubbleX,
        barX,
        barY,
        barWidth,
        barHeight,
        fillY,
        fillHeight,
        fillRatio,
        now
      );
      if (bubble.y - bubble.radius <= surfaceY || bubble.y + bubble.radius < barY) {
        continue;
      }
      bubbles[writeIndex] = bubble;
      writeIndex += 1;
    }
    bubbles.length = writeIndex;
    if (fillHeight < 20) return;
    PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator += deltaTime * (3e-3 + fillRatio * 44e-4);
    while (PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator >= 1 && bubbles.length < MAX_PROGRESS_LIQUID_BUBBLES) {
      spawnProgressLiquidBubble(barX, barY, barWidth, barHeight, fillHeight, fillRatio);
      PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator -= 1;
    }
  }
  function spawnProgressLiquidBubble(barX, barY, barWidth, barHeight, fillHeight, fillRatio) {
    const radius = 0.42 + Math.random() * (0.62 + fillRatio * 0.32);
    const padding = 3 + radius;
    const availableWidth = Math.max(0, barWidth - padding * 2);
    const bottomY = barY + barHeight;
    PROGRESS_VISUAL_STATE.liquidBubbles.push({
      baseX: barX + padding + Math.random() * availableWidth,
      y: bottomY - Math.random() * Math.min(12, fillHeight * 0.22) + radius,
      radius,
      speed: 42 + Math.random() * 30,
      phase: Math.random() * TWO_PI2,
      alpha: 0.28 + Math.random() * 0.3,
      ageMs: Math.random() * 600
    });
  }
  function getLiquidBubbleX(bubble) {
    return bubble.baseX;
  }
  function renderLiquidBubbles2(ctx2, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
    const bubbles = PROGRESS_VISUAL_STATE.liquidBubbles;
    if (bubbles.length === 0) return;
    const bottomY = barY + barHeight;
    ctx2.save();
    ctx2.globalCompositeOperation = "lighter";
    for (let i = 0; i < bubbles.length; i += 1) {
      const bubble = bubbles[i];
      const x = getLiquidBubbleX(bubble);
      const surfaceY = getLiquidSurfaceY(x, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
      const surfaceFade = clampNumber((bubble.y - surfaceY) / Math.max(1, bubble.radius * 7), 0, 1);
      const bottomFade = clampNumber((bottomY - bubble.y + bubble.radius * 2) / Math.max(1, bubble.radius * 8), 0, 1);
      const wobblePulse = 0.82 + Math.sin(bubble.ageMs / 1e3 * 2.2 + bubble.phase) * 0.08;
      const alpha = bubble.alpha * Math.min(surfaceFade, bottomFade) * wobblePulse;
      if (alpha <= 0.01) continue;
      ctx2.fillStyle = rgbaArrayToCss([255, 255, 255], alpha * 0.12);
      ctx2.strokeStyle = rgbaArrayToCss([255, 255, 255], alpha);
      ctx2.lineWidth = 0.55;
      ctx2.shadowBlur = 0;
      ctx2.beginPath();
      ctx2.arc(x, bubble.y, bubble.radius, 0, TWO_PI2);
      ctx2.fill();
      ctx2.stroke();
      ctx2.fillStyle = rgbaArrayToCss([255, 255, 255], alpha * 0.85);
      ctx2.beginPath();
      ctx2.arc(x - bubble.radius * 0.32, bubble.y - bubble.radius * 0.35, Math.max(0.18, bubble.radius * 0.18), 0, TWO_PI2);
      ctx2.fill();
    }
    ctx2.restore();
  }
  function renderLiquidSurfaceHighlight(ctx2, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
    const waveHeight = getLiquidWaveHeight(fillHeight, fillRatio, barHeight);
    const surfaceGlow = clampNumber(0.22 + fillRatio * 0.34, 0, 0.5);
    const step = 2;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(barX, barY, barWidth, barHeight);
    ctx2.clip();
    ctx2.globalCompositeOperation = "lighter";
    ctx2.lineCap = "round";
    ctx2.beginPath();
    for (let x = barX; x <= barX + barWidth; x += step) {
      const y = getLiquidSurfaceY(x, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
      if (x === barX) {
        ctx2.moveTo(x, y);
      } else {
        ctx2.lineTo(x, y);
      }
    }
    ctx2.strokeStyle = rgbaArrayToCss([255, 255, 255], surfaceGlow);
    ctx2.lineWidth = 1.5;
    ctx2.shadowColor = rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0.18);
    ctx2.shadowBlur = 1 + waveHeight * 0.4;
    ctx2.stroke();
    ctx2.restore();
  }
  function renderProgressGlow(ctx2, barX, barY, barWidth, barHeight, fillRatio, isFull, now, collectionPulse = 0) {
    if (fillRatio <= 0 && collectionPulse <= 0) return;
    const hasCollectionGlow = collectionPulse > 0;
    const collectionFade = hasCollectionGlow ? clampNumber(collectionPulse / FULL_PULSE_MAX, 0, 1) : 0;
    const glowColor = collectionPulse > 0 ? COLORS.bar.progress.fillEnd : getProgressColorArray(fillRatio * 100);
    const charge = Math.pow(fillRatio, 0.85);
    const pulse = isFull ? getFullPulse(now) : 1;
    const baseGlowPower = charge * pulse;
    const glowPower = hasCollectionGlow ? collectionPulse : baseGlowPower;
    const strokeBaseFade = hasCollectionGlow ? collectionFade : charge;
    const shadowAlpha = 0.8 * glowPower;
    const strokeAlpha = 0.12 * strokeBaseFade + 0.5 * glowPower;
    if (shadowAlpha <= 1e-3 && strokeAlpha <= 1e-3) return;
    ctx2.save();
    ctx2.globalCompositeOperation = "lighter";
    ctx2.shadowColor = rgbaArrayToCss(glowColor, shadowAlpha);
    ctx2.shadowBlur = 10 + 46 * glowPower;
    ctx2.strokeStyle = rgbaArrayToCss(glowColor, strokeAlpha);
    ctx2.lineWidth = 1 + 6 * glowPower;
    ctx2.strokeRect(barX + 0.5, barY + 0.5, barWidth - 1, barHeight - 1);
    if (isFull) {
      ctx2.shadowColor = rgbaArrayToCss([255, 255, 255], 0.5 * pulse);
      ctx2.shadowBlur = 38 + 36 * pulse;
      ctx2.strokeStyle = rgbaArrayToCss([255, 255, 255], 0.16 + 0.32 * pulse);
      ctx2.lineWidth = 2 + 3 * pulse;
      ctx2.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
    }
    ctx2.restore();
  }
  function renderRisingEnergy(ctx2, barX, barY, barWidth, barHeight, now) {
    const innerX = barX + 4;
    const innerY = barY + 3;
    const innerWidth = barWidth - 8;
    const innerHeight = barHeight - 6;
    const pulse = getFullPulse(now);
    if (innerWidth <= 0 || innerHeight <= 0) return;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(innerX, innerY, innerWidth, innerHeight);
    ctx2.clip();
    ctx2.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i += 1) {
      const phase = (now * 22e-5 + i / 3) % 1;
      const y = innerY + innerHeight - phase * innerHeight;
      const alpha = Math.sin(phase * Math.PI) * 0.2 * pulse;
      const bandGradient = ctx2.createLinearGradient(innerX, y, innerX + innerWidth, y);
      bandGradient.addColorStop(0, rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0));
      bandGradient.addColorStop(0.5, rgbaArrayToCss([255, 255, 255], alpha));
      bandGradient.addColorStop(1, rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0));
      ctx2.fillStyle = bandGradient;
      ctx2.fillRect(innerX, y, innerWidth, 2);
    }
    ctx2.restore();
  }
  function spawnProgressCompletionBurst(barX, barY, barWidth, barHeight) {
    if (spawnGpuProgressCompletionBurst(
      barX,
      barY,
      barWidth,
      barHeight,
      COMPLETION_BURST_COLORS,
      { countMultiplier: 1.5, gravity: 100 }
    )) {
      return;
    }
    const centerX = barX + barWidth / 2;
    const centerY = barY + barHeight / 2;
    for (let i = 0; i < 81; i += 1) {
      const originX = barX + Math.random() * barWidth;
      const originY = barY + Math.random() * barHeight;
      const outwardAngle = Math.atan2(originY - centerY, originX - centerX);
      const angle = outwardAngle + (Math.random() - 0.5) * 0.95;
      const speed = 90 + Math.random() * 250;
      const color = COMPLETION_BURST_COLORS[Math.floor(Math.random() * COMPLETION_BURST_COLORS.length)];
      const colorCss = rgbArrayToCss(color);
      PROGRESS_VISUAL_STATE.completionParticles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.94 + Math.random() * 0.03,
        radius: 1.4 + Math.random() * 3.2,
        lineWidth: 1.1 + Math.random() * 1.5,
        colorCss,
        elapsedMs: 0,
        lifeMs: 560 + Math.random() * 520
      });
    }
    for (let i = 0; i < 27; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 150 + Math.random() * 260;
      const color = COMPLETION_BURST_COLORS[Math.floor(Math.random() * COMPLETION_BURST_COLORS.length)];
      const colorCss = rgbArrayToCss(color);
      PROGRESS_VISUAL_STATE.completionParticles.push({
        x: barX + Math.random() * barWidth,
        y: barY + Math.random() * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.93 + Math.random() * 0.03,
        radius: 1.2 + Math.random() * 2.4,
        lineWidth: 1 + Math.random() * 1.3,
        colorCss,
        elapsedMs: 0,
        lifeMs: 520 + Math.random() * 480
      });
    }
    if (PROGRESS_VISUAL_STATE.completionParticles.length > MAX_PROGRESS_COMPLETION_PARTICLES) {
      PROGRESS_VISUAL_STATE.completionParticles.splice(
        0,
        PROGRESS_VISUAL_STATE.completionParticles.length - MAX_PROGRESS_COMPLETION_PARTICLES
      );
    }
  }
  function updateProgressCompletionParticles(deltaTime) {
    const particles = PROGRESS_VISUAL_STATE.completionParticles;
    if (particles.length === 0) return;
    const deltaSeconds = deltaTime / 1e3;
    let writeIndex = 0;
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      particle.elapsedMs += deltaTime;
      if (particle.elapsedMs >= particle.lifeMs) {
        continue;
      }
      const drag = Math.pow(particle.drag, deltaTime / 16.67);
      particle.vx *= drag;
      particle.vy *= drag;
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particles[writeIndex] = particle;
      writeIndex += 1;
    }
    particles.length = writeIndex;
  }
  function renderProgressCompletionParticles(ctx2) {
    const particles = PROGRESS_VISUAL_STATE.completionParticles;
    if (particles.length === 0) return;
    ctx2.save();
    ctx2.globalCompositeOperation = "lighter";
    ctx2.lineCap = "round";
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      const lifeProgress = particle.elapsedMs / particle.lifeMs;
      const alpha = Math.pow(Math.max(0, 1 - lifeProgress), 1.45);
      const tailScale = 0.018 + (1 - lifeProgress) * 0.034;
      ctx2.globalAlpha = alpha;
      ctx2.strokeStyle = particle.colorCss;
      ctx2.fillStyle = particle.colorCss;
      ctx2.shadowColor = particle.colorCss;
      ctx2.shadowBlur = 14 * alpha;
      ctx2.lineWidth = particle.lineWidth;
      ctx2.beginPath();
      ctx2.moveTo(particle.x, particle.y);
      ctx2.lineTo(
        particle.x - particle.vx * tailScale,
        particle.y - particle.vy * tailScale
      );
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(particle.x, particle.y, particle.radius * (0.7 + alpha * 0.4), 0, TWO_PI2);
      ctx2.fill();
    }
    ctx2.restore();
  }
  function getProgressBarLayout(canvas2) {
    const baseHeight = canvas2.height - 120;
    const barHeight = baseHeight * 0.72;
    return {
      x: canvas2.width - 92,
      y: 90,
      width: PROGRESS_BAR_WIDTH,
      height: barHeight
    };
  }

  // src/render/effects.ts
  var TWO_PI3 = Math.PI * 2;
  var CLICK_BURST_COLORS = Object.freeze([
    COLORS.rewards.coins,
    COLORS.rewards.shards,
    COLORS.rewards.cores,
    COLORS.rewards.achievement,
    COLORS.rewards.questSummary
  ]);
  var MAX_FLOATING_TEXTS = 72;
  var TEXT_SPRITE_PADDING = 14;
  var MAX_TEXT_SPRITE_CACHE = 96;
  var REWARD_POPUP_MIN_RENDER_SIZE_PX = 1;
  var textSpriteCache = /* @__PURE__ */ new Map();
  function createFloatingTextState() {
    return [];
  }
  function spawnFloatingText(floatingTexts2, text, x, y, color, options = {}) {
    if (!Array.isArray(floatingTexts2)) return;
    floatingTexts2.push({
      text: String(text ?? ""),
      x,
      y,
      startX: x,
      startY: y,
      color,
      alpha: 1,
      elapsedMs: 0,
      type: options.type || "generic",
      targetX: options.targetX ?? x,
      targetY: options.targetY ?? y,
      holdMs: options.holdMs ?? 0,
      flyMs: options.flyMs ?? 0,
      riseSpeed: options.riseSpeed ?? GENERIC_FLOAT_RISE_SPEED,
      holdRiseSpeed: options.holdRiseSpeed ?? REWARD_POPUP_HOLD_RISE_SPEED,
      lifeMs: options.lifeMs ?? GENERIC_FLOAT_LIFE_MS,
      font: options.font || REWARD_POPUP_FONT,
      textAlign: options.textAlign || "center",
      scale: options.scale ?? 1,
      minRenderSizePx: options.minRenderSizePx ?? 0,
      stackGroupId: options.stackGroupId ?? null,
      stackIndex: options.stackIndex ?? null
    });
    if (floatingTexts2.length > MAX_FLOATING_TEXTS) {
      floatingTexts2.splice(0, floatingTexts2.length - MAX_FLOATING_TEXTS);
    }
  }
  function getHudRewardTargets(canvas2) {
    const canvasWidth = canvas2?.width ?? CANVAS_WIDTH;
    return {
      exp: {
        x: TOP_HUD_EXP_COUNTER_X,
        y: TOP_HUD_EXP_COUNTER_Y
      },
      coins: { x: canvasWidth - TOP_HUD_COINS_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y },
      shards: { x: canvasWidth - TOP_HUD_SHARDS_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y },
      cores: { x: canvasWidth - TOP_HUD_CORES_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y }
    };
  }
  function spawnRewardPopup(floatingTexts2, canvas2, text, x, y, color, targetKey) {
    const targets = getHudRewardTargets(canvas2);
    const target = targets[targetKey] || targets.coins;
    spawnFloatingText(floatingTexts2, text, x, y, color, {
      type: "reward",
      targetX: target.x,
      targetY: target.y,
      holdMs: REWARD_POPUP_HOLD_MS,
      flyMs: REWARD_POPUP_FLY_MS,
      holdRiseSpeed: REWARD_POPUP_HOLD_RISE_SPEED,
      font: REWARD_POPUP_FONT,
      textAlign: "center",
      minRenderSizePx: REWARD_POPUP_MIN_RENDER_SIZE_PX
    });
  }
  function updateFloatingTexts(floatingTexts2, deltaTime) {
    if (!Array.isArray(floatingTexts2) || floatingTexts2.length === 0) return;
    const deltaSeconds = deltaTime / 1e3;
    let writeIndex = 0;
    for (let i = 0; i < floatingTexts2.length; i += 1) {
      const ft = floatingTexts2[i];
      ft.elapsedMs += deltaTime;
      if (ft.type === "reward") {
        updateRewardPopup(ft);
      } else {
        ft.y -= ft.riseSpeed * deltaSeconds;
        ft.alpha = Math.max(0, 1 - ft.elapsedMs / ft.lifeMs);
      }
      if (!shouldRemoveFloatingText(ft)) {
        floatingTexts2[writeIndex] = ft;
        writeIndex += 1;
      }
    }
    floatingTexts2.length = writeIndex;
  }
  function renderFloatingTexts(ctx2, floatingTexts2) {
    if (!Array.isArray(floatingTexts2) || floatingTexts2.length === 0) return;
    ctx2.save();
    for (let i = 0; i < floatingTexts2.length; i += 1) {
      const ft = floatingTexts2[i];
      if (ft.alpha <= 0) continue;
      const sprite = getTextSprite(ctx2, ft);
      const scale = getFloatingTextRenderScale(ft, sprite);
      if (scale <= 0) continue;
      ctx2.globalAlpha = ft.alpha;
      ctx2.drawImage(
        sprite.canvas,
        ft.x - getSpriteAnchorX(sprite, ft.textAlign) * scale,
        ft.y - sprite.anchorY * scale,
        sprite.canvas.width * scale,
        sprite.canvas.height * scale
      );
    }
    ctx2.restore();
  }
  function getTextSprite(ctx2, ft) {
    const key = `${ft.text}\0${ft.font}\0${ft.color}`;
    if (ft.spriteKey === key && ft.sprite) {
      return ft.sprite;
    }
    const cachedSprite = textSpriteCache.get(key);
    if (cachedSprite) {
      ft.spriteKey = key;
      ft.sprite = cachedSprite;
      return cachedSprite;
    }
    const sprite = createTextSprite(ctx2, ft.text, ft.font, ft.color);
    textSpriteCache.set(key, sprite);
    if (textSpriteCache.size > MAX_TEXT_SPRITE_CACHE) {
      const oldestKey = textSpriteCache.keys().next().value;
      textSpriteCache.delete(oldestKey);
    }
    ft.spriteKey = key;
    ft.sprite = sprite;
    return sprite;
  }
  function createTextSprite(ctx2, text, font, color) {
    ctx2.save();
    ctx2.font = font;
    const metrics = ctx2.measureText(text);
    ctx2.restore();
    const fontSize = parseFontSizePx(font);
    const textWidth = Math.ceil(metrics.width);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize * 0.82);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.28);
    const width = Math.max(1, textWidth + TEXT_SPRITE_PADDING * 2);
    const height = Math.max(1, ascent + descent + TEXT_SPRITE_PADDING * 2);
    const canvas2 = createSpriteCanvas(width, height);
    const spriteCtx = canvas2.getContext("2d");
    const textX = TEXT_SPRITE_PADDING;
    const textY = TEXT_SPRITE_PADDING + ascent;
    spriteCtx.font = font;
    spriteCtx.textAlign = "left";
    spriteCtx.textBaseline = "alphabetic";
    spriteCtx.lineJoin = "round";
    spriteCtx.lineWidth = 7;
    spriteCtx.strokeStyle = "#ffffff";
    spriteCtx.shadowColor = "rgba(0, 0, 0, 0.6)";
    spriteCtx.shadowBlur = 5;
    spriteCtx.shadowOffsetX = 2;
    spriteCtx.shadowOffsetY = 2;
    spriteCtx.strokeText(text, textX, textY);
    spriteCtx.shadowColor = "transparent";
    spriteCtx.shadowBlur = 0;
    spriteCtx.shadowOffsetX = 0;
    spriteCtx.shadowOffsetY = 0;
    spriteCtx.fillStyle = "rgba(0, 0, 0, 0.8)";
    spriteCtx.fillText(text, textX - 1, textY);
    spriteCtx.fillText(text, textX + 1, textY);
    spriteCtx.fillText(text, textX, textY - 1);
    spriteCtx.fillText(text, textX, textY + 1);
    spriteCtx.fillStyle = color;
    spriteCtx.fillText(text, textX, textY);
    return {
      canvas: canvas2,
      textWidth,
      anchorY: textY
    };
  }
  function createSpriteCanvas(width, height) {
    if (typeof OffscreenCanvas === "function") {
      return new OffscreenCanvas(width, height);
    }
    const canvas2 = document.createElement("canvas");
    canvas2.width = width;
    canvas2.height = height;
    return canvas2;
  }
  function getSpriteAnchorX(sprite, textAlign) {
    switch (textAlign) {
      case "center":
        return TEXT_SPRITE_PADDING + sprite.textWidth / 2;
      case "right":
      case "end":
        return TEXT_SPRITE_PADDING + sprite.textWidth;
      case "left":
      case "start":
      default:
        return TEXT_SPRITE_PADDING;
    }
  }
  function getFloatingTextRenderScale(ft, sprite) {
    const requestedScale = Number.isFinite(ft.scale) ? Math.max(0, ft.scale) : 1;
    const minRenderSizePx = Number.isFinite(ft.minRenderSizePx) ? Math.max(0, ft.minRenderSizePx) : 0;
    if (minRenderSizePx <= 0) {
      return requestedScale;
    }
    const largestSpriteDimension = Math.max(
      sprite?.canvas?.width ?? 0,
      sprite?.canvas?.height ?? 0,
      1
    );
    return Math.max(requestedScale, minRenderSizePx / largestSpriteDimension);
  }
  function parseFontSizePx(font) {
    const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
    if (!match) {
      return 16;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : 16;
  }
  function updateRewardPopup(ft) {
    const holdElapsed = Math.min(ft.elapsedMs, ft.holdMs);
    const holdDistance = ft.holdRiseSpeed * (holdElapsed / 1e3);
    const holdY = ft.startY - holdDistance;
    if (ft.elapsedMs <= ft.holdMs) {
      ft.x = ft.startX;
      ft.y = holdY;
      ft.alpha = 1;
      ft.scale = 1;
      return;
    }
    const flyElapsed = ft.elapsedMs - ft.holdMs;
    const flyProgress = ft.flyMs > 0 ? Math.min(flyElapsed / ft.flyMs, 1) : 1;
    const eased = 1 - Math.pow(1 - flyProgress, 3);
    ft.x = ft.startX + (ft.targetX - ft.startX) * eased;
    ft.y = holdY + (ft.targetY - holdY) * eased;
    ft.alpha = Math.max(0, 1 - flyProgress);
    ft.scale = Math.max(0, 1 - flyProgress);
  }
  function shouldRemoveFloatingText(ft) {
    if (ft.type === "reward") {
      return ft.elapsedMs >= ft.holdMs + ft.flyMs;
    }
    return ft.elapsedMs >= ft.lifeMs;
  }

  // src/features/progress/claim-effects.ts
  var POPUP_OFFSET = Object.freeze({
    exp: { x: -55, y: -20 },
    coins: { x: 55, y: -20 },
    shards: { x: -55, y: 12 },
    cores: { x: 55, y: 12 }
  });
  function spawnProgressClaimRewardEffects(floatingTexts2, canvas2, textMeasureContext, currentAmounts, newAmounts, anchorPoint = null) {
    const expGain = Math.max(0, Math.floor(newAmounts.exp) - Math.floor(currentAmounts.exp));
    const coinGain = Math.max(0, Math.floor(newAmounts.coins) - Math.floor(currentAmounts.coins));
    const shardGain = Math.max(0, Math.floor(newAmounts.shards) - Math.floor(currentAmounts.shards));
    const coreGain = Math.max(0, Math.floor(newAmounts.cores) - Math.floor(currentAmounts.cores));
    const expText = formatSignedNumber(expGain);
    const coinText = formatSignedNumber(coinGain);
    const shardText = formatSignedNumber(shardGain);
    const coreText = formatSignedNumber(coreGain);
    const rewardGroupEntries = [
      { text: expText, font: REWARD_POPUP_FONT, offsetX: POPUP_OFFSET.exp.x, offsetY: POPUP_OFFSET.exp.y },
      { text: coinText, font: REWARD_POPUP_FONT, offsetX: POPUP_OFFSET.coins.x, offsetY: POPUP_OFFSET.coins.y }
    ];
    if (shardGain > 0) {
      rewardGroupEntries.push({ text: shardText, font: REWARD_POPUP_FONT, offsetX: POPUP_OFFSET.shards.x, offsetY: POPUP_OFFSET.shards.y });
    }
    if (coreGain > 0) {
      rewardGroupEntries.push({ text: coreText, font: REWARD_POPUP_FONT, offsetX: POPUP_OFFSET.cores.x, offsetY: POPUP_OFFSET.cores.y });
    }
    const barLayout = getProgressBarLayout(canvas2);
    const rawAnchor = anchorPoint ?? {
      x: barLayout.x + barLayout.width / 2,
      y: barLayout.y + barLayout.height / 2
    };
    const anchor = clampRewardAnchorToCanvas(textMeasureContext, canvas2, rawAnchor, rewardGroupEntries);
    spawnRewardPopup(
      floatingTexts2,
      canvas2,
      expText,
      anchor.x + POPUP_OFFSET.exp.x,
      anchor.y + POPUP_OFFSET.exp.y,
      COLORS.rewards.expGain,
      "exp"
    );
    spawnRewardPopup(
      floatingTexts2,
      canvas2,
      coinText,
      anchor.x + POPUP_OFFSET.coins.x,
      anchor.y + POPUP_OFFSET.coins.y,
      COLORS.rewards.coins,
      "coins"
    );
    if (shardGain > 0) {
      spawnRewardPopup(
        floatingTexts2,
        canvas2,
        shardText,
        anchor.x + POPUP_OFFSET.shards.x,
        anchor.y + POPUP_OFFSET.shards.y,
        COLORS.rewards.shards,
        "shards"
      );
    }
    if (coreGain > 0) {
      spawnRewardPopup(
        floatingTexts2,
        canvas2,
        coreText,
        anchor.x + POPUP_OFFSET.cores.x,
        anchor.y + POPUP_OFFSET.cores.y,
        COLORS.rewards.cores,
        "cores"
      );
    }
  }
  function clampRewardAnchorToCanvas(textMeasureContext, canvas2, point, entries) {
    let minX = Number.NEGATIVE_INFINITY;
    let maxX = Number.POSITIVE_INFINITY;
    let minY = Number.NEGATIVE_INFINITY;
    let maxY = Number.POSITIVE_INFINITY;
    for (const entry of entries) {
      const bounds = getCenteredPopupAnchorBounds(textMeasureContext, canvas2, entry.text, entry.font, entry.offsetX, entry.offsetY);
      minX = Math.max(minX, bounds.minX);
      maxX = Math.min(maxX, bounds.maxX);
      minY = Math.max(minY, bounds.minY);
      maxY = Math.min(maxY, bounds.maxY);
    }
    if (maxX < minX) {
      minX = canvas2.width / 2;
      maxX = canvas2.width / 2;
    }
    if (maxY < minY) {
      minY = canvas2.height / 2;
      maxY = canvas2.height / 2;
    }
    return {
      x: clamp(point.x, minX, maxX),
      y: clamp(point.y, minY, maxY)
    };
  }
  function getCenteredPopupAnchorBounds(textMeasureContext, canvas2, text, font, offsetX, offsetY, margin = 8) {
    const fontSize = parseFontSizePx2(font);
    const textWidth = measureTextWidth(textMeasureContext, text, font);
    const halfWidth = textWidth / 2;
    const bottomPadding = Math.max(6, Math.round(fontSize * 0.3));
    const displayAreaRight = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH;
    const displayAreaBottom = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT;
    return {
      minX: DISPLAY_AREA_X + margin + halfWidth - offsetX,
      maxX: displayAreaRight - margin - halfWidth - offsetX,
      minY: DISPLAY_AREA_Y + margin + fontSize - offsetY,
      maxY: displayAreaBottom - margin - bottomPadding - offsetY
    };
  }
  function measureTextWidth(textMeasureContext, text, font) {
    textMeasureContext.save();
    textMeasureContext.font = font;
    const width = textMeasureContext.measureText(text).width;
    textMeasureContext.restore();
    return width;
  }
  function parseFontSizePx2(font) {
    const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
    if (!match) {
      return 16;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : 16;
  }
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // src/app.ts
  var tokenKey = "incrementalist.anonymousPlayerToken";
  var statusLine = requiredElement("#status-line");
  var levelValue = requiredElement("#level-value");
  var slotValue = requiredElement("#slot-value");
  var noopButton = requiredElement("#noop-button");
  var saveButton = requiredElement("#save-button");
  var resetButton = requiredElement("#reset-button");
  var slotList = requiredElement("#slot-list");
  var canvas = requiredElement("#game-canvas");
  var effectsCanvas = requiredElement("#effects-canvas");
  var ctx = canvas.getContext("2d");
  var serverState = createServerState();
  var channel;
  var snapshotCache;
  var busy = false;
  var claimResolutionInFlight = false;
  var floatingTexts = createFloatingTextState();
  var lastPointerPoint = null;
  var pendingClaimPopupPoint = null;
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
    slotList.querySelectorAll("button").forEach((button) => {
      setButtonBusy(button, busy);
    });
  }
  async function applyAndAck(result) {
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
    let next = await ackAppliedResult(channel, result.command_id);
    if (clearsCommandQueue(result)) channel.clearCommandQueue();
    while (next) {
      hydrateSnapshotFromCache(next);
      const previousAmounts2 = next.type === "progress.claim_reward.result" ? snapshotAmounts() : null;
      applyResult(serverState, next);
      cacheSnapshotFromResult(next);
      applyProgressResultEffects(next, previousAmounts2);
      if (next.type === "save_slot.switch.result" || next.type === "save_slot.reset.result") {
        if (serverState.snapshot) {
          getStateFromSnapshot(serverState.snapshot);
        }
      }
      renderDom();
      const applied = next;
      next = await ackAppliedResult(channel, applied.command_id);
      if (clearsCommandQueue(applied)) channel.clearCommandQueue();
    }
  }
  function snapshotAmounts() {
    const snapshot = serverState.snapshot;
    if (!snapshot) return null;
    return {
      exp: snapshot.state.exp,
      coins: snapshot.state.coins,
      shards: snapshot.state.shards,
      cores: snapshot.state.cores
    };
  }
  function applyProgressResultEffects(result, previousAmounts) {
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
  async function runCommand(command, loadingMessage = null) {
    if (busy) return null;
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
    if (serverState.snapshot) {
      getStateFromSnapshot(serverState.snapshot);
    }
    renderDom();
    if (bootResult.pending_result) {
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
  bindSaveSlotClicks(
    slotList,
    (slotIndex) => runCommand(() => switchSaveSlot(channel, slotIndex, Boolean(snapshotCache.load(slotIndex))), "Loading save file...")
  );
  function hydrateSnapshotFromCache(result) {
    if (result.type !== "save_slot.switch.result" || result.snapshot) return;
    const cachedSnapshot = snapshotCache.load(result.active_save_slot);
    if (cachedSnapshot) {
      serverState.snapshot = cachedSnapshot;
      getStateFromSnapshot(cachedSnapshot);
    }
  }
  function cacheSnapshotFromResult(result) {
    if ("snapshot" in result && result.snapshot) {
      snapshotCache.save(result.snapshot);
    }
  }
  function clearsCommandQueue(result) {
    return result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result";
  }
  function requiredElement(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Game shell is missing required element: ${selector}`);
    return element;
  }
  function claimRewardOnAnyInput(clickPoint = null) {
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
  function handleClick(event) {
    const point = getCanvasPointFromInputEvent(event, canvas);
    lastPointerPoint = point;
    claimRewardOnAnyInput(point);
  }
  function handleMouseMove(event) {
    const point = getCanvasPointFromInputEvent(event, canvas);
    lastPointerPoint = point;
    claimRewardOnAnyInput(point);
  }
  function handleKeydown(event) {
    claimRewardOnAnyInput(lastPointerPoint);
    event.preventDefault();
  }
  document.addEventListener("click", handleClick);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("keydown", handleKeydown);
  canvas.addEventListener("mouseleave", () => {
    lastPointerPoint = null;
  });
  var lastTime = performance.now();
  function gameLoop(time) {
    requestAnimationFrame(gameLoop);
    const dt = time - lastTime;
    lastTime = time;
    updateProjectedFill(dt);
    if (channel && handleProgressLoop(channel)) {
      runCommand(() => progressClaimIn(channel));
    }
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = COLORS.game.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      renderProgressBar(ctx, canvas);
    }
    updateFloatingTexts(floatingTexts, dt);
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
      let reward = await runCommand(() => progressClaimReward(channel));
      while (reward && reward.type === "command.error" && reward.reason === "claim_not_ready" && typeof reward.can_claim_in === "number" && reward.can_claim_in > 0) {
        await sleep(reward.can_claim_in);
        reward = await runCommand(() => progressClaimReward(channel));
      }
    } finally {
      setPendingClaimIntent(false);
      claimResolutionInFlight = false;
    }
  }
  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, ms));
    });
  }
  function getCanvasPointFromInputEvent(event, targetCanvas) {
    const rect = targetCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    let clientX = null;
    let clientY = null;
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
})();
//# sourceMappingURL=app.js.map
