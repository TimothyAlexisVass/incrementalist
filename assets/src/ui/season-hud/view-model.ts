import { getServerNow } from "../../core/time";
import type { ClimateRainIntensity, ClimateState } from "../../net/protocol";

export type SeasonHudModel = {
  leftText: string;
  rightText: string;
  iconPath: string;
};

export function buildSeasonHudModel(climate: ClimateState | null | undefined): SeasonHudModel | null {
  if (!climate) return null;

  const time = projectedGameTime(climate);
  const temperature = Math.round(climate.temperature_c);
  const day = Math.max(1, climate.day_in_year || 1);
  const isDay = climate.day_phase === "day";

  return {
    leftText: `Year ${climate.year} Day ${day}, ${climate.season_label}`,
    rightText: `${temperature}ºC   ${time}`,
    iconPath: resolveIconPath(climate.rain_intensity, isDay)
  };
}

function projectedGameTime(climate: ClimateState): string {
  const epochMs = Date.parse(climate.epoch_at);
  const nowMs = getServerNow();
  const safeEpochMs = Number.isFinite(epochMs) ? epochMs : nowMs;
  const elapsedMs = Math.max(0, nowMs - safeEpochMs);

  const hourMs = Math.max(1, climate.hour_ms || 3_600_000);
  const hoursPerDay = Math.max(1, climate.hours_per_day || 2);
  const gameHoursPerRealHour = 24 / hoursPerDay;
  const dayStartHour = Number.isFinite(climate.game_day_start_hour) ? climate.game_day_start_hour : 8;

  const elapsedRealHours = elapsedMs / hourMs;
  const elapsedGameMinutes = Math.floor(elapsedRealHours * gameHoursPerRealHour * 60);
  const totalMinutes = positiveMod(dayStartHour * 60 + elapsedGameMinutes, 24 * 60);

  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${pad2(hour)}:${pad2(minute)}`;
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function resolveIconPath(rainIntensity: ClimateRainIntensity, isDay: boolean): string {
  const suffix = isDay ? "day" : "night";

  switch (rainIntensity) {
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
    default:
      return `images/ui/climate/none-${suffix}.png`;
  }
}
