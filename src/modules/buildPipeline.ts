// ============================================================
//  世界模块化系统 v2 — 管线执行器
//  用于多步骤世界创建管线（主题提取 → 顺序生成 → 资源生成 → 世界书生成 → 合成验证）
//
//  依赖关系：
//  - 数值系统：独立存在
//  - 成长系统：依赖数值系统（需要知道属性名称、范围）
//  - 资源系统：可以独立存在
// ============================================================

import type { BuildContext, StatConfig, StatState, ProgressionConfig, ResourceConfig } from './buildContext';
import type { WorldBookEntryDef } from '../data/worlds-schema';
import type { StatModuleSchema, ProgressionModuleSchema, ResourceModuleSchema } from './schema';
import {
  buildStatThemePrompt,
  buildStatGenPrompt,
  buildProgressionGenPrompt,
  buildResourceGenPrompt,
  STAT_UPDATE_RULES,
  PROGRESSION_UPDATE_RULES,
  RESOURCE_UPDATE_RULES,
  DICE_RULES_PROMPT,
  DICE_UPDATE_RULES,
  TALENT_UPDATE_RULES,
} from './prompts';
import { waitForRateLimit } from '../api/rateLimiter';

export interface PipelineConfig {
  /** AI 调用函数（由外部注入，解耦API层） */
  callAI: (messages: Array<{ role: string; content: string }>) => Promise<string>;
  /** 进度回调 */
  onProgress?: (stage: string, detail: string) => void;
}

/**
 * 执行世界创建管线
 *
 * 阶段1: 主题提取 → WorldTheme
 * 阶段2: 顺序生成（属性 → 成长 → 资源），避免并发触发429
 * 阶段3: 世界书条目生成（蓝灯/绿灯）
 * 阶段4: 合成验证（分离配置和状态）
 */
export async function executeBuildPipeline(
  ctx: BuildContext,
  config: PipelineConfig
): Promise<BuildContext> {
  const { callAI, onProgress } = config;
  const hasModule = (id: string) => ctx.selectedModules.includes(id);

  // ─── 阶段1：主题提取 ───
  // 如果选了成长模块但没选属性模块，自动启用属性模块（成长依赖属性）
  if (hasModule('progression') && !hasModule('stat')) {
    ctx.selectedModules.push('stat');
  }

  if (hasModule('stat')) {
    onProgress?.('阶段1', '提取世界主题与属性命名...');
    const themePrompt = buildStatThemePrompt(ctx.description);
    const themeRaw = await callAI([{ role: 'user', content: themePrompt }]);
    try {
      const themeData = JSON.parse(extractJSON(themeRaw));
      ctx.theme = {
        theme: themeData.theme || '',
        tone: themeData.tone || '中等',
        era: themeData.era || '现代',
        attrAName: themeData.attrAName || '生命',
        attrBName: themeData.attrBName || '能量',
        dim1Name: themeData.dim1Name || '攻击',
        dim2Name: themeData.dim2Name || '防御',
        dim3Name: themeData.dim3Name || '速度',
        dim4Name: themeData.dim4Name || '智力',
        dim5Name: themeData.dim5Name || '魅力',
        dim6Name: themeData.dim6Name || '幸运',
      };
    } catch {
      // JSON解析失败，使用默认命名
      ctx.theme = {
        theme: '通用',
        tone: '中等',
        era: '现代',
        attrAName: '生命', attrBName: '能量',
        dim1Name: '攻击', dim2Name: '防御', dim3Name: '速度',
        dim4Name: '智力', dim5Name: '魅力', dim6Name: '幸运',
      };
    }
  }

  await waitForRateLimit();

  // ─── 阶段2：顺序生成（避免并发触发429） ───

  // 2a. 生成属性系统（如果选了）
  if (hasModule('stat') && ctx.theme) {
    onProgress?.('阶段2', '生成属性系统...');
    const statPrompt = buildStatGenPrompt({
      theme: ctx.theme.theme,
      attrAName: ctx.theme.attrAName,
      attrBName: ctx.theme.attrBName,
      dim1Name: ctx.theme.dim1Name,
      dim2Name: ctx.theme.dim2Name,
      dim3Name: ctx.theme.dim3Name,
      dim4Name: ctx.theme.dim4Name,
      dim5Name: ctx.theme.dim5Name,
      dim6Name: ctx.theme.dim6Name,
    });
    const statRaw = await callAI([{ role: 'user', content: statPrompt }]);
    try {
      ctx.statData = JSON.parse(extractJSON(statRaw)) as StatModuleSchema;
      // 分离配置和状态
      if (ctx.statData) {
        ctx.statConfig = extractStatConfig(ctx.statData);
        ctx.statState = extractStatState(ctx.statData);
      }
    } catch { /* 解析失败则不设置 */ }
  }

  // 2b. 生成成长体系（如果选了，依赖属性数据）
  if (hasModule('progression') && ctx.theme) {
    await waitForRateLimit();
    onProgress?.('阶段2', '生成成长体系...');
    const progPrompt = buildProgressionGenPrompt({
      theme: ctx.theme.theme,
      tone: ctx.theme.tone,
      era: ctx.theme.era,
    });
    const progRaw = await callAI([{ role: 'user', content: progPrompt }]);
    try {
      ctx.progressionData = JSON.parse(extractJSON(progRaw)) as ProgressionModuleSchema;
      // 分离配置（状态在变量系统中，不在这里）
      if (ctx.progressionData) {
        ctx.progressionConfig = extractProgressionConfig(ctx.progressionData);
      }
    } catch { /* 解析失败则不设置 */ }
  }

  // 2c. 生成资源系统（如果选了，独立存在，不依赖数值系统）
  if (hasModule('resource')) {
    await waitForRateLimit();
    onProgress?.('阶段2', '生成资源系统...');
    const statNames = ctx.statData
      ? [
          ctx.statData.dim1?.name, ctx.statData.dim2?.name, ctx.statData.dim3?.name,
          ctx.statData.dim4?.name, ctx.statData.dim5?.name, ctx.statData.dim6?.name,
          ...(Array.isArray(ctx.statData.special) ? ctx.statData.special.map(s => s?.name) : []),
        ].filter(Boolean).join('、')
      : '';
    const progressionInfo = ctx.progressionData
      ? (ctx.progressionData.tiers?.map(t => t.name).join('、') || `等级制 0~${ctx.progressionData.levelData?.maxLevel ?? '?'}级`)
      : '';

    // 资源系统独立存在：如果有 theme 就用，没有就用世界描述作为主题
    const resourceTheme = ctx.theme?.theme || ctx.description.substring(0, 100);
    const resourceTone = ctx.theme?.tone || '中等';

    const resPrompt = buildResourceGenPrompt({
      theme: resourceTheme,
      tone: resourceTone,
      statNames,
      progressionInfo,
    });
    const resRaw = await callAI([{ role: 'user', content: resPrompt }]);
    try {
      ctx.resourceData = JSON.parse(extractJSON(resRaw)) as ResourceModuleSchema;
      // 提取配置
      if (ctx.resourceData) {
        ctx.resourceConfig = extractResourceConfig(ctx.resourceData);
      }
    } catch { /* 解析失败则不设置 */ }
  }

  // ─── 阶段3：生成世界书条目（蓝灯/绿灯） ───
  onProgress?.('阶段3', '生成世界书条目...');
  ctx.worldBookEntries = generateWorldBookEntries(ctx);

  // ─── 阶段4：合成验证 ───
  onProgress?.('阶段4', '合成验证...');
  ctx.result = synthesizeResult(ctx);

  return ctx;
}

/** 从AI回复中提取JSON字符串 */
function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  // 修复中文引号（某些 API 会返回全角引号）
  return raw.replace(/[“”‘’]/g, (ch) => {
    if (ch === '“' || ch === '”') return '"';
    return "'";
  });
}

/** 安全数值转换，防止 NaN 传播 */
function safeNum(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * 从数值属性原始数据中提取配置（静态部分）
 */
function extractStatConfig(statData: StatModuleSchema): StatConfig {
  const dimDefaults = [
    { name: '属性1', range: [0, 100] as [number, number] },
    { name: '属性2', range: [0, 100] as [number, number] },
    { name: '属性3', range: [0, 100] as [number, number] },
    { name: '属性4', range: [0, 100] as [number, number] },
    { name: '属性5', range: [0, 100] as [number, number] },
    { name: '属性6', range: [0, 100] as [number, number] },
  ];
  const dims = [statData.dim1, statData.dim2, statData.dim3, statData.dim4, statData.dim5, statData.dim6];
  return {
    attrA: { name: statData.attrA?.name || '生命', max: safeNum(statData.attrA?.max, 100) },
    attrB: { name: statData.attrB?.name || '能量', max: safeNum(statData.attrB?.max, 100) },
    dim1: dims[0] ? { name: dims[0].name, range: dims[0].range } : dimDefaults[0],
    dim2: dims[1] ? { name: dims[1].name, range: dims[1].range } : dimDefaults[1],
    dim3: dims[2] ? { name: dims[2].name, range: dims[2].range } : dimDefaults[2],
    dim4: dims[3] ? { name: dims[3].name, range: dims[3].range } : dimDefaults[3],
    dim5: dims[4] ? { name: dims[4].name, range: dims[4].range } : dimDefaults[4],
    dim6: dims[5] ? { name: dims[5].name, range: dims[5].range } : dimDefaults[5],
    special: Array.isArray(statData.special) ? statData.special.map(s => ({
      id: s.id || '',
      name: s.name || '',
      range: Array.isArray(s.range) && s.range.length >= 2 ? s.range : [0, 100],
      description: s.description || '',
    })) : [],
  };
}

/**
 * 从数值属性原始数据中提取状态（动态部分）
 */
function extractStatState(statData: StatModuleSchema): StatState {
  const specialState: Record<string, number> = {};
  if (Array.isArray(statData.special)) {
    for (const s of statData.special) {
      if (s && s.id) {
        specialState[s.id] = safeNum(s.value, 0);
      }
    }
  }
  const dims = [statData.dim1, statData.dim2, statData.dim3, statData.dim4, statData.dim5, statData.dim6];
  return {
    attrA: safeNum(statData.attrA?.current, 80),
    attrB: safeNum(statData.attrB?.current, 60),
    dim1: dims[0] ? safeNum(dims[0].value, 50) : 50,
    dim2: dims[1] ? safeNum(dims[1].value, 50) : 50,
    dim3: dims[2] ? safeNum(dims[2].value, 50) : 50,
    dim4: dims[3] ? safeNum(dims[3].value, 50) : 50,
    dim5: dims[4] ? safeNum(dims[4].value, 50) : 50,
    dim6: dims[5] ? safeNum(dims[5].value, 50) : 50,
    special: specialState,
  };
}

/**
 * 从成长体系原始数据中提取配置（静态部分）
 * 注意：状态（当前段位索引、当前经验值）不在这里，存放在变量系统
 */
function extractProgressionConfig(progData: ProgressionModuleSchema): ProgressionConfig {
  const config: ProgressionConfig = {
    mode: progData.mode,
    xpFormula: progData.xpFormula,
  };

  if (progData.mode === 'tiered' && progData.tiers) {
    config.tiers = progData.tiers.map(t => ({
      name: t.name,
      description: t.description,
    }));
  }

  if (progData.mode === 'level' && progData.levelData) {
    config.levelData = {
      maxLevel: progData.levelData.maxLevel,
      baseStats: progData.levelData.baseStats,
      growthPerLevel: progData.levelData.growthPerLevel,
    };
  }

  return config;
}

/**
 * 从资源管理原始数据中提取配置（静态部分）
 */
function extractResourceConfig(resData: ResourceModuleSchema): ResourceConfig {
  return {
    description: resData.description,
    items: resData.items.map(item => ({
      id: item.id,
      name: item.name,
      symbol: item.symbol,
      max: item.max,
      scarce: item.scarce,
      description: item.description,
    })),
    currency: resData.currency ? {
      name: resData.currency.name,
      symbol: resData.currency.symbol,
      description: resData.currency.description,
    } : undefined,
  };
}

/** 合成最终结果（分离配置和状态） */
function synthesizeResult(ctx: BuildContext): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // 数值属性：配置 + 初始状态
  if (ctx.statConfig && ctx.statState) {
    result.数值属性 = {
      config: ctx.statConfig,
      initialState: ctx.statState,
    };
  } else if (ctx.statData) {
    // 兼容旧格式：直接使用原始数据
    result.数值属性 = ctx.statData;
  }

  // 成长体系：只有配置（状态在变量系统中）
  if (ctx.progressionConfig) {
    result.成长体系 = {
      config: ctx.progressionConfig,
    };
  } else if (ctx.progressionData) {
    // 兼容旧格式：直接使用原始数据
    result.成长体系 = ctx.progressionData;
  }

  // 资源管理：配置（初始状态可选）
  if (ctx.resourceConfig) {
    result.资源管理 = {
      config: ctx.resourceConfig,
    };
  } else if (ctx.resourceData) {
    // 兼容旧格式：直接使用原始数据
    result.资源管理 = ctx.resourceData;
  }

  // 世界书条目
  if (ctx.worldBookEntries && ctx.worldBookEntries.length > 0) {
    result.worldBookEntries = ctx.worldBookEntries;
  }

  return result;
}

/**
 * 从生成的数据中提取关键词
 * 用于绿灯触发，让 AI 知道什么时候应该注入模块规则
 */
function extractKeywords(ctx: BuildContext): string[] {
  const keywords: string[] = [];

  // 从属性数据中提取关键词
  if (ctx.statData) {
    if (ctx.statData.attrA?.name) keywords.push(ctx.statData.attrA.name);
    if (ctx.statData.attrB?.name) keywords.push(ctx.statData.attrB.name);
    const dims = [ctx.statData.dim1, ctx.statData.dim2, ctx.statData.dim3, ctx.statData.dim4, ctx.statData.dim5, ctx.statData.dim6];
    for (const d of dims) {
      if (d?.name) keywords.push(d.name);
    }
    // 特色属性名
    if (Array.isArray(ctx.statData.special)) {
      for (const sp of ctx.statData.special) {
        if (sp?.name) keywords.push(sp.name);
      }
    }
  }

  // 从成长体系中提取关键词
  if (ctx.progressionData) {
    if (ctx.progressionData.mode === 'level' && ctx.progressionData.levelData) {
      keywords.push('等级', '升级', '经验');
    } else if (ctx.progressionData.tiers) {
      // 段位名称
      for (const tier of ctx.progressionData.tiers) {
        keywords.push(tier.name);
      }
      keywords.push('段位', '境界', '突破');
    }
  }

  // 从资源管理中提取关键词
  if (ctx.resourceData) {
    if (ctx.resourceData.currency) {
      keywords.push(ctx.resourceData.currency.name);
    }
    for (const item of ctx.resourceData.items) {
      keywords.push(item.name);
    }
    keywords.push('资源', '物品');
  }

  return keywords.filter(k => k && k.length > 0);
}

/**
 * 生成世界书条目（蓝灯/绿灯）
 *
 * 蓝灯：底层架构，常驻注入
 * 绿灯：详细规则，关键词触发（使用该世界自定义的名称）
 */
function generateWorldBookEntries(ctx: BuildContext): WorldBookEntryDef[] {
  const entries: WorldBookEntryDef[] = [];
  const keywords = extractKeywords(ctx);

  // ─── 数值属性模块 ───
  if (ctx.statData) {
    const statData = ctx.statData;
    const dims = [statData.dim1, statData.dim2, statData.dim3, statData.dim4, statData.dim5, statData.dim6];
    const dimKeys = ['dim1', 'dim2', 'dim3', 'dim4', 'dim5', 'dim6'];
    const dimDesc = dims.map((d, i) =>
      d ? `- ${d.name}（${dimKeys[i]}）：当前 ${safeNum(d.value, 50)}，范围 ${d.range?.[0] ?? 0}-${d.range?.[1] ?? 100}` : null
    ).filter(Boolean).join('\n');
    const specialDesc = Array.isArray(statData.special) && statData.special.length > 0
      ? '\n特色属性：\n' + statData.special.filter(s => s).map(s =>
          `- ${s.name}（${s.id}）：当前 ${safeNum(s.value, 0)}，范围 ${s.range?.[0] ?? 0}-${s.range?.[1] ?? 100}，${s.description || ''}`
        ).join('\n')
      : '';

    // 蓝灯：数值属性状态（常驻）
    entries.push({
      uid: -5001,
      comment: '[模块] 数值属性 - 状态',
      content: `【数值属性】\n底层属性：${statData.attrA?.name || '生命'} ${safeNum(statData.attrA?.current, 80)}/${safeNum(statData.attrA?.max, 100)}，${statData.attrB?.name || '能量'} ${safeNum(statData.attrB?.current, 60)}/${safeNum(statData.attrB?.max, 100)}\n六维属性：\n${dimDesc}${specialDesc}`,
      constant: true,
      key: [],
      order: 50,
      position: 'after_char',
    });

    // 绿灯：数值属性更新规则（关键词触发）
    const statKeywords = [
      statData.attrA?.name, statData.attrB?.name,
      ...dims.filter(Boolean).map(d => d!.name),
      ...(Array.isArray(statData.special) ? statData.special.filter(s => s?.name).map(s => s.name!) : []),
      '属性', '数值', '状态',
    ].filter((k): k is string => !!k && k.length > 0);

    entries.push({
      uid: -5002,
      comment: '[模块] 数值属性 - 规则',
      content: STAT_UPDATE_RULES,
      constant: false,
      key: statKeywords,
      order: 51,
      position: 'after_char',
    });
  }

  // ─── 成长体系模块 ───
  if (ctx.progressionData) {
    const progData = ctx.progressionData;
    let statusContent = '';
    let progressionKeywords: string[] = [];

    if (progData.mode === 'level' && progData.levelData) {
      // 等级制
      const ld = progData.levelData;
      const bs = ld.baseStats;
      const gl = ld.growthPerLevel;
      const ceilingInfo = bs && gl
        ? `\n0级属性天花板：${bs.attrAMax}/${bs.attrBMax}，六维 ${bs.dim1Max}/${bs.dim2Max}/${bs.dim3Max}/${bs.dim4Max}/${bs.dim5Max}/${bs.dim6Max}\n每级增长：${gl.attrAMax}/${gl.attrBMax}，六维 ${gl.dim1Max}/${gl.dim2Max}/${gl.dim3Max}/${gl.dim4Max}/${gl.dim5Max}/${gl.dim6Max}\n满级属性天花板：${bs.attrAMax + ld.maxLevel * gl.attrAMax}/${bs.attrBMax + ld.maxLevel * gl.attrBMax}`
        : '';
      statusContent = `【成长体系】\n模式：等级制（0~${ld.maxLevel}级）\n当前：Lv.${progData.currentTierIndex}\n经验：${progData.currentXP}${ceilingInfo}`;
      progressionKeywords = ['等级', '升级', '经验', 'Lv', '等级制'];
    } else if (progData.tiers?.length) {
      // 段位制
      const currentTier = progData.tiers[progData.currentTierIndex];
      const tierList = progData.tiers.map((t, i) =>
        `  ${i + 1}. ${t.name}${i === progData.currentTierIndex ? '（当前）' : ''} — ${t.description}`
      ).join('\n');
      statusContent = `【成长体系】\n模式：段位制\n当前：${currentTier?.name || '未知'}（第${progData.currentTierIndex + 1}段）\n经验：${progData.currentXP}\n段位列表：\n${tierList}`;
      progressionKeywords = [
        ...progData.tiers.map(t => t.name),
        '段位', '境界', '突破', '升级', '进阶',
      ];
    }

    // 蓝灯：成长体系状态（常驻）
    if (statusContent) {
      entries.push({
        uid: -5003,
        comment: '[模块] 成长体系 - 状态',
        content: statusContent,
        constant: true,
        key: [],
        order: 52,
        position: 'after_char',
      });
    }

    // 绿灯：成长体系更新规则（关键词触发）
    if (progressionKeywords.length > 0) {
      entries.push({
        uid: -5004,
        comment: '[模块] 成长体系 - 规则',
        content: PROGRESSION_UPDATE_RULES,
        constant: false,
        key: progressionKeywords.filter(k => k && k.length > 0),
        order: 53,
        position: 'after_char',
      });
    }
  }

  // ─── 资源管理模块 ───
  if (ctx.resourceData) {
    const resData = ctx.resourceData;
    const currencyDesc = resData.currency
      ? `货币：${resData.currency.name} ${resData.currency.amount}${resData.currency.symbol || ''}\n`
      : '';
    const itemsDesc = Array.isArray(resData.items) ? resData.items.filter(r => r).map(r =>
      `- ${r.name || '未知'}（${r.id || '?'}）${r.symbol || ''}：${safeNum(r.amount, 0)}${r.max ? `/${r.max}` : ''}${r.scarce ? ' [稀缺]' : ''} — ${r.description || ''}`
    ).join('\n') : '';

    // 蓝灯：资源状态（常驻）
    entries.push({
      uid: -5005,
      comment: '[模块] 资源管理 - 状态',
      content: `【资源管理】\n${resData.description}\n${currencyDesc}资源列表：\n${itemsDesc}`,
      constant: true,
      key: [],
      order: 54,
      position: 'after_char',
    });

    // 绿灯：资源更新规则（关键词触发）
    const resourceKeywords = [
      resData.currency?.name,
      ...(Array.isArray(resData.items) ? resData.items.filter(r => r?.name).map(r => r.name!) : []),
      '资源', '物品', '货币',
    ].filter((k): k is string => !!k && k.length > 0);

    entries.push({
      uid: -5006,
      comment: '[模块] 资源管理 - 规则',
      content: RESOURCE_UPDATE_RULES,
      constant: false,
      key: resourceKeywords,
      order: 55,
      position: 'after_char',
    });
  }

  // ─── 骰子检定模块（绿灯） ───
  if (ctx.selectedModules.includes('dice')) {
    entries.push({
      uid: -5007,
      comment: '[模块] 骰子检定',
      content: `${DICE_RULES_PROMPT}\n\n${DICE_UPDATE_RULES}`,
      constant: false,
      key: ['掷骰', '检定', '判定', 'd20', '骰子', '骰', '难度', 'DC', '成功率', '豁免'],
      order: 56,
      position: 'after_char',
    });
  }

  // ─── 天赋体系模块（绿灯） ───
  if (ctx.selectedModules.includes('talent')) {
    entries.push({
      uid: -5008,
      comment: '[模块] 天赋体系',
      content: TALENT_UPDATE_RULES,
      constant: false,
      key: ['天赋', '技能', '觉醒', '能力', '神通', '功法', '武技', '魔法', '异能'],
      order: 57,
      position: 'after_char',
    });
  }

  return entries;
}
