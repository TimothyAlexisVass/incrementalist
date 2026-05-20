import { ZERO } from "../core/bignum";
import { type InteractionState } from "../ui/managers/interactions";
import {
  BONUSTIME_REWARD_MODAL_DELAY_MS,
  getBonusTimeWelcomeLayout
} from "../features/bonustime/flow";
import {
  ChestState,
  getChestState,
  handleChestDrawInteractions,
  resetChestState
} from "../features/bonustime/01-chest-draw/interactions";
import { type ChestDrawData } from "../features/bonustime/01-chest-draw/view-model";
import {
  LabyrinthState,
  getLabyrinthState,
  getMazeSeed,
  getSymmetricConnections,
  handleLabyrinthInteractions,
  resetLabyrinthState
} from "../features/bonustime/07-reward-labyrinth/interactions";
import { type RewardLabyrinthData } from "../features/bonustime/07-reward-labyrinth/view-model";

type Point = { x: number; y: number };

let clockNow = 0;
const originalPerformanceNow = globalThis.performance.now.bind(globalThis.performance);
Object.defineProperty(globalThis.performance, "now", {
  configurable: true,
  value: () => clockNow
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function setClock(now: number) {
  clockNow = now;
}

function makeInput(pointer: Point | null, clicked = false): InteractionState {
  return {
    pointer,
    pressStartPointer: pointer,
    clicked,
    isPressed: clicked,
    wheelDelta: 0,
    consumed: false
  };
}

function centerOf(rect: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function directionPointer(
  direction: "north" | "south" | "east" | "west",
  rect: { x: number; y: number; width: number; height: number }
): Point {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const buttonSize = 40;
  const offset = 56;
  const mapCenterY = centerY - 20;

  if (direction === "north") return { x: centerX, y: mapCenterY - offset };
  if (direction === "south") return { x: centerX, y: mapCenterY + offset };
  if (direction === "east") return { x: centerX + offset, y: mapCenterY };
  return { x: centerX - offset, y: mapCenterY };
}

function runChestDrawFlow() {
  resetChestState();
  setClock(0);
  let queuedCommands = 0;
  const runCommand = (_cmd: () => Promise<any>) => {
    queuedCommands += 1;
  };

  const rect = { x: 0, y: 0, width: 800, height: 600 };
  const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
    cardWidth: 420,
    cardHeight: 300,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });
  const data: ChestDrawData = {
    hasToken: true,
    lastTier: null,
    lastRewardAmount: ZERO
  };

  const clickResult = handleChestDrawInteractions(
    makeInput(centerOf(welcomeLayout.buttonRect), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  assert(clickResult === null, "Chest Draw should not open the modal on the start click");
  assert(getChestState() === ChestState.REVEALING, "Chest Draw should enter REVEALING after start");
  assert(queuedCommands === 1, "Chest Draw should queue one play command");

  data.lastTier = 4;
  setClock(1600);
  handleChestDrawInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(getChestState() === ChestState.REVEALED, "Chest Draw should move to REVEALED once the result is ready");

  setClock(1600 + BONUSTIME_REWARD_MODAL_DELAY_MS - 1);
  const beforeModal = handleChestDrawInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(beforeModal === null, "Chest Draw should keep waiting before the shared reward delay elapses");

  setClock(1600 + BONUSTIME_REWARD_MODAL_DELAY_MS);
  const afterModal = handleChestDrawInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(afterModal?.type === "open_modal", "Chest Draw should auto-open the reward modal after 5 seconds");
}

function runRewardLabyrinthFlow() {
  resetLabyrinthState();
  setClock(1000);
  let queuedCommands = 0;
  const runCommand = (_cmd: () => Promise<any>) => {
    queuedCommands += 1;
  };

  const rect = { x: 0, y: 0, width: 800, height: 600 };
  const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
    cardWidth: 560,
    cardHeight: 360,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });
  const data: RewardLabyrinthData = {
    hasToken: true,
    streak: 12,
    bonustimeFlips: 0,
    lastResult: {
      game_id: "reward_labyrinth",
      tier: 7,
      steps_total: 1,
      chests: [{ step: 2, tier: 7 }],
      reward_amount: ZERO,
      played_at: "2026-01-01T00:00:00Z"
    }
  };

  const startResult = handleLabyrinthInteractions(
    makeInput(centerOf(welcomeLayout.buttonRect), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  assert(startResult === null, "Reward Labyrinth should not open the modal on the start click");
  assert(getLabyrinthState() === LabyrinthState.PLAYING, "Reward Labyrinth should enter PLAYING after the start click");
  assert(queuedCommands === 1, "Reward Labyrinth should queue one play command");

  const seed = getMazeSeed();
  const connections = getSymmetricConnections(0, 0, seed);
  const direction = (["north", "south", "east", "west"] as const).find((dir) => connections[dir]);
  assert(direction, "Reward Labyrinth should generate at least one walkable direction");

  const moveResult = handleLabyrinthInteractions(
    makeInput(directionPointer(direction, rect), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  assert(moveResult === null, "Reward Labyrinth should not open the modal immediately after finishing");
  assert(getLabyrinthState() === LabyrinthState.FINISHED, "Reward Labyrinth should enter FINISHED after the last step");

  setClock(1000 + BONUSTIME_REWARD_MODAL_DELAY_MS - 1);
  const beforeModal = handleLabyrinthInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(beforeModal === null, "Reward Labyrinth should keep waiting before the shared reward delay elapses");

  setClock(1000 + BONUSTIME_REWARD_MODAL_DELAY_MS);
  const afterModal = handleLabyrinthInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(afterModal?.type === "open_modal", "Reward Labyrinth should auto-open the reward modal after 5 seconds");
  assert(getLabyrinthState() === LabyrinthState.REVEALED, "Reward Labyrinth should enter REVEALED once the modal is ready");
}

function main() {
  runChestDrawFlow();
  runRewardLabyrinthFlow();
  console.log("bonustime flow tests passed");
}

try {
  main();
} finally {
  Object.defineProperty(globalThis.performance, "now", {
    configurable: true,
    value: originalPerformanceNow
  });
}

