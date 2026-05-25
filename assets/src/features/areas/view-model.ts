import { AreaDefinition } from "../../net/protocol";
import { getAreaPresentation, getFurnaceLevelPresentation } from "../requirements";
import { syncCloverfieldFromSnapshot } from "./cloverfield/view-model";

export type AreaViewModel = {
  currentArea: string;
  availableAreas: AreaDefinition[];
  furnaceLevel: number;
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
  furnaceLevel: 1,
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
  areaViewModel.furnaceLevel = snapshotState.furnace_level ?? 1;
  areaViewModel.availableAreas = (snapshotState.areas || [])
    .map((area: AreaDefinition) => resolveAreaPresentation(area, areaViewModel.furnaceLevel))
    .sort((a: AreaDefinition, b: AreaDefinition) => b.unlock_level - a.unlock_level);
  syncCloverfieldFromSnapshot(snapshotState.clover_hunt);
}

function resolveAreaPresentation(area: AreaDefinition, furnaceLevel: number): AreaDefinition {
  const sharedArea = getAreaPresentation(area.key);
  const nextArea = {
    ...area,
    name: sharedArea?.name ?? area.name,
    description: sharedArea?.description ?? area.description
  };

  if (area.key !== "furnace") return nextArea;

  const furnacePresentation = getFurnaceLevelPresentation(furnaceLevel);
  return {
    ...nextArea,
    name: furnacePresentation.name,
    description: furnacePresentation.description
  };
}
