import climateConfig from "../../../shared/requirements/climate.json";
import { synchronize } from "../core/time";
import { buildSeasonHudModel } from "../ui/season-hud/view-model";
import type { ClimateState } from "../net/protocol";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type RainBandConfig = {
  id: "none" | "very_light" | "light" | "moderate" | "heavy" | "torrential";
  min_mm: number;
  max_mm: number;
};

type ClimateSharedConfig = {
  rain_bands: RainBandConfig[];
};

function resolveExpectedRainBandIconPath(rainBandId: RainBandConfig["id"], isDay: boolean): string {
  const suffix = isDay ? "day" : "night";

  switch (rainBandId) {
    case "none":
      return `images/ui/climate/none-${suffix}.png`;
    case "very_light":
      return `images/ui/climate/very_light-${suffix}.png`;
    case "light":
      return `images/ui/climate/light-${suffix}.png`;
    case "moderate":
      return `images/ui/climate/moderate-${suffix}.png`;
    case "heavy":
      return "images/ui/climate/heavy.png";
    case "torrential":
      return "images/ui/climate/torrential.png";
  }
}

function runClimateRainBandFlow() {
  const climateSharedConfig = climateConfig as ClimateSharedConfig;
  const dayAnchorIso = "2026-05-28T12:00:00Z";
  const nightAnchorIso = "2026-05-28T13:00:00Z";
  const baseClimate: ClimateState = {
    epoch_at: dayAnchorIso,
    year: 1008,
    day_in_year: 1,
    temperature_c: 22,
    rain_mm: 0
  };

  for (const rainBand of climateSharedConfig.rain_bands) {
    const sampleValues = rainBand.id === "none" ? [0] : [rainBand.min_mm];

    for (const rainMmPerHour of sampleValues) {
      synchronize(dayAnchorIso);
      const model = buildSeasonHudModel({
        ...baseClimate,
        rain_mm: rainMmPerHour / 60
      });

      assert(model !== null, "Season HUD should build a model");
      assert(
        model.iconPath === resolveExpectedRainBandIconPath(rainBand.id, true),
        `Season HUD should use the shared rain band ${rainBand.id} day icon for ${rainMmPerHour} mm/h`
      );

      synchronize(nightAnchorIso);
      const nightModel = buildSeasonHudModel({
        ...baseClimate,
        rain_mm: rainMmPerHour / 60
      });

      assert(nightModel !== null, "Season HUD should build a night model");
      assert(
        nightModel.iconPath === resolveExpectedRainBandIconPath(rainBand.id, false),
        `Season HUD should use the shared rain band ${rainBand.id} night icon for ${rainMmPerHour} mm/h`
      );
    }
  }
}

function main() {
  runClimateRainBandFlow();
  console.log("climate tests passed");
}

main();
