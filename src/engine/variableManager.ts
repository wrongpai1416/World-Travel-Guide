// 变量管理器
import type { GameState } from '../schema/variables';
import { createDefaultGameState } from '../schema/variables';
import type { ApiConfig } from '../api/types';
import { requestCompletion } from '../api/client';
import * as _ from 'lodash-es';
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

export class VariableManager {
  private state: GameState;

  constructor(initial?: GameState) {
    this.state = initial ? _.cloneDeep(initial) : createDefaultGameState();
    this.normalizeState();
  }

  getState(): GameState {
    this.normalizeState();
    return _.cloneDeep(this.state);
  }

  setState(state: GameState) {
    this.state = _.cloneDeep(state);
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
    return _.get(this.state, path, defaultValue);
  }

  // 设置嵌套变量值（对象深度合并，避免部分更新丢失字段）
  setVar(path: string, value: unknown) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const existing = _.get(this.state, path);
      if (existing !== null && typeof existing === 'object' && !Array.isArray(existing)) {
        _.set(this.state, path, _.merge({}, existing, value));
        return;
      }
    }
    _.set(this.state, path, value);
  }

  // 规范化状态：确保NPC分类、事迹、结构默认值
  private normalizeState(): void {
    ensureNpcCategoryDefaults(this.state);
    ensureNpcChronicleDefaults(this.state);
    ensureNpcStructureDefaults(this.state);
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
          _.set(this.state, resolvedPath, patch.value);
          break;
        case 'remove':
          _.unset(this.state, resolvedPath);
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
        // 人物事迹：数组拼接（追加）而非替换
        const npcData = data as Record<string, unknown>;
        const incomingChronicles = npcData.人物事迹;
        if (Array.isArray(incomingChronicles)) {
          delete npcData.人物事迹;
          const existing = (this.state.人物档案[npcId] as any).人物事迹;
          const existingArr = Array.isArray(existing) ? existing : [];
          // 去重追加：只添加不存在的新条目
          const newEntries = incomingChronicles.filter(c => !existingArr.includes(c));
          (this.state.人物档案[npcId] as any).人物事迹 = [...existingArr, ...newEntries];
        }
        _.merge(this.state.人物档案[npcId], npcData);
      }

      // 从 patch 中移除已单独处理的 人物档案
      const { 人物档案: _npcs, ...rest } = patch;
      if (Object.keys(rest).length > 0) {
        _.merge(this.state, rest);
      }
    } else {
      // 没有 NPC 数据，普通合并
      _.merge(this.state, patch);
    }

    this.normalizeState();
  }

  // 创建供系统提示使用的安全快照
  createSafeSnapshotForPrompt(): GameState {
    const snapshot = _.cloneDeep(this.state);
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
  createSnapshot(): GameState {
    return _.cloneDeep(this.state);
  }

  // 从快照恢复变量状态（保留 portraitUrl 等缓存字段）
  restoreSnapshot(snapshot: GameState): void {
    if (!snapshot) return;
    const currentState = _.cloneDeep(this.state);
    this.state = _.cloneDeep(snapshot);
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
        this.state = _.cloneDeep(parsed);
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
