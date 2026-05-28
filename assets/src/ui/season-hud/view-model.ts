import { getServerNow } from "../../core/time";
import type { ClimateState } from "../../net/protocol";
import climateConfig from "../../../../shared/requirements/climate.json";
import { COLORS } from "../../colors";
import { SMALL_TEXT_FONT } from "../../config";

type RainBandId = "none" | "very_light" | "light" | "moderate" | "heavy" | "torrential";
type SeasonConfig = {
  id: string;
  label: string;
  temperature: {
    min_c: number;
    max_c: number;
  };
  rain_chance_per_hour: number;
};
type ClimateSharedConfig = {
  epoch_utc: string;
  year_start: number;
  hour_ms: number;
  day_hours: number;
  game_day_start_hour: number;
  game_night_start_hour: number;
  days_per_season: number;
  seasons: SeasonConfig[];
  rain_bands: RainBandConfig[];
};
type RainBandConfig = {
  id: RainBandId;
  min_mm: number;
  max_mm: number;
  weight?: number;
};
type ClimateProjection = {
  year: number;
  dayInYear: number;
  seasonLabel: string;
  isDay: boolean;
  timeText: string;
};

const climateSharedConfig = climateConfig as ClimateSharedConfig;
const MINUTES_PER_HOUR = 60;
const DEFAULT_SEASONS: SeasonConfig[] = [
  {
    id: "spring",
    label: "Spring",
    temperature: { min_c: 18, max_c: 30 },
    rain_chance_per_hour: 0.16
  }
];

export type SeasonHudModel = {
  leftText: string;
  rightText: string;
  iconPath: string;
};

export function buildSeasonHudModel(climate: ClimateState | null | undefined): SeasonHudModel | null {
  if (!climate) return null;

  const projection = projectClimate(climate);
  const temperature = Math.round(climate.temperature_c);
  const rainBand = resolveRainBandIdFromPerMinute(climate.rain_mm);

  return {
    leftText: `Year ${projection.year} Day ${projection.dayInYear}, ${projection.seasonLabel}`,
    rightText: `${temperature}ºC   ${projection.timeText}`,
    iconPath: resolveIconPath(rainBand, projection.isDay)
  };
}

function projectClimate(climate: ClimateState): ClimateProjection {
  const epochMs = Date.parse(climate.epoch_at);
  const fallbackEpochMs = Date.parse(climateSharedConfig.epoch_utc);
  const nowMs = getServerNow();
  const safeEpochMs = Number.isFinite(epochMs)
    ? epochMs
    : Number.isFinite(fallbackEpochMs)
      ? fallbackEpochMs
      : nowMs;
  const elapsedMs = Math.max(0, nowMs - safeEpochMs);

  const hourMs = Math.max(1, climateSharedConfig.hour_ms || 3_600_000);
  const hoursPerDay = Math.max(1, climateSharedConfig.day_hours || 2);
  const daysPerSeason = Math.max(1, climateSharedConfig.days_per_season || 84);
  const yearStart = Number.isFinite(climateSharedConfig.year_start)
    ? climateSharedConfig.year_start
    : 1;
  const seasons = climateSharedConfig.seasons.length > 0 ? climateSharedConfig.seasons : DEFAULT_SEASONS;
  const seasonsPerYear = Math.max(1, seasons.length);
  const hoursPerSeason = hoursPerDay * daysPerSeason;
  const hoursPerYear = Math.max(1, hoursPerSeason * seasonsPerYear);

  const elapsedHours = Math.max(0, Math.floor(elapsedMs / hourMs));
  const year = yearStart + Math.floor(elapsedHours / hoursPerYear);
  const hourInYear = positiveMod(elapsedHours, hoursPerYear);
  const dayInYear = Math.floor(hourInYear / hoursPerDay) + 1;

  const seasonIndex = Math.floor((dayInYear - 1) / daysPerSeason) % seasonsPerYear;
  const seasonLabel = seasons[seasonIndex]?.label || DEFAULT_SEASONS[0].label;

  const gameHoursPerRealHour = 24 / hoursPerDay;
  const dayStartHour = Number.isFinite(climateSharedConfig.game_day_start_hour)
    ? climateSharedConfig.game_day_start_hour
    : 8;
  const nightStartHour = Number.isFinite(climateSharedConfig.game_night_start_hour)
    ? climateSharedConfig.game_night_start_hour
    : 20;

  const elapsedRealHours = elapsedMs / hourMs;
  const elapsedGameMinutes = Math.floor(elapsedRealHours * gameHoursPerRealHour * 60);
  const totalMinutes = positiveMod(dayStartHour * 60 + elapsedGameMinutes, 24 * 60);

  const gameHour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const isDay = gameHour >= dayStartHour && gameHour < nightStartHour;

  return {
    year,
    dayInYear,
    seasonLabel,
    isDay,
    timeText: `${pad2(gameHour)}:${pad2(minute)}`
  };
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function resolveRainBandIdFromPerMinute(rainMmPerMinute: number): RainBandId {
  return resolveRainBandId(rainMmPerMinute * MINUTES_PER_HOUR);
}

function resolveRainBandId(rainMmPerHour: number): RainBandId {
  if (!Number.isFinite(rainMmPerHour) || rainMmPerHour <= 0) return "none";

  const rainyBands = climateSharedConfig.rain_bands.filter((band) => band.id !== "none");
  const matchingBand = rainyBands.find((band) => rainMmPerHour >= band.min_mm && rainMmPerHour <= band.max_mm);

  if (matchingBand) return matchingBand.id;

  const overflowBand = rainyBands[rainyBands.length - 1];
  if (overflowBand) return overflowBand.id;
  return "none";
}

function resolveWeatherLabel(rainBand: RainBandId, isDay: boolean): string {
  switch (rainBand) {
    case "very_light":
      return "very light rain";
    case "light":
      return "light rain";
    case "moderate":
      return "moderate rain";
    case "heavy":
      return "heavy rain";
    case "torrential":
      return "torrential rain";
    default:
      return isDay ? "sunny" : "clear";
  }
}

function resolveIconPath(rainIntensity: RainBandId, isDay: boolean): string {
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

export type SeasonHudTooltipData = {
  lines: string[];
  lineColors: string[];
  lineFonts: string[];
};

export function buildSeasonHudTooltip(climate: ClimateState | null | undefined): SeasonHudTooltipData | null {
  if (!climate) return null;

  const projection = projectClimate(climate);
  const isDay = projection.isDay;
  const hoursPerDay = Math.max(1, climateSharedConfig.day_hours || 2);
  const gameHoursPerRealHour = 24 / hoursPerDay;
  const realMinutesPerGameHour = MINUTES_PER_HOUR / gameHoursPerRealHour;
  const rainBand = resolveRainBandIdFromPerMinute(climate.rain_mm);

  // Currently weather label
  const weatherLabel = resolveWeatherLabel(rainBand, isDay);

  const lines: string[] = [];
  const lineColors: string[] = [];
  const lineFonts: string[] = [];

  // 1. Currently <weather>
  lines.push(`Currently ${weatherLabel}`);
  lineColors.push(COLORS.panel.textPrimary);
  lineFonts.push("bold 13px Arial");

  // 2. If raining, calculated mm/in-game-hour
  if (climate.rain_mm > 0) {
    const rainfallPerGameHour = climate.rain_mm * realMinutesPerGameHour;
    lines.push(`${rainfallPerGameHour.toFixed(1)} mm/game-hour`);
    lineColors.push(COLORS.panel.textSecondary);
    lineFonts.push(SMALL_TEXT_FONT);
  }

  // 3. Separator (blank line)
  lines.push("");
  lineColors.push(COLORS.panel.textSecondary);
  lineFonts.push(SMALL_TEXT_FONT);

  // 4. Forecast header
  lines.push(`Forecast for ${isDay ? "tonight" : "tomorrow"}`);
  lineColors.push(COLORS.panel.textPrimary);
  lineFonts.push("bold 13px Arial");

  // 5. Forecast details: next season bounds & chance
  const seasons = climateSharedConfig.seasons.length > 0 ? climateSharedConfig.seasons : DEFAULT_SEASONS;
  const seasonsPerYear = Math.max(1, seasons.length);
  const daysPerSeason = Math.max(1, climateSharedConfig.days_per_season || 84);
  const seasonIndex = Math.floor((projection.dayInYear - 1) / daysPerSeason) % seasonsPerYear;
  const nextSeasonIndex = (seasonIndex + 1) % seasonsPerYear;
  const nextSeason = seasons[nextSeasonIndex];

  // Temperature: <min>ºC to <max>ºC
  const nextMin = nextSeason.temperature?.min_c ?? 18;
  const nextMax = nextSeason.temperature?.max_c ?? 30;
  lines.push(`Between ${nextMin}ºC and ${nextMax}ºC`);
  lineColors.push(COLORS.panel.textSecondary);
  lineFonts.push(SMALL_TEXT_FONT);

  // Chance of rain <next_season chance>
  const nextRainChance = Math.round((nextSeason.rain_chance_per_hour ?? 0.16) * 100);
  lines.push(`${nextRainChance}% Chance of rain`);
  lineColors.push(COLORS.panel.textSecondary);
  lineFonts.push(SMALL_TEXT_FONT);

  return {
    lines,
    lineColors,
    lineFonts
  };
}
