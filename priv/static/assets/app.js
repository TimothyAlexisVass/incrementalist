const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const usernameInput = document.querySelector("#username-input");
const clickButton = document.querySelector("#click-button");
const clickCount = document.querySelector("#click-count");
const statusLine = document.querySelector("#status-line");

const state = {
  clicks: 0,
  pending: 0,
  status: "",
  statusTone: "",
  lastClickAt: 0,
  pulses: [],
  sparks: [],
  width: 0,
  height: 0,
  pixelRatio: 1
};

let loadTimer = 0;
let requestId = 0;

function currentUsername() {
  return usernameInput.value.trim();
}

function setStatus(message, tone = "") {
  state.status = message;
  state.statusTone = tone;
  statusLine.textContent = message;
  statusLine.dataset.tone = tone;
}

function setClicks(nextClicks) {
  state.clicks = Math.max(0, Number(nextClicks) || 0);
  clickCount.textContent = state.clicks.toLocaleString();
}

function resizeCanvas() {
  state.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.floor(state.width * state.pixelRatio);
  canvas.height = Math.floor(state.height * state.pixelRatio);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0);
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    ...options
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

async function loadClicks() {
  const username = currentUsername();
  const id = ++requestId;

  if (!username) {
    setClicks(0);
    setStatus("Enter a username to play.");
    return;
  }

  setStatus("Syncing...");

  try {
    const data = await requestJson(`/api/clicks?username=${encodeURIComponent(username)}`);

    if (id === requestId) {
      setClicks(data.clicks);
      setStatus("Ready.");
    }
  } catch (error) {
    if (id === requestId) {
      setStatus(error.message, "error");
    }
  }
}

async function sendClick() {
  const username = currentUsername();

  if (!username) {
    setStatus("Enter a username to play.", "error");
    usernameInput.focus();
    return;
  }

  state.pending += 1;
  state.lastClickAt = performance.now();
  addBurst();
  setStatus("Saving...");

  try {
    const data = await requestJson("/api/clicks", {
      method: "POST",
      body: JSON.stringify({ username })
    });

    if (username === currentUsername()) {
      setClicks(Math.max(state.clicks, data.clicks));
      setStatus("Saved.");
    }
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    state.pending = Math.max(0, state.pending - 1);
  }
}

function scheduleLoad() {
  window.clearTimeout(loadTimer);
  loadTimer = window.setTimeout(() => {
    loadClicks();
  }, 250);
}

function addBurst() {
  const center = machineCenter();
  state.pulses.push({ x: center.x, y: center.y, age: 0, life: 520 });

  for (let index = 0; index < 12; index += 1) {
    const angle = -Math.PI / 2 + (index - 5.5) * 0.18;
    const speed = 1.6 + Math.random() * 2.8;
    state.sparks.push({
      x: center.x,
      y: center.y - 22,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 520 + Math.random() * 260,
      size: 5 + Math.random() * 8
    });
  }
}

function machineCenter() {
  const hudRoom = state.width < 720 ? 280 : 430;
  return {
    x: state.width < 720 ? state.width * 0.5 : state.width * 0.66,
    y: Math.max(160, (state.height - hudRoom) * 0.48)
  };
}

function drawBackground(time) {
  ctx.fillStyle = "#f7f8f3";
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = "#dceff4";
  ctx.fillRect(0, 0, state.width, Math.max(180, state.height * 0.4));

  ctx.fillStyle = "#eef3dc";
  ctx.beginPath();
  ctx.moveTo(0, state.height * 0.54);
  ctx.bezierCurveTo(
    state.width * 0.2,
    state.height * 0.46,
    state.width * 0.46,
    state.height * 0.62,
    state.width,
    state.height * 0.48
  );
  ctx.lineTo(state.width, state.height);
  ctx.lineTo(0, state.height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(23, 32, 38, 0.09)";
  ctx.lineWidth = 1;
  const offset = (time * 0.018) % 36;

  for (let x = -36 + offset; x < state.width + 36; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + state.height * 0.25, state.height);
    ctx.stroke();
  }
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawMachine(time) {
  const center = machineCenter();
  const scale = Math.max(0.72, Math.min(1.2, state.width / 1060));
  const thump = Math.max(0, 1 - (time - state.lastClickAt) / 180);
  const lift = Math.sin(time / 320) * 3 - thump * 5;
  const baseWidth = 330 * scale;
  const baseHeight = 150 * scale;

  ctx.save();
  ctx.translate(center.x, center.y + lift);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(23, 32, 38, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 130, 170, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#172026";
  roundedRect(-baseWidth / 2 / scale, 34, baseWidth / scale, baseHeight / scale, 8);
  ctx.fill();

  ctx.fillStyle = "#1f7a8c";
  roundedRect(-132, -52, 264, 118, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  roundedRect(-96, -28, 192, 54, 6);
  ctx.fill();

  ctx.fillStyle = "#172026";
  ctx.font = "900 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(state.clicks), 0, 0);

  ctx.fillStyle = "#edb83d";
  for (let index = 0; index < 5; index += 1) {
    roundedRect(-148 + index * 26, 75 - index * 6, 70, 18, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(23, 32, 38, 0.18)";
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(104, 64);
  ctx.rotate(time / 950);
  ctx.fillStyle = "#dd5f46";
  roundedRect(-44, -44, 88, 88, 8);
  ctx.fill();
  ctx.fillStyle = "#f7f8f3";
  ctx.fillRect(-7, -48, 14, 96);
  ctx.fillRect(-48, -7, 96, 14);
  ctx.restore();

  ctx.fillStyle = "#277a55";
  roundedRect(-32, -112 - thump * 14, 64, 74, 7);
  ctx.fill();

  ctx.fillStyle = "#172026";
  ctx.fillRect(-9, -46 - thump * 7, 18, 28);

  ctx.restore();
}

function drawPulses(delta) {
  state.pulses = state.pulses.filter((pulse) => {
    pulse.age += delta;
    const progress = pulse.age / pulse.life;

    if (progress >= 1) {
      return false;
    }

    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = "#1f7a8c";
    ctx.lineWidth = 4;
    roundedRect(
      pulse.x - 55 - progress * 90,
      pulse.y - 70 - progress * 38,
      110 + progress * 180,
      128 + progress * 76,
      8
    );
    ctx.stroke();
    ctx.restore();
    return true;
  });
}

function drawSparks(delta) {
  state.sparks = state.sparks.filter((spark) => {
    spark.age += delta;
    spark.x += spark.vx * delta * 0.07;
    spark.y += spark.vy * delta * 0.07;
    spark.vy += 0.008 * delta;

    const progress = spark.age / spark.life;

    if (progress >= 1) {
      return false;
    }

    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.translate(spark.x, spark.y);
    ctx.rotate(progress * Math.PI * 2);
    ctx.fillStyle = progress < 0.5 ? "#edb83d" : "#dd5f46";
    ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    ctx.restore();
    return true;
  });
}

let previousTime = performance.now();

function render(time) {
  const delta = Math.min(40, time - previousTime);
  previousTime = time;

  drawBackground(time);
  drawPulses(delta);
  drawMachine(time);
  drawSparks(delta);

  window.requestAnimationFrame(render);
}

usernameInput.value = "player";
resizeCanvas();
loadClicks();

window.addEventListener("resize", resizeCanvas);
usernameInput.addEventListener("input", scheduleLoad);
clickButton.addEventListener("click", sendClick);
window.requestAnimationFrame(render);
