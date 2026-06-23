// 变量管理器
import type { GameState } from '../schema/variables';
import { createDefaultGameState } from '../schema/variables';
import type { ApiConfig } from '../api/types';
import { requestCompletion } from '../api/client';
import { cloneDeep, get, set, merge, unset } from 'lodash-es';
import {
  resolveNpcId,
  warnIgnoredNpcPatchUpdate,
  canCreateNpcFromPatch,
  getCreatableNpcIdentifier,
  isNpcCreationPayload,
  ensureNpcCategoryDefaults,
  ensureNpcChronicleDefaults,
  ensureNpcStructureDefaults,
  createPromptSafeNpcSnapshot,
} from '../utils/npcHelpers';

/** 安全数值转换 + 区间钳制，防止 NaN 传播（参考 yijiekkk 的 clampInteger 模式） */
function safeClamp(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export class VariableManager {
  private state: GameState;

  constructor(initial?: GameState) {
    this.state = initial ? cloneDeep(initial) : createDefaultGameState();
    this.normalizeState();
  }

  getState(): GameState {
    this.normalizeState();
    return cloneDeep(this.state);
  }

  setState(state: GameState) {
    this.state = cloneDeep(state);
    this.normalizeState();
  }

  /**
   * 初始化笔记本（第0轮自动注入）
   * 笔记本初始为空，由 AI 根据世界设定动态创建
   */
  initializeWorldAndNotebook(): void {
    this.normalizeState();
  }

  // 获取嵌套变量值
  getVar(path: string, defaultValue?: unknown): unknown {
    return get(this.state, path, defaultValue);
  }

  // 设置嵌套变量值
  // forceReplace=false 时对象深度合并（避免部分更新丢失字段）
  // forceReplace=true 时直接替换（允许删除旧键）
  setVar(path: string, value: unknown, forceReplace = false) {
    if (!forceReplace && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const existing = get(this.state, path);
      if (existing !== null && typeof existing === 'object' && !Array.isArray(existing)) {
        set(this.state, path, merge({}, existing, value));
        return;
      }
    }
    set(this.state, path, value);
  }

  // 规范化状态：确保NPC分类、事迹、结构默认值 + 笔记本容量限制 + 模块数值校验
  private normalizeState(): void {
    ensureNpcCategoryDefaults(this.state);
    ensureNpcChronicleDefaults(this.state);
    ensureNpcStructureDefaults(this.state);
    this.normalizeNotebook();
    this.validateAndClampModuleValues();
  }

  /**
   * 校验并修正模块数值，防止 AI 输出超出范围的值
   * 在每次状态更新后调用，确保数值合法性
   */
  private validateAndClampModuleValues(): void {
    const worldSystem = (this.state.世界 as any)?.世界系统;
    if (!worldSystem || typeof worldSystem !== 'object') return;

    // 校验数值属性模块
    const statData = worldSystem.数值属性;
    if (statData && typeof statData === 'object') {
      // 校验 attrA（生命类）
      if (statData.attrA && typeof statData.attrA === 'object') {
        const maxA = safeClamp(statData.attrA.max, 1, Infinity, 100);
        statData.attrA.max = maxA;
        statData.attrA.current = safeClamp(statData.attrA.current, 0, maxA, 0);
      }

      // 校验 attrB（能量类）
      if (statData.attrB && typeof statData.attrB === 'object') {
        const maxB = safeClamp(statData.attrB.max, 1, Infinity, 100);
        statData.attrB.max = maxB;
        statData.attrB.current = safeClamp(statData.attrB.current, 0, maxB, 0);
      }

      // 校验六维属性
      for (let i = 1; i <= 6; i++) {
        const dim = statData[`dim${i}`];
        if (dim && typeof dim === 'object') {
          if (dim.range && Array.isArray(dim.range) && dim.range.length >= 2) {
            const lo = safeClamp(dim.range[0], 0, Infinity, 0);
            const hi = safeClamp(dim.range[1], lo, Infinity, 100);
            dim.range = [lo, hi];
            dim.value = safeClamp(dim.value, lo, hi, lo);
          } else {
            // range 缺失时给默认值
            dim.range = [0, 100];
            dim.value = safeClamp(dim.value, 0, 100, 0);
          }
        }
      }

      // 校验特色属性
      if (Array.isArray(statData.special)) {
        for (const sp of statData.special) {
          if (sp && typeof sp === 'object') {
            if (sp.range && Array.isArray(sp.range) && sp.range.length >= 2) {
              const lo = safeClamp(sp.range[0], 0, Infinity, 0);
              const hi = safeClamp(sp.range[1], lo, Infinity, 100);
              sp.range = [lo, hi];
              sp.value = safeClamp(sp.value, lo, hi, lo);
            } else {
              sp.range = [0, 100];
              sp.value = safeClamp(sp.value, 0, 100, 0);
            }
          }
        }
      }
    }

    // 校验成长体系模块
    const progData = worldSystem.成长体系;
    if (progData && typeof progData === 'object') {
      // 校验 currentXP（不能为负）
      progData.currentXP = safeClamp(progData.currentXP, 0, Infinity, 0);

      // 校验 currentTierIndex
      const tierIdx = safeClamp(progData.currentTierIndex, 0, Infinity, 0);
      if (progData.mode === 'level' && progData.levelData) {
        // 等级制：不能超过 maxLevel
        const maxLv = safeClamp(progData.levelData.maxLevel, 1, Infinity, 100);
        progData.currentTierIndex = Math.min(tierIdx, maxLv);
      } else if (Array.isArray(progData.tiers) && progData.tiers.length > 0) {
        // 段位制：不能超过 tiers 数组长度
        progData.currentTierIndex = Math.min(tierIdx, progData.tiers.length - 1);
      } else {
        progData.currentTierIndex = tierIdx;
      }
    }

    // 校验生存资源模块
    const survData = worldSystem.生存资源;
    if (survData && typeof survData === 'object') {
      if (Array.isArray(survData.resources)) {
        for (const res of survData.resources) {
          if (res && typeof res === 'object') {
            res.amount = safeClamp(res.amount, 0, Infinity, 0);
            if (res.max != null) {
              const maxVal = safeClamp(res.max, 1, Infinity, 9999);
              res.max = maxVal;
              res.amount = Math.min(res.amount, maxVal);
            }
          }
        }
      }
    }
  }

  // 笔记本容量限制：每个分区最多 20 条，超出删除最旧的
  private normalizeNotebook(): void {
    const NOTEBOOK_SECTION_CAP = 20;
    const notebook = this.state.玩家?.记事本;
    if (!notebook || typeof notebook !== 'object') return;

    for (const section of ['潜在危机', '当前机遇', '待办事项'] as const) {
      const entries = notebook[section];
      if (!entries || typeof entries !== 'object') continue;
      const keys = Object.keys(entries);
      if (keys.length > NOTEBOOK_SECTION_CAP) {
        // 删除最旧的条目（保留最后 N 个，按插入顺序）
        const toRemove = keys.slice(0, keys.length - NOTEBOOK_SECTION_CAP);
        for (const key of toRemove) {
          delete entries[key];
        }
      }
    }
  }

  // 批量应用补丁 (RFC 6902 风格) - NPC 感知版本
  applyPatches(patches: Array<{ op: string; path: string; value?: unknown }>) {
    for (const patch of patches) {
      const rawPath = patch.path.replace(/^\//, '').replace(/\//g, '.');
      const pathParts = rawPath.split('.');

      // NPC 感知逻辑：当路径涉及 人物档案.XXX 时
      if (pathParts[0] === '人物档案' && pathParts.length >= 2) {
        const npcResolution = resolveNpcId(pathParts[1], this.state);

        if (!npcResolution.ok) {
          if (canCreateNpcFromPatch(pathParts, patch.op, patch.value)) {
            const creatableId = getCreatableNpcIdentifier(pathParts[1]);
            if (!creatableId) {
              warnIgnoredNpcPatchUpdate('RFC 补丁', pathParts[1], npcResolution);
              continue;
            }
            pathParts[1] = creatableId;
          } else {
            warnIgnoredNpcPatchUpdate('RFC 补丁', pathParts[1], npcResolution);
            continue;
          }
        } else {
          pathParts[1] = npcResolution.npcId!;
        }
      }

      const resolvedPath = pathParts.join('.');
      switch (patch.op) {
        case 'replace':
        case 'add':
          set(this.state, resolvedPath, patch.value);
          break;
        case 'remove':
          unset(this.state, resolvedPath);
          break;
      }
    }
    this.normalizeState();
  }

  // 从AI响应中的UpdateVariable标签解析并应用更新
  applyUpdateVariable(updateText: string): boolean {
    try {
      const parsed = JSON.parse(updateText);

      // 数组 → RFC 6902 补丁
      if (Array.isArray(parsed)) {
        this.applyPatches(parsed);
        return true;
      }

      // 对象 → 深度合并（NPC 感知）
      if (typeof parsed === 'object' && parsed !== null) {
        this.applyMergeUpdate(parsed);
        return true;
      }
      return false;
    } catch {
      // 尝试解析为键值对格式
      try {
        const lines = updateText.split('\n').filter(l => l.includes('='));
        for (const line of lines) {
          const [path, ...rest] = line.split('=');
          const value = rest.join('=').trim();
          if (path && value) {
            this.setVar(path.trim(), value);
          }
        }
        this.normalizeState();
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * 按 id 合并数组（解决 lodash merge 按索引合并的问题）
   * 用于 数值属性.special、生存资源.items 等需要按 id 匹配的数组字段
   */
  private mergeArrayById(existing: unknown[], incoming: unknown[], idField = 'id'): unknown[] {
    if (!Array.isArray(incoming)) return incoming;

    const result = [...existing];
    for (const incomingItem of incoming) {
      if (!incomingItem || typeof incomingItem !== 'object') continue;
      const incomingId = (incomingItem as any)[idField];
      if (!incomingId) continue;

      const existingIndex = result.findIndex(item =>
        item && typeof item === 'object' && (item as any)[idField] === incomingId
      );

      if (existingIndex >= 0) {
        // 找到匹配的元素，深度合并
        result[existingIndex] = merge({}, result[existingIndex], incomingItem);
      } else {
        // 没找到，追加新元素
        result.push(incomingItem);
      }
    }
    return result;
  }

  /**
   * 处理世界系统模块数据的特殊合并逻辑
   * 解决 数值属性.special、生存资源.items 等数组字段按 id 合并的问题
   */
  private mergeWorldSystem(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
    // 深拷贝 incoming 防止修改原始参数（delete 操作会污染调用方数据）
    const incomingCopy = cloneDeep(incoming);
    const result = { ...existing };

    for (const [moduleKey, moduleValue] of Object.entries(incomingCopy)) {
      if (!moduleValue || typeof moduleValue !== 'object' || Array.isArray(moduleValue)) {
        result[moduleKey] = moduleValue;
        continue;
      }

      const existingModule = result[moduleKey];
      if (!existingModule || typeof existingModule !== 'object' || Array.isArray(existingModule)) {
        result[moduleKey] = moduleValue;
        continue;
      }

      // 处理数值属性模块的 special 数组
      if (moduleKey === '数值属性') {
        const merged = { ...(existingModule as Record<string, unknown>) };
        const incomingModule = moduleValue as Record<string, unknown>;

        if (Array.isArray(incomingModule.special) && Array.isArray((existingModule as any).special)) {
          merged.special = this.mergeArrayById(
            (existingModule as any).special,
            incomingModule.special,
            'id'
          );
          delete incomingModule.special;
        }

        // 其他字段正常合并
        result[moduleKey] = merge({}, merged, incomingModule);
        continue;
      }

      // 处理生存资源模块的 items 数组
      if (moduleKey === '生存资源') {
        const merged = { ...(existingModule as Record<string, unknown>) };
        const incomingModule = moduleValue as Record<string, unknown>;

        // 合并 resources 数组（按 id 匹配）
        if (Array.isArray(incomingModule.resources) && Array.isArray((existingModule as any).resources)) {
          merged.resources = this.mergeArrayById(
            (existingModule as any).resources,
            incomingModule.resources,
            'id'
          );
          delete incomingModule.resources;
        }

        // 其他字段正常合并
        result[moduleKey] = merge({}, merged, incomingModule);
        continue;
      }

      // 处理经营资产模块的 assets 数组（按 id 匹配）
      if (moduleKey === '经营资产') {
        const merged = { ...(existingModule as Record<string, unknown>) };
        const incomingModule = moduleValue as Record<string, unknown>;

        if (Array.isArray(incomingModule.assets) && Array.isArray((existingModule as any).assets)) {
          merged.assets = this.mergeArrayById(
            (existingModule as any).assets,
            incomingModule.assets,
            'id'
          );
          delete incomingModule.assets;
        }

        // 其他字段正常合并
        result[moduleKey] = merge({}, merged, incomingModule);
        continue;
      }

      // 处理天赋体系模块的 categories 数组（按 id 匹配大类，内部 talents 按 id 匹配）
      if (moduleKey === '天赋体系') {
        const merged = { ...(existingModule as Record<string, unknown>) };
        const incomingModule = moduleValue as Record<string, unknown>;

        if (Array.isArray(incomingModule.categories) && Array.isArray((existingModule as any).categories)) {
          const existingCategories = (existingModule as any).categories as any[];
          const incomingCategories = incomingModule.categories as any[];

          const mergedCategories = [...existingCategories];
          for (const incomingCat of incomingCategories) {
            if (!incomingCat || typeof incomingCat !== 'object') continue;
            const catId = incomingCat.id;
            if (!catId) continue;

            const existingCatIndex = mergedCategories.findIndex(c => c?.id === catId);
            if (existingCatIndex >= 0) {
              // 合并大类内部的 talents 数组
              if (Array.isArray(incomingCat.talents) && Array.isArray(mergedCategories[existingCatIndex]?.talents)) {
                incomingCat.talents = this.mergeArrayById(
                  mergedCategories[existingCatIndex].talents,
                  incomingCat.talents,
                  'id'
                );
              }
              mergedCategories[existingCatIndex] = merge({}, mergedCategories[existingCatIndex], incomingCat);
            } else {
              mergedCategories.push(incomingCat);
            }
          }
          merged.categories = mergedCategories;
          delete incomingModule.categories;
        }

        result[moduleKey] = merge({}, merged, incomingModule);
        continue;
      }

      // 其他模块正常合并
      result[moduleKey] = merge({}, existingModule, moduleValue);
    }

    return result;
  }

  // NPC 感知的合并更新
  private applyMergeUpdate(patch: Record<string, unknown>): void {
    // 处理 人物档案 中的 NPC 数据
    if (patch.人物档案 && typeof patch.人物档案 === 'object' && !Array.isArray(patch.人物档案)) {
      const npcUpdates = patch.人物档案 as Record<string, unknown>;
      for (const [identifier, data] of Object.entries(npcUpdates)) {
        const npcResolution = resolveNpcId(identifier, this.state);

        let npcId = npcResolution.npcId;
        if (!npcResolution.ok) {
          if (!isNpcCreationPayload(data)) {
            warnIgnoredNpcPatchUpdate('合并补丁', identifier, npcResolution);
            continue;
          }
          npcId = getCreatableNpcIdentifier(identifier);
          if (!npcId) {
            warnIgnoredNpcPatchUpdate('合并补丁', identifier, npcResolution);
            continue;
          }
        }

        if (!npcId) continue;
        if (!this.state.人物档案[npcId]) {
          (this.state.人物档案 as any)[npcId] = {};
        }
        // 人物事迹：支持精细操作（chronicleOperations）或追加模式
        const npcData = data as Record<string, unknown>;
        const CHRONICLE_HARD_CAP = 30;

        // 优先处理 chronicleOperations（精细操作：add/replace/merge/remove）
        const chronicleOps = (npcData as any).chronicleOperations;
        if (Array.isArray(chronicleOps)) {
          delete (npcData as any).chronicleOperations;
          const existing = (this.state.人物档案[npcId] as any).人物事迹;
          const working = Array.isArray(existing) ? [...existing] : [];

          for (const op of chronicleOps) {
            if (!op || typeof op !== 'object') continue;
            const type = String(op.type || '').toLowerCase();

            if (type === 'add' && op.value && !working.includes(String(op.value))) {
              working.push(String(op.value));
            } else if (type === 'replace' && typeof op.index === 'number' && op.value) {
              if (op.index >= 0 && op.index < working.length) {
                working[op.index] = String(op.value);
              }
            } else if (type === 'merge' && Array.isArray(op.indexes) && op.value) {
              const indexes = op.indexes.map((i: any) => Number(i)).filter(i => i >= 0 && i < working.length).sort((a, b) => a - b);
              if (indexes.length > 0) {
                working[indexes[0]] = String(op.value);
                // 从后往前删除被合并的条目
                for (let i = indexes.length - 1; i >= 1; i--) {
                  working.splice(indexes[i], 1);
                }
              }
            } else if (type === 'remove' && typeof op.index === 'number') {
              if (op.index >= 0 && op.index < working.length) {
                working.splice(op.index, 1);
              }
            }
          }

          // 去重 + 硬上限
          const deduped = working.filter((item, i) => working.indexOf(item) === i);
          (this.state.人物档案[npcId] as any).人物事迹 = deduped.length > CHRONICLE_HARD_CAP
            ? deduped.slice(-CHRONICLE_HARD_CAP)
            : deduped;
        }

        // 兼容模式：人物事迹数组追加（去重）
        const incomingChronicles = npcData.人物事迹;
        if (Array.isArray(incomingChronicles)) {
          delete npcData.人物事迹;
          const existing = (this.state.人物档案[npcId] as any).人物事迹;
          const existingArr = Array.isArray(existing) ? existing : [];
          const newEntries = incomingChronicles.filter(c => !existingArr.includes(c));
          const merged = [...existingArr, ...newEntries];
          (this.state.人物档案[npcId] as any).人物事迹 = merged.length > CHRONICLE_HARD_CAP
            ? merged.slice(-CHRONICLE_HARD_CAP)
            : merged;
        }
        merge(this.state.人物档案[npcId], npcData);
      }

      // 从 patch 中移除已单独处理的 人物档案
      const { 人物档案: _npcs, ...rest } = patch;
      if (Object.keys(rest).length > 0) {
        // 检查是否涉及世界系统模块数据
        if (rest.世界 && typeof rest.世界 === 'object' && (rest.世界 as any).世界系统) {
          const { 世界: worldPatch, ...otherRest } = rest;
          const worldData = worldPatch as Record<string, unknown>;
          const existingWorld = this.state.世界 as Record<string, unknown>;

          // 合并世界系统模块数据（按 id 匹配数组元素）
          if (existingWorld?.世界系统 && worldData.世界系统) {
            (this.state.世界 as any).世界系统 = this.mergeWorldSystem(
              existingWorld.世界系统 as Record<string, unknown>,
              worldData.世界系统 as Record<string, unknown>
            );
            delete worldData.世界系统;
          }

          // 其他世界字段正常合并
          if (Object.keys(worldData).length > 0) {
            merge(this.state.世界, worldData);
          }

          // 其他非世界字段正常合并
          if (Object.keys(otherRest).length > 0) {
            merge(this.state, otherRest);
          }
        } else {
          merge(this.state, rest);
        }
      }
    } else {
      // 没有 NPC 数据，普通合并
      // 检查是否涉及世界系统模块数据
      if (patch.世界 && typeof patch.世界 === 'object' && (patch.世界 as any).世界系统) {
        const { 世界: worldPatch, ...otherPatch } = patch;
        const worldData = worldPatch as Record<string, unknown>;
        const existingWorld = this.state.世界 as Record<string, unknown>;

        // 合并世界系统模块数据（按 id 匹配数组元素）
        if (existingWorld?.世界系统 && worldData.世界系统) {
          (this.state.世界 as any).世界系统 = this.mergeWorldSystem(
            existingWorld.世界系统 as Record<string, unknown>,
            worldData.世界系统 as Record<string, unknown>
          );
          delete worldData.世界系统;
        }

        // 其他世界字段正常合并
        if (Object.keys(worldData).length > 0) {
          merge(this.state.世界, worldData);
        }

        // 其他非世界字段正常合并
        if (Object.keys(otherPatch).length > 0) {
          merge(this.state, otherPatch);
        }
      } else {
        merge(this.state, patch);
      }
    }

    this.normalizeState();
  }

  // 创建供系统提示使用的安全快照
  createSafeSnapshotForPrompt(): GameState {
    const snapshot = cloneDeep(this.state);
    // 对每个 NPC 创建安全快照
    const safeNpcs: Record<string, unknown> = {};
    for (const [id, npc] of Object.entries(snapshot.人物档案)) {
      safeNpcs[id] = createPromptSafeNpcSnapshot(npc, id);
    }
    (snapshot as any).人物档案 = safeNpcs;
    return snapshot;
  }

  // 用主API总结NPC事迹，防止条目过多
  async summarizeNpcChronicles(npcId: string, apiConfig: ApiConfig): Promise<boolean> {
    const npc = this.state.人物档案[npcId];
    if (!npc) return false;
    const chronicles = (npc as any).人物事迹;
    if (!Array.isArray(chronicles) || chronicles.length <= 5) return false;

    const npcName = (npc as any).姓名 || npcId;
    const prompt = `你是叙事记录员。以下是NPC「${npcName}」的事迹记录，请按时间线合并总结为简洁条目（5-8条），保留关键事件和转折点，去除重复和琐碎内容。只输出总结后的条目，每条一行，不要编号以外的前缀。\n\n原始事迹：\n${chronicles.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

    try {
      const result = await requestCompletion(apiConfig, [
        { role: 'user', content: prompt },
      ], { temperature: 0.3 });
      const lines = result.text.split('\n').map(l => l.replace(/^\d+[\.\)、]\s*/, '').trim()).filter(Boolean);
      if (lines.length > 0) {
        (npc as any).人物事迹 = lines;
        return true;
      }
    } catch (e) {
      console.warn('[VariableManager] 事迹总结失败:', e);
    }
    return false;
  }

  // 合并指定范围的事迹条目为一条
  async mergeNpcChronicles(npcId: string, startIndex: number, endIndex: number, apiConfig: ApiConfig): Promise<boolean> {
    const npc = this.state.人物档案[npcId];
    if (!npc) return false;
    const chronicles = (npc as any).人物事迹;
    if (!Array.isArray(chronicles)) return false;
    if (startIndex < 0 || endIndex >= chronicles.length || startIndex >= endIndex) return false;

    const npcName = (npc as any).姓名 || npcId;
    const selectedDeeds = chronicles.slice(startIndex, endIndex + 1);
    const prompt = `你是叙事记录员。以下是NPC「${npcName}」的${selectedDeeds.length}条事迹记录，请将它们合并总结为1条简洁的事迹摘要（30-60字），保留关键事件，去除冗余。只输出合并后的1条文本，不要编号或其他前缀。\n\n原始事迹：\n${selectedDeeds.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

    try {
      const result = await requestCompletion(apiConfig, [
        { role: 'user', content: prompt },
      ], { temperature: 0.3 });
      const merged = result.text.replace(/^\d+[\.\)、]\s*/, '').trim();
      if (merged) {
        const newChronicles = [
          ...chronicles.slice(0, startIndex),
          merged,
          ...chronicles.slice(endIndex + 1),
        ];
        (npc as any).人物事迹 = newChronicles;
        return true;
      }
    } catch (e) {
      console.warn('[VariableManager] 事迹合并失败:', e);
    }
    return false;
  }

  // 创建快照（挂载到消息上，用于回滚）
  // 使用 JSON 序列化替代 cloneDeep，避免超大对象导致 "Invalid string length"
  createSnapshot(): GameState {
    // 先瘦身：截断 NPC 长字段、限制事迹条数，防止序列化爆内存
    const slim = this._slimForSnapshot(this.state);
    try {
      return JSON.parse(JSON.stringify(slim));
    } catch {
      return cloneDeep(slim);
    }
  }

  /** 瘦身 state 用于快照：截断长文本、限制数组长度 */
  private _slimForSnapshot(state: GameState): GameState {
    const s = { ...state };
    if (s.人物档案) {
      const npcs: Record<string, unknown> = {};
      for (const [id, npc] of Object.entries(s.人物档案)) {
        if (!npc || typeof npc !== 'object') { npcs[id] = npc; continue; }
        const n = { ...npc } as any;
        // 截断长文本字段（超过 200 字截断）
        const longFields = ['背景', '外貌', '表性格', '里性格', '当前想法', '当前穿着', '当前状态', '内心想法', '备注'];
        for (const f of longFields) {
          if (typeof n[f] === 'string' && n[f].length > 200) n[f] = n[f].slice(0, 200) + '…';
        }
        // 限制事迹条数
        if (Array.isArray(n.人物事迹) && n.人物事迹.length > 15) {
          n.人物事迹 = n.人物事迹.slice(-15);
        }
        // 移除大型缓存字段
        delete n.portraitUrl;
        npcs[id] = n;
      }
      s.人物档案 = npcs as any;
    }
    return s;
  }

  // 从快照恢复变量状态（保留 portraitUrl 等缓存字段）
  restoreSnapshot(snapshot: GameState): void {
    if (!snapshot) return;
    const currentState = cloneDeep(this.state);
    this.state = cloneDeep(snapshot);
    // 保留现有 portraitUrl，避免丢失缓存头像
    if (currentState.人物档案 && this.state.人物档案) {
      for (const [id, npc] of Object.entries(currentState.人物档案)) {
        if ((npc as any).portraitUrl && this.state.人物档案[id]) {
          (this.state.人物档案[id] as any).portraitUrl = (npc as any).portraitUrl;
        }
      }
    }
    this.normalizeState();
  }

  // 用 JSON 字符串覆盖当前状态（设置页编辑后保存）
  setStateFromJSON(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed === 'object' && parsed !== null) {
        this.state = cloneDeep(parsed);
        this.normalizeState();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // 序列化为JSON（用于存档）
  toJSON() {
    return {
      state: this.state,
    };
  }

  // 从JSON恢复
  static fromJSON(data: { state: GameState }) {
    return new VariableManager(data.state);
  }
}
