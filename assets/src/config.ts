export const SAVE_KEY = 'aitg_save';
export const SAVE_KEY_PREFIX = 'aitg_save_';
export const GLOBAL_OPTIONS_KEY = 'aitg_global';
export const MAX_SAVEFILES = 4;

export const NEW_PLAYER_BONUS_WINDOW_MS = 25_000;
export const NEW_PLAYER_BONUS_FILL_MULTIPLIER = 2.5;
export const NEW_PLAYER_BONUS_FILL_BONUS = 20;
export const LATE_NEW_PLAYER_BONUS_FILL_MULTIPLIER = 7.25;
export const BASE_IDLE_MODE_OFF_FILL_RATE = 0.8;
export const BASE_IDLE_MODE_ON_FILL_RATE = 0.24;
export const BAR_RESET_LERP_SPEED = 7;
export const BAR_FULL_PULSE_SPEED = 0.3;
export const BAR_COLLECTION_GLOW_FADE_MULTIPLIER = 5;
export const REWARD_POPUP_HOLD_MS = 2000;
export const REWARD_POPUP_FLY_MS = 500;
export const REWARD_POPUP_HOLD_RISE_SPEED = 12;
export const GENERIC_FLOAT_LIFE_MS = 2500;
export const GENERIC_FLOAT_RISE_SPEED = 16;

// Top HUD fonts
export const TOP_HUD_LEVEL_FONT = 'bold 24px Arial';
export const TOP_HUD_EXP_FONT = '14px Arial';
export const TOP_HUD_COINS_FONT = '18px Arial';
export const BOTTOM_HUD_BUTTON_FONT = 'bold 12px Arial';

// Reward and popup fonts
export const ACHIEVEMENT_ANNOUNCEMENT_FONT = '30px Arial';
export const REWARD_POPUP_FONT = '25px Arial';
export const BONUS_TEXT_FONT = '18px Arial';

// UI message fonts
export const UI_MESSAGE_FONT = '24px Arial';
export const UI_MESSAGE_SMALL_FONT = '18px Arial';

// Small text fonts
export const SMALL_TEXT_FONT = '13px Arial';
export const TINY_TEXT_FONT = '12px Arial';

// Sisu UI fonts
export const SISU_METER_FONT = 'bold 14px Arial';
export const SISU_DECAY_FONT = '10px Arial';
export const SISU_CURRENT_FONT = 'bold 40px Arial';
export const SISU_MAX_FONT = '16px Arial';
export const SISU_UPGRADE_BUTTON_FONT = 'bold 13px Arial';

// Progress bar fonts
export const PROGRESS_PERCENT_FONT = 'bold 16px Arial';
export const IDLE_TOGGLE_FONT = 'bold 11px Arial';

// Shop fonts
export const SHOP_ITEM_NAME_FONT = 'bold 16px Arial';
export const SHOP_ITEM_DESC_FONT = '13px Arial';
export const SHOP_ITEM_COST_FONT = '14px Arial';
export const SHOP_ITEM_REQ_FONT = '12px Arial';

// Quest panel fonts
export const QUEST_PANEL_TOKENS_FONT = 'bold 14px Arial';
export const QUEST_NAME_FONT = '13px Arial';
export const QUEST_RANK_FONT = '12px Arial';

// Achievement panel fonts
export const ACHIEVEMENT_STARS_FONT = 'bold 18px Arial';
export const ACHIEVEMENT_UNLOCKED_FONT = '14px Arial';
export const ACHIEVEMENT_NAME_FONT = '13px Arial';

// Daily bonus fonts
export const DAILY_BONUS_ENTRANCE_FONT = 'bold 38px Arial';
export const DAILY_BONUS_TITLE_FONT = 'bold 42px Arial';
export const DAILY_BONUS_RESULT_FONT = 'bold 22px Arial';
export const DAILY_BONUS_BODY_FONT = '15px Arial';
export const DAILY_BONUS_LABEL_FONT = '12px Arial';
export const DAILY_BONUS_BUTTON_FONT = 'bold 14px Arial';

// Coin Rain fonts
export const COIN_RAIN_TIMER_FONT = '24px sans-serif';
export const COIN_RAIN_COUNTDOWN_FONT = '48px sans-serif';

// Save panel fonts
export const SAVE_AUTOSAVE_FONT = '14px Arial';
export const SAVE_FILE_LABEL_FONT = 'bold 16px Arial';
export const SAVE_FILE_INFO_FONT = '13px Arial';
export const SAVE_FILE_STATUS_FONT = 'bold 13px Arial';
export const SAVE_DELETE_FONT = 'bold 11px Arial';

// Stats panel fonts
export const STATS_SECTION_FONT = '14px Arial';
export const STATS_LABEL_FONT = 'bold 13px Arial';
export const STATS_VALUE_FONT = '13px Arial';

// Overlay and modal fonts
export const OVERLAY_TITLE_FONT = 'bold 20px Arial';
export const MODAL_TITLE_FONT = 'bold 16px Arial';
export const MODAL_BODY_FONT = '13px Arial';

// Button fonts
export const BUTTON_DEFAULT_FONT = '12px Arial';

export const ACHIEVEMENT_ANNOUNCEMENT_LIFE_MS = 5000;
export const ACHIEVEMENT_FLOAT_RISE_SPEED = 2;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 760;
export const TOP_HUD_HEIGHT = 50;
export const BOTTOM_HUD_HEIGHT = 50;
export const DISPLAY_AREA_X = 20;
export const DISPLAY_AREA_Y = TOP_HUD_HEIGHT;
export const DISPLAY_AREA_WIDTH = 1112;
export const DISPLAY_AREA_HEIGHT = CANVAS_HEIGHT - TOP_HUD_HEIGHT - BOTTOM_HUD_HEIGHT;
export const TOP_HUD_EXP_BAR_X = DISPLAY_AREA_X;
export const TOP_HUD_EXP_BAR_Y = 15;
export const TOP_HUD_EXP_BAR_WIDTH = 300;
export const TOP_HUD_EXP_BAR_HEIGHT = 20;
export const TOP_HUD_LEVEL_X = TOP_HUD_EXP_BAR_X * 2 + TOP_HUD_EXP_BAR_WIDTH;
export const TOP_HUD_EXP_COUNTER_X = TOP_HUD_EXP_BAR_X + (TOP_HUD_EXP_BAR_WIDTH / 2);
export const TOP_HUD_EXP_COUNTER_Y = TOP_HUD_EXP_BAR_Y + 15;
export const TOP_HUD_CURRENCY_ICON_SIZE = 32;
export const TOP_HUD_CURRENCY_ICON_Y = Math.floor((TOP_HUD_HEIGHT - TOP_HUD_CURRENCY_ICON_SIZE) / 2);
export const TOP_HUD_COINS_ICON_RIGHT = 450;
export const TOP_HUD_SHARDS_ICON_RIGHT = 300;
export const TOP_HUD_CORES_ICON_RIGHT = 150;
export const TOP_HUD_COIN_COUNTER_Y = 30;
export const TOP_HUD_COINS_COUNTER_RIGHT = 350;
export const TOP_HUD_SHARDS_COUNTER_RIGHT = 180;
export const TOP_HUD_CORES_COUNTER_RIGHT = 10;
export const PROGRESS_BAR_WIDTH = 40;

// Milliseconds in a day for day rollover calculations
export const MS_PER_DAY = 86_400_000;
