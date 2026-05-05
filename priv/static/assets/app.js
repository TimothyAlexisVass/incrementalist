const tokenKey = "incrementalist.anonymousPlayerToken";
const heartbeatIntervalMs = 25000;
const commandQueueLimit = 10;

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const statusLine = document.querySelector("#status-line");
const levelValue = document.querySelector("#level-value");
const slotValue = document.querySelector("#slot-value");
const noopButton = document.querySelector("#noop-button");
const saveButton = document.querySelector("#save-button");
const resetButton = document.querySelector("#reset-button");
const slotList = document.querySelector("#slot-list");

const colors = {
  ink: "#162026",
  muted: "#5b6570",
  panelStrong: "#ffffff",
  blue: "#1f6f8b",
  gold: "#edb83d",
  sky: "#dceff4",
  grass: "#eef3dc",
  background: "#f7f8f3"
};

const serverState = {
  snapshot: null,
  slots: [],
  status: "Connecting...",
  statusTone: "",
  loadingMessage: null
};

const canvasState = {
  width: 0,
  height: 0,
  pixelRatio: 1
};

let channel = null;
let snapshotCache = null;
let busy = false;

class SnapshotCache {
  constructor(token) {
    this.token = token;
  }

  cachedSlotIndexes() {
    if (!this.token) return [];

    const indexes = [];
    for (let slotIndex = 0; slotIndex < 4; slotIndex += 1) {
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
      return snapshot?.type === "game.snapshot" && snapshot.active_save_slot === slotIndex ? snapshot : null;
    } catch (_error) {
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
}

class GameChannel {
  constructor(token, cachedSaveSlots = []) {
    this.token = token;
    this.cachedSaveSlots = cachedSaveSlots;
    this.socket = null;
    this.ref = 0;
    this.joinRef = null;
    this.waiters = new Map();
    this.heartbeatId = 0;
    this.commandQueue = Array(commandQueueLimit).fill(false);
  }

  connect() {
    const params = new URLSearchParams({ vsn: "2.0.0" });
    if (this.token) params.set("anonymous_player_token", this.token);
    if (this.cachedSaveSlots.length > 0) params.set("cached_save_slots", this.cachedSaveSlots.join(","));

    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    this.socket = new WebSocket(`${scheme}://${window.location.host}/socket/websocket?${params}`);

    return new Promise((resolve, reject) => {
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

  clearCommandQueue() {
    this.commandQueue.fill(false);
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
    const [_joinRef, ref, _topic, eventName, payload] = JSON.parse(event.data);
    if (eventName !== "phx_reply" || !ref) return;

    const waiter = this.waiters.get(ref);
    if (!waiter) return;

    this.waiters.delete(ref);

    if (payload.status === "ok") {
      waiter.resolve(payload.response);
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

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatId = window.setInterval(() => {
      this.send("phoenix", "heartbeat", {}).catch(() => {});
    }, heartbeatIntervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatId) window.clearInterval(this.heartbeatId);
    this.heartbeatId = 0;
  }
}

function resizeCanvas() {
  canvasState.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvasState.width = window.innerWidth;
  canvasState.height = window.innerHeight;
  canvas.width = Math.floor(canvasState.width * canvasState.pixelRatio);
  canvas.height = Math.floor(canvasState.height * canvasState.pixelRatio);
  canvas.style.width = `${canvasState.width}px`;
  canvas.style.height = `${canvasState.height}px`;
  context.setTransform(canvasState.pixelRatio, 0, 0, canvasState.pixelRatio, 0, 0);
}

function renderDom() {
  const snapshot = serverState.snapshot;
  statusLine.textContent = serverState.loadingMessage ?? serverState.status;
  statusLine.dataset.tone = serverState.statusTone;
  levelValue.textContent = String(snapshot?.state.level ?? 1);
  slotValue.textContent = String((snapshot?.active_save_slot ?? 0) + 1);
  renderSaveSlots(createSaveSlotsViewModel(snapshot, serverState.slots));
  slotList.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
  });
}

function createSaveSlotsViewModel(snapshot, slots) {
  const activeSlot = snapshot?.active_save_slot ?? 0;
  if (slots.length > 0) return { activeSlot, slots };

  return {
    activeSlot,
    slots: [0, 1, 2, 3].map((slotIndex) => ({
      slot_index: slotIndex,
      file_index: slotIndex,
      is_current: slotIndex === activeSlot,
      has_data: slotIndex === activeSlot,
      level: snapshot?.state.level ?? 1,
      rewards_claimed: snapshot?.state.progress_bar.rewards_claimed ?? 0,
      saved_at: snapshot?.state.saved_at ?? null
    }))
  };
}

function renderSaveSlots(viewModel) {
  slotList.replaceChildren(
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

function applyResult(result) {
  if (result.snapshot) {
    serverState.snapshot = result.snapshot;
  }

  if (result.slots) {
    serverState.slots = result.slots;
  } else if (result.snapshot?.save_slot) {
    serverState.slots = upsertSlot(serverState.slots, result.snapshot.save_slot);
  }

  serverState.statusTone = result.status === "error" ? "error" : "ok";
  serverState.status = statusForResult(result);
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

function isAckableResult(result) {
  return (
    result.type === "game.noop.result" ||
    result.type === "save_slots.list.result" ||
    result.type === "save_slot.switch.result" ||
    result.type === "save_slot.reset.result" ||
    result.type === "command.error"
  );
}

async function applyAndAck(result) {
  hydrateSnapshotFromCache(result);
  applyResult(result);
  cacheSnapshotFromResult(result);
  renderDom();

  if (!isAckableResult(result)) return;

  let next = (await channel.ackCommand(result.command_id)).released_result ?? null;
  if (clearsCommandQueue(result)) channel.clearCommandQueue();
  while (next) {
    hydrateSnapshotFromCache(next);
    applyResult(next);
    cacheSnapshotFromResult(next);
    renderDom();
    const applied = next;
    next = (await channel.ackCommand(applied.command_id)).released_result ?? null;
    if (clearsCommandQueue(applied)) channel.clearCommandQueue();
  }
}

async function runCommand(command, loadingMessage = null) {
  if (busy) return;
  busy = true;
  serverState.loadingMessage = loadingMessage;
  setButtonsBusy(true);
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
    setButtonsBusy(false);
    renderDom();
  }
}

function setButtonsBusy(nextBusy) {
  for (const button of [noopButton, saveButton, resetButton]) {
    button.disabled = nextBusy;
    button.setAttribute("aria-busy", String(nextBusy));
  }
}

function renderCanvas(time) {
  const { width, height } = canvasState;
  const snapshot = serverState.snapshot;

  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = colors.sky;
  context.fillRect(0, 0, width, Math.max(180, height * 0.4));

  context.fillStyle = colors.grass;
  context.beginPath();
  context.moveTo(0, height * 0.58);
  context.bezierCurveTo(width * 0.18, height * 0.47, width * 0.56, height * 0.66, width, height * 0.5);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  const centerX = width < 720 ? width * 0.5 : width * 0.68;
  const centerY = Math.max(150, height * 0.38 + Math.sin(time / 600) * 4);

  context.fillStyle = "rgba(22, 32, 38, 0.15)";
  context.beginPath();
  context.ellipse(centerX, centerY + 95, 150, 24, 0, 0, Math.PI * 2);
  context.fill();

  roundRect(centerX - 140, centerY - 52, 280, 128, 8);
  context.fillStyle = colors.ink;
  context.fill();

  roundRect(centerX - 106, centerY - 86, 212, 92, 8);
  context.fillStyle = colors.blue;
  context.fill();

  roundRect(centerX - 76, centerY - 58, 152, 42, 6);
  context.fillStyle = colors.panelStrong;
  context.fill();

  context.fillStyle = colors.ink;
  context.font = "800 22px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`Level ${snapshot?.state.level ?? 1}`, centerX, centerY - 37);

  context.fillStyle = colors.gold;
  const progress = snapshot?.state.progress_bar.fill ?? 0;
  roundRect(centerX - 86, centerY + 26, 172, 18, 5);
  context.strokeStyle = "rgba(255,255,255,0.8)";
  context.lineWidth = 2;
  context.stroke();
  context.fillRect(centerX - 84, centerY + 28, Math.max(0, Math.min(168, progress * 1.68)), 14);

  if (serverState.loadingMessage) {
    context.fillStyle = "rgba(22, 32, 38, 0.58)";
    context.fillRect(0, 0, width, height);
    context.fillStyle = colors.panelStrong;
    context.font = "850 24px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(serverState.loadingMessage, width / 2, height / 2);
  }

  window.requestAnimationFrame(renderCanvas);
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

async function boot() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

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
    await applyAndAck(bootResult.pending_result);
  }

  window.requestAnimationFrame(renderCanvas);
}

noopButton.addEventListener("click", () => runCommand(() => channel.pushCommand("game.noop")));
saveButton.addEventListener("click", () => runCommand(() => channel.pushCommand("save_slots.list")));
resetButton.addEventListener("click", () => {
  if (window.confirm("Reset the active save file?")) {
    runCommand(() => channel.pushCommand("save_slot.reset"), "Loading save file...");
  }
});
slotList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("[data-slot-index]");
  if (!button) return;

  const slotIndex = Number(button.dataset.slotIndex);
  if (Number.isInteger(slotIndex)) {
    runCommand(() =>
      channel.pushCommand("save_slot.switch", {
        slot_index: slotIndex,
        has_cached_snapshot: Boolean(snapshotCache.load(slotIndex))
      }),
      "Loading save file..."
    );
  }
});

function hydrateSnapshotFromCache(result) {
  if (result.type !== "save_slot.switch.result" || result.snapshot) return;

  const cachedSnapshot = snapshotCache.load(result.active_save_slot);
  if (cachedSnapshot) {
    serverState.snapshot = cachedSnapshot;
  }
}

function cacheSnapshotFromResult(result) {
  if (result.snapshot) {
    snapshotCache.save(result.snapshot);
  }
}

function clearsCommandQueue(result) {
  return result.type === "save_slot.switch.result" || result.type === "save_slot.reset.result";
}

boot().catch((error) => {
  serverState.statusTone = "error";
  serverState.status = error instanceof Error ? error.message : "Boot failed";
  renderDom();
});
