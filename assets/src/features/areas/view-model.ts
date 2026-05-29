import { AreaDefinition, ClimateState, SoilState } from "../../net/protocol";
import { getAreaPresentation, getFurnaceLevelPresentation } from "../requirements";
import { syncCloverfieldFromSnapshot } from "./cloverfield/view-model";
import { syncOrchardFromSnapshot } from "./orchard/view-model";

export type AreaViewModel = {
  currentArea: string;
  availableAreas: AreaDefinition[];
  furnaceLevel: number;
  // Area specific visual state
  sage: {
    lastLevelForTip: number;
    tipStartTime: number;
    tipText: string;
  };
  orchard: {
    soil: SoilState | null;
    climate: ClimateState | null;
  };
};

let areaViewModel: AreaViewModel = {
  currentArea: "sage",
  availableAreas: [],
  furnaceLevel: 1,
  sage: {
    lastLevelForTip: -1,
    tipStartTime: 0,
    tipText: ""
  },
  orchard: {
    soil: null,
    climate: null
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
  areaViewModel.orchard.soil = snapshotState.soil || null;
  areaViewModel.orchard.climate = snapshotState.climate || null;
  syncCloverfieldFromSnapshot(snapshotState.clover_hunt);
  syncOrchardFromSnapshot(snapshotState);
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
