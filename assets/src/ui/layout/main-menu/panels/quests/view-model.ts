import { ServerState } from '../../../../../net/snapshots';
import { QuestState } from '../../../../../net/protocol';

export interface QuestViewModel {
  dailyQuests: QuestState[];
  mainQuests: QuestState[];
}

export function getQuestViewModel(state: ServerState): QuestViewModel {
  const quests = state.snapshot?.state.quests || {};
  const questList = Object.entries(quests).map(([id, q]) => ({ id, ...q }));

  return {
    dailyQuests: questList.filter(q => q.category === 'daily').sort((a, b) => a.id.localeCompare(b.id)),
    mainQuests: questList.filter(q => q.category === 'main').sort((a, b) => a.id.localeCompare(b.id))
  };
}
