import { InteractionState, pointInRect } from '../../../../managers/interactions';
import { QuestState } from '../../../../../net/protocol';
import { isQuestClaimClicked } from '../../../../components/cards/quest';
import { getNetwork } from '../../view-model';
import { notices } from '../../../../managers/notices';

export function handleQuestInteractions(
  input: InteractionState,
  quests: QuestState[],
  listRect: { x: number; y: number; width: number; height: number },
  scrollOffsetY: number,
  cardWidth: number,
  cardHeight: number,
  cardGap: number
) {
  if (!input.clicked || input.consumed) return;

  const { channel, runCommand } = getNetwork();
  if (!channel || !runCommand) return;

  const pointer = input.pointer;
  if (!pointInRect(pointer, listRect)) return;

  const startY = listRect.y - scrollOffsetY;
  
  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    const cardY = startY + (i * (cardHeight + cardGap));

    if (cardY >= listRect.y + listRect.height) break;
    if (cardY + cardHeight <= listRect.y) continue;

    const cardRect = {
      x: listRect.x,
      y: cardY,
      width: cardWidth,
      height: cardHeight
    };

    if (quest.rank > quest.claimed_rank && pointer && isQuestClaimClicked(pointer, cardRect)) {
      notices.reportLeafClicked(`leaf.quest.${(quest as any).id}.claim_button`, channel, runCommand);
      runCommand(() => channel.pushCommand("quest.claim", { quest_id: (quest as any).id }));
      input.consumed = true;
      return;
    }
  }
}
