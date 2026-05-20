import { ZERO } from "../core/bignum";
import { type InteractionState } from "../ui/managers/interactions";
import {
  BONUSTIME_REWARD_MODAL_DELAY_MS,
  getBonusTimeWelcomeLayout
} from "../features/bonustime/flow";
import {
  BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX,
  BONUSTIME_CHECKLIST_BASE_GAP_PX,
  BONUSTIME_CHECKLIST_BASE_HEIGHT_PX,
  BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
  BONUSTIME_CHECKLIST_GRID_COLS,
  fitRectWithinBonusTimeArea
} from "../features/bonustime/layout";
import {
  MatchPairsState,
  getFinalRevealStartTime,
  getKnown,
  getMatchPairsGridLayout,
  getMatchPairsState,
  getRemainingIndices,
  getRestFlippedIndices,
  handleMatchPairsInteractions,
  resetMatchPairsState
} from "../features/bonustime/13-match-pairs/interactions";
import { type MatchPairsData } from "../features/bonustime/13-match-pairs/view-model";
import {
  ChestState,
  getChestState,
  handleChestDrawInteractions,
  resetChestState
} from "../features/bonustime/01-chest-draw/interactions";
import { type ChestDrawData } from "../features/bonustime/01-chest-draw/view-model";
import {
  ResourceChecklistState,
  getResourceChecklistState,
  getRewardWaitStartedAt as getResourceChecklistRewardWaitStartedAt,
  handleResourceChecklistInteractions,
  resetResourceChecklistState
} from "../features/bonustime/03-resource-checklist/interactions";
import { type ResourceChecklistData } from "../features/bonustime/03-resource-checklist/view-model";
import {
  ItemChecklistState,
  getItemChecklistState,
  getRewardWaitStartedAt as getItemChecklistRewardWaitStartedAt,
  handleItemChecklistInteractions,
  resetItemChecklistState
} from "../features/bonustime/05-item-checklist/interactions";
import { type ItemChecklistData } from "../features/bonustime/05-item-checklist/view-model";
import {
  LabyrinthState,
  getLabyrinthState,
  getMazeSeed,
  getSymmetricConnections,
  handleLabyrinthInteractions,
  resetLabyrinthState
} from "../features/bonustime/07-reward-labyrinth/interactions";
import { type RewardLabyrinthData } from "../features/bonustime/07-reward-labyrinth/view-model";
import {
  LadderClimbState,
  getLadderClimbAnimationStartedAt,
  getLadderClimbBoardRect,
  getLadderClimbCompletedStepCount,
  getLadderClimbState,
  getRewardWaitStartedAt as getLadderClimbRewardWaitStartedAt,
  handleLadderClimbInteractions,
  resetLadderClimbState
} from "../features/bonustime/08-ladder-climb/interactions";
import {
  getLadderClimbAnimationDurationMs,
  type LadderClimbData
} from "../features/bonustime/08-ladder-climb/view-model";

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

function matchPairsTileCenter(
  layout: ReturnType<typeof getMatchPairsGridLayout>,
  index: number
): Point {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);

  return {
    x: layout.gridStartX + (col * (layout.tileSize + layout.gap)) + (layout.tileSize / 2),
    y: layout.gridStartY + (row * (layout.tileSize + layout.gap)) + (layout.tileSize / 2)
  };
}

function checklistEntryCenter(
  rect: { x: number; y: number; width: number; height: number },
  entryIndex: number
): Point {
  const layout = fitRectWithinBonusTimeArea(
    rect,
    BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
    BONUSTIME_CHECKLIST_BASE_HEIGHT_PX
  );
  const boxSize = BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX * layout.scale;
  const gap = BONUSTIME_CHECKLIST_BASE_GAP_PX * layout.scale;
  const col = entryIndex % BONUSTIME_CHECKLIST_GRID_COLS;
  const row = Math.floor(entryIndex / BONUSTIME_CHECKLIST_GRID_COLS);

  return {
    x: layout.x + (col * (boxSize + gap)) + (boxSize / 2),
    y: layout.y + (row * (boxSize + gap)) + (boxSize / 2)
  };
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

function runLadderClimbFlow() {
  resetLadderClimbState();
  setClock(500);

  let queuedCommands = 0;
  const runCommand = (_cmd: () => Promise<any>) => {
    queuedCommands += 1;
  };

  const rect = { x: 0, y: 0, width: 800, height: 600 };
  const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
    cardWidth: 500,
    cardHeight: 330,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });
  const data: LadderClimbData = {
    hasToken: true,
    streak: 60,
    lastPlayedAt: null,
    lastResult: null,
    path: [],
    highestRung: 1,
    rewardTier: null,
    rewardAmount: null
  };
  const boardRect = getLadderClimbBoardRect(rect);
  const boardClick = centerOf(boardRect);

  const startResult = handleLadderClimbInteractions(
    makeInput(centerOf(welcomeLayout.buttonRect), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  assert(startResult === null, "Ladder Climb should not open the modal on the start click");
  assert(getLadderClimbState() === LadderClimbState.PREPARING, "Ladder Climb should enter PREPARING after the start click");
  assert(queuedCommands === 1, "Ladder Climb should queue one play command");
  assert(getLadderClimbAnimationStartedAt() === 0, "Ladder Climb should not start the replay animation before the result arrives");

  data.lastPlayedAt = "2026-01-01T00:00:02Z";
  data.lastResult = {
    game_id: "ladder_climb",
    tier: 2,
    rolls: [
      { from_rung: 1, target_rung: 2, success: true, chance: 0.8, reached_rung: 2 },
      { from_rung: 2, target_rung: 3, success: false, chance: 0.5, reached_rung: 2 }
    ],
    reward_amount: ZERO,
    played_at: data.lastPlayedAt
  };
  data.path = data.lastResult.rolls;
  data.highestRung = 2;
  data.rewardTier = 2;
  data.rewardAmount = ZERO;

  setClock(1000);
  const replayStart = handleLadderClimbInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(replayStart === null, "Ladder Climb should wait for a click after the result arrives");
  assert(getLadderClimbState() === LadderClimbState.REVEALING, "Ladder Climb should enter REVEALING once the result arrives");
  assert(getLadderClimbAnimationStartedAt() === 0, "Ladder Climb should stay idle until the player clicks the board");
  assert(getLadderClimbCompletedStepCount() === 0, "Ladder Climb should start with no completed click steps");

  const animationMs = getLadderClimbAnimationDurationMs(data);
  const firstStepClick = handleLadderClimbInteractions(makeInput(boardClick, true), data, rect, {} as never, runCommand);
  assert(firstStepClick === null, "Ladder Climb should not open the modal when the first step click starts");
  assert(getLadderClimbAnimationStartedAt() === 1000, "Ladder Climb should capture the first step animation start time on click");

  setClock(1000 + animationMs - 1);
  const beforeFirstStepFinish = handleLadderClimbInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(beforeFirstStepFinish === null, "Ladder Climb should keep waiting while the clicked step is animating");
  assert(getLadderClimbState() === LadderClimbState.REVEALING, "Ladder Climb should stay in REVEALING while the clicked step is running");
  assert(getLadderClimbAnimationStartedAt() === 1000, "Ladder Climb should keep the current step animation start time until it finishes");

  setClock(1000 + animationMs);
  const firstStepFinish = handleLadderClimbInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(firstStepFinish === null, "Ladder Climb should not open the modal after the first step finishes");
  assert(getLadderClimbState() === LadderClimbState.REVEALING, "Ladder Climb should remain in REVEALING after one clicked step");
  assert(getLadderClimbCompletedStepCount() === 1, "Ladder Climb should count the completed clicked step");
  assert(getLadderClimbAnimationStartedAt() === 0, "Ladder Climb should clear the step animation time after the step finishes");

  setClock(1000 + animationMs + 40);
  const secondStepClick = handleLadderClimbInteractions(makeInput(boardClick, true), data, rect, {} as never, runCommand);
  assert(secondStepClick === null, "Ladder Climb should keep the modal closed when the second step click starts");
  assert(getLadderClimbAnimationStartedAt() === 1000 + animationMs + 40, "Ladder Climb should capture the second step animation start time on click");

  setClock(1000 + (animationMs * 2) + 40);
  const secondStepFinish = handleLadderClimbInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(secondStepFinish === null, "Ladder Climb should not open the modal immediately when the final step finishes");
  assert(getLadderClimbState() === LadderClimbState.REVEALED, "Ladder Climb should enter REVEALED after the final clicked step");
  assert(getLadderClimbRewardWaitStartedAt() === 1000 + (animationMs * 2) + 40, "Ladder Climb should begin the shared reward wait when the final step finishes");

  setClock(1000 + (animationMs * 2) + 40 + BONUSTIME_REWARD_MODAL_DELAY_MS);
  const openModal = handleLadderClimbInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(openModal?.type === "open_modal", "Ladder Climb should open the reward modal after the shared delay");
}

function runChecklistFlow() {
  resetResourceChecklistState();
  resetItemChecklistState();
  setClock(0);

  let queuedCommands = 0;
  const runCommand = (_cmd: () => Promise<any>) => {
    queuedCommands += 1;
  };

  const rect = { x: 0, y: 0, width: 800, height: 600 };
  const resourceData: ResourceChecklistData = {
    hasToken: true,
    entries: [
      { entryIndex: 0, entryNumber: 1, tier: 1, completed: false, active: false },
      { entryIndex: 1, entryNumber: 2, tier: 2, completed: false, active: true },
      { entryIndex: 2, entryNumber: 3, tier: 3, completed: false, active: false }
    ],
    nextEntryIndex: 1,
    lastTier: null,
    lastRewardAmount: ZERO
  };
  const resourceBoardClick = checklistEntryCenter(rect, 0);

  const resourceClick = handleResourceChecklistInteractions(
    makeInput(resourceBoardClick, true),
    resourceData,
    rect,
    {} as never,
    runCommand
  );

  assert(resourceClick?.type === "open_modal", "Resource Checklist should open the confirmation from any board tile");
  assert(getResourceChecklistState() === ResourceChecklistState.REVEALED, "Resource Checklist should lock after the board click");
  assert(getResourceChecklistRewardWaitStartedAt() === 0, "Resource Checklist should not enter a waiting state");
  assert(queuedCommands === 1, "Resource Checklist should queue exactly one play command");

  const resourceRepeat = handleResourceChecklistInteractions(
    makeInput(resourceBoardClick, true),
    resourceData,
    rect,
    {} as never,
    runCommand
  );

  assert(resourceRepeat === null, "Resource Checklist should not queue another claim while the modal is open");
  assert(queuedCommands === 1, "Resource Checklist should stay at one queued command");

  resetResourceChecklistState();

  const itemData: ItemChecklistData = {
    hasToken: true,
    entries: [
      { entryIndex: 0, entryNumber: 1, tier: 1, completed: false, active: false },
      { entryIndex: 1, entryNumber: 2, tier: 2, completed: false, active: true },
      { entryIndex: 2, entryNumber: 3, tier: 3, completed: false, active: false }
    ],
    nextEntryIndex: 1,
    lastTier: null,
    lastRewardAmount: ZERO
  };
  const itemBoardClick = checklistEntryCenter(rect, 0);

  const itemClick = handleItemChecklistInteractions(
    makeInput(itemBoardClick, true),
    itemData,
    rect,
    {} as never,
    runCommand
  );

  assert(itemClick?.type === "open_modal", "Item Checklist should open the confirmation from any board tile");
  assert(getItemChecklistState() === ItemChecklistState.REVEALED, "Item Checklist should lock after the board click");
  assert(getItemChecklistRewardWaitStartedAt() === 0, "Item Checklist should not enter a waiting state");
  assert(Number(queuedCommands) === 2, "Item Checklist should queue exactly one additional play command");

  const itemRepeat = handleItemChecklistInteractions(
    makeInput(itemBoardClick, true),
    itemData,
    rect,
    {} as never,
    runCommand
  );

  assert(itemRepeat === null, "Item Checklist should not queue another claim while the modal is open");
  assert(Number(queuedCommands) === 2, "Item Checklist should stay at one queued command for the entry");

  resetItemChecklistState();
}

function runMatchPairsFlow() {
  resetMatchPairsState();
  setClock(0);

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
  const gridLayout = getMatchPairsGridLayout(rect);
  const data: MatchPairsData = {
    hasToken: true,
    streak: 0,
    lastResult: undefined
  };

  const startResult = handleMatchPairsInteractions(
    makeInput(centerOf(welcomeLayout.buttonRect), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  assert(startResult === null, "Match Pairs should not open the modal on the start click");
  assert(getMatchPairsState() === MatchPairsState.PLAYING, "Match Pairs should enter PLAYING after the start click");
  assert(queuedCommands === 1, "Match Pairs should queue one start command");

  data.lastResult = {
    results: [{ kind: "match", tier: "tier_2" }],
    token_type: "daily",
    started_at: "2026-01-01T00:00:00Z"
  };

  handleMatchPairsInteractions(
    makeInput(matchPairsTileCenter(gridLayout, 0), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  handleMatchPairsInteractions(
    makeInput(matchPairsTileCenter(gridLayout, 1), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  assert(getMatchPairsState() === MatchPairsState.MATCH_PAUSE, "Match Pairs should pause after the second click");

  setClock(820);
  handleMatchPairsInteractions(makeInput(null, false), data, rect, {} as never, runCommand);

  assert(getMatchPairsState() === MatchPairsState.FINAL_REVEAL, "Match Pairs should enter FINAL_REVEAL after the turn limit is reached");

  const revealStart = getFinalRevealStartTime();
  const remainingIndices = getRemainingIndices();
  assert(remainingIndices.length === 46, "Match Pairs should reveal every non-matched slot at the end");

  setClock(revealStart + 2019);
  handleMatchPairsInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(!getKnown().has(2), "Match Pairs should not reveal the next slot before 20 ms elapses");

  setClock(revealStart + 2020);
  handleMatchPairsInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(getKnown().has(2), "Match Pairs should reveal one additional slot every 20 ms");
  assert(getRestFlippedIndices().has(2), "Match Pairs should track the revealed end-state slot");

  const totalRevealDuration = 2000 + remainingIndices.length * 20;

  setClock(revealStart + totalRevealDuration - 1);
  const beforeConfirm = handleMatchPairsInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(beforeConfirm === null, "Match Pairs should keep waiting before the confirmation countdown ends");
  assert(getMatchPairsState() === MatchPairsState.FINAL_REVEAL, "Match Pairs should stay in FINAL_REVEAL until confirmation");
  assert(queuedCommands === 1, "Match Pairs should not claim before the confirmation countdown ends");

  setClock(revealStart + totalRevealDuration + BONUSTIME_REWARD_MODAL_DELAY_MS);
  const confirmResult = handleMatchPairsInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(confirmResult === null, "Match Pairs should transition to REVEALED before opening the modal");
  assert(getMatchPairsState() === MatchPairsState.REVEALED, "Match Pairs should enter REVEALED after confirmation");
  assert(Number(queuedCommands) === 2, "Match Pairs should queue the claim command after the reveal countdown");

  const afterModal = handleMatchPairsInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(afterModal?.type === "open_modal", "Match Pairs should open the reward modal after confirmation");
}

function main() {
  runChestDrawFlow();
  runRewardLabyrinthFlow();
  runLadderClimbFlow();
  runChecklistFlow();
  runMatchPairsFlow();
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
