import sisu from "../../../../shared/requirements/sisu.json";
import type { BigNum } from "../../core/bignum";

type SharedSisuRequirements = {
  base_max: number;
  per_level: number;
  upgrade_costs: BigNum[];
};

const requirements = sisu as SharedSisuRequirements;

export const SISU_BASE_MAX = requirements.base_max;
export const SISU_PER_LEVEL = requirements.per_level;
export const UPGRADE_COSTS = Object.freeze([...requirements.upgrade_costs]);
export const SISU_MAX_UPGRADE_LEVEL = UPGRADE_COSTS.length - 1;
