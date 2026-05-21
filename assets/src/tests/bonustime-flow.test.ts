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
import {
  ScratchCardState,
  getScratchCardBoardRect,
  getScratchCardRevealVisuals,
  getScratchCardRewardWaitStartedAt,
  getScratchCardScratchedPixels,
  getScratchCardState,
  handleScratchCardInteractions,
  resetScratchCardState
} from "../features/bonustime/12-scratch-card/interactions";
import { type ScratchCardData } from "../features/bonustime/12-scratch-card/view-model";
import {
  LUCKY_DICE_WELCOME_LAYOUT_OPTIONS,
  LuckyDiceState,
  getLuckyDiceFinalRevealStartedAt,
  getLuckyDiceDieFaceValue,
  getLuckyDiceHeldIndexes,
  getLuckyDiceLayout,
  getLuckyDiceState,
  getLuckyDiceThrowButtonRect,
  handleLuckyDiceInteractions,
  shouldCenterLuckyDiceActionButton,
  shouldShowLuckyDiceClaimButton,
  shouldShowLuckyDiceCurrentHand,
  resetLuckyDiceState
} from "../features/bonustime/10-lucky-dice/interactions";
import { type LuckyDiceData } from "../features/bonustime/10-lucky-dice/view-model";
import type { GameChannel } from "../net/game-channel";

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

function makePressedInput(pointer: Point | null): InteractionState {
  return {
    pointer,
    pressStartPointer: pointer,
    clicked: false,
    isPressed: true,
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

function runRewardLabyrinthPendingResultFlow() {
  resetLabyrinthState();
  setClock(2000);
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
    streak: 3,
    bonustimeFlips: 0,
    lastResult: null
  };

  const startResult = handleLabyrinthInteractions(
    makeInput(centerOf(welcomeLayout.buttonRect), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  assert(startResult === null, "Reward Labyrinth should not open the modal while waiting for the result payload");
  assert(getLabyrinthState() === LabyrinthState.PREPARING, "Reward Labyrinth should enter PREPARING immediately after the start click");
  assert(queuedCommands === 1, "Reward Labyrinth should queue one play command while entering");

  data.hasToken = false;
  data.lastResult = {
    game_id: "reward_labyrinth",
    tier: 4,
    steps_total: 2,
    chests: [{ step: 2, tier: 4 }],
    reward_amount: ZERO,
    played_at: "2026-01-01T00:00:01Z"
  };

  const afterResult = handleLabyrinthInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(afterResult === null, "Reward Labyrinth should continue into active play once the payload arrives");
  assert(getLabyrinthState() === LabyrinthState.PLAYING, "Reward Labyrinth should leave PREPARING once it receives server result data");
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

function runScratchCardFlow() {
  resetScratchCardState();
  setClock(1000);

  let queuedCommands = 0;
  const runCommand = (_cmd: () => Promise<any>) => {
    queuedCommands += 1;
  };

  const rect = { x: 0, y: 0, width: 1120, height: 660 };
  const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
    cardWidth: 580,
    cardHeight: 360,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });
  const data: ScratchCardData = {
    hasToken: true,
    streak: 42,
    lastResult: null
  };

  const startResult = handleScratchCardInteractions(
    makeInput(centerOf(welcomeLayout.buttonRect), true),
    data,
    rect,
    {} as never,
    runCommand
  );

  assert(startResult === null, "Scratch Card should not open the modal on the start click");
  assert(getScratchCardState() === ScratchCardState.PLAYING, "Scratch Card should enter PLAYING after the start click");
  assert(queuedCommands === 1, "Scratch Card should queue one play command");

  data.lastResult = {
    game_id: "scratch_card",
    tier: 3,
    pixels_budget: 80,
    reveal_schedule: [{ pixels: 50, tier: 3 }],
    reward_amount: ZERO,
    played_at: "2026-01-01T00:00:00Z"
  };

  const boardRect = getScratchCardBoardRect(rect);
  const touchA = { x: boardRect.x + boardRect.width * 0.5, y: boardRect.y + boardRect.height * 0.5 };
  const touchB = { x: touchA.x + 8, y: touchA.y + 4 };
  const touchC = { x: boardRect.x + boardRect.width * 0.9, y: boardRect.y + boardRect.height * 0.8 };
  const touchMid = { x: (touchA.x + touchC.x) * 0.5, y: (touchA.y + touchC.y) * 0.5 };

  handleScratchCardInteractions(makePressedInput(touchA), data, rect, {} as never, runCommand);
  assert(getScratchCardScratchedPixels() > 0, "Scratch Card should scratch pixels while dragging");
  assert(getScratchCardRevealVisuals().length === 0, "Scratch Card should defer reveal until the next touch after threshold");

  handleScratchCardInteractions(makePressedInput(touchB), data, rect, {} as never, runCommand);
  assert(getScratchCardRevealVisuals().length === 0, "Scratch Card should keep reveal deferred if no local 37x37 block includes the touch");

  handleScratchCardInteractions(makePressedInput(touchC), data, rect, {} as never, runCommand);
  const pixelsBeforeMidpointTouch = getScratchCardScratchedPixels();
  handleScratchCardInteractions(makePressedInput(touchMid), data, rect, {} as never, runCommand);
  assert(
    getScratchCardScratchedPixels() === pixelsBeforeMidpointTouch,
    "Scratch Card should interpolate fast drags so midpoint touch does not scratch new pixels"
  );

  const safetyLimit = 5000;
  let iterations = 0;
  while (getScratchCardRevealVisuals().length === 0 && iterations < safetyLimit) {
    const sweepRatio = (iterations % 200) / 199;
    const hoverTouch = {
      x: boardRect.x + boardRect.width * sweepRatio,
      y: boardRect.y + boardRect.height * 0.15
    };
    setClock(1000 + iterations + 1);
    handleScratchCardInteractions(makeInput(hoverTouch, false), data, rect, {} as never, runCommand);
    iterations += 1;
  }

  assert(getScratchCardRevealVisuals().length === 1, "Scratch Card should auto-continue and reveal once it reaches a connected 37x37 block");
  assert(getScratchCardState() === ScratchCardState.REVEALED, "Scratch Card should enter REVEALED when budget and reveals are complete");

  const startedAt = getScratchCardRewardWaitStartedAt();
  assert(startedAt > 0, "Scratch Card should start the shared reward wait timer");

  setClock(startedAt + BONUSTIME_REWARD_MODAL_DELAY_MS - 1);
  const beforeModal = handleScratchCardInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(beforeModal === null, "Scratch Card should keep waiting before the shared reward delay elapses");

  setClock(startedAt + BONUSTIME_REWARD_MODAL_DELAY_MS);
  const afterModal = handleScratchCardInteractions(makeInput(null, false), data, rect, {} as never, runCommand);
  assert(afterModal?.type === "open_modal", "Scratch Card should open the reward modal after the shared delay");
}

function runLuckyDiceFlow() {
  resetLuckyDiceState();
  setClock(1000);

  const rect = { x: 0, y: 0, width: 800, height: 600 };
  const commands: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const channel = {
    pushCommand(event: string, payload: Record<string, unknown>) {
      commands.push({ event, payload });
      return Promise.resolve(null);
    }
  } as unknown as GameChannel;

  const data: LuckyDiceData = {
    hasToken: true,
    streak: 31,
    throwsFromStreak: 3,
    session: {
      throwsTotal: 3,
      throwsRemaining: 2,
      currentDice: [1, 2, 3, 4, 5, 6, 7],
      heldIndexes: [],
      claimedTiers: [],
      currentTier: 4,
      currentOutcome: "Four-of-a-kind",
      startedAt: "2026-01-01T00:00:00Z"
    },
    lastResult: null
  };

  const layout = getLuckyDiceLayout(rect);
  const session = data.session;
  assert(session !== null, "Lucky Dice test requires a seeded session");

  assert(
    getLuckyDiceDieFaceValue(LuckyDiceState.PLAYING, session, null, 0) === 7,
    "Lucky Dice should show 7s before the first throw is revealed"
  );
  assert(
    shouldShowLuckyDiceCurrentHand(session) === false,
    "Lucky Dice should not show the current hand before the first throw is revealed"
  );
  assert(
    shouldShowLuckyDiceClaimButton(session) === false,
    "Lucky Dice should not show a claim button before the first throw is revealed"
  );
  assert(
    shouldCenterLuckyDiceActionButton(session) === true,
    "Lucky Dice should center the only action button before the first throw is revealed"
  );

  const preRevealHoldIntent = handleLuckyDiceInteractions(
    makeInput(centerOf(layout.diceRects[0]), true),
    data,
    rect,
    channel
  );

  assert(
    preRevealHoldIntent === null,
    "Lucky Dice should not dispatch a command when the board has not been revealed yet"
  );
  assert(
    getLuckyDiceHeldIndexes().length === 0,
    "Lucky Dice should not track held dice before the first throw is revealed"
  );
  assert(commands.length === 0, "Lucky Dice should not send a hold command for local die selection");

  const boardRevealIntent = handleLuckyDiceInteractions(
    makeInput(centerOf(getLuckyDiceThrowButtonRect(layout, rect, true)), true),
    data,
    rect,
    channel
  );

  assert(
    boardRevealIntent === null,
    "Lucky Dice should not open the modal when revealing the first board"
  );
  assert(
    commands.length === 0,
    "Lucky Dice should not send a command when revealing the first board"
  );
  assert(
    getLuckyDiceDieFaceValue(LuckyDiceState.PLAYING, session, null, 0) === session.currentDice[0],
    "Lucky Dice should show the server dice after the first reveal click"
  );
  assert(
    shouldShowLuckyDiceCurrentHand(session) === true,
    "Lucky Dice should show the current hand once the board is revealed"
  );
  assert(
    shouldShowLuckyDiceClaimButton(session) === true,
    "Lucky Dice should show claim on the first throw when a reroll is still available"
  );
  assert(
    shouldCenterLuckyDiceActionButton(session) === false,
    "Lucky Dice should keep the throw button offset when claim is also visible"
  );

  const holdIntent = handleLuckyDiceInteractions(
    makeInput(centerOf(layout.diceRects[0]), true),
    data,
    rect,
    channel
  );

  assert(holdIntent === null, "Lucky Dice should not dispatch a command when toggling a held die");
  assert(
    getLuckyDiceHeldIndexes().length === 1 && getLuckyDiceHeldIndexes()[0] === 0,
    "Lucky Dice should track held dice locally after the board has been revealed"
  );
  assert(commands.length === 0, "Lucky Dice should not send a hold command for local die selection");

  const rollIntent = handleLuckyDiceInteractions(
    makeInput(centerOf(layout.rollButtonRect), true),
    data,
    rect,
    channel
  );

  assert(rollIntent === null, "Lucky Dice should not open the modal on a normal throw");
  const commandCount = Number(commands.length);
  assert(commandCount === 1, "Lucky Dice should send one throw command after the board is revealed");
  const throwCommand = commands[0];

  assert(throwCommand.event === "bonustime.play", "Lucky Dice should use the bonustime.play channel event");
  assert(throwCommand.payload.game === "lucky_dice", "Lucky Dice should target the lucky_dice game");
  assert(throwCommand.payload.action === "throw", "Lucky Dice should send a throw action");
  const heldIndexes = throwCommand.payload.held_indexes;
  assert(Array.isArray(heldIndexes), "Lucky Dice should send the held dice indexes with the throw command");
  assert(heldIndexes.length === 1 && heldIndexes[0] === 0, "Lucky Dice should send the held dice indexes with the throw command");

  const lastThrowSession: NonNullable<LuckyDiceData["session"]> = {
    throwsTotal: session.throwsTotal,
    throwsRemaining: 1,
    currentDice: session.currentDice,
    heldIndexes: session.heldIndexes,
    claimedTiers: session.claimedTiers,
    currentTier: session.currentTier,
    currentOutcome: session.currentOutcome,
    startedAt: session.startedAt
  };

  assert(
    shouldShowLuckyDiceClaimButton(lastThrowSession) === true,
    "Lucky Dice should keep claim available while a reroll still remains"
  );
  assert(
    shouldCenterLuckyDiceActionButton(lastThrowSession) === false,
    "Lucky Dice should keep throw offset while claim is also available"
  );
  assert(
    getLuckyDiceThrowButtonRect(layout, rect, shouldCenterLuckyDiceActionButton(lastThrowSession)).x ===
      layout.rollButtonRect.x,
    "Lucky Dice should keep the throw button offset while claim is available"
  );

  const claimIntent = handleLuckyDiceInteractions(
    makeInput(centerOf(layout.claimButtonRect), true),
    data,
    rect,
    channel
  );

  assert(claimIntent === null, "Lucky Dice should not open the modal when claiming a mid-game reward");
  const claimCommandCount = Number(commands.length);
  assert(claimCommandCount === 3, "Lucky Dice should send claim plus immediate reroll commands");
  const claimRewardCommand = commands[1];
  assert(claimRewardCommand.event === "bonustime.play", "Lucky Dice should use the bonustime.play channel event for claims");
  assert(claimRewardCommand.payload.game === "lucky_dice", "Lucky Dice should target the lucky_dice game for claims");
  assert(claimRewardCommand.payload.action === "claim", "Lucky Dice should send a claim action when claiming mid-game");
  const rerollAfterClaimCommand = commands[2];
  const rerollAfterClaimHeldIndexes = rerollAfterClaimCommand.payload.held_indexes;
  assert(
    rerollAfterClaimCommand.event === "bonustime.play",
    "Lucky Dice should use the bonustime.play channel event for claim rerolls"
  );
  assert(
    rerollAfterClaimCommand.payload.game === "lucky_dice",
    "Lucky Dice should target lucky_dice for claim rerolls"
  );
  assert(
    rerollAfterClaimCommand.payload.action === "throw",
    "Lucky Dice should immediately reroll all dice after a claim"
  );
  assert(
    Array.isArray(rerollAfterClaimHeldIndexes),
    "Lucky Dice claim reroll should include held_indexes"
  );
  assert(
    rerollAfterClaimHeldIndexes.length === 0,
    "Lucky Dice claim reroll should reroll all dice"
  );

  data.session = null;
  data.lastResult = {
    game_id: "lucky_dice",
    tier: 4,
    dice: [1, 2, 3, 4, 5, 6, 7],
    claimed_tiers: [4],
    reward_amount: ZERO,
    played_at: "2026-01-01T00:00:00Z"
  };

  const finalRevealIntent = handleLuckyDiceInteractions(makeInput(null, false), data, rect, channel);
  assert(
    getLuckyDiceState() === LuckyDiceState.FINAL_REVEALING,
    "Lucky Dice should reveal the final board immediately after the last throw result arrives"
  );
  assert(finalRevealIntent === null, "Lucky Dice should not open the modal immediately when final reveal starts");
  assert(
    getLuckyDiceFinalRevealStartedAt() === 1000,
    "Lucky Dice should arm the shared reward countdown when the final reveal starts"
  );

  setClock(1000 + BONUSTIME_REWARD_MODAL_DELAY_MS - 1);
  const beforeModal = handleLuckyDiceInteractions(makeInput(null, false), data, rect, channel);
  assert(beforeModal === null, "Lucky Dice should keep waiting before the shared reward delay elapses");
  assert(
    getLuckyDiceState() === LuckyDiceState.FINAL_REVEALING,
    "Lucky Dice should keep the reveal visible while the reward delay is still running"
  );

  setClock(1000 + BONUSTIME_REWARD_MODAL_DELAY_MS);
  const afterModal = handleLuckyDiceInteractions(makeInput(null, false), data, rect, channel);
  assert(afterModal?.type === "open_modal", "Lucky Dice should open the reward modal after the shared delay");
  assert(
    getLuckyDiceState() === LuckyDiceState.REVEALED,
    "Lucky Dice should mark the final reward as revealed once the delay expires"
  );
}

function runLuckyDiceWelcomeAndLoadingFlow() {
  resetLuckyDiceState();
  setClock(2000);

  const rect = { x: 0, y: 0, width: 800, height: 600 };
  const commands: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const channel = {
    pushCommand(event: string, payload: Record<string, unknown>) {
      commands.push({ event, payload });
      return Promise.resolve(null);
    }
  } as unknown as GameChannel;

  const data: LuckyDiceData = {
    hasToken: true,
    streak: 16,
    throwsFromStreak: 2,
    session: null,
    lastResult: {
      game_id: "lucky_dice",
      tier: 3,
      dice: [1, 1, 1, 2, 3, 4, 5],
      claimed_tiers: [3],
      reward_amount: ZERO,
      played_at: "2026-01-01T00:00:00Z"
    }
  };

  const welcomeLayout = getBonusTimeWelcomeLayout(rect, LUCKY_DICE_WELCOME_LAYOUT_OPTIONS);
  const welcomeClickIntent = handleLuckyDiceInteractions(
    makeInput(centerOf(welcomeLayout.buttonRect), true),
    data,
    rect,
    channel
  );

  assert(welcomeClickIntent === null, "Lucky Dice should not open modal when starting from welcome");
  assert(commands.length === 1, "Lucky Dice should send one throw command from welcome");
  assert(commands[0].event === "bonustime.play", "Lucky Dice welcome start should use bonustime.play");
  assert(commands[0].payload.action === "throw", "Lucky Dice welcome start should enqueue a throw");
  assert(getLuckyDiceState() === LuckyDiceState.LOADING, "Lucky Dice should remain loading while waiting for session");

  const loadingIntent = handleLuckyDiceInteractions(makeInput(null, false), data, rect, channel);
  assert(loadingIntent === null, "Lucky Dice loading should not open modal");
  assert(
    getLuckyDiceState() === LuckyDiceState.LOADING,
    "Lucky Dice should ignore stale last_result while loading a newly started run"
  );

  data.session = {
    throwsTotal: 2,
    throwsRemaining: 1,
    currentDice: [2, 3, 4, 5, 6, 7, 1],
    heldIndexes: [],
    claimedTiers: [],
    currentTier: 4,
    currentOutcome: "Small straight",
    startedAt: "2026-01-02T00:00:00Z"
  };

  handleLuckyDiceInteractions(makeInput(null, false), data, rect, channel);

  const layout = getLuckyDiceLayout(rect);
  const revealIntent = handleLuckyDiceInteractions(
    makeInput(centerOf(getLuckyDiceThrowButtonRect(layout, rect, true)), true),
    data,
    rect,
    channel
  );
  assert(revealIntent === null, "Lucky Dice first in-board throw click should reveal, not send command");
  assert(commands.length === 1, "Lucky Dice reveal click should not enqueue a second command");
  assert(
    getLuckyDiceDieFaceValue(LuckyDiceState.PLAYING, data.session, null, 0) === data.session.currentDice[0],
    "Lucky Dice should reveal server-provided dice on the first in-board throw click"
  );
}

function main() {
  runChestDrawFlow();
  runRewardLabyrinthFlow();
  runRewardLabyrinthPendingResultFlow();
  runLadderClimbFlow();
  runChecklistFlow();
  runMatchPairsFlow();
  runScratchCardFlow();
  runLuckyDiceWelcomeAndLoadingFlow();
  runLuckyDiceFlow();
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
