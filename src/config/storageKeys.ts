// 配置存储 key 常量 - 统一命名规范
export const STORAGE_KEYS = {
  // UI 设置
  UI_SETTINGS: 'world_travel_guide_ui_settings',
  API_CONFIG: 'world_travel_guide_api_config',

  // 记忆系统
  MEMORY_CONFIG: 'world_travel_guide_memory_config',

  // 管线配置
  PIPELINE_CONFIG: 'world_travel_guide_pipeline',

  // 模板存储
  PLAYER_PRESETS: 'world_travel_guide_player_presets',
  HISTORY_PRESETS: 'world_travel_guide_history_presets',
  CUSTOM_WORLDS: 'world_travel_guide_custom_worlds',

  // 存档系统
  ACTIVE_SAVE: 'world_travel_guide_active_save_id',

  // 生图配置
  IMAGE_CONFIG: 'world_travel_guide_image_config',

  // 代理设置
  PROXY_URL: 'world_travel_guide_proxy_url',
} as const

export type StorageKey = keyof typeof STORAGE_KEYS
