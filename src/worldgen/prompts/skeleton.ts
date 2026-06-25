// 阶段1：世界骨架 prompt

import type { WorldSeed } from '../types';

export function buildSkeletonPrompt(userDesc: string, seed: WorldSeed): string {
  return `你是一位专业的世界观架构师。请根据以下分析结果，生成一个完整的世界骨架。

用户描述：${userDesc}

世界分析：
- 类型：${seed.genre}
- 主题：${seed.themes.join('、')}
- 基调：${seed.tone}
- 时代：${seed.era}
- 核心概念：${seed.keyConcepts.join('、')}
- 目标玩家：${seed.targetAudience}

严格返回 JSON（不要 markdown），包含：
{
  "name": "创意中文世界名称（2-6字）",
  "oneLiner": "一句话简介（20字以内）",
  "overview": "2-3段沉浸式世界观描述（200-400字）",
  "worldScale": "small 或 medium 或 large",
  "timePeriod": "时间背景（如：架空古代、近未来2087年、中世纪、现代都市）",
  "locationNames": ["关键地名1", "关键地名2", "关键地名3", "关键地名4"],
  "factionNames": ["势力名1", "势力名2", "势力名3"],
  "npcRoles": ["角色定位1:一句话描述", "角色定位2:一句话描述", "角色定位3:一句话描述"],
  "eventNames": ["事件名1", "事件名2", "事件名3"],
  "coreConflict": "这个世界的核心矛盾或冲突（一句话）",
  "icon": "Lucide图标名（Globe/Compass/BookOpen/Flame/Mountain/Ship/Castle/Skull/Crown/Rocket/Star/Shield/Zap/Brain/Gem/Ghost/Snowflake/Sun/Moon/Wind/Waves/Anchor/Eye/Heart/Target）",
  "tags": ["标签1", "标签2", "标签3"],
  "difficulty": "easy 或 medium 或 hard"
}

注意：
- locationNames 列出 3-5 个最重要的地点名称
- factionNames 列出 3-4 个核心势力名称
- npcRoles 列出 3-5 个关键 NPC 的角色定位
- eventNames 列出 3-5 个重要事件名称
- 这些名称将用于后续阶段的并行生成`;
}
