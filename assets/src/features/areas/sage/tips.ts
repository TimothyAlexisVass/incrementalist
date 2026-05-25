import { AREA_UNLOCK_REQUIRED_LEVELS, SHOP_UNLOCK_REQUIRED_LEVELS } from "../../requirements";

export type SageTip = {
  text: string[];
  confirmation?: string;
};

const IDLE_MODE_UNLOCK_LEVEL = SHOP_UNLOCK_REQUIRED_LEVELS.idle_mode;
const SISU_GENERATOR_UNLOCK_LEVEL = SHOP_UNLOCK_REQUIRED_LEVELS.sisu_generator;
const CLOVERFIELD_UNLOCK_LEVEL = AREA_UNLOCK_REQUIRED_LEVELS.cloverfield;
const MARKET_UNLOCK_LEVEL = AREA_UNLOCK_REQUIRED_LEVELS.market;

export const SAGE_LEVEL_TIP_IDS = Object.freeze([
  "1",
  String(IDLE_MODE_UNLOCK_LEVEL),
  String(SISU_GENERATOR_UNLOCK_LEVEL),
  String(CLOVERFIELD_UNLOCK_LEVEL),
  String(MARKET_UNLOCK_LEVEL)
]);

export const SAGE_TIP_ORDER = Object.freeze([
  ...SAGE_LEVEL_TIP_IDS,
  "clover_4_leaf",
  "clover_5_leaf",
  "clover_6_leaf"
]);

export const SAGE_TIPS: Readonly<Record<string, SageTip>> = {
  "1": {
    text: [
      "Your journey to become the supreme Incrementalist begins now.",
      "A journey around the globe begins with one step.",
      "You collect rewards by performing any kind of action when the progress-bar is full."
    ],
    confirmation: "Yes Master"
  },
  [String(IDLE_MODE_UNLOCK_LEVEL)]: {
    text: [
      "You can unlock new capabilities in the shop. Go now and unlock Idle mode.",
      "When you idle, the progress bar rewards will be collected automatically, but at a reduced speed.",
      "However, you will be able to upgrade your idling in the future as you get stronger."
    ],
    confirmation: "I Do Like Earnings"
  },
  [String(SISU_GENERATOR_UNLOCK_LEVEL)]: {
    text: [
      "I can sense an immense power dormant in you. You are now ready to unlock some of that potential.",
      "We are going to have to release your inner nature gradually.",
      "Sisu is a Finnish concept meaning deep inner strength, grit, and determination.",
      "It is the ability to keep going through difficulty, not through loud force, but through quiet endurance, resilience, and willpower."
    ],
    confirmation: "I've got the power!"
  },
  [String(CLOVERFIELD_UNLOCK_LEVEL)]: {
    text: [
      "Harvest season has come!",
      "Before we release you fully into the Incrementiverse, we are going to have to improve your luck.",
      "You are now free to leave the temple, find the Cloverfield and seek the seven leaf clover."
    ],
    confirmation: "Lucky number 7!"
  },
  [String(MARKET_UNLOCK_LEVEL)]: {
    text: [
      "Fortuna favet audacibus!",
      "You have collected many resources on your journey.",
      "It is now time to learn how to profit from trade.",
      "Go to the Market to trade your goods and acquire new capabilities."
    ],
    confirmation: "Audentes Fortuna iuvat!"
  },
  "clover_4_leaf": {
    text: [
      "Yeah, 4-leaf clovers are a sign of luck, but the kind of luck you are",
      "going to need only comes with the 7-leaf clover.",
      "Keep on searching!"
    ],
    confirmation: "Still searching"
  },
  "clover_5_leaf": {
    text: [
      "A 5-leaf clover bends fate a little further.",
      "Your luck is growing, but you still need to push deeper."
    ],
    confirmation: "Luck is growing"
  },
  "clover_6_leaf": {
    text: [
      "You found a 6-leaf clover. Wow! I had no idea those exis...",
      "Ehm... so... To tell you the truth, there are no 7-leaf clovers.",
      "The only reason I sent you on that quest was to clear that field.",
      "Like I said, harvest season has come! Let's prepare an orchard.",
      "Go plant these clovers, so we can fix some nitrogen in the soil!"
    ],
    confirmation: "Uhm... Thanks"
  }
};
