import { AreaDefinition } from "../../net/protocol";

export type AreaViewModel = {
  currentArea: string;
  availableAreas: AreaDefinition[];
  // Area specific visual state
  sage: {
    lastLevelForTip: number;
    tipStartTime: number;
    tipText: string;
  }
};

let areaViewModel: AreaViewModel = {
  currentArea: "sage",
  availableAreas: [],
  sage: {
    lastLevelForTip: -1,
    tipStartTime: 0,
    tipText: ""
  }
};

export function getAreaViewModel() {
  return areaViewModel;
}

export function updateAreaViewModel(snapshotState: any) {
  areaViewModel.currentArea = snapshotState.area;
  areaViewModel.availableAreas = [...(snapshotState.areas || [])].sort(
    (a, b) => b.unlock_level - a.unlock_level
  );
}
