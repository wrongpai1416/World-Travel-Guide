// 阶段5：世界书条目合成（纯代码，无 AI 调用）

import type { WorldGenContext, DeepDetailResults, WorldSkeleton, DimensionResults } from '../types';
import type { WorldBookEntryDef } from '../../data/worlds-schema';

export function executeStage5(ctx: WorldGenContext): WorldBookEntryDef[] {
  const skeleton = ctx.skeleton!;
  const dims = ctx.dimensions!;
  const deep = ctx.deepDetails!;

  const entries: WorldBookEntryDef[] = [];
  let uid = 1;

  // ── 1. 世界观概述（常驻） ──
  // 从维度结果中提取地点/时间/氛围信息
  const mainLocation = dims.geography.locations.length > 0
    ? dims.geography.locations.map(l => l.name).join('、')
    : skeleton.locationNames.join('、');
  const atmosphere = dims.geography.locations.length > 0
    ? dims.geography.locations[0].atmosphere
    : dims.culture.description.substring(0, 50);

  entries.push({
    uid: uid++,
    key: [],
    constant: true,
    comment: '世界设定',
    content: skeleton.overview,
    order: 1,
    position: 'before_char',
    entryType: 'setting',
    meta: {
      location: mainLocation || undefined,
      timePeriod: skeleton.timePeriod || undefined,
      atmosphere: atmosphere || undefined,
      recommendedFor: [],
    },
  });

  // ── 2. 核心规则摘要（常驻） ──
  entries.push({
    uid: uid++,
    key: [],
    constant: true,
    comment: '核心规则',
    content: [
      `力量体系：${dims.rules.powerSystem}`,
      `社会结构：${dims.rules.socialStructure}`,
      dims.rules.specialRules.length > 0 ? `特殊规则：${dims.rules.specialRules.join('；')}` : '',
    ].filter(Boolean).join('\n'),
    order: 2,
    position: 'before_char',
    entryType: 'rules',
    meta: {
      powerSystem: dims.rules.powerSystem,
      socialStructure: dims.rules.socialStructure,
      specialRules: dims.rules.specialRules,
    },
  });

  // ── 3. 各势力独立条目（关键词触发） ──
  for (const faction of deep.factionDeep) {
    entries.push({
      uid: uid++,
      key: generateKeywords(faction.name, [
        faction.headquarters,
        faction.philosophy,
        ...faction.relationships?.map(r => r.target) || [],
      ]),
      constant: false,
      comment: faction.name,
      content: [
        `【${faction.name}】${faction.alignment ? `[${faction.alignment}]` : ''}`,
        faction.description,
        faction.headquarters ? `总部：${faction.headquarters}` : '',
        faction.philosophy ? `理念：${faction.philosophy}` : '',
        faction.strength ? `实力：${faction.strength}` : '',
        faction.internalFactions?.length ? `内部派系：${faction.internalFactions.join('、')}` : '',
      ].filter(Boolean).join('\n'),
      order: 3,
      position: 'before_char',
      entryType: 'factions',
      meta: {
        factions: [{
          name: faction.name,
          description: faction.description,
          alignment: faction.alignment,
        }],
      },
    });
  }

  // ── 4. 各 NPC 独立条目（关键词触发） ──
  for (const npc of deep.npcDeep) {
    entries.push({
      uid: uid++,
      key: generateKeywords(npc.name, [
        npc.role,
        npc.appearance,
        ...npc.relationships?.map(r => r.target) || [],
      ]),
      constant: false,
      comment: `${npc.name}（${npc.role}）`,
      content: [
        `【${npc.name}】${npc.role}`,
        npc.description,
        npc.personality ? `性格：${npc.personality}` : '',
        npc.background ? `背景：${npc.background}` : '',
        npc.motivation ? `动机：${npc.motivation}` : '',
      ].filter(Boolean).join('\n'),
      order: 4,
      position: 'before_char',
      entryType: 'npcs',
      meta: {
        npcs: [{
          name: npc.name,
          role: npc.role,
          description: npc.description,
          personality: npc.personality,
        }],
      },
    });
  }

  // ── 5. 各事件独立条目（关键词触发） ──
  for (const evt of dims.events.events) {
    entries.push({
      uid: uid++,
      key: generateKeywords(evt.name, [evt.trigger, evt.impact || '']),
      constant: false,
      comment: evt.name,
      content: [
        `【${evt.name}】${evt.significance === 'major' ? '【重大事件】' : ''}`,
        evt.description,
        evt.trigger ? `触发条件：${evt.trigger}` : '',
        evt.impact ? `影响：${evt.impact}` : '',
      ].filter(Boolean).join('\n'),
      order: 7,
      position: 'before_char',
      entryType: 'events',
      meta: {
        events: [{
          name: evt.name,
          description: evt.description,
          trigger: evt.trigger,
          significance: evt.significance,
        }],
      },
    });
  }

  // ── 6. 力量体系详情（关键词触发） ──
  if (dims.rules.powerSystem) {
    entries.push({
      uid: uid++,
      key: extractKeywordsFromText(dims.rules.powerSystem),
      constant: false,
      comment: '力量体系',
      content: dims.rules.powerSystem,
      order: 5,
      position: 'before_char',
      entryType: 'rules',
      meta: { powerSystem: dims.rules.powerSystem },
    });
  }

  // ── 7. 经济系统（关键词触发） ──
  entries.push({
    uid: uid++,
    key: ['花钱', '消费', '买单', '价格', '买东西', '付钱', '货币', '工资', '收入', '买', '卖'],
    constant: false,
    comment: '经济系统',
    content: [
      dims.economy.description,
      dims.economy.currency ? `货币：${dims.economy.currency.symbol || ''}${dims.economy.currency.name}${dims.economy.currency.description ? `（${dims.economy.currency.description}）` : ''}` : '',
      dims.economy.priceLevel ? `物价：${dims.economy.priceLevel}` : '',
    ].filter(Boolean).join('\n'),
    order: 6,
    position: 'before_char',
    entryType: 'economy',
    meta: {
      currency: dims.economy.currency,
      priceLevel: dims.economy.priceLevel,
    },
  });

  // ── 8. 地理地点（lore 条目，关键词触发） ──
  for (const loc of deep.locationDeep) {
    entries.push({
      uid: uid++,
      key: generateKeywords(loc.name, loc.features),
      constant: false,
      comment: loc.name,
      content: [
        `【${loc.name}】`,
        loc.description,
        loc.history ? `历史：${loc.history}` : '',
      ].filter(Boolean).join('\n'),
      order: 8,
      position: 'before_char',
      entryType: 'lore',
      meta: {
        location: loc.name,
        atmosphere: loc.atmosphere,
      },
    });
  }

  // ── 9. 文化风俗（culture 条目，关键词触发） ──
  if (dims.culture.description) {
    entries.push({
      uid: uid++,
      key: extractKeywordsFromText(dims.culture.description).concat(
        dims.culture.customs.slice(0, 3),
        dims.culture.taboos.slice(0, 2),
      ),
      constant: false,
      comment: '文化风俗',
      content: [
        dims.culture.description,
        dims.culture.customs.length > 0 ? `风俗：${dims.culture.customs.join('、')}` : '',
        dims.culture.beliefs.length > 0 ? `信仰：${dims.culture.beliefs.join('、')}` : '',
        dims.culture.dailyLife ? `日常：${dims.culture.dailyLife}` : '',
        dims.culture.taboos.length > 0 ? `禁忌：${dims.culture.taboos.join('、')}` : '',
      ].filter(Boolean).join('\n'),
      order: 9,
      position: 'before_char',
      entryType: 'culture',
      meta: {
        highlights: dims.culture.customs.concat(dims.culture.beliefs),
      },
    });
  }

  // ── 10. 核心特色（常驻） ──
  entries.push({
    uid: uid++,
    key: [],
    constant: true,
    comment: '核心特色',
    content: skeleton.tags.join('、'),
    order: 10,
    position: 'before_char',
    entryType: 'highlights',
    meta: { highlights: skeleton.tags },
  });

  return entries;
}

/** 从名称和关联词生成关键词 */
function generateKeywords(name: string, related: Array<string | undefined>): string[] {
  const keywords = [name];
  for (const r of related) {
    if (r && r.length > 0 && r.length < 10) {
      keywords.push(r);
    }
  }
  // 去重 + 限制数量
  return [...new Set(keywords)].slice(0, 8);
}

/** 从文本中提取关键词（简单实现：取前 5 个有意义的词） */
function extractKeywordsFromText(text: string): string[] {
  // 提取中文词组（2-4字）
  const matches = text.match(/[一-龥]{2,4}/g) || [];
  const unique = [...new Set(matches)].filter(w =>
    w.length >= 2 && !['的', '是', '在', '了', '和', '与', '或', '但', '而', '也', '都', '就', '不'].includes(w),
  );
  return unique.slice(0, 5);
}
