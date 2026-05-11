export type SageTip = {
  text: string[];
  confirmation?: string;
};

export const SAGE_TIPS: Record<number, SageTip> = {
  1: {
    text: [
      "Your journey to become the Incrementalist begins now.",
      "A journey around the globe begins with one step.",
      "You collect rewards by performing any kind of action when the progress-bar is full."
    ],
    confirmation: "Yes Master"
  },
  2: {
    text: [
      "You can unlock new capabilities in the shop. Go now and unlock Idle mode.",
      "When you idle, the progress bar rewards will be collected automatically, but at a reduced speed.",
      "However, you will be able to upgrade your idling in the future as you get stronger."
    ],
    confirmation: "I Do Like Earnings"
  },
  4: {
    text: [
      "I can sense an immense power dormant in you. You are now ready to unlock some of that potential.",
      "We are going to have to release your inner nature gradually.",
      "Sisu is a Finnish concept meaning deep inner strength, grit, and determination.",
      "It is the ability to keep going through difficulty, not through loud force, but through quiet endurance, resilience, and willpower."
    ],
    confirmation: "I've got the power!"
  },
  10: {
    text: [
      "Harvest season has come!",
      "Before we release you fully into the Incrementiverse, we are going to have to improve your luck.",
      "You are now free to leave the temple, find the Cloverfield and seek the seven leaf clover."
    ],
    confirmation: "Lucky number 7!"
  },
  15: {
    text: [
      "Fortuna favet audacibus!",
      "You have collected many resources on your journey.",
      "It is now time to learn how to profit from trade.",
      "Go to the Market to trade your goods and acquire new capabilities."
    ],
    confirmation: "Audentes Fortuna iuvat!"
  }
};
