// ============================================================
//  统一 WorldModule 数据格式 — normalizeModule
//  将旧格式 `data` 转换为新格式 `moduleConfig` + `initialState`
// ============================================================

import type { WorldModule } from '@/data/worlds-schema';

/**
 * 将 WorldModule 统一为新格式（moduleConfig + initialState）
 *
 * - 已有 moduleConfig 且无 data → 原样返回
 - 有 data 但无 moduleConfig → 拆分为 moduleConfig + initialState
 * - 两者都有 → 以 moduleConfig 为准，删除 data
 */
export function normalizeModule(mod: WorldModule): WorldModule {
  // 已经是新格式，无需转换
  if (mod.moduleConfig && !mod.data) return mod;

  const data = mod.data as Record<string, unknown> | undefined;
  if (!data || Object.keys(data).length === 0) {
    // data 为空，直接删除
    const { data: _, ...rest } = mod;
    return rest;
  }

  switch (mod.moduleId) {
    case 'stat':
      return normalizeStatModule(mod, data);
    case 'progression':
      return normalizeProgressionModule(mod, data);
    default:
      return normalizeGenericModule(mod, data);
  }
}

/** stat 模块：从 data 拆分出 moduleConfig（定义）和 initialState（初始值） */
function normalizeStatModule(mod: WorldModule, data: Record<string, unknown>): WorldModule {
  const config: Record<string, unknown> = {};
  const state: Record<string, unknown> = {};

  // attrA / attrB：拆 name+max → config，current → state
  for (const key of ['attrA', 'attrB']) {
    const attr = data[key] as Record<string, unknown> | undefined;
    if (attr && typeof attr === 'object') {
      config[key] = { name: attr.name, max: attr.max };
      if (attr.current != null) state[key] = attr.current;
    }
  }

  // 六维 dim1~dim6：拆 name+range → config，value → state
  for (let i = 1; i <= 6; i++) {
    const dimKey = `dim${i}`;
    const dim = data[dimKey] as Record<string, unknown> | undefined;
    if (dim && typeof dim === 'object') {
      config[dimKey] = { name: dim.name, range: dim.range };
      if (dim.value != null) state[`${dimKey}Value`] = dim.value;
    }
  }

  // special：定义 → config，值 → state
  if (Array.isArray(data.special)) {
    config.special = data.special.map((sp: Record<string, unknown>) => ({
      id: sp.id, name: sp.name, value: sp.value, range: sp.range, description: sp.description,
    }));
    const specialState: Record<string, number> = {};
    for (const sp of data.special as Array<Record<string, unknown>>) {
      if (sp.id && sp.value != null) specialState[sp.id as string] = sp.value as number;
    }
    if (Object.keys(specialState).length > 0) state.special = specialState;
  }

  return {
    ...mod,
    moduleConfig: mod.moduleConfig || config,
    initialState: mod.initialState || state,
    data: undefined,
  };
}

/** progression 模块：拆分 config（模式/段位定义）和 state（当前段位/经验） */
function normalizeProgressionModule(mod: WorldModule, data: Record<string, unknown>): WorldModule {
  const config: Record<string, unknown> = {};
  const state: Record<string, unknown> = {};

  // 配置字段
  if (data.mode) config.mode = data.mode;
  if (data.xpFormula) config.xpFormula = data.xpFormula;
  if (data.tiers) config.tiers = data.tiers;
  if (data.levelData) config.levelData = data.levelData;

  // 状态字段
  if (data.currentTierIndex != null) state.currentTierIndex = data.currentTierIndex;
  if (data.currentXP != null) state.currentXP = data.currentXP;

  return {
    ...mod,
    moduleConfig: mod.moduleConfig || config,
    initialState: mod.initialState || (Object.keys(state).length > 0 ? state : undefined),
    data: undefined,
  };
}

/** 通用模块（survival/business/dice/talent 等）：data 整体 → moduleConfig */
function normalizeGenericModule(mod: WorldModule, data: Record<string, unknown>): WorldModule {
  return {
    ...mod,
    moduleConfig: mod.moduleConfig || data,
    data: undefined,
  };
}

/** 批量规范化整个 modules 数组 */
export function normalizeModules(modules: WorldModule[]): WorldModule[] {
  return modules.map(normalizeModule);
}

// ─── 反向转换：供编辑器使用 ───
// 编辑器的模块编辑组件读写 mod.data，需要从 moduleConfig + initialState 重建 data

/**
 * 将新格式（moduleConfig + initialState）反向转换为旧格式（data）
 * 供编辑器内部使用，保存时再通过 normalizeModules 转回新格式
 */
export function denormalizeModule(mod: WorldModule): WorldModule {
  // 已有 data，无需转换
  if (mod.data) return mod;

  const mc = mod.moduleConfig as Record<string, unknown> | undefined;
  const is = mod.initialState as Record<string, unknown> | undefined;
  if (!mc) return mod;

  let data: Record<string, unknown>;

  switch (mod.moduleId) {
    case 'stat': {
      data = {};
      // attrA / attrB
      for (const key of ['attrA', 'attrB']) {
        const cfg = mc[key] as Record<string, unknown> | undefined;
        if (cfg) {
          data[key] = {
            name: cfg.name,
            current: is?.[key] ?? 80,
            max: cfg.max,
          };
        }
      }
      // dim1~dim6
      for (let i = 1; i <= 6; i++) {
        const dimKey = `dim${i}`;
        const cfg = mc[dimKey] as Record<string, unknown> | undefined;
        if (cfg) {
          data[dimKey] = {
            name: cfg.name,
            value: is?.[`${dimKey}Value`] ?? 50,
            range: cfg.range,
          };
        }
      }
      // special
      if (Array.isArray(mc.special)) {
        const specialState = (is?.special || {}) as Record<string, number>;
        data.special = (mc.special as Array<Record<string, unknown>>).map(sp => ({
          ...sp,
          value: specialState[sp.id as string] ?? sp.value ?? 0,
        }));
      }
      break;
    }
    case 'progression': {
      data = { ...mc };
      if (is) {
        data.currentTierIndex = is.currentTierIndex ?? 0;
        data.currentXP = is.currentXP ?? 0;
      }
      break;
    }
    default:
      data = { ...mc };
      break;
  }

  return { ...mod, data };
}

/** 批量反向转换 */
export function denormalizeModules(modules: WorldModule[]): WorldModule[] {
  return modules.map(denormalizeModule);
}
