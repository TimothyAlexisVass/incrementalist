## Implementation Plan: Orchard, Market, Furnace

### 0. Global implementation in the game of Years / Days / Seasons / Weather
SEASON => Spring, Summer, Autumn, Winter (note, winters are always mild, never freezing, minimum temperature is 10 degrees Celcius)
Season updates every week
1 year in the game = 4 weeks in real time
1 season = 84 in-game days
2 real time hours = 1 in-game day
1 in-game year = 336 in-game-days

TEMPERATURE => Temperature updates every (real time) hour, each season needs temperature ranges.
Spring: 18-30
Summer: 25-40
Autumn: 15-27
Winter: 10-20

Evey in-game day has a day (1h real time) and night (1h real time)

RAIN => updates every hour 0-300mm, temperature is relative to rain! Rain means lower temperature.
Rain in 1 real time hour	Simple meaning
0 mm	No rain
1-4 mm	Very light rain
5–15 mm	Light rain
15–49 mm	Moderate rain
50–249 mm	Heavy rain
250+ mm	Torrential rain

Each season has rain chance per real time hour:
Spring: 8%
Summer: 4%
Autumn: 9%
Winter: 5%

### 1. Core Data Model

| Entity            | Purpose                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| **Seed**          | Plantable item; may be bought, gifted, found, harvested, or created by splicing.                    |
| **Plant**         | Active planted object with type, growth progress, season effects, soil effects, and harvest output. |
| **Plot**          | Holds one plant, soil values, decomposition state, plant matter, and optional mycelium.     |
| **Resource**      | Inventory item: Core, Gold, Wood, Plant Matter, Ash, Charcoal, etc.                                 |
| **Furnace**       | Upgradeable processing station with level-based recipes and fuel restrictions.                      |
| **Climate State** | Seasonal/global modifier affecting growth speed, fruit chance, demand, and price.                   |

---

# Phase 1: Orchard Entry

## Starting acquisition

| Item            | Source             | Cost / Amount         |
| --------------- | ------------------ | --------------------- |
| **Acorn**       | Orchard Shop       | 10 Core               |
| **Clover Seed** | Gifted by The Sage | First 50 Clover Seeds |

The Acorn is the first purchasable seed. The Sage gives the first 50 Clover Seeds to introduce herbaceous plants, nitrogen fixing, and the future Acorn + Clover splice path.

---

# Phase 2: Orchard System

## Plant categories

| Plant type            | Wood | Plant Matter |
| --------------------- | ---: | -----------: |
| **Trees**             |  90% |          10% |
| **Bushes**            |  40% |          60% |
| **Herbaceous plants** |   0% |         100% |

Each plant should have:

| Field              | Description                                |
| ------------------ | ------------------------------------------ |
| `seed` | seed that grows this plant |
| `size` | determines wood and plant matter amount | 
| `plantType`        | tree, bush, or herbaceous                  |
| `baseGrowthTime`   | Base growth percentage per real time hour   |
| `seedsToPlant` | Amount of seeds required to plant one plot |
| `harvestType` | resource, fruit, seed |
| `seedAmount` | chance of amount {"0": 70, "1": 25, "2": 5} means 70% chance of 0, 25% chance of 1, 5% chance of 2 |
| `harvestAmount` | chance of amount {"0": 70, "1": 25, "2-5": 5} means 70% chance of 0, 25% chance of 1, 5% chance of random between 2 and 5, or null if harvestType is seed |
| `fruit` | Which fruit this plant produces, null when harvestType != fruit |
| `seedPerFruit` | {min: BigNum, max: BigNum} or null when harvestType != fruit|
| `nitrogenFixing` | integer, will increase nitrogen by this much every real time hour |
| `nitrogen`  | {min: integer, max: integer} or null, min decides minimum required to plant seed (planting will remove half as much N), max determines cap of baseGrowthTime effect while that much N is in the soil during growth. null means unaffected by nitrogen levels |
| `phosphorus`  | {min: integer, max: integer} or null, min decides minimum required to plant seed (planting will remove half as much P), max determines cap of harvestAmount effect while that much P is in the soil during growth. null means unaffected by phosphorus levels |
| `potassium` | {min: integer, max: integer} min decides minimum required to plant seed (planting will remove half as much K), max determines cap of growthSpeed, harvestAmount and seedPerFruit effects while that much K is in the soil during growth. null means unaffected by potassium levels |
| `minDepth` | Plot depth required to plant |
| `minTemp` | Growth stops below temperature |
| `minWater` | Growth stops below water amount |
| `level` | Affects baseGrowthTime, harvestAmount, seedPerFruit, nitrogen, phosphorus, potassium, minTemp, minWater |

v1 Plants:
Clovers => seed: clover_seeds, size: 2, plantType: herbaceous, baseGrowthTime: 100, seedsToPlant: 50, harvestType: seed, seedAmount: {"20": 40, "30": 20, "40": 20, "50": 10, "75": 5, "100": 5}, havestAmount: null, fruit: null, seedPerFruit: null, nitrogenFixing: 2, nitrogen: null, phosphorus: null, potassium: null, minDepth: 0, minTemp: 0, minWater: 1, level: 1

Oak => seed: acorn, plantType: tree, size: 50, baseGrowthTime: 50, seedsToPlant: 1, harvestType: seed, seedAmount: {"0": 50, "1": 45, "2": 5}, harvestAmount: null, seedPerFruit: null, nitrogenFixing: 0, nitrogen: 4, phosphorus: null, potassium: 1, minDepth: 1, minTemp: 15, minWater: 2, level: 1

Coin Tree => seed: coin_tree_seed, size: 20, plantType: tree, baseGrowthTime: 20, seedsToPlant: 1, harvestType: resource, seedAmount: {"0": 60, "1": 20, "2": 15, "3": 5}, harvestAmount: {"1000-3000": 70, "3001-8000": 25, "8001-20000": 5}, fruit: null, seedPerFruit: null, nitrogenFixing: 0, nitrogen: 2, phosphorus: 2, potassium: 2, minDepth: 2, minTemp: 18, minWater: 2

---

# Phase 3: Splicing and Orchard shop

## Orchard Splicing Menu

| Rule     | Description       |
| -------- | ----------------- |
| Location | Splicing is done in the **Splicing modal** of the Orchard. |
| Cost     | Splicing costs in Gold, Shards and Core |
| Chance | Chance to successfully splice seeds |
| seed_a    | First seed type |
| seed_b   | second seed type |

First required splice:

coin_tree_seed => cost: 2000 gold, chance: 100%, seed_a: clover_seeds, seed_b: acorn

Successfully splicing a seed makes it available in the Orchard Shop Menu

## Orchard Shop Menu

clover_seeds => cost: 5 gold (unlocked by default)
acorn => cost: 500 gold and 5 shards (unlocked by default)
coin_tree_seed => cost: 3000 gold, 10 shards

---

# Phase 4: Soil Quality Mechanics

## Soil stats
All properties apply to the entire orchard except for Depth which is plot specific.

| Soil stat          | Improved by                        |
| ------------------ | ---------------------------------- |
| **Nitrogen**              | plants with nitrogenFixing > 0 |
| **Phosphorus**              | leaving plant matter to decompose, Mushrooms and fruit | 
| **Potassium**              | Ash from furnace | Improved composting |
| **Organic Matter** | Each decomposition cycle increases amount |
| **Depth**          | Increases to max(current_depth, plant_depth + 1) at harvest of a plant |
| **Water**          | Increases during rain, decreases every real-time hour when not raining |

Organic matter, Phosphorus, Potassium and Water decrease every real-time hour when it is not raining.
Nitrogen decreases only when no nitrogen fixers are growing.
Phosphorous leaches half as fast as Potassium and Nitrogen.
At the point where the furnace is upgraded to Clean Smelter, burning stops and the only way to get Potassium will be to research improved composting. We will defer that specific part, as the research part of the game is not yet planned.

## Soil loop

| Action                     | Result                              |
| -------------------------- | ----------------------------------- |
| Harvest plants             | Produces Wood and/or Plant Matter and Harvest. Decide what to do with Plant matter and/or Fruit  |
| Leave Plant Matter and/or fruit on plot | Sets a decomposition cycle, can inoculate mycelium if player has spores |
| Decomposition completes    | Increases Organic Matter, increases P by the amount that the increases P if inoculated, increases P if fruit was left on plot, mushroom harvest chance |
| Grow plant with nitrogenFixing amount        | Increases N.                        |
| Add Ash                    | Increases K.                        |

Plant Matter should therefore have two uses:

| Use             | Benefit                | Cost                      |
| --------------- | ---------------------- | ------------------------- |
| Burn in furnace | Ash                    | No decomposition benefit. |
| Leave on plot   | Organic Matter + mushroom chance | No fuel/ash.    |

---

# Phase 6: Furnace System

## Furnace fuels

| Fuel             | Use                     |  Burn time | Ash yield |
| ---------------- | ----------------------- | ---------: | --------: |
| **Plant Matter** | Direct burn only        | Very short |       80% |
| **Wood**         | Direct burn or charring |     Medium |        5% |
| **Charcoal**     | Direct burn or biocoke  |       Long |        0% |
| **Biocoke**      | Direct burn only.       |  Very long |        0% |

## Fuel equivalence

| Fuel              |    Burn-time value |
| ----------------- | -----------------: |
| 100 Plant Matter  |           = 5 Wood |
| 10 Wood           |       = 1 Charcoal |
| 5 Charcoal        |        = 1 Biocoke |

## Furnace rules

| Process         | Fuel allowed                         |
| --------------- | ------------------------------------ |
| Making charcoal | Wood                                 |
| Firing bricks   | Any                                  |
| Smelting ore    | Charcoal/Biocoke                     |
| Alloys          | Biocoke                              |

---

# Phase 8: Furnace Levels
Important thing. After the player has generated 500 Metal at the Coal Furnace, the Coal Furnace will be shut down and the furnace
is automatically upgrade back to the next Large Furnace, until Clean Smelting has been researched. The already stored metal, and some bricks and stone will then be used to upgrade to the "Clean Smelter".

| Furnace level        | Unlocks             |
| -------------------- | ------------------- |
| 1 **Campfire**       | Ash                 | At moment of harvest, the player gets to choose if they want to keep the plant matter in storage or leave it to decompose on the plot. Plant matter in When plant matter is burned, it will produce ash, which is stored in storage and can be used to enrich the soil with K.
| 2 **Small Furnace**  | Charcoal            | At moment of harvest, plant with wood will add wood to storage. Wood can be charred into charcoal, a more efficient fuel.
| 3 **Large Furnace**  | Bricks              | Same as small furnace, just allows making bricks.
| 4 **Coal Furnace**   | Smelting            | This temporary furnace level, before coal mining / burning is banned, requires coal for smelting.
| 5 **Large Furnace**  | Bricks              | This works exactly like the previous large furnace.
| 6 **Clean Smelter**  | Biocoking, Smelting, Alloys    | Carcoal can be used for smelting, but charcoal can also be futher enriched into biocoke, which is required for alloys.
| 7 **Arc Furnace**    | Advanced Alloys     |
| 8 **Plasma Furnace** | Space Age materials |

---

## Core Design Loop

```text
Buy/find seeds
→ Plant and grow
→ Harvest Wood / Plant Matter / harvest
→ Splice seeds
→ Improve soil through NPK, decomposition, and depth
→ Burn resources in furnace or return them to soil
→ Unlock Plots, Upgrade Plants and Furnace
```
