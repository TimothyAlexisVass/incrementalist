import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba } from "../../../utils";
import { drawButton } from "../../../ui/components/button";
import {
  BONUSTIME_BODY_FONT,
  BONUSTIME_BUTTON_FONT,
  BONUSTIME_TITLE_FONT
} from "../../../config";
import {
  LUCKY_DICE_WELCOME_LAYOUT_OPTIONS,
  LuckyDiceState,
  getLuckyDiceDieFaceValue,
  getLuckyDiceBoardRevealed,
  getLuckyDiceHeldIndexes,
  getLuckyDiceHoveredDieIndex,
  getLuckyDiceLayout,
  getLuckyDiceState,
  getLuckyDiceThrowButtonRect,
  shouldCenterLuckyDiceActionButton,
  shouldShowLuckyDiceClaimButton,
  shouldShowLuckyDiceCurrentHand
} from "./interactions";
import { LuckyDiceData } from "./view-model";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  renderBonusTimeWelcomeCard
} from "../flow";

const TIER_OUTCOMES: Array<{ tier: number; outcomes: string[] }> = [
  { tier: 7, outcomes: ["Seven-of-a-kind"] },
  { tier: 6, outcomes: ["Full straight (1-7)", "Six-of-a-kind"] },
  { tier: 5, outcomes: ["7-leaf clover (Pair of 7s, no straight)", "Five + pair", "Five-of-a-kind", "Large straight (1-6 or 2-7)"] },
  { tier: 4, outcomes: ["Small straight (1-5, 2-6, 3-7)", "Four-of-a-kind", "Single pair (non-7s, no straight)"] },
  { tier: 3, outcomes: ["Three-of-a-kind", "Four + three"] },
  { tier: 2, outcomes: ["Full house + pair", "Three pairs", "Two triples"] },
  { tier: 1, outcomes: ["Full house", "Two pairs", "Four-of-a-kind + pair"] }
];

export function renderLuckyDice(
  data: LuckyDiceData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getLuckyDiceState();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const session = data.session;
  const lastResult = data.lastResult;
  const boardRevealed = getLuckyDiceBoardRevealed();
  const finalRevealVisible = state === LuckyDiceState.FINAL_REVEALING || state === LuckyDiceState.REVEALED;

  if (state === LuckyDiceState.IDLE) {
    const welcomeLayout = getBonusTimeWelcomeLayout(rect, LUCKY_DICE_WELCOME_LAYOUT_OPTIONS);

    renderBonusTimeWelcomeCard(renderer, rect, {
      ...LUCKY_DICE_WELCOME_LAYOUT_OPTIONS,
      title: "LUCKY DICE",
      bodyLines: [
        "Throw seven dice and hold what you like before rerolls.",
        "Streak 0-15: 1 throw | 16-30: 2 throws | 31+: 3 throws",
        `Your current streak gives you ${data.throwsFromStreak} throw${data.throwsFromStreak === 1 ? "" : "s"}.`
      ],
      streakText: `Current Streak: ${data.streak}`,
      buttonText: "THROW DICE",
      titleColor: "#ffbe4d",
      bodyColor: "#edf2f7",
      streakColor: "#52df87",
      accentColor: "#ffbe4d",
      glowColor: [255, 190, 77, 255],
      backgroundColor: "#120d24",
      buttonActive: isPointInBonusTimeWelcomeButton(pointer, welcomeLayout)
    });
    return;
  }

  if (!session && !finalRevealVisible) {
    renderer.drawText({
      text: "ROLLING DICE...",
      x: centerX,
      y: centerY,
      font: BONUSTIME_TITLE_FONT,
      color: "#edf2f7",
      align: "center",
      baseline: "middle"
    });
    return;
  }

  const layout = getLuckyDiceLayout(rect);
  const hoveredDie = getLuckyDiceHoveredDieIndex();
  const heldIndexes = getLuckyDiceHeldIndexes();
  const currentTier = session && Number.isInteger(session.currentTier) && session.currentTier !== null
    ? session.currentTier
    : null;
  const hasBoard = boardRevealed && !!session && session.currentDice.length === 7;
  const finalTier = Number.isInteger(lastResult?.tier) ? lastResult?.tier ?? null : null;
  const finalDiceVisible = state === LuckyDiceState.FINAL_REVEALING || state === LuckyDiceState.REVEALED;
  const centerActionButton = shouldCenterLuckyDiceActionButton(session);
  const showClaimButton = shouldShowLuckyDiceClaimButton(session);
  const showCurrentHand = shouldShowLuckyDiceCurrentHand(session);
  const actionButtonRect = getLuckyDiceThrowButtonRect(layout, rect, centerActionButton);
  const throwsRemaining =
    session
      ? (boardRevealed ? session.throwsRemaining : Math.min(session.throwsTotal, session.throwsRemaining + 1))
      : (finalRevealVisible ? null : data.throwsFromStreak);
  const throwsText = throwsRemaining === null ? null : `Throws: ${throwsRemaining}`;
  const currentHandText = session?.currentOutcome
    ? `Current hand: ${session.currentOutcome} (T${currentTier})`
    : `Current hand: T${currentTier}`;
  renderer.drawText({
    text: "LUCKY DICE",
    x: rect.x + 36,
    y: rect.y + 38,
    font: BONUSTIME_TITLE_FONT,
    color: "#ffbe4d",
    align: "left",
    baseline: "middle"
  });

  if (throwsText) {
    renderer.drawText({
      text: throwsText,
      x: rect.x + 36,
      y: rect.y + 72,
      font: BONUSTIME_BODY_FONT,
      color: "#edf2f7",
      align: "left",
      baseline: "middle"
    });
  }

  if (showCurrentHand) {
    renderer.drawText({
      text: currentHandText,
      x: rect.x + 36,
      y: rect.y + 102,
      font: BONUSTIME_BODY_FONT,
      color: "#52df87",
      align: "left",
      baseline: "middle"
    });
  }

  if (finalDiceVisible && finalTier !== null) {
    renderer.drawText({
      text: `Final hand: T${finalTier}`,
      x: rect.x + 36,
      y: rect.y + 102,
      font: BONUSTIME_BODY_FONT,
      color: "#52df87",
      align: "left",
      baseline: "middle"
    });
  }

  for (let i = 0; i < layout.diceRects.length; i += 1) {
    const die = layout.diceRects[i];
    const face = getLuckyDiceDieFaceValue(state, session, lastResult, i);
    const isHeld = hasBoard && heldIndexes.includes(i);
    const isHovered = hoveredDie === i;
    const baseColor = isHeld ? "#1f5136" : "#1f2937";
    const borderColor = isHeld ? "#52df87" : (isHovered ? "#ffbe4d" : "#4a5568");
    const faceText = face === null ? "-" : `${face}`;

    if (isHeld || isHovered) {
      renderer.drawGlowRect({
        x: die.x - 1,
        y: die.y - 1,
        width: die.width + 2,
        height: die.height + 2,
        color: hexToRgba(borderColor),
        radius: 10,
        intensity: isHeld ? 0.45 : 0.3,
        outerAlpha: isHeld ? 0.3 : 0.2
      });
    }

    renderer.drawRect({
      x: die.x,
      y: die.y,
      width: die.width,
      height: die.height,
      color: hexToRgba(baseColor, 0.96)
    });

    renderer.drawRect({ x: die.x, y: die.y, width: die.width, height: 2, color: hexToRgba(borderColor, 0.95) });
    renderer.drawRect({ x: die.x, y: die.y + die.height - 2, width: die.width, height: 2, color: hexToRgba(borderColor, 0.95) });
    renderer.drawRect({ x: die.x, y: die.y, width: 2, height: die.height, color: hexToRgba(borderColor, 0.95) });
    renderer.drawRect({ x: die.x + die.width - 2, y: die.y, width: 2, height: die.height, color: hexToRgba(borderColor, 0.95) });

    renderer.drawText({
      text: faceText,
      x: die.x + (die.width / 2),
      y: die.y + (die.height / 2),
      font: "bold 42px 'Outfit'",
      color: "#ffffff",
      align: "center",
      baseline: "middle"
    });

    if (isHeld) {
      renderer.drawText({
        text: "HELD",
        x: die.x + (die.width / 2),
        y: die.y + die.height + 16,
        font: "bold 14px 'Outfit'",
        color: "#52df87",
        align: "center",
        baseline: "middle"
      });
    }
  }

  const showThrowButton =
    !!session && session.throwsRemaining > 0;

  if (showThrowButton) {
    const isRollHovered = !!pointer &&
      pointer.x >= actionButtonRect.x &&
      pointer.x <= actionButtonRect.x + actionButtonRect.width &&
      pointer.y >= actionButtonRect.y &&
      pointer.y <= actionButtonRect.y + actionButtonRect.height;

    drawButton(actionButtonRect, "THROW", {
      font: BONUSTIME_BUTTON_FONT,
      active: isRollHovered
    });

    if (showClaimButton) {
      const claimRect = layout.claimButtonRect;
      const isClaimHovered = !!pointer &&
        pointer.x >= claimRect.x &&
        pointer.x <= claimRect.x + claimRect.width &&
        pointer.y >= claimRect.y &&
        pointer.y <= claimRect.y + claimRect.height;

      drawButton(claimRect, `CLAIM (T${currentTier})`, {
        font: BONUSTIME_BUTTON_FONT,
        active: isClaimHovered
      });
    }
  }

  const panelRect = layout.outcomesRect;

  renderer.drawRect({
    x: panelRect.x,
    y: panelRect.y,
    width: panelRect.width,
    height: panelRect.height,
    color: hexToRgba("#0f172a", 0.9)
  });

  renderer.drawRect({
    x: panelRect.x,
    y: panelRect.y,
    width: panelRect.width,
    height: 2,
    color: hexToRgba("#334155", 0.8)
  });

  renderer.drawText({
    text: "Tiers and Outcomes",
    x: panelRect.x + 14,
    y: panelRect.y + 18,
    font: "bold 16px 'Outfit'",
    color: "#e2e8f0",
    align: "left",
    baseline: "middle"
  });

  let lineY = panelRect.y + 40;
  for (const row of TIER_OUTCOMES) {
    renderer.drawText({
      text: `T${row.tier}: ${row.outcomes.join(" | ")}`,
      x: panelRect.x + 14,
      y: lineY,
      font: "14px 'Outfit'",
      color: "#cbd5e1",
      align: "left",
      baseline: "middle"
    });
    lineY += 18;
  }

}
