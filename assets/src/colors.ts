export const COLORS = Object.freeze({
  app: {
    background: '#0f0f1a',
    canvasBorder: '#333',
    canvasShadow: 'rgba(0, 0, 0, 0.5)'
  },
  game: {
    background: '#1a1a2e'
  },
  bar: {
    track: '#0f1b30',
    border: '#000',
    progress: {
      border: '#412407',
      fillStart: [255, 107, 107], // #FF6B6B
      fillMid: [255, 230, 109],   // #FFE66D
      fillEnd: [78, 205, 196],    // #4ECDC4
      idle: {
        border: '#2b1c48ff',
        fillStart: [38, 58, 103], // #263A67
        fillMid: [82, 97, 163],   // #5261A3
        fillEnd: [108, 188, 144]  // #6CBC90
      }
    },
    exp: {
      fillStart: '#6d1f8c',
      fillEnd: '#d053ec'
    },
    fame: {
      fillStart: '#083245',
      fillEnd: '#0fbcc2'
    },
    quest: {
      readyStart: '#188b37',
      readyEnd: '#51ff82',
      pendingStart: '#163b84',
      pendingEnd: '#6ecaff'
    }
  },
  sisu: {
    azure: '#1e90ff',
    aether: '#9932cc',
    lucent: '#ff8c1a',
    transcendent: '#f5f7fa'
  },
  button: {
    surface: {
      active: '#2c6fb3',
      inactive: '#2b3f60'
    },
    border: {
      active: '#cfe7ff',
      inactive: '#4d678f'
    },
    text: '#f5f8ff',
    secondary: {
      surface: '#2a3f61',
      border: '#93b3d8',
      text: '#dbe8ff'
    },
    toggle: {
      on: '#4caf50',
      off: '#2c1d6e'
    },
    bonusTime: {
      textActive: '#aeb8c6',
      textDisabled: '#566172'
    }
  },
  panel: {
    bg: '#16213e',
    border: '#3a5273',
    highlight: 'rgba(255, 255, 255, 0.12)',
    textPrimary: '#ffffff',
    textSecondary: '#a0aec0',
    textDisabled: '#718096',
    coins: '#ffd700',
    shards: '#ff8c1a',
    cores: '#ff4d4d',
    whiteCoins: '#1e90ff',
    questTokens: '#ff6b6b',
    bonusText: '#6bc2ff'
  },
  rewards: {
    achievement: '#6bc2ff',
    expGain: '#c951f8',
    coins: '#ffd700',
    shards: '#ff8c1a',
    cores: '#ff4d4d',
    whiteCoins: '#1e90ff',
    totalBonus: '#6bc2ff',
    questSummary: '#ff9b6a',
    questSummaryOverflow: '#d2def0',
    questTokenGain: '#ff6b6b',
    eventTokenGain: '#6bc2ff',
    saveNotice: '#7ce89a'
  },
  coinRain: {
    bucket: '#8b4513',
    itemCoins: '#ffd700',
    itemReward: '#ff00ff',
    timerText: '#ffffff',
    countdownText: '#ffffff'
  },
  overlay: {
    backdrop: 'rgba(0, 0, 0, 0.1)',
    panelBorder: '#3a5273',
    titleText: '#dbe8ff',
    multiplierText: '#ffd966',
    unlockedStateText: '#dbe8ff',
    statusUnlocked: '#7fe38e',
    statusLocked: '#ff8c8c',
    bodyText: '#f5f8ff',
    questTokenText: '#ffd2a8',
    questBonusText: '#9be8a9',
    questRowBackground: '#1a2d4a',
    questRowBorder: '#2f4f79',
    questRankText: '#f4ca64',
    questProgressReadyText: '#9be8a9',
    questProgressPendingText: '#dbe8ff',
    optionsTitleText: '#dbe8ff',
    optionsCheckboxCheckmark: '#dbe8ff',
    optionsDropdownBackground: '#2b3f60',
    optionsDropdownBorder: '#4d678f'
  },
  hud: {
    coins: '#ffd700',
    shards: '#ff8c1a',
    cores: '#ff4d4d',
    textPrimary: '#ffffff',
    textWarning: '#ff0000'
  }
} as const);

const CSS_COLOR_VARIABLES = Object.freeze({
  '--app-bg-color': COLORS.app.background,
  '--canvas-border-color': COLORS.app.canvasBorder,
  '--canvas-shadow-color': COLORS.app.canvasShadow
});

export function applyCssThemeVariables(root = document.documentElement) {
  if (!root || !root.style) {
    return;
  }

  for (const [name, value] of Object.entries(CSS_COLOR_VARIABLES)) {
    root.style.setProperty(name, value);
  }
}
