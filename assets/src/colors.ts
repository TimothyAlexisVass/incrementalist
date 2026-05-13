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
    border: '#5b6f93',
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
      fillStart: '#934caf',
      fillEnd: '#e753ec'
    },
    quest: {
      readyStart: '#34a853',
      readyEnd: '#7ce89a',
      pendingStart: '#4b72c2',
      pendingEnd: '#6ea9ff'
    }
  },
  sisu: {
    darkBlue: '#0B1F4D',
    blue: '#1E90FF',
    purple: '#9932CC',
    orange: '#FF8C1A',
    white: '#F5F7FA',
    yellow: '#FFD700'
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
      on: '#4CAF50',
      off: '#2c1d6e'
    }
  },
  panel: {
    bg: '#16213e',
    border: '#3a5273',
    highlight: 'rgba(255, 255, 255, 0.12)',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0AEC0',
    textDisabled: '#718096',
    coins: '#FFD700',
    shards: '#FF8C1A',
    cores: '#FF4D4D',
    whiteCoins: '#1E90FF',
    questTokens: '#FF6B6B',
    bonusText: '#6BC2FF'
  },
  rewards: {
    achievement: '#6BC2FF',
    expGain: '#c951f8',
    coins: '#FFD700',
    shards: '#FF8C1A',
    cores: '#FF4D4D',
    whiteCoins: '#1E90FF',
    totalBonus: '#6BC2FF',
    questSummary: '#FF9B6A',
    questSummaryOverflow: '#D2DEF0',
    questTokenGain: '#FF6B6B',
    eventTokenGain: '#6BC2FF',
    saveNotice: '#7CE89A'
  },
  coinRain: {
    bucket: '#8B4513',
    itemCoins: '#FFD700',
    itemReward: '#FF00FF',
    timerText: '#FFFFFF',
    countdownText: '#FFFFFF'
  },
  overlay: {
    backdrop: 'rgba(0, 0, 0, 0.1)',
    panelBorder: '#3a5273',
    titleText: '#dbe8ff',
    starsText: '#ffd966',
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
    coins: '#FFD700',
    shards: '#FF8C1A',
    cores: '#FF4D4D',
    textPrimary: '#FFFFFF'
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
