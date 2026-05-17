import { AchievementState, GameSnapshot } from '../../../../../net/protocol';

export function getAchievementViewModel(snapshot: GameSnapshot) {
  const achievements = Object.entries(snapshot.state.achievements).map(([id, a]) => ({ id, ...a }));
  
  // Sort: Unlocked first (by date desc), then locked
  return achievements.sort((a, b) => {
    if (a.unlocked_at && b.unlocked_at) {
      const comp = b.unlocked_at.localeCompare(a.unlocked_at);
      if (comp !== 0) return comp;
      return a.name.localeCompare(b.name);
    }
    if (a.unlocked_at) return -1;
    if (b.unlocked_at) return 1;
    return a.name.localeCompare(b.name);
  });
}
