// 选择式世界生成管线 — 维度选项生成 Prompt
// ============================================================

import type { DimensionConfig, DimensionSelection } from './types';

/** 维度配置列表 */
export const DIMENSIONS: DimensionConfig[] = [
  { key: 'tone',      label: '基调', required: true,  entryType: 'setting' },
  { key: 'geography', label: '地理', required: true,  entryType: 'lore' },
  { key: 'factions',  label: '势力', required: true,  entryType: 'factions' },
  { key: 'culture',   label: '文化', required: false, entryType: 'culture' },
  { key: 'economy',   label: '经济', required: false, entryType: 'economy' },
  { key: 'npcs',      label: 'NPC',  required: true,  entryType: 'npcs' },
  { key: 'rules',     label: '规则', required: true,  entryType: 'rules' },
];

/**
 * 为指定维度生成选项的 Prompt
 */
export function buildChoicePrompt(
  dimension: DimensionConfig,
  userDesc: string,
  previousSelections: DimensionSelection[],
): string {
  const context = previousSelections
    .map(s => `- ${s.dimensionLabel}：${s.choice.title}（${s.choice.subtitle}）`)
    .join('\n');

  const contextSection = context
    ? `\n用户已做出以下选择：\n${context}\n请确保新生成的选项与之前的选择保持一致。\n`
    : '';

  const dimensionHints: Record<string, string> = {
    tone: '每个选项应是不同的风格基调，如"严肃古典"、"轻松日常"、"黑暗残酷"、"史诗壮阔"等。标题2-4个字，副标题简要说明这种基调的特点。',
    geography: '每个选项应是不同的地理格局，如"五大陆分布"、"群岛散布"、"一超多强"、"层叠世界"等。标题是格局名称，副标题说明地理特点。',
    factions: '每个选项应是不同的势力结构，如"正邪对立"、"群雄割据"、"暗流涌动"、"表面和平"等。标题是势力格局名称，副标题说明势力关系特点。',
    culture: '每个选项应是不同的文化特征，如"宗门制度"、"城邦联盟"、"部落传统"、"科技文明"等。标题是文化类型，副标题说明文化特点。',
    economy: '每个选项应是不同的经济体系，如"灵石经济"、"信用点体系"、"以物易物"、"封建贡赋"等。标题是经济类型，副标题说明经济特点。',
    npcs: '每个选项应是不同的关键人物组合，如"正道领袖"、"亦正亦邪"、"底层群像"、"权贵阶层"等。标题是人物群体特征，副标题说明人物关系。',
    rules: '每个选项应是不同的规则体系，如"修仙九境"、"科技等级"、"血脉觉醒"、"契约系统"等。标题是体系名称，副标题说明核心机制。',
  };

  const hint = dimensionHints[dimension.key] || '生成4个有明显差异的选项。';

  return `你是一个世界构建专家。用户想要创建一个世界：
"${userDesc}"
${contextSection}
现在请为这个世界生成"${dimension.label}"的4个选项。

要求：
1. 4个选项要有明显差异，覆盖不同风格
2. 与用户描述的世界类型相匹配
3. 标题2-4个字，副标题一句话
4. ${hint}

请严格按以下JSON格式返回，不要有任何其他文字：
{
  "narrative": "关于${dimension.label}的2-3句描述性文字，像在讲故事一样介绍这个维度的特点",
  "choices": [
    { "id": "A", "title": "选项标题", "subtitle": "简短描述" },
    { "id": "B", "title": "选项标题", "subtitle": "简短描述" },
    { "id": "C", "title": "选项标题", "subtitle": "简短描述" },
    { "id": "D", "title": "选项标题", "subtitle": "简短描述" }
  ]
}`;
}
