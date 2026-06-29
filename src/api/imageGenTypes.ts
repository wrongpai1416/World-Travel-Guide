// ─── 生图功能类型定义 ───

export type ImageEngine = 'nai' | 'comfyui' | 'openai_compatible';
export type ImageCategory = 'story' | 'character' | 'player';
export type ImageTaskStatus = 'queued' | 'generating' | 'completed' | 'failed';

export interface ComfyLora {
  name: string;
  strength_model: number;
  strength_clip: number;
}

export interface ImageGenConfig {
  engine: ImageEngine;
  // ─── NovelAI ───
  apiKey: string;
  model: string;
  sampler: string;
  steps: number;
  scale: number;
  resolution: string;
  customWidth: number;
  customHeight: number;
  seed: number;
  positivePrompt: string;
  negativePrompt: string;
  qualityToggle: boolean;
  varietyPlus: boolean;
  cfgRescale: number;
  ucPreset: number;
  noiseSchedule: string;
  // ─── ComfyUI ───
  comfyUrl: string;
  comfyModel: string;
  comfySampler: string;
  comfyScheduler: string;
  comfyVae: string;
  comfyLoras: ComfyLora[];
  comfyPositivePrompt: string;
  comfyNegativePrompt: string;
  // ─── OpenAI Compatible ───
  openaiCompatibleProvider: string;
  openaiCompatibleApiUrl: string;
  openaiCompatibleApiKey: string;
  openaiCompatibleModel: string;
  // ─── 正文生图 ───
  inlineImageEnabled: boolean;
  inlineImageRegex: string;
  autoClickImageGen: boolean;
  // ─── 角色画像 ───
  characterPortraitEnabled: boolean;
  characterPortraitAutoUpdateEnabled: boolean;
  characterPortraitPromptTemplate: string;
}

export interface ImageTask {
  id: string;
  status: ImageTaskStatus;
  prompt: string;
  negativePrompt: string;
  imageUrl: string;
  imageBlobKey: string | null;
  createdAt: number;
  updatedAt: number;
  params: Record<string, unknown>;
  errorMessage: string;
  category: ImageCategory;
  characterName: string;
}

export interface ImageGenResult {
  blob: Blob;
  seed: number | null;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  model: string;
  sampler: string;
  steps: number | null;
  scale: number | null;
}

export interface ComfyUIData {
  models: string[];
  samplers: string[];
  schedulers: string[];
  vaes: string[];
  loras: string[];
  objectInfo: Record<string, unknown>;
}

// ─── 常量 ───

export const DEFAULT_NEGATIVE_PROMPT =
  'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';

export const NAI_MODELS: Record<string, { label: string; recommended?: boolean }> = {
  'nai-diffusion-4-5-full': { label: 'NAI Diffusion V4.5 Full', recommended: true },
  'nai-diffusion-4-5-curated': { label: 'NAI Diffusion V4.5 Curated' },
  'nai-diffusion-4-full': { label: 'NAI Diffusion V4 Full' },
  'nai-diffusion-4-curated': { label: 'NAI Diffusion V4 Curated' },
  'nai-diffusion-3': { label: 'NAI Diffusion V3 (Anime)' },
};

export const NAI_SAMPLERS = [
  'k_euler_ancestral',
  'k_euler',
  'k_dpmpp_2m',
  'k_dpmpp_2s_ancestral',
  'k_dpmpp_sde',
  'ddim_v3',
];

export const NAI_RESOLUTIONS: Record<string, { width: number; height: number; label: string }> = {
  portrait: { width: 832, height: 1216, label: '竖版 (832×1216)' },
  landscape: { width: 1216, height: 832, label: '横版 (1216×832)' },
  square: { width: 1024, height: 1024, label: '方形 (1024×1024)' },
  portrait_sm: { width: 512, height: 768, label: '竖版小 (512×768)' },
  landscape_sm: { width: 768, height: 512, label: '横版小 (768×512)' },
  square_sm: { width: 640, height: 640, label: '方形小 (640×640)' },
};

export const UC_PRESETS = [
  { value: 0, label: 'Heavy' },
  { value: 1, label: 'Light' },
  { value: 2, label: 'Furry' },
  { value: 3, label: 'Human' },
  { value: 4, label: 'None' },
];

export const OPENAI_COMPATIBLE_IMAGE_PROVIDERS: Record<
  string,
  { label: string; defaultApiUrl: string; modelPlaceholder: string }
> = {
  openai: { label: 'OpenAI', defaultApiUrl: 'https://api.openai.com/v1', modelPlaceholder: 'gpt-image-1' },
  grok: { label: 'Grok', defaultApiUrl: 'https://api.x.ai/v1', modelPlaceholder: 'grok-2-image-1212' },
  gemini: {
    label: 'Gemini',
    defaultApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelPlaceholder: 'imagen-3.0-generate-002',
  },
  custom: { label: '自定义兼容地址', defaultApiUrl: '', modelPlaceholder: 'your-image-model' },
};

export const DEFAULT_IMAGE_CONFIG: ImageGenConfig = {
  engine: 'nai',
  // NovelAI
  apiKey: '',
  model: 'nai-diffusion-4-5-full',
  sampler: 'k_euler_ancestral',
  steps: 28,
  scale: 5,
  resolution: 'portrait',
  customWidth: 832,
  customHeight: 1216,
  seed: 0,
  positivePrompt: '',
  negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  qualityToggle: true,
  varietyPlus: true,
  cfgRescale: 0,
  ucPreset: 4,
  noiseSchedule: 'karras',
  // ComfyUI
  comfyUrl: 'http://localhost:8188',
  comfyModel: '',
  comfySampler: 'euler',
  comfyScheduler: 'normal',
  comfyVae: '',
  comfyLoras: [],
  comfyPositivePrompt: '',
  comfyNegativePrompt: '',
  // OpenAI Compatible
  openaiCompatibleProvider: 'openai',
  openaiCompatibleApiUrl: '',
  openaiCompatibleApiKey: '',
  openaiCompatibleModel: '',
  // 正文生图
  inlineImageEnabled: false,
  inlineImageRegex: 'image###([\\s\\S]+?)###',
  autoClickImageGen: false,
  // 角色画像
  characterPortraitEnabled: false,
  characterPortraitAutoUpdateEnabled: false,
  characterPortraitPromptTemplate: '',
};
