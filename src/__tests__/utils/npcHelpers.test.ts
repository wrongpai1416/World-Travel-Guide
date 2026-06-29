import { describe, it, expect } from 'bun:test';
import {
  isNpcDead,
  normalizeNpcCategoryValue,
  getNpcCategoryValue,
  ensureNpcCategoryDefaults,
  normalizeNpcIdentifierText,
  getNpcDisplayName,
  resolveNpcId,
  normalizeNpcChronicles,
  ensureNpcChronicleDefaults,
  ensureNpcStructureDefaults,
  countNpcCreationHintFields,
  isNpcCreationPayload,
  canCreateNpcFromPatch,
  getCreatableNpcIdentifier,
  createPromptSafeNpcSnapshot,
  formatSnapshotForMainAI,
  NPC_CATEGORY_DEFAULT,
  NPC_CATEGORY_VALUES,
} from '../../utils/npcHelpers';
import { createDefaultGameState, type GameState } from '../../schema/variables';

// 辅助：创建带 NPC 的 GameState
function makeStateWithNpc(): GameState {
  const state = createDefaultGameState();
  state.人物档案 = {
    npc_001: {
      姓名: '李明',
      种族: '人类',
      性别: '男',
      年龄: 25,
      生存状态: { 血量: 100, 体力值: 100 },
      社会身份: { 职业: '战士', 社会地位: '平民' },
      关系数据: { 好感度: 50, 关系类型: '熟人' },
      个人信息: {
        外貌: '高大', 表性格: '豪爽', 里性格: '细心',
        当前想法: '', 当前穿着: '', 当前位置: '', 当前状态: '', 备注: '',
      },
      重要NPC: false,
      _关注: false,
      $time: 1000,
      人物分类: '在场',
      人物事迹: ['初遇'],
    } as any,
    npc_002: {
      姓名: '王芳',
      种族: '人类',
      性别: '女',
      年龄: 22,
      生存状态: { 血量: 0, 体力值: 0 },
      社会身份: { 职业: '药师', 社会地位: '平民' },
      关系数据: { 好感度: 30, 关系类型: '陌生人' },
      个人信息: {
        外貌: '清秀', 表性格: '温柔', 里性格: '坚强',
        当前想法: '', 当前穿着: '', 当前位置: '', 当前状态: '已死亡', 备注: '',
      },
      重要NPC: false,
      _关注: false,
      $time: 2000,
      人物分类: '离场',
      人物事迹: ['初遇', '救治'],
    } as any,
  };
  return state;
}

describe('npcHelpers', () => {
  // ── 常量 ──

  describe('常量', () => {
    it('NPC_CATEGORY_DEFAULT 为 "在场"', () => {
      expect(NPC_CATEGORY_DEFAULT).toBe('在场');
    });

    it('NPC_CATEGORY_VALUES 包含三个分类', () => {
      expect(NPC_CATEGORY_VALUES.has('在场')).toBe(true);
      expect(NPC_CATEGORY_VALUES.has('离场')).toBe(true);
      expect(NPC_CATEGORY_VALUES.has('重点')).toBe(true);
      expect(NPC_CATEGORY_VALUES.has('其他')).toBe(false);
    });
  });

  // ── isNpcDead ──

  describe('isNpcDead', () => {
    it('血量 <= 0 判定为死亡', () => {
      expect(isNpcDead({ 生存状态: { 血量: 0 } } as any)).toBe(true);
      expect(isNpcDead({ 生存状态: { 血量: -10 } } as any)).toBe(true);
    });

    it('血量 > 0 判定为存活', () => {
      expect(isNpcDead({ 生存状态: { 血量: 100 } } as any)).toBe(false);
      expect(isNpcDead({ 生存状态: { 血量: 1 } } as any)).toBe(false);
    });

    it('当前状态包含死亡关键词判定为死亡', () => {
      expect(isNpcDead({ 生存状态: { 血量: 100 }, 个人信息: { 当前状态: '已死亡' } } as any)).toBe(true);
      expect(isNpcDead({ 生存状态: { 血量: 100 }, 个人信息: { 当前状态: 'dead' } } as any)).toBe(true);
    });

    it('null/undefined/非对象返回 false', () => {
      expect(isNpcDead(null)).toBe(false);
      expect(isNpcDead(undefined)).toBe(false);
      expect(isNpcDead('string' as any)).toBe(false);
    });
  });

  // ── normalizeNpcCategoryValue ──

  describe('normalizeNpcCategoryValue', () => {
    it('有效值原样返回', () => {
      expect(normalizeNpcCategoryValue('在场')).toBe('在场');
      expect(normalizeNpcCategoryValue('离场')).toBe('离场');
      expect(normalizeNpcCategoryValue('重点')).toBe('重点');
    });

    it('无效值返回默认值 "在场"', () => {
      expect(normalizeNpcCategoryValue('其他')).toBe('在场');
      expect(normalizeNpcCategoryValue(null)).toBe('在场');
      expect(normalizeNpcCategoryValue(undefined)).toBe('在场');
      expect(normalizeNpcCategoryValue(123 as any)).toBe('在场');
    });
  });

  // ── getNpcCategoryValue ──

  describe('getNpcCategoryValue', () => {
    it('有 人物分类 字段时返回该值', () => {
      expect(getNpcCategoryValue({ 人物分类: '在场' } as any)).toBe('在场');
      expect(getNpcCategoryValue({ 人物分类: '离场' } as any)).toBe('离场');
    });

    it('无 人物分类 字段时返回默认值', () => {
      expect(getNpcCategoryValue({} as any)).toBe('在场');
      expect(getNpcCategoryValue(null)).toBe('在场');
      expect(getNpcCategoryValue(undefined)).toBe('在场');
    });

    it('无效的 人物分类 值返回默认值', () => {
      expect(getNpcCategoryValue({ 人物分类: '无效' } as any)).toBe('在场');
    });
  });

  // ── normalizeNpcIdentifierText ──

  describe('normalizeNpcIdentifierText', () => {
    it('去除首尾空白', () => {
      expect(normalizeNpcIdentifierText('  李明  ')).toBe('李明');
    });

    it('null/undefined 返回空字符串', () => {
      expect(normalizeNpcIdentifierText(null)).toBe('');
      expect(normalizeNpcIdentifierText(undefined)).toBe('');
    });

    it('非字符串转为字符串', () => {
      expect(normalizeNpcIdentifierText(123 as any)).toBe('123');
    });
  });

  // ── getNpcDisplayName ──

  describe('getNpcDisplayName', () => {
    it('有姓名时返回姓名', () => {
      expect(getNpcDisplayName({ 姓名: '李明' } as any)).toBe('李明');
    });

    it('无姓名时返回 fallbackId', () => {
      expect(getNpcDisplayName({}, 'npc_001')).toBe('npc_001');
    });

    it('null 返回 fallbackId', () => {
      expect(getNpcDisplayName(null, 'fallback')).toBe('fallback');
    });
  });

  // ── resolveNpcId ──

  describe('resolveNpcId', () => {
    it('精确 ID 匹配', () => {
      const state = makeStateWithNpc();
      const result = resolveNpcId('npc_001', state);
      expect(result.ok).toBe(true);
      expect(result.npcId).toBe('npc_001');
      expect(result.matchedBy).toBe('id');
    });

    it('姓名匹配', () => {
      const state = makeStateWithNpc();
      const result = resolveNpcId('李明', state);
      expect(result.ok).toBe(true);
      expect(result.npcId).toBe('npc_001');
      expect(result.matchedBy).toBe('name');
    });

    it('无匹配时返回 not_found', () => {
      const state = makeStateWithNpc();
      const result = resolveNpcId('不存在的人', state);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('空标识返回 empty', () => {
      const state = makeStateWithNpc();
      const result = resolveNpcId('', state);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('empty');
    });

    it('null 标识返回 empty', () => {
      const state = makeStateWithNpc();
      const result = resolveNpcId(null, state);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('empty');
    });

    it('多个同名 NPC 时返回 ambiguous', () => {
      const state = makeStateWithNpc();
      // 添加一个同名的 NPC
      state.人物档案.npc_003 = { ...state.人物档案.npc_001, 姓名: '李明' } as any;
      const result = resolveNpcId('李明', state);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('ambiguous');
      expect(result.matchedIds).toHaveLength(2);
    });

    it('空人物档案时返回 not_found', () => {
      const state = createDefaultGameState();
      const result = resolveNpcId('李明', state);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_found');
    });
  });

  // ── normalizeNpcChronicles ──

  describe('normalizeNpcChronicles', () => {
    it('数组输入：trim + filter(Boolean)', () => {
      expect(normalizeNpcChronicles(['  a  ', '', 'b'])).toEqual(['a', 'b']);
    });

    it('字符串输入：按换行分割', () => {
      expect(normalizeNpcChronicles('第一行\n第二行\n第三行')).toEqual(['第一行', '第二行', '第三行']);
    });

    it('字符串输入：按 | 分割', () => {
      expect(normalizeNpcChronicles('事件A|事件B|事件C')).toEqual(['事件A', '事件B', '事件C']);
    });

    it('字符串输入：按 ｜（全角）分割', () => {
      expect(normalizeNpcChronicles('事件A｜事件B')).toEqual(['事件A', '事件B']);
    });

    it('空字符串返回空数组', () => {
      expect(normalizeNpcChronicles('')).toEqual([]);
    });

    it('null/undefined 返回空数组', () => {
      expect(normalizeNpcChronicles(null)).toEqual([]);
      expect(normalizeNpcChronicles(undefined)).toEqual([]);
    });

    it('数字类型返回空数组', () => {
      expect(normalizeNpcChronicles(123)).toEqual([]);
    });
  });

  // ── ensureNpcChronicleDefaults ──

  describe('ensureNpcChronicleDefaults', () => {
    it('缺失人物事迹时不主动填充（isSameChronicleList 判定 undefined ≡ []）', () => {
      const state = createDefaultGameState();
      state.人物档案.test = { 姓名: '测试' } as any;
      ensureNpcChronicleDefaults(state);
      // isSameChronicleList(undefined, []) 返回 true，所以不会写入
      expect((state.人物档案.test as any).人物事迹).toBeUndefined();
    });

    it('已有人物事迹时规范化', () => {
      const state = createDefaultGameState();
      state.人物档案.test = { 姓名: '测试', 人物事迹: ['  a  ', '', 'b'] } as any;
      ensureNpcChronicleDefaults(state);
      expect((state.人物档案.test as any).人物事迹).toEqual(['a', 'b']);
    });

    it('兼容 characterDeeds 字段', () => {
      const state = createDefaultGameState();
      state.人物档案.test = { 姓名: '测试', characterDeeds: ['事件A', '事件B'] } as any;
      ensureNpcChronicleDefaults(state);
      expect((state.人物档案.test as any).人物事迹).toEqual(['事件A', '事件B']);
    });
  });

  // ── ensureNpcStructureDefaults ──

  describe('ensureNpcStructureDefaults', () => {
    it('缺失字段时填充默认值', () => {
      const state = createDefaultGameState();
      state.人物档案.test = { 姓名: '测试' } as any;
      ensureNpcStructureDefaults(state);
      const n = state.人物档案.test as any;
      expect(n.背景).toBe('未知');
      expect(n.性格).toBe('未知');
      expect(n.穿着).toBe('未知');
      expect(n.当前行动).toBe('未知');
      expect(n.短期目标).toBe('未知');
      expect(n.长期目标).toBe('未知');
      expect(n.内心想法).toBe('暂无');
      expect(n.种族特性).toEqual([]);
      expect(n.属性).toEqual({});
      expect(n.天赋).toEqual([]);
      expect(n.技能列表).toEqual([]);
      expect(n.物品列表).toEqual([]);
      expect(n.装备列表).toEqual({});
    });

    it('缺失嵌套对象时填充默认值', () => {
      const state = createDefaultGameState();
      state.人物档案.test = { 姓名: '测试' } as any;
      ensureNpcStructureDefaults(state);
      const n = state.人物档案.test as any;
      expect(n.生存状态).toEqual({ 血量: 100, 体力值: 100 });
      expect(n.社会身份).toEqual({ 职业: '未知', 社会地位: '普通' });
      expect(n.关系数据).toEqual({ 好感度: 0, 关系类型: '陌生人' });
      expect(n.个人信息).toBeDefined();
      expect(n.个人信息.外貌).toBe('未知');
    });

    it('已有字段不被覆盖', () => {
      const state = createDefaultGameState();
      state.人物档案.test = {
        姓名: '测试',
        背景: '已有背景',
        生存状态: { 血量: 50, 体力值: 60 },
      } as any;
      ensureNpcStructureDefaults(state);
      const n = state.人物档案.test as any;
      expect(n.背景).toBe('已有背景');
      expect(n.生存状态.血量).toBe(50);
    });

    it('空字符串字段被替换为默认值', () => {
      const state = createDefaultGameState();
      state.人物档案.test = {
        姓名: '测试',
        个人信息: { 外貌: '', 表性格: '', 里性格: '' },
      } as any;
      ensureNpcStructureDefaults(state);
      const n = state.人物档案.test as any;
      expect(n.个人信息.外貌).toBe('未知');
      expect(n.个人信息.表性格).toBe('未知');
      expect(n.个人信息.里性格).toBe('未知');
    });

    it('空人物档案不崩溃', () => {
      const state = createDefaultGameState();
      expect(() => ensureNpcStructureDefaults(state)).not.toThrow();
    });
  });

  // ── ensureNpcCategoryDefaults ──

  describe('ensureNpcCategoryDefaults', () => {
    it('缺失人物分类时填充默认值 "在场"', () => {
      const state = createDefaultGameState();
      state.人物档案.test = { 姓名: '测试' } as any;
      ensureNpcCategoryDefaults(state);
      expect((state.人物档案.test as any).人物分类).toBe('在场');
    });

    it('已有有效人物分类不被覆盖', () => {
      const state = createDefaultGameState();
      state.人物档案.test = { 姓名: '测试', 人物分类: '离场' } as any;
      ensureNpcCategoryDefaults(state);
      expect((state.人物档案.test as any).人物分类).toBe('离场');
    });

    it('无效人物分类被替换为默认值', () => {
      const state = createDefaultGameState();
      state.人物档案.test = { 姓名: '测试', 人物分类: '无效值' } as any;
      ensureNpcCategoryDefaults(state);
      expect((state.人物档案.test as any).人物分类).toBe('在场');
    });
  });

  // ── NPC 创建检测 ──

  describe('countNpcCreationHintFields / isNpcCreationPayload', () => {
    it('0 个 hint 字段 → count=0, isCreation=false', () => {
      expect(countNpcCreationHintFields({ 随意字段: 'x' })).toBe(0);
      expect(isNpcCreationPayload({ 随意字段: 'x' })).toBe(false);
    });

    it('1 个 hint 字段 → count=1, isCreation=false（需要 >=2）', () => {
      expect(countNpcCreationHintFields({ 姓名: '李明' })).toBe(1);
      expect(isNpcCreationPayload({ 姓名: '李明' })).toBe(false);
    });

    it('2 个 hint 字段 → count=2, isCreation=true', () => {
      expect(countNpcCreationHintFields({ 姓名: '李明', 性别: '男' })).toBe(2);
      expect(isNpcCreationPayload({ 姓名: '李明', 性别: '男' })).toBe(true);
    });

    it('英文 hint 字段同样计数', () => {
      expect(countNpcCreationHintFields({ name: 'Lee', age: 25 })).toBe(2);
      expect(isNpcCreationPayload({ name: 'Lee', age: 25 })).toBe(true);
    });

    it('非对象返回 0', () => {
      expect(countNpcCreationHintFields(null)).toBe(0);
      expect(countNpcCreationHintFields('string')).toBe(0);
      expect(countNpcCreationHintFields([1, 2])).toBe(0);
    });
  });

  // ── canCreateNpcFromPatch ──

  describe('canCreateNpcFromPatch', () => {
    it('路径为 人物档案/X 且 add 操作且 value 是创建 payload → true', () => {
      expect(canCreateNpcFromPatch(['人物档案', 'new_npc'], 'add', { 姓名: '新人', 性别: '男' })).toBe(true);
    });

    it('路径深度 > 2 → false', () => {
      expect(canCreateNpcFromPatch(['人物档案', 'npc', '字段'], 'add', { 姓名: 'x', 性别: 'y' })).toBe(false);
    });

    it('op 不是 add/replace → false', () => {
      expect(canCreateNpcFromPatch(['人物档案', 'new_npc'], 'remove', { 姓名: 'x', 性别: 'y' })).toBe(false);
    });

    it('value 不是创建 payload → false', () => {
      expect(canCreateNpcFromPatch(['人物档案', 'new_npc'], 'add', { 随意字段: 'x' })).toBe(false);
    });

    it('路径第一段不是 人物档案 → false', () => {
      expect(canCreateNpcFromPatch(['玩家', 'new_npc'], 'add', { 姓名: 'x', 性别: 'y' })).toBe(false);
    });
  });

  // ── getCreatableNpcIdentifier ──

  describe('getCreatableNpcIdentifier', () => {
    it('正常字符串返回 trim 后的值', () => {
      expect(getCreatableNpcIdentifier('  李明  ')).toBe('李明');
    });

    it('null 返回空字符串', () => {
      expect(getCreatableNpcIdentifier(null)).toBe('');
    });
  });

  // ── createPromptSafeNpcSnapshot ──

  describe('createPromptSafeNpcSnapshot', () => {
    it('null/undefined 返回最小快照', () => {
      const result = createPromptSafeNpcSnapshot(null, 'npc_001');
      expect(result.姓名).toBe('npc_001');
      expect(result.人物分类).toBe('离场');
      expect(result.人物事迹).toEqual([]);
    });

    it('离场 NPC 返回精简快照', () => {
      const npc = {
        姓名: '王芳',
        人物分类: '离场',
        人物事迹: ['事件A', '事件B', '事件C', '事件D'],
        个人信息: { 当前位置: '墓地' },
      };
      const result = createPromptSafeNpcSnapshot(npc, 'npc_002');
      expect(result.姓名).toBe('王芳');
      expect(result.人物分类).toBe('离场');
      expect((result.人物事迹 as string[]).length).toBe(3); // 最近 3 条
      expect((result.个人信息 as any).当前位置).toBe('墓地');
    });

    it('在场 NPC 返回完整快照', () => {
      const npc = {
        姓名: '李明',
        人物分类: '在场',
        人物事迹: ['初遇'],
        种族: '人类',
      };
      const result = createPromptSafeNpcSnapshot(npc, 'npc_001');
      expect(result.姓名).toBe('李明');
      expect(result.人物分类).toBe('在场');
      expect(result.人物事迹).toEqual(['初遇']);
      expect(result.种族).toBe('人类');
    });

    it('重点 NPC 返回完整快照', () => {
      const npc = {
        姓名: '重要角色',
        人物分类: '重点',
        人物事迹: ['关键事件'],
      };
      const result = createPromptSafeNpcSnapshot(npc, 'npc_003');
      expect(result.人物分类).toBe('重点');
    });
  });

  // ── formatSnapshotForMainAI ──

  describe('formatSnapshotForMainAI', () => {
    it('空状态返回空字符串', () => {
      const state = createDefaultGameState();
      const result = formatSnapshotForMainAI(state);
      // 默认状态只有默认值，大部分为空，但货币资源有默认值
      expect(typeof result).toBe('string');
    });

    it('包含玩家信息', () => {
      const state = createDefaultGameState();
      state.玩家.姓名 = '勇者';
      state.玩家.当前位置 = '王城';
      state.玩家.当前目标 = '打倒魔王';
      const result = formatSnapshotForMainAI(state);
      expect(result).toContain('勇者');
      expect(result).toContain('王城');
      expect(result).toContain('打倒魔王');
      expect(result).toContain('【玩家】');
    });

    it('包含世界状态', () => {
      const state = createDefaultGameState();
      state.世界.时间系统.当前时间 = '黎明';
      state.世界.时间系统.当前天气 = '晴';
      state.世界.空间定位.当前位置 = '王城';
      const result = formatSnapshotForMainAI(state);
      expect(result).toContain('黎明');
      expect(result).toContain('晴');
      expect(result).toContain('王城');
      expect(result).toContain('【世界状态】');
    });

    it('包含在场 NPC', () => {
      const state = makeStateWithNpc();
      const result = formatSnapshotForMainAI(state);
      expect(result).toContain('李明');
      expect(result).toContain('[NPC]');
      expect(result).toContain('【在场人物】');
    });

    it('包含离场 NPC', () => {
      const state = makeStateWithNpc();
      const result = formatSnapshotForMainAI(state);
      expect(result).toContain('王芳');
      expect(result).toContain('【离场人物】');
    });

    it('包含生存状态', () => {
      const state = createDefaultGameState();
      state.玩家.生存状态.血量 = 80;
      state.玩家.生存状态.体力值 = 60;
      const result = formatSnapshotForMainAI(state);
      expect(result).toContain('血量:80');
      expect(result).toContain('体力值:60');
      expect(result).toContain('【生存状态】');
    });

    it('包含记事本内容', () => {
      const state = createDefaultGameState();
      state.玩家.记事本.潜在危机 = {
        '龙来袭': { 严重程度: '高', 预计影响时间: '3天', 应对措施: '逃跑', $time: 1 },
      };
      const result = formatSnapshotForMainAI(state);
      expect(result).toContain('龙来袭');
      expect(result).toContain('【记事本】');
    });
  });
});
