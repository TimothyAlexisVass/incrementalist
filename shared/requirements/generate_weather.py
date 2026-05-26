#!/usr/bin/env python3
"""
Generate weather projections into shared/requirements/weather.json.

Usage:
  python3 shared/requirements/generate_weather.py <days>
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
CLIMATE_PATH = BASE_DIR / "climate.json"
WEATHER_PATH = BASE_DIR / "weather.json"


def load_climate() -> dict[str, Any]:
    with CLIMATE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def torrential_band_max_mm(climate: dict[str, Any]) -> int:
    for band in climate["rain_bands"]:
        if band.get("id") == "torrential":
            return int(band["max_mm"])

    raise ValueError("climate.rain_bands must include a torrential band")


def pick_weighted_band(rain_bands: list[dict[str, Any]], rng: random.Random) -> dict[str, Any]:
    total_weight = sum(int(band.get("weight", 0)) for band in rain_bands)
    if total_weight <= 0:
        raise ValueError("rain_bands must include positive weights")

    roll = rng.uniform(0, total_weight)
    cursor = 0.0
    for band in rain_bands:
        cursor += int(band.get("weight", 0))
        if roll <= cursor:
            return band

    return rain_bands[-1]


def roll_temperature(
    min_c: int,
    max_c: int,
    mm: int,
    rainfall_max_mm: int,
    is_day: bool,
    rng: random.Random,
) -> int:
    if max_c <= min_c:
        return min_c

    if rainfall_max_mm <= 0:
        rainfall_max_mm = 1

    wetness = max(0.0, min(1.0, mm / rainfall_max_mm))

    # More rain biases toward colder values, less rain biases toward warmer values.
    mode_ratio = 1.0 - wetness

    # Nights are colder on average, but max temperature is still possible.
    if not is_day:
        mode_ratio = max(0.0, mode_ratio - 0.18)

    temp_ratio = rng.triangular(0.0, 1.0, mode_ratio)

    value = min_c + temp_ratio * (max_c - min_c)
    return int(round(value))


def generate_weather(days: int, climate: dict[str, Any]) -> list[dict[str, int]]:
    if days <= 0:
        raise ValueError("days must be a positive integer")

    day_hours = int(climate["day_hours"])
    days_per_season = int(climate["days_per_season"])
    rainfall_max_mm = torrential_band_max_mm(climate)
    game_day_start_hour = int(climate["game_day_start_hour"])
    game_night_start_hour = int(climate["game_night_start_hour"])

    if day_hours <= 0:
        raise ValueError("climate.day_hours must be a positive integer")

    seasons: list[dict[str, Any]] = climate["seasons"]
    if not seasons:
        raise ValueError("climate.seasons cannot be empty")

    rainy_bands = [band for band in climate["rain_bands"] if band.get("id") != "none"]
    if not rainy_bands:
        raise ValueError("climate.rain_bands must include at least one rainy band")

    rng = random.Random()
    output: list[dict[str, int]] = []

    for day_index in range(days):
        season_index = (day_index // days_per_season) % len(seasons)
        season = seasons[season_index]
        rain_chance = float(season["rain_chance_per_hour"])

        min_c = int(season["temperature"]["min_c"])
        max_c = int(season["temperature"]["max_c"])

        for hour_in_day in range(day_hours):
            elapsed_hour = day_index * day_hours + hour_in_day
            is_day = is_day_hour(
                elapsed_hour,
                day_hours,
                game_day_start_hour,
                game_night_start_hour,
            )

            if rng.random() < rain_chance:
                rain_band = pick_weighted_band(rainy_bands, rng)
                mm = rng.randint(int(rain_band["min_mm"]), int(rain_band["max_mm"]))
            else:
                mm = 0

            c = roll_temperature(min_c, max_c, mm, rainfall_max_mm, is_day, rng)
            output.append({"mm": mm, "c": c})

    return output


def is_day_hour(
    elapsed_hour: int,
    hours_per_day: int,
    game_day_start_hour: int,
    game_night_start_hour: int,
) -> bool:
    game_total_minutes = (
        game_day_start_hour * 60
        + int(elapsed_hour * (24 / hours_per_day) * 60)
    ) % (24 * 60)
    game_hour = game_total_minutes // 60
    return game_day_start_hour <= game_hour < game_night_start_hour


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: python3 shared/requirements/generate_weather.py <days>")
        return 1

    try:
        days = int(argv[1])
    except ValueError:
        print("days must be an integer")
        return 1

    climate = load_climate()
    data = generate_weather(days, climate)

    with WEATHER_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Wrote {len(data)} weather entries to {WEATHER_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
