import { describe, it, expect, beforeEach } from 'bun:test';
import { VariableManager } from '../../engine/variableManager';
import { createDefaultGameState } from '../../schema/variables';
import type { GameState } from '../../schema/variables';

// 辅助：创建带 NPC 的初始状态
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
      $time: Date.now(),
      人物分类: '在场',
      人物事迹: ['初遇'],
    } as any,
  };
  return state;
}

describe('VariableManager', () => {
  // ── 构造与初始状态 ──

  describe('构造函数', () => {
    it('无参数时创建默认状态', () => {
      const vm = new VariableManager();
      const state = vm.getState();
      expect(state.玩家.生存状态.血量).toBe(100);
      expect(state.玩家.生存状态.体力值).toBe(100);
      expect(state.玩家.货币资源.主货币.数量).toBe(500);
      expect(state.人物档案).toEqual({});
    });

    it('传入自定义初始状态时使用该状态', () => {
      const custom = createDefaultGameState();
      custom.玩家.姓名 = '勇者';
      custom.玩家.生存状态.血量 = 80;
      const vm = new VariableManager(custom);
      const state = vm.getState();
      expect(state.玩家.姓名).toBe('勇者');
      expect(state.玩家.生存状态.血量).toBe(80);
    });

    it('传入的初始状态被深拷贝（修改原始不影响 VM）', () => {
      const custom = createDefaultGameState();
      custom.玩家.姓名 = '勇者';
      const vm = new VariableManager(custom);
      custom.玩家.姓名 = '改了';
      expect(vm.getState().玩家.姓名).toBe('勇者');
    });
  });

  // ── getVar / setVar ──

  describe('getVar / setVar', () => {
    it('基本读写', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.姓名', '张三');
      expect(vm.getVar('玩家.姓名')).toBe('张三');
    });

    it('嵌套路径读写', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.生存状态.血量', 75);
      expect(vm.getVar('玩家.生存状态.血量')).toBe(75);
    });

    it('读取不存在的路径返回 defaultValue', () => {
      const vm = new VariableManager();
      expect(vm.getVar('不存在的路径', '默认值')).toBe('默认值');
    });

    it('读取不存在的路径无 defaultValue 返回 undefined', () => {
      const vm = new VariableManager();
      expect(vm.getVar('不存在的路径')).toBeUndefined();
    });

    it('对象值默认深度合并（forceReplace=false）', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.身份信息', { 职业: '战士' });
      // 默认合并，不丢失原有字段
      const info = vm.getVar('玩家.身份信息') as any;
      expect(info.职业).toBe('战士');
      expect(info.阶层).toBe(''); // 原有字段保留
    });

    it('forceReplace=true 时直接替换', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.身份信息', { 职业: '战士' }, true);
      const info = vm.getVar('玩家.身份信息') as any;
      expect(info.职业).toBe('战士');
      expect(info.阶层).toBeUndefined(); // 原有字段被删除
    });

    it('数组值不被深度合并（直接替换）', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.技能系统', { 火球术: { 品质: '普通', 描述: 'd', 类型: 't' } });
      vm.setVar('玩家.技能系统', { 冰冻术: { 品质: '稀有', 描述: 'd2', 类型: 't2' } });
      const skills = vm.getVar('玩家.技能系统') as any;
      // 对象合并：两个技能都在
      expect(skills.火球术).toBeDefined();
      expect(skills.冰冻术).toBeDefined();
    });
  });

  // ── 原型污染防护 ──

  describe('isSafePath（通过 setVar 间接测试）', () => {
    it('__proto__ 路径被拒绝', () => {
      const vm = new VariableManager();
      vm.setVar('__proto__.polluted', 'evil');
      const state = vm.getState() as any;
      // 不应污染 Object.prototype
      expect(({} as any).polluted).toBeUndefined();
    });

    it('constructor 路径被拒绝', () => {
      const vm = new VariableManager();
      vm.setVar('constructor.prototype.polluted', 'evil');
      expect(({} as any).polluted).toBeUndefined();
    });

    it('prototype 路径被拒绝', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.prototype.test', 'evil');
      // 不应创建 prototype 属性
      const player = vm.getVar('玩家') as any;
      expect(player.prototype).toBeUndefined();
    });

    it('嵌套路径中的 __proto__ 被拒绝', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.生存状态.__proto__.polluted', 'evil');
      expect(({} as any).polluted).toBeUndefined();
    });

    it('正常路径不受影响', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.姓名', '正常值');
      expect(vm.getVar('玩家.姓名')).toBe('正常值');
    });
  });

  // ── applyPatches ──

  describe('applyPatches', () => {
    it('add 操作设置值', () => {
      const vm = new VariableManager();
      vm.applyPatches([{ op: 'add', path: '/玩家/姓名', value: '勇者' }]);
      expect(vm.getVar('玩家.姓名')).toBe('勇者');
    });

    it('replace 操作替换值', () => {
      const vm = new VariableManager();
      vm.applyPatches([{ op: 'replace', path: '/玩家/生存状态/血量', value: 50 }]);
      expect(vm.getVar('玩家.生存状态.血量')).toBe(50);
    });

    it('remove 操作删除值', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.当前目标', '打倒魔王');
      vm.applyPatches([{ op: 'remove', path: '/玩家/当前目标' }]);
      // unset 后属性完全删除，返回 undefined
      expect(vm.getVar('玩家.当前目标')).toBeUndefined();
    });

    it('多个补丁批量应用', () => {
      const vm = new VariableManager();
      vm.applyPatches([
        { op: 'add', path: '/玩家/姓名', value: '勇者' },
        { op: 'replace', path: '/玩家/生存状态/血量', value: 80 },
        { op: 'add', path: '/玩家/当前目标', value: '冒险' },
      ]);
      expect(vm.getVar('玩家.姓名')).toBe('勇者');
      expect(vm.getVar('玩家.生存状态.血量')).toBe(80);
      expect(vm.getVar('玩家.当前目标')).toBe('冒险');
    });

    it('NPC 路径通过 ID 匹配', () => {
      const vm = new VariableManager(makeStateWithNpc());
      vm.applyPatches([{ op: 'replace', path: '/人物档案/npc_001/关系数据/好感度', value: 80 }]);
      expect(vm.getVar('人物档案.npc_001.关系数据.好感度')).toBe(80);
    });

    it('NPC 路径通过姓名匹配', () => {
      const vm = new VariableManager(makeStateWithNpc());
      vm.applyPatches([{ op: 'replace', path: '/人物档案/李明/关系数据/好感度', value: 90 }]);
      expect(vm.getVar('人物档案.npc_001.关系数据.好感度')).toBe(90);
    });

    it('不存在的 NPC 且非创建补丁时忽略', () => {
      const vm = new VariableManager(makeStateWithNpc());
      vm.applyPatches([{ op: 'replace', path: '/人物档案/不存在的人/关系数据/好感度', value: 50 }]);
      expect(vm.getVar('人物档案.不存在的人')).toBeUndefined();
    });

    it('原型污染路径在补丁中被拒绝', () => {
      const vm = new VariableManager();
      vm.applyPatches([{ op: 'add', path: '/__proto__/polluted', value: 'evil' }]);
      expect(({} as any).polluted).toBeUndefined();
    });
  });

  // ── applyUpdateVariable ──

  describe('applyUpdateVariable', () => {
    it('JSON 数组格式（RFC 6902 补丁）', () => {
      const vm = new VariableManager();
      const json = JSON.stringify([
        { op: 'add', path: '/玩家/姓名', value: '勇者' },
        { op: 'replace', path: '/玩家/生存状态/血量', value: 60 },
      ]);
      expect(vm.applyUpdateVariable(json)).toBe(true);
      expect(vm.getVar('玩家.姓名')).toBe('勇者');
      expect(vm.getVar('玩家.生存状态.血量')).toBe(60);
    });

    it('JSON 对象格式（合并更新）', () => {
      const vm = new VariableManager();
      const json = JSON.stringify({
        玩家: { 姓名: '英雄', 当前目标: '拯救世界' },
      });
      expect(vm.applyUpdateVariable(json)).toBe(true);
      expect(vm.getVar('玩家.姓名')).toBe('英雄');
      expect(vm.getVar('玩家.当前目标')).toBe('拯救世界');
    });

    it('键值对格式（回退解析）', () => {
      const vm = new VariableManager();
      const text = '玩家.姓名=剑士\n玩家.当前目标=寻找宝藏';
      expect(vm.applyUpdateVariable(text)).toBe(true);
      expect(vm.getVar('玩家.姓名')).toBe('剑士');
      expect(vm.getVar('玩家.当前目标')).toBe('寻找宝藏');
    });

    it('值中包含等号的键值对', () => {
      const vm = new VariableManager();
      const text = '玩家.身份信息.背景信息=a=b=c';
      expect(vm.applyUpdateVariable(text)).toBe(true);
      expect(vm.getVar('玩家.身份信息.背景信息')).toBe('a=b=c');
    });

    it('JSON 非对象/非数组返回 false', () => {
      const vm = new VariableManager();
      // JSON.parse('123') 返回 number，不是对象/数组 → false
      expect(vm.applyUpdateVariable('123')).toBe(false);
    });

    it('NPC 合并更新：通过姓名匹配 NPC', () => {
      const vm = new VariableManager(makeStateWithNpc());
      const json = JSON.stringify({
        人物档案: {
          李明: { 关系数据: { 好感度: 99 } },
        },
      });
      expect(vm.applyUpdateVariable(json)).toBe(true);
      expect(vm.getVar('人物档案.npc_001.关系数据.好感度')).toBe(99);
    });

    it('NPC 合并更新：人物事迹追加去重', () => {
      const vm = new VariableManager(makeStateWithNpc());
      const json = JSON.stringify({
        人物档案: {
          npc_001: { 人物事迹: ['初遇', '并肩作战'] },
        },
      });
      expect(vm.applyUpdateVariable(json)).toBe(true);
      const chronicles = vm.getVar('人物档案.npc_001.人物事迹') as string[];
      expect(chronicles).toContain('初遇');
      expect(chronicles).toContain('并肩作战');
      expect(chronicles.filter(c => c === '初遇').length).toBe(1); // 去重
    });

    it('NPC chronicleOperations: add 操作', () => {
      const vm = new VariableManager(makeStateWithNpc());
      const json = JSON.stringify({
        人物档案: {
          npc_001: {
            chronicleOperations: [
              { type: 'add', value: '酒馆相遇' },
              { type: 'add', value: '共同冒险' },
            ],
          },
        },
      });
      expect(vm.applyUpdateVariable(json)).toBe(true);
      const chronicles = vm.getVar('人物档案.npc_001.人物事迹') as string[];
      expect(chronicles).toContain('酒馆相遇');
      expect(chronicles).toContain('共同冒险');
    });

    it('NPC chronicleOperations: remove 操作', () => {
      const vm = new VariableManager(makeStateWithNpc());
      // 先添加多条事迹
      vm.applyUpdateVariable(JSON.stringify({
        人物档案: {
          npc_001: {
            chronicleOperations: [
              { type: 'add', value: '事件A' },
              { type: 'add', value: '事件B' },
              { type: 'add', value: '事件C' },
            ],
          },
        },
      }));
      // 此时事迹 = ['初遇', '事件A', '事件B', '事件C']
      // 删除索引 2（事件B）
      vm.applyUpdateVariable(JSON.stringify({
        人物档案: {
          npc_001: {
            chronicleOperations: [
              { type: 'remove', index: 2 },
            ],
          },
        },
      }));
      const chronicles = vm.getVar('人物档案.npc_001.人物事迹') as string[];
      expect(chronicles).not.toContain('事件B');
      expect(chronicles).toContain('事件A');
      expect(chronicles).toContain('事件C');
    });

    it('NPC chronicleOperations: replace 操作', () => {
      const vm = new VariableManager(makeStateWithNpc());
      vm.applyUpdateVariable(JSON.stringify({
        人物档案: {
          npc_001: {
            chronicleOperations: [
              { type: 'add', value: '旧事件' },
            ],
          },
        },
      }));
      vm.applyUpdateVariable(JSON.stringify({
        人物档案: {
          npc_001: {
            chronicleOperations: [
              { type: 'replace', index: 1, value: '新事件' },
            ],
          },
        },
      }));
      const chronicles = vm.getVar('人物档案.npc_001.人物事迹') as string[];
      // index 1 是 '旧事件'（index 0 是 '初遇'）
      expect(chronicles).not.toContain('旧事件');
      expect(chronicles).toContain('新事件');
    });
  });

  // ── createSnapshot / restoreSnapshot ──

  describe('createSnapshot / restoreSnapshot', () => {
    it('快照往返一致性', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.姓名', '勇者');
      vm.setVar('玩家.生存状态.血量', 70);
      const snapshot = vm.createSnapshot();
      // 修改当前状态
      vm.setVar('玩家.生存状态.血量', 100);
      vm.setVar('玩家.姓名', '改了');
      // 恢复快照
      vm.restoreSnapshot(snapshot);
      expect(vm.getVar('玩家.姓名')).toBe('勇者');
      expect(vm.getVar('玩家.生存状态.血量')).toBe(70);
    });

    it('快照是深拷贝（修改快照不影响 VM）', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.姓名', '原始');
      const snapshot = vm.createSnapshot();
      (snapshot as any).玩家.姓名 = '篡改';
      expect(vm.getVar('玩家.姓名')).toBe('原始');
    });

    it('restoreSnapshot 保留 portraitBlobKey', () => {
      const state = makeStateWithNpc();
      (state.人物档案.npc_001 as any).portraitBlobKey = 'blob_key_123';
      const vm = new VariableManager(state);
      // 创建不含 portraitBlobKey 的快照
      const snapshot = vm.createSnapshot();
      delete (snapshot.人物档案.npc_001 as any).portraitBlobKey;
      // 恢复后应保留当前内存中的 blobKey
      vm.restoreSnapshot(snapshot);
      expect((vm.getState().人物档案.npc_001 as any).portraitBlobKey).toBe('blob_key_123');
    });

    it('restoreSnapshot(null) 不崩溃', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.姓名', '勇者');
      vm.restoreSnapshot(null as any);
      expect(vm.getVar('玩家.姓名')).toBe('勇者');
    });
  });

  // ── getState / setState ──

  describe('getState / setState', () => {
    it('getState 返回深拷贝', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.姓名', '勇者');
      const state1 = vm.getState();
      (state1 as any).玩家.姓名 = '篡改';
      expect(vm.getVar('玩家.姓名')).toBe('勇者');
    });

    it('setState 替换内部状态', () => {
      const vm = new VariableManager();
      const newState = createDefaultGameState();
      newState.玩家.姓名 = '新角色';
      vm.setState(newState);
      expect(vm.getVar('玩家.姓名')).toBe('新角色');
    });

    it('setState 深拷贝（修改原始不影响 VM）', () => {
      const vm = new VariableManager();
      const newState = createDefaultGameState();
      newState.玩家.姓名 = '新角色';
      vm.setState(newState);
      newState.玩家.姓名 = '改了';
      expect(vm.getVar('玩家.姓名')).toBe('新角色');
    });
  });

  // ── setStateFromJSON / toJSON / fromJSON ──

  describe('setStateFromJSON / toJSON / fromJSON', () => {
    it('setStateFromJSON 有效 JSON 返回 true', () => {
      const vm = new VariableManager();
      const json = JSON.stringify(createDefaultGameState());
      expect(vm.setStateFromJSON(json)).toBe(true);
    });

    it('setStateFromJSON 无效 JSON 返回 false', () => {
      const vm = new VariableManager();
      expect(vm.setStateFromJSON('not json')).toBe(false);
    });

    it('setStateFromJSON 非 JSON 对象返回 false', () => {
      const vm = new VariableManager();
      expect(vm.setStateFromJSON('123')).toBe(false);
    });

    it('toJSON / fromJSON 往返一致', () => {
      const vm = new VariableManager();
      vm.setVar('玩家.姓名', '勇者');
      vm.setVar('玩家.生存状态.血量', 88);
      const json = vm.toJSON();
      const restored = VariableManager.fromJSON(json);
      expect(restored.getVar('玩家.姓名')).toBe('勇者');
      expect(restored.getVar('玩家.生存状态.血量')).toBe(88);
    });
  });

  // ── 笔记本容量限制 ──

  describe('normalizeNotebook（笔记本容量限制）', () => {
    it('每个分区最多 20 条，超出删除最旧的', () => {
      const vm = new VariableManager();
      const entries: Record<string, any> = {};
      for (let i = 0; i < 25; i++) {
        entries[`条目${i}`] = { 严重程度: '高', 预计影响时间: '3天', 应对措施: 'x', $time: i };
      }
      vm.setVar('玩家.记事本.潜在危机', entries, true);
      // getState() 触发 normalizeState() → normalizeNotebook()
      const state = vm.getState();
      const notebook = state.玩家.记事本.潜在危机 as Record<string, any>;
      const keys = Object.keys(notebook);
      expect(keys.length).toBe(20);
      // 保留最后 20 条（条目5 ~ 条目24）
      expect(keys).toContain('条目24');
      expect(keys).toContain('条目5');
      expect(keys).not.toContain('条目4');
      expect(keys).not.toContain('条目0');
    });

    it('不超过 20 条时不截断', () => {
      const vm = new VariableManager();
      const entries: Record<string, any> = {};
      for (let i = 0; i < 15; i++) {
        entries[`条目${i}`] = { 严重程度: '高', 预计影响时间: '3天', 应对措施: 'x', $time: i };
      }
      vm.setVar('玩家.记事本.潜在危机', entries, true);
      const state = vm.getState();
      const notebook = state.玩家.记事本.潜在危机 as Record<string, any>;
      expect(Object.keys(notebook).length).toBe(15);
    });

    it('恰好 20 条不截断', () => {
      const vm = new VariableManager();
      const entries: Record<string, any> = {};
      for (let i = 0; i < 20; i++) {
        entries[`条目${i}`] = { 严重程度: '高', 预计影响时间: '3天', 应对措施: 'x', $time: i };
      }
      vm.setVar('玩家.记事本.潜在危机', entries, true);
      const state = vm.getState();
      const notebook = state.玩家.记事本.潜在危机 as Record<string, any>;
      expect(Object.keys(notebook).length).toBe(20);
    });
  });

  // ── createSafeSnapshotForPrompt ──

  describe('createSafeSnapshotForPrompt', () => {
    it('返回状态深拷贝', () => {
      const vm = new VariableManager(makeStateWithNpc());
      const snapshot = vm.createSafeSnapshotForPrompt();
      expect(snapshot.人物档案.npc_001).toBeDefined();
      expect((snapshot.人物档案.npc_001 as any).姓名).toBe('李明');
    });

    it('NPC 数据经过安全过滤', () => {
      const state = makeStateWithNpc();
      (state.人物档案.npc_001 as any).portraitUrl = 'data:image/png;base64,xxx';
      const vm = new VariableManager(state);
      const snapshot = vm.createSafeSnapshotForPrompt();
      // createPromptSafeNpcSnapshot 会过滤敏感字段
      const npc = snapshot.人物档案.npc_001 as any;
      expect(npc.姓名).toBe('李明');
    });
  });
});
