import { compare as compareBigNum } from '../../../../../core/bignum';
import { ServerState } from '../../../../../net/snapshots';
import { QuestState } from '../../../../../net/protocol';

export interface QuestViewModel {
  dailyQuests: (QuestState & { id: string })[];
  mainQuests: (QuestState & { id: string })[];
}

export function getQuestViewModel(state: ServerState): QuestViewModel {
  const quests = state.snapshot?.state.quests || {};

  const questList = Object.entries(quests).map(([id, q]) => ({ id, ...q }));

  const sortQuests = (a: QuestState & { id: string }, b: QuestState & { id: string }) => {
    // 1. Ready to claim first (rank > claimed_rank)
    const readyA = a.rank > a.claimed_rank ? 1 : 0;
    const readyB = b.rank > b.claimed_rank ? 1 : 0;
    if (readyA !== readyB) {
      return readyB - readyA; // 1 (ready) comes before 0 (not ready)
    }

    // 2. Rank ascending (target rank = claimed_rank + 1, clamped to max_rank)
    const rankA = Math.min(a.claimed_rank + 1, a.max_rank);
    const rankB = Math.min(b.claimed_rank + 1, b.max_rank);
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // 3. Fame ascending
    const fameA = a.fame || { m: 0, e: 0 };
    const fameB = b.fame || { m: 0, e: 0 };
    const fameComp = compareBigNum(fameA, fameB);
    if (fameComp !== 0) {
      return fameComp;
    }

    // 4. Stable fallback by ID ascending
    return a.id.localeCompare(b.id);
  };

  return {
    dailyQuests: questList.filter(q => q.category === 'daily').sort(sortQuests),
    mainQuests: questList.filter(q => q.category === 'main').sort(sortQuests)
  };
}
