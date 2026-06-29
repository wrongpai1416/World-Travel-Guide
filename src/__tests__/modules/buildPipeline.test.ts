import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { generateWorldBookEntries, executeBuildPipeline } from '../../modules/buildPipeline';
import { createBuildContext, type BuildContext } from '../../modules/buildContext';
import type { StatModuleSchema, ProgressionModuleSchema, SurvivalModuleSchema, BusinessModuleSchema, TalentModuleSchema } from '../../modules/schema';

// ═══════════════════════════════════════════════════
//  generateWorldBookEntries — 直接测试（已导出）
// ═══════════════════════════════════════════════════

describe('generateWorldBookEntries', () => {
  it('没有模块数据时返回空数组', () => {
    const ctx = createBuildContext('test', []);
    expect(generateWorldBookEntries(ctx)).toEqual([]);
  });

  it('数值属性模块生成绿灯条目', () => {
    const statData: StatModuleSchema = {
      attrA: { name: '生命', current: 80, max: 100 },
      attrB: { name: '能量', current: 60, max: 100 },
      dim1: { name: '攻击', value: 50, range: [0, 100] },
      dim2: { name: '防御', value: 40, range: [0, 100] },
      special: [{ id: 'crit', name: '暴击', value: 5, range: [0, 100], description: '暴击率' }],
    };
    const ctx = createBuildContext('test', ['stat']);
    ctx.statData = statData;
    const entries = generateWorldBookEntries(ctx);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const statEntry = entries.find(e => e.comment.includes('数值属性'));
    expect(statEntry).toBeDefined();
    expect(statEntry!.constant).toBe(false);
    expect(statEntry!.key).toContain('生命');
    expect(statEntry!.key).toContain('攻击');
    expect(statEntry!.key).toContain('暴击');
    expect(statEntry!.content).toContain('生命');
    expect(statEntry!.content).toContain('攻击');
  });

  it('成长体系模块（段位制）生成绿灯条目', () => {
    const progData: ProgressionModuleSchema = {
      mode: 'tiered',
      xpFormula: { baseXP: 100, exponent: 1, scaleFactor: 1 },
      tiers: [
        { name: '青铜', description: '初学者', xpRequired: 0, statBonuses: {} as any },
        { name: '白银', description: '进阶', xpRequired: 100, statBonuses: {} as any },
      ],
      currentTierIndex: 0,
      currentXP: 0,
    };
    const ctx = createBuildContext('test', ['progression']);
    ctx.progressionData = progData;
    const entries = generateWorldBookEntries(ctx);
    const progEntry = entries.find(e => e.comment.includes('成长体系'));
    expect(progEntry).toBeDefined();
    expect(progEntry!.key).toContain('青铜');
    expect(progEntry!.key).toContain('白银');
    expect(progEntry!.key).toContain('段位');
    expect(progEntry!.content).toContain('青铜');
    expect(progEntry!.content).toContain('白银');
  });

  it('成长体系模块（等级制）生成绿灯条目', () => {
    const progData: ProgressionModuleSchema = {
      mode: 'level',
      xpFormula: { baseXP: 100, exponent: 1, scaleFactor: 1 },
      levelData: {
        maxLevel: 50,
        baseStats: {} as any,
        growthPerLevel: {} as any,
      },
      currentTierIndex: 0,
      currentXP: 0,
    };
    const ctx = createBuildContext('test', ['progression']);
    ctx.progressionData = progData;
    const entries = generateWorldBookEntries(ctx);
    const progEntry = entries.find(e => e.comment.includes('成长体系'));
    expect(progEntry).toBeDefined();
    expect(progEntry!.key).toContain('等级');
    expect(progEntry!.key).toContain('升级');
    expect(progEntry!.content).toContain('50');
  });

  it('骰子检定模块生成绿灯条目', () => {
    const ctx = createBuildContext('test', ['dice']);
    const entries = generateWorldBookEntries(ctx);
    const diceEntry = entries.find(e => e.comment.includes('骰子'));
    expect(diceEntry).toBeDefined();
    expect(diceEntry!.key).toContain('掷骰');
    expect(diceEntry!.key).toContain('d20');
  });

  it('多个模块同时存在时生成多个条目', () => {
    const ctx = createBuildContext('test', ['stat', 'progression', 'dice']);
    ctx.statData = {
      attrA: { name: 'HP', current: 80, max: 100 },
      attrB: { name: 'MP', current: 60, max: 100 },
      dim1: { name: '攻击', value: 50, range: [0, 100] },
      special: [],
    };
    ctx.progressionData = {
      mode: 'tiered',
      xpFormula: { baseXP: 100, exponent: 1, scaleFactor: 1 },
      tiers: [{ name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any }],
      currentTierIndex: 0,
      currentXP: 0,
    };
    const entries = generateWorldBookEntries(ctx);
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════
//  executeBuildPipeline — 通过 mock callAI 间接测试
//  覆盖 extractJSON, safeNum, extractStatConfig, extractStatState,
//  extractProgressionConfig, synthesizeResult
// ═══════════════════════════════════════════════════

// Mock waitForRateLimit 避免真实延迟
mock.module('../../api/rateLimiter', () => ({
  waitForRateLimit: () => Promise.resolve(),
}));

describe('executeBuildPipeline', () => {
  beforeEach(() => {
    mock.restore();
  });

  it('阶段1: 主题提取 — 正确解析 AI 返回的 JSON', async () => {
    const themeJSON = JSON.stringify({
      theme: '东方修仙',
      tone: '严肃',
      era: '古代',
      attrAName: '灵力',
      attrBName: '真气',
      dim1Name: '根骨', dim2Name: '悟性', dim3Name: '机缘',
      dim4Name: '道行', dim5Name: '心境', dim6Name: '福缘',
    });
    const callAI = mock(async (messages: Array<{ role: string; content: string }>) => {
      return '```json\n' + themeJSON + '\n```';
    });
    const ctx = createBuildContext('修仙世界', ['stat']);
    const result = await executeBuildPipeline(ctx, { callAI });
    expect(result.theme).toBeDefined();
    expect(result.theme!.theme).toBe('东方修仙');
    expect(result.theme!.attrAName).toBe('灵力');
    expect(result.theme!.dim1Name).toBe('根骨');
  });

  it('阶段1: 主题提取 — JSON 解析失败时使用默认值', async () => {
    const callAI = mock(async () => 'not valid json at all');
    const ctx = createBuildContext('test world', ['stat']);
    const result = await executeBuildPipeline(ctx, { callAI });
    expect(result.theme).toBeDefined();
    expect(result.theme!.theme).toBe('通用');
    expect(result.theme!.attrAName).toBe('生命');
  });

  it('阶段2: 属性系统生成 — 正确分离 config 和 state', async () => {
    const statJSON = JSON.stringify({
      attrA: { name: '生命', current: 85, max: 120 },
      attrB: { name: '能量', current: 50, max: 80 },
      dim1: { name: '攻击', value: 60, range: [0, 100] },
      dim2: { name: '防御', value: 45, range: [0, 100] },
      special: [{ id: 'crit', name: '暴击', value: 10, range: [0, 50], description: '暴击率' }],
    });
    let callCount = 0;
    const callAI = mock(async () => {
      callCount++;
      if (callCount === 1) return JSON.stringify({ theme: 'test', attrAName: '生命', attrBName: '能量', dim1Name: '攻击', dim2Name: '防御', dim3Name: '速度', dim4Name: '智力', dim5Name: '魅力', dim6Name: '幸运' });
      return '```json\n' + statJSON + '\n```';
    });
    const ctx = createBuildContext('test', ['stat']);
    const result = await executeBuildPipeline(ctx, { callAI });
    // 验证 extractStatConfig 的结果
    expect(result.statConfig).toBeDefined();
    expect(result.statConfig!.attrA.name).toBe('生命');
    expect(result.statConfig!.attrA.max).toBe(120);
    expect(result.statConfig!.dim1.name).toBe('攻击');
    expect(result.statConfig!.dim1.range).toEqual([0, 100]);
    expect(result.statConfig!.special).toHaveLength(1);
    // 验证 extractStatState 的结果
    expect(result.statState).toBeDefined();
    expect(result.statState!.attrA).toBe(85);
    expect(result.statState!.attrB).toBe(50);
    expect(result.statState!.dim1).toBe(60);
    expect(result.statState!.special.crit).toBe(10);
  });

  it('阶段2: 属性系统 — 缺失字段使用默认值（safeNum 回退）', async () => {
    const statJSON = JSON.stringify({
      attrA: { name: 'HP' },  // 缺失 current 和 max
      attrB: { name: 'MP' },
      // 缺失所有 dim
      special: [],
    });
    let callCount = 0;
    const callAI = mock(async () => {
      callCount++;
      if (callCount === 1) return JSON.stringify({ theme: 'test', attrAName: 'HP', attrBName: 'MP', dim1Name: 'd1', dim2Name: 'd2', dim3Name: 'd3', dim4Name: 'd4', dim5Name: 'd5', dim6Name: 'd6' });
      return statJSON;
    });
    const ctx = createBuildContext('test', ['stat']);
    const result = await executeBuildPipeline(ctx, { callAI });
    // safeNum(undefined, 100) → 100
    expect(result.statConfig!.attrA.max).toBe(100);
    // safeNum(undefined, 80) → 80 (attrA current 默认)
    expect(result.statState!.attrA).toBe(80);
    // safeNum(undefined, 50) → 50 (dim 默认)
    expect(result.statState!.dim1).toBe(50);
  });

  it('阶段2: 成长体系生成 — 正确提取 progressionConfig', async () => {
    const progJSON = JSON.stringify({
      mode: 'tiered',
      xpFormula: { baseXP: 200, exponent: 1.5, scaleFactor: 1 },
      tiers: [
        { name: '凡人', description: '普通人', xpRequired: 0, statBonuses: {} },
        { name: '筑基', description: '修仙入门', xpRequired: 200, statBonuses: {} },
      ],
      currentTierIndex: 0,
      currentXP: 0,
    });
    let callCount = 0;
    const callAI = mock(async () => {
      callCount++;
      if (callCount === 1) return JSON.stringify({ theme: '修仙', attrAName: '灵力', attrBName: '真气', dim1Name: '根骨', dim2Name: '悟性', dim3Name: '机缘', dim4Name: '道行', dim5Name: '心境', dim6Name: '福缘', tone: '中等', era: '古代' });
      if (callCount === 2) return '{}'; // stat 数据为空
      return progJSON;
    });
    const ctx = createBuildContext('修仙世界', ['stat', 'progression']);
    const result = await executeBuildPipeline(ctx, { callAI });
    expect(result.progressionConfig).toBeDefined();
    expect(result.progressionConfig!.mode).toBe('tiered');
    expect(result.progressionConfig!.xpFormula.baseXP).toBe(200);
    expect(result.progressionConfig!.tiers).toHaveLength(2);
    expect(result.progressionConfig!.tiers![0].name).toBe('凡人');
  });

  it('阶段4: synthesizeResult — 正确合成最终结果', async () => {
    const statJSON = JSON.stringify({
      attrA: { name: '生命', current: 80, max: 100 },
      attrB: { name: '能量', current: 60, max: 100 },
      dim1: { name: '攻击', value: 50, range: [0, 100] },
      special: [],
    });
    let callCount = 0;
    const callAI = mock(async () => {
      callCount++;
      if (callCount === 1) return JSON.stringify({ theme: 'test', attrAName: '生命', attrBName: '能量', dim1Name: '攻击', dim2Name: '防御', dim3Name: '速度', dim4Name: '智力', dim5Name: '魅力', dim6Name: '幸运' });
      return statJSON;
    });
    const ctx = createBuildContext('test', ['stat']);
    const result = await executeBuildPipeline(ctx, { callAI });
    expect(result.result).toBeDefined();
    // 有 config + initialState 格式
    expect(result.result!['数值属性']).toBeDefined();
    expect((result.result!['数值属性'] as any).config).toBeDefined();
    expect((result.result!['数值属性'] as any).initialState).toBeDefined();
    // 有世界书条目
    expect(result.result!.worldBookEntries).toBeDefined();
    expect(Array.isArray(result.result!.worldBookEntries)).toBe(true);
  });

  it('阶段4: synthesizeResult — 兼容旧格式（只有原始数据时直接使用）', async () => {
    // 不选任何模块，不会生成数据
    const callAI = mock(async () => '');
    const ctx = createBuildContext('empty world', []);
    const result = await executeBuildPipeline(ctx, { callAI });
    // 没有模块数据，result 应该只有 worldBookEntries（如果有的话）
    expect(result.result).toBeDefined();
  });

  it('progression 模块自动启用 stat 模块', async () => {
    let callCount = 0;
    const callAI = mock(async () => {
      callCount++;
      return JSON.stringify({ theme: 'test', attrAName: 'a', attrBName: 'b', dim1Name: 'd1', dim2Name: 'd2', dim3Name: 'd3', dim4Name: 'd4', dim5Name: 'd5', dim6Name: 'd6' });
    });
    const ctx = createBuildContext('test', ['progression']);  // 只选 progression
    const result = await executeBuildPipeline(ctx, { callAI });
    // stat 应该被自动添加
    expect(result.selectedModules).toContain('stat');
  });

  it('extractJSON: 从 markdown 代码块提取', async () => {
    const json = '{ "theme": "test" }';
    let callCount = 0;
    const callAI = mock(async () => {
      callCount++;
      if (callCount === 1) return 'Here is the result:\n```json\n' + json + '\n```\nDone.';
      return '{}';
    });
    const ctx = createBuildContext('test', ['stat']);
    const result = await executeBuildPipeline(ctx, { callAI });
    expect(result.theme!.theme).toBe('test');
  });

  it('extractJSON: 从裸文本提取 JSON', async () => {
    const json = '{ "theme": "裸JSON" }';
    let callCount = 0;
    const callAI = mock(async () => {
      callCount++;
      if (callCount === 1) return 'Some text before ' + json + ' some text after';
      return '{}';
    });
    const ctx = createBuildContext('test', ['stat']);
    const result = await executeBuildPipeline(ctx, { callAI });
    expect(result.theme!.theme).toBe('裸JSON');
  });

  it('extractJSON: 修复中文引号', async () => {
    // 使用中文全角引号的 JSON
    const json = '{ “theme”: “中文引号” }';
    let callCount = 0;
    const callAI = mock(async () => {
      callCount++;
      if (callCount === 1) return json;
      return '{}';
    });
    const ctx = createBuildContext('test', ['stat']);
    const result = await executeBuildPipeline(ctx, { callAI });
    expect(result.theme!.theme).toBe('中文引号');
  });

  it('onProgress 回调被正确调用', async () => {
    const callAI = mock(async () => JSON.stringify({ theme: 'test', attrAName: 'a', attrBName: 'b', dim1Name: 'd1', dim2Name: 'd2', dim3Name: 'd3', dim4Name: 'd4', dim5Name: 'd5', dim6Name: 'd6' }));
    const progressCalls: Array<{ stage: string; detail: string }> = [];
    const ctx = createBuildContext('test', ['stat']);
    await executeBuildPipeline(ctx, {
      callAI,
      onProgress: (stage, detail) => progressCalls.push({ stage, detail }),
    });
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls.some(p => p.stage === '阶段1')).toBe(true);
    expect(progressCalls.some(p => p.stage === '阶段3')).toBe(true);
    expect(progressCalls.some(p => p.stage === '阶段4')).toBe(true);
  });
});
