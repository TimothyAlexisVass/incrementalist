import type { PlotState } from "../../../net/protocol";
import orchardPlantsConfig from "../../../../../shared/requirements/plants.json";
import { getAreaViewModel } from "../view-model";
import { toNumber } from "../../../core/bignum";


export type OrchardUvPoint = readonly [number, number];
export type OrchardHexState = "unlocked" | "locked";

export type OrchardHexagon = {
  id: string;
  points: readonly OrchardUvPoint[];
  state?: OrchardHexState;
  plotData?: PlotState | null;
};

export type OrchardViewModel = {
  hexagons: readonly OrchardHexagon[];
};

const orchardViewModel: OrchardViewModel = {
  // UV coordinates in local display-area space (0..1, 0..1).
  hexagons: [
    {
      id: "plot_30",
      points: [
        [0.3770, 0.5748], // top-right
        [0.3872, 0.5899], // right
        [0.3659, 0.6107], // bottom-right
        [0.3159, 0.6107], // bottom-left
        [0.3044, 0.5916], // left
        [0.3292, 0.5748]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_19",
      points: [
        [0.5100, 0.5739], // top-right
        [0.5254, 0.5958], // right
        [0.5107, 0.6119], // bottom-right
        [0.4643, 0.6119], // bottom-left
        [0.4458, 0.5935], // left
        [0.4650, 0.5739]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_31",
      points: [
        [0.6400, 0.5783], // top-right
        [0.6635, 0.5945], // right
        [0.6535, 0.6131], // bottom-right
        [0.6056, 0.6131], // bottom-left
        [0.5830, 0.5935], // left
        [0.5950, 0.5783]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_28",
      points: [
        [0.2968, 0.5927], // top-right
        [0.3085, 0.6126], // right
        [0.2802, 0.6370], // bottom-right
        [0.2322, 0.6370], // bottom-left
        [0.2225, 0.6131], // left
        [0.2519, 0.5927]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_17",
      points: [
        [0.4396, 0.5939], // top-right
        [0.4554, 0.6150], // right
        [0.4349, 0.6382], // bottom-right
        [0.3848, 0.6382], // bottom-left
        [0.3718, 0.6133], // left
        [0.3946, 0.5938]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_18",
      points: [
        [0.5781, 0.5950], // top-right
        [0.5996, 0.6162], // right
        [0.5853, 0.6382], // bottom-right
        [0.5367, 0.6382], // bottom-left
        [0.5160, 0.6145], // left
        [0.5338, 0.5938]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_29",
      points: [
        [0.7166, 0.5962], // top-right
        [0.7445, 0.6174], // right
        [0.7358, 0.6382], // bottom-right
        [0.6858, 0.6394], // bottom-left
        [0.6608, 0.6145], // left
        [0.6724, 0.5950]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_15",
      points: [
        [0.3650, 0.6165], // top-right
        [0.3774, 0.6400], // right
        [0.3498, 0.6668], // bottom-right
        [0.2983, 0.6668], // bottom-left
        [0.2860, 0.6396], // left
        [0.3145, 0.6165] // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_2",
      points: [
        [0.5100, 0.6181], // top-right
        [0.5288, 0.6424], // right
        [0.5133, 0.6670], // bottom-right
        [0.4593, 0.6673], // bottom-left
        [0.4411, 0.6404], // left
        [0.4622, 0.6181] // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_16",
      points: [
        [0.6541, 0.6177], // top-right
        [0.6812, 0.6424], // right
        [0.6697, 0.6668], // bottom-right
        [0.6161, 0.6668], // bottom-left
        [0.5910, 0.6406], // left
        [0.6063, 0.6177] // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_26",
      points: [
        [0.2779, 0.6428], // top-right
        [0.2905, 0.6680], // right
        [0.2575, 0.6966], // bottom-right
        [0.2034, 0.6964], // bottom-left
        [0.1950, 0.6700], // left
        [0.2287, 0.6428] // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_7",
      points: [
        [0.4340, 0.6428], // top-right
        [0.4505, 0.6699], // right
        [0.4264, 0.6966], // bottom-right
        [0.3721, 0.6975], // bottom-left
        [0.3558, 0.6692], // left
        [0.3841, 0.6428] // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_3",
      points: [
        [0.5865, 0.6440], // top-right
        [0.6108, 0.6711], // right
        [0.5945, 0.6990], // bottom-right
        [0.5409, 0.6990], // bottom-left
        [0.5180, 0.6698], // left
        [0.5381, 0.6440] // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_27",
      points: [
        [0.7356, 0.6440], // top-right
        [0.7691, 0.6723], // right
        [0.7611, 0.7002], // bottom-right
        [0.7069, 0.7002], // bottom-left
        [0.6767, 0.6705], // left
        [0.6886, 0.6440] // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_13",
      points: [
        [0.3496, 0.6714], // top-right
        [0.3640, 0.7021], // right
        [0.3322, 0.7348], // bottom-right
        [0.2758, 0.7360], // bottom-left
        [0.2649, 0.7016], // left
        [0.2976, 0.6722]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_1",
      points: [
        [0.5109, 0.6738], // top-right
        [0.5352, 0.7021], // right
        [0.5132, 0.7372], // bottom-right
        [0.4540, 0.7384], // bottom-left
        [0.4320, 0.7028], // left
        [0.4582, 0.6726] // top-left
      ],
      state: "unlocked"
    },
    {
      id: "plot_14",
      points: [
        [0.6709, 0.6726], // top-right
        [0.7023, 0.7045], // right
        [0.6901, 0.7360], // bottom-right
        [0.6316, 0.7372], // bottom-left
        [0.6025, 0.7016], // left
        [0.6189, 0.6714]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_24",
      points: [
        [0.2553, 0.7036], // top-right
        [0.2656, 0.7379], // right
        [0.2267, 0.7790], // bottom-right
        [0.1675, 0.7766], // bottom-left
        [0.1609, 0.7374], // left
        [0.2012, 0.7036]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_6",
      points: [
        [0.4255, 0.7048], // top-right
        [0.4449, 0.7427], // right
        [0.4187, 0.7778], // bottom-right
        [0.3546, 0.7790], // bottom-left
        [0.3402, 0.7398], // left
        [0.3700, 0.7056]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_4",
      points: [
        [0.5957, 0.7060], // top-right
        [0.6242, 0.7415], // right
        [0.6071, 0.7790], // bottom-right
        [0.5444, 0.7790], // bottom-left
        [0.5188, 0.7374], // left
        [0.5402, 0.7060]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_25",
      points: [
        [0.7638, 0.7060], // top-right
        [0.8014, 0.7439], // right
        [0.7949, 0.7790], // bottom-right
        [0.7322, 0.7790], // bottom-left
        [0.6974, 0.7398], // left
        [0.7096, 0.7072]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_11",
      points: [
        [0.3306, 0.7442], // top-right
        [0.3465, 0.7844], // right
        [0.3097, 0.8291], // bottom-right
        [0.2456, 0.8267], // bottom-left
        [0.2327, 0.7840], // left
        [0.2709, 0.7445]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_5",
      points: [
        [0.5120, 0.7454], // top-right
        [0.5356, 0.7832], // right
        [0.5101, 0.8291], // bottom-right
        [0.4481, 0.8291], // bottom-left
        [0.4232, 0.7839], // left
        [0.4523, 0.7454] // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_12",
      points: [
        [0.6920, 0.7442], // top-right
        [0.7276, 0.7844], // right
        [0.7140, 0.8291], // bottom-right
        [0.6471, 0.8291], // bottom-left
        [0.6144, 0.7827], // left
        [0.6316, 0.7442]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_22",
      points: [
        [0.2244, 0.7860], // top-right
        [0.2353, 0.8322], // right
        [0.1894, 0.8852], // bottom-right
        [0.1232, 0.8852], // bottom-left
        [0.1152, 0.8353], // left
        [0.1640, 0.7860]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_9",
      points: [
        [0.4157, 0.7860], // top-right
        [0.4372, 0.8322], // right
        [0.4046, 0.8864], // bottom-right
        [0.3377, 0.8864], // bottom-left
        [0.3170, 0.8329], // left
        [0.3538, 0.7860]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_10",
      points: [
        [0.6069, 0.7860], // top-right
        [0.6383, 0.8357], // right
        [0.6177, 0.8864], // bottom-right
        [0.5507, 0.8876], // bottom-left
        [0.5181, 0.8329], // left
        [0.5458, 0.7883]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_23",
      points: [
        [0.7968, 0.7884], // top-right
        [0.8436, 0.8393], // right
        [0.8357, 0.8864], // bottom-right
        [0.7687, 0.8876], // bottom-left
        [0.7234, 0.8329], // left
        [0.7364, 0.7895]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_20",
      points: [
        [0.3081, 0.8397], // top-right
        [0.3232, 0.8918], // right
        [0.2830, 0.9496], // bottom-right
        [0.2090, 0.9496], // bottom-left
        [0.1960, 0.8901], // left
        [0.2420, 0.8397]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_8",
      points: [
        [0.5104, 0.8406], // top-right
        [0.5395, 0.8961], // right
        [0.5142, 0.9510], // bottom-right
        [0.4354, 0.9510], // bottom-left
        [0.4108, 0.8961], // left
        [0.4444, 0.8406]  // top-left
      ],
      state: "locked"
    },
    {
      id: "plot_21",
      points: [
        [0.7152, 0.8397], // top-right
        [0.7578, 0.8978], // right
        [0.7407, 0.9496], // bottom-right
        [0.6640, 0.9496], // bottom-left
        [0.6264, 0.8911], // left
        [0.6499, 0.8419]  // top-left
      ],
      state: "locked"
    }
  ]
};

export function getOrchardViewModel() {
  return orchardViewModel;
}

export function orchardHexPoints(hex: OrchardHexagon): readonly OrchardUvPoint[] {
  return hex.points;
}

export function orchardHexState(hex: OrchardHexagon): OrchardHexState {
  return hex.state ?? "locked";
}

export function syncOrchardFromSnapshot(snapshotState: any) {
  const unlocked = new Set(snapshotState.unlocked_plots || ["plot_16"]);
  const plotsList = snapshotState.plots || [];
  const plotsMap = new Map(plotsList.map((p: any) => [p.id, p]));

  for (const hex of orchardViewModel.hexagons as any) {
    hex.state = unlocked.has(hex.id) ? "unlocked" : "locked";
    hex.plotData = plotsMap.get(hex.id) || null;
  }
}

export function tickOrchardProjections(deltaTimeMs: number) {
  const { soil, climate } = getAreaViewModel().orchard;
  if (!soil || !climate) return;

  for (const hex of orchardViewModel.hexagons as any) {
    if (hex.plotData && hex.plotData.plant) {
      const plant = hex.plotData.plant;
      if (plant.growth < 100.0) {
        const spec = (orchardPlantsConfig as any)[plant.plant_id];
        if (spec) {
          const minTemp = spec.minTemp ?? 0.0;
          const minWater = spec.minWater ?? 0.0;

          if (climate.temperature_c >= minTemp && soil.water >= minWater) {
            const nRatio = getNutrientRatio(soil.nitrogen, spec.nitrogen);
            const kRatio = getNutrientRatio(soil.potassium, spec.potassium);

            const growthBoost = 1.0 + nRatio * 0.5 + kRatio * 0.5;
            const baseRate = (spec.baseGrowthTime ?? 100.0) / 60.0;
            const ratePerMs = baseRate / (60.0 * 1000.0);

            const addedProgress = ratePerMs * growthBoost * deltaTimeMs;
            plant.growth = Math.min(100.0, plant.growth + addedProgress);
          }
        }
      }
    }

    if (hex.plotData && hex.plotData.decomposition) {
      const decomp = hex.plotData.decomposition;
      if (decomp.progress < 100.0) {
        const ratePerMs = 10.0 / (60.0 * 1000.0);
        decomp.progress = Math.min(100.0, decomp.progress + ratePerMs * deltaTimeMs);
      }
    }
  }
}

function getNutrientRatio(soilVal: any, limit: { min: number; max: number } | null | undefined): number {
  if (!limit) return 0;
  const maxVal = limit.max;
  if (!maxVal) return 0;
  const soilFloat = toNumber(soilVal);
  if (maxVal > 0) {
    return Math.min(1.0, soilFloat / maxVal);
  }
  return 0;
}
