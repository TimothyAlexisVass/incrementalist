import { AchievementState, GameSnapshot } from '../../../../../net/protocol';

export function getAchievementViewModel(
  snapshot: GameSnapshot,
  hasLeafNotice: (leafId: string) => boolean = () => false
) {
  const achievements = Object.entries(snapshot.state.achievements).map(([id, a]) => ({ id, ...a }));

  // Sort order:
  // 1) Newly achieved with leaf notice
  // 2) Non-achieved
  // 3) Achieved
  return achievements.sort((a, b) => {
    const bucketOf = (achievement: AchievementState & { id: string }) => {
      const leafId = `leaf.achievement.${achievement.id}.unlocked`;
      if (hasLeafNotice(leafId)) return 0;
      if (!achievement.unlocked_at) return 1;
      return 2;
    };

    const bucketA = bucketOf(a);
    const bucketB = bucketOf(b);
    if (bucketA !== bucketB) return bucketA - bucketB;

    if (a.unlocked_at && b.unlocked_at) {
      const comp = b.unlocked_at.localeCompare(a.unlocked_at);
      if (comp !== 0) return comp;
      return a.name.localeCompare(b.name);
    }

    return a.name.localeCompare(b.name);
  });
}
