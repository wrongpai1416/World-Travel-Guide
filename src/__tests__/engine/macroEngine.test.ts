import { describe, it, expect } from 'bun:test';
import { MacroEngine } from '../../engine/macroEngine';

// 辅助：创建确定性 rng（总是返回固定值）
function makeFixedRng(value: number): () => number {
  return () => value;
}

describe('MacroEngine', () => {
  // ── setVar / getVar ──

  describe('setVar / getVar', () => {
    it('基本读写', () => {
      const engine = new MacroEngine();
      engine.setVar('name', '李明');
      expect(engine.getVar('name')).toBe('李明');
    });

    it('键名大小写不敏感', () => {
      const engine = new MacroEngine();
      engine.setVar('Name', '李明');
      expect(engine.getVar('name')).toBe('李明');
      expect(engine.getVar('NAME')).toBe('李明');
    });

    it('值被转为字符串', () => {
      const engine = new MacroEngine();
      engine.setVar('count', 42 as any);
      expect(engine.getVar('count')).toBe('42');
    });

    it('不存在的键返回空字符串', () => {
      const engine = new MacroEngine();
      expect(engine.getVar('nonexistent')).toBe('');
    });
  });

  // ── updateContext ──

  describe('updateContext', () => {
    it('批量设置上下文变量', () => {
      const engine = new MacroEngine();
      engine.updateContext({ name: '张三', role: '战士' });
      expect(engine.getVar('name')).toBe('张三');
      expect(engine.getVar('role')).toBe('战士');
    });

    it('上下文变量大小写不敏感', () => {
      const engine = new MacroEngine();
      engine.updateContext({ Name: '张三' });
      expect(engine.getVar('name')).toBe('张三');
    });

    it('setVar 优先于 context', () => {
      const engine = new MacroEngine();
      engine.updateContext({ name: '张三' });
      engine.setVar('name', '李四');
      expect(engine.getVar('name')).toBe('李四');
    });
  });

  // ── resolve: getvar ──

  describe('resolve: {{getvar::key}}', () => {
    it('显式读取变量', () => {
      const engine = new MacroEngine();
      engine.setVar('hero', '勇者');
      expect(engine.resolve('你是{{getvar::hero}}')).toBe('你是勇者');
    });

    it('变量不存在时替换为空字符串', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('你好，{{getvar::nobody}}！')).toBe('你好，！');
    });

    it('getvar 大小写不敏感', () => {
      const engine = new MacroEngine();
      engine.setVar('name', '李明');
      expect(engine.resolve('{{GETVAR::NAME}}')).toBe('李明');
    });
  });

  // ── resolve: setvar ──

  describe('resolve: {{setvar::key::value}}', () => {
    it('写入变量并返回空字符串', () => {
      const engine = new MacroEngine();
      const result = engine.resolve('前缀{{setvar::count::10}}后缀');
      expect(result).toBe('前缀后缀');
      expect(engine.getVar('count')).toBe('10');
    });

    it('值中可以包含冒号', () => {
      const engine = new MacroEngine();
      engine.resolve('{{setvar::url::https://example.com}}');
      expect(engine.getVar('url')).toBe('https://example.com');
    });
  });

  // ── resolve: incvar / decvar ──

  describe('resolve: {{incvar::key}} / {{decvar::key}}', () => {
    it('incvar 从 0 开始递增', () => {
      const engine = new MacroEngine();
      const result = engine.resolve('{{incvar::counter}}');
      expect(result).toBe('');
      expect(engine.getVar('counter')).toBe('1');
    });

    it('incvar 在已有值基础上递增', () => {
      const engine = new MacroEngine();
      engine.setVar('counter', '5');
      engine.resolve('{{incvar::counter}}');
      expect(engine.getVar('counter')).toBe('6');
    });

    it('decvar 从 0 开始递减', () => {
      const engine = new MacroEngine();
      engine.resolve('{{decvar::counter}}');
      expect(engine.getVar('counter')).toBe('-1');
    });

    it('decvar 在已有值基础上递减', () => {
      const engine = new MacroEngine();
      engine.setVar('counter', '10');
      engine.resolve('{{decvar::counter}}');
      expect(engine.getVar('counter')).toBe('9');
    });

    it('非数字变量 incvar 当作 0 处理', () => {
      const engine = new MacroEngine();
      engine.setVar('text', 'hello');
      engine.resolve('{{incvar::text}}');
      expect(engine.getVar('text')).toBe('1');
    });
  });

  // ── resolve: random ──

  describe('resolve: {{random::...}}', () => {
    it('双冒号分隔选项 — 固定 rng 选取第一个', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0) });
      expect(engine.resolve('{{random::苹果::香蕉::橙子}}')).toBe('苹果');
    });

    it('双冒号分隔选项 — rng=0.5 选取中间项', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0.5) });
      // 3 个选项，idx = floor(0.5 * 3) = 1 → 香蕉
      expect(engine.resolve('{{random::苹果::香蕉::橙子}}')).toBe('香蕉');
    });

    it('双冒号分隔选项 — rng 接近 1 选取最后一项', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0.99) });
      // 3 个选项，idx = floor(0.99 * 3) = 2 → 橙子
      expect(engine.resolve('{{random::苹果::香蕉::橙子}}')).toBe('橙子');
    });

    it('逗号分隔选项', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0) });
      expect(engine.resolve('{{random::苹果,香蕉,橙子}}')).toBe('苹果');
    });

    it('混合分隔（:: 和 ,）', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0.5) });
      // split(/::|,/) → ['苹果', '香蕉', '橙子']，idx=1 → 香蕉
      expect(engine.resolve('{{random::苹果,香蕉::橙子}}')).toBe('香蕉');
    });

    it('选项全为空白时返回空字符串', () => {
      const engine = new MacroEngine();
      // 正则 [^}]+ 要求至少一个字符，空格可以匹配
      // split → [' '], trim → [''], filter(Boolean) → []，返回空
      expect(engine.resolve('{{random:: }}')).toBe('');
    });

    it('只有一个选项', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{random::唯一}}')).toBe('唯一');
    });
  });

  // ── resolve: roll ──

  describe('resolve: {{roll NdM}}', () => {
    it('基本骰子投掷 1d6 — rng=0 返回 1', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0) });
      // floor(0 * 6) + 1 = 1
      expect(engine.resolve('{{roll 1d6}}')).toBe('1');
    });

    it('基本骰子投掷 1d6 — rng=0.99 返回 6', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0.99) });
      // floor(0.99 * 6) + 1 = 6
      expect(engine.resolve('{{roll 1d6}}')).toBe('6');
    });

    it('多骰子投掷 3d6 — rng=0 每骰返回 1，总计 3', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0) });
      expect(engine.resolve('{{roll 3d6}}')).toBe('3');
    });

    it('多骰子投掷 2d20 — rng=0.99 每骰返回 20，总计 40', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0.99) });
      expect(engine.resolve('{{roll 2d20}}')).toBe('40');
    });

    it('带正修饰符 {{roll 1d6+5}}', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0) });
      // 1 + 5 = 6
      expect(engine.resolve('{{roll 1d6+5}}')).toBe('6');
    });

    it('带负修饰符 {{roll 1d6-3}}', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0) });
      // 1 - 3 = -2 → Math.max(0, -2) = 0
      expect(engine.resolve('{{roll 1d6-3}}')).toBe('0');
    });

    it('roll 大小写不敏感', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0) });
      expect(engine.resolve('{{ROLL 1D6}}')).toBe('1');
    });

    it('roll 结果不会低于 0', () => {
      const engine = new MacroEngine({ rng: makeFixedRng(0) });
      expect(engine.resolve('{{roll 1d6-100}}')).toBe('0');
    });
  });

  // ── resolve: #if ──

  describe('resolve: {{#if::cond::true::false}}', () => {
    it('非空条件为 true', () => {
      const engine = new MacroEngine();
      engine.setVar('name', '李明');
      expect(engine.resolve('{{#if::{{getvar::name}}::有名字::无名}}')).toBe('有名字');
    });

    it('条件为空白时为 false', () => {
      const engine = new MacroEngine();
      // 正则 [^:}]+ 要求至少一个字符，空格可以匹配
      // trim 后为空，isTrue = false
      expect(engine.resolve('{{#if:: ::有名字::无名}}')).toBe('无名');
    });

    it('条件为 "0" 时为 false', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::0::是::否}}')).toBe('否');
    });

    it('条件为 "false" 时为 false', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::false::是::否}}')).toBe('否');
    });

    it('条件为 "false" 大写时也为 false', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::FALSE::是::否}}')).toBe('否');
    });

    it('条件为非零数字时为 true', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::42::是::否}}')).toBe('是');
    });

    it('== 相等比较为 true', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::abc==abc::相等::不等}}')).toBe('相等');
    });

    it('== 相等比较为 false', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::abc==def::相等::不等}}')).toBe('不等');
    });

    it('!= 不等比较为 true', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::abc!=def::不等::相等}}')).toBe('不等');
    });

    it('!= 不等比较为 false', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::abc!=abc::不等::相等}}')).toBe('相等');
    });

    it('省略 false 分支时返回空', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('{{#if::0::是}}')).toBe('');
    });
  });

  // ── resolve: 通用变量查找 ──

  describe('resolve: {{key}} 通用查找', () => {
    it('查找已设置的变量', () => {
      const engine = new MacroEngine();
      engine.setVar('hero', '勇者');
      expect(engine.resolve('你是{{hero}}')).toBe('你是勇者');
    });

    it('查找上下文变量', () => {
      const engine = new MacroEngine();
      engine.updateContext({ town: '王城' });
      expect(engine.resolve('欢迎来到{{town}}')).toBe('欢迎来到王城');
    });

    it('未知变量保留原文', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('你好{{unknown_var}}')).toBe('你好{{unknown_var}}');
    });

    it('已知命令关键字不被当变量查找', () => {
      const engine = new MacroEngine();
      engine.setVar('random', '不该出现');
      // {{random}} 不带 :: 不匹配 random 命令的正则，走到兜底
      // 但 knownCommands 包含 'random'，所以保留原文
      expect(engine.resolve('{{random}}')).toBe('{{random}}');
    });
  });

  // ── resolve: 嵌套解析 ──

  describe('resolve: 嵌套与多轮', () => {
    it('setvar 后 getvar 在同一模板中生效', () => {
      const engine = new MacroEngine();
      const template = '{{setvar::x::hello}}{{getvar::x}}';
      // 第一轮：setvar 写入 x=hello，返回空；getvar 读取 x=hello
      // 但 setvar 的正则先执行，所以第一轮就能完成
      expect(engine.resolve(template)).toBe('hello');
    });

    it('incvar 连续递增', () => {
      const engine = new MacroEngine();
      const template = '{{incvar::n}}{{incvar::n}}{{incvar::n}}';
      engine.resolve(template);
      expect(engine.getVar('n')).toBe('3');
    });

    it('多轮解析直到稳定', () => {
      const engine = new MacroEngine();
      engine.setVar('a', '{{b}}');
      engine.setVar('b', '最终值');
      // 第一轮：{{a}} → {{b}}（因为 getVar('a') = '{{b}}'）
      // 第二轮：{{b}} → 最终值
      expect(engine.resolve('{{a}}')).toBe('最终值');
    });
  });

  // ── resolve: 特殊保留 ──

  describe('resolve: 特殊保留', () => {
    it('{{VAR_SNAPSHOT}} 保留原文（延迟绑定）', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('前缀{{VAR_SNAPSHOT}}后缀')).toBe('前缀{{VAR_SNAPSHOT}}后缀');
    });

    it('无宏的纯文本原样返回', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('这是一段普通文本。')).toBe('这是一段普通文本。');
    });

    it('空字符串返回空字符串', () => {
      const engine = new MacroEngine();
      expect(engine.resolve('')).toBe('');
    });
  });
});
