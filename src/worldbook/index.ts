// 世界书管理器 - 从角色卡 JSON 加载和管理世界书条目

export interface WorldBookEntry {
  id: number;
  comment: string;
  content: string;
  constant: boolean;
  enabled: boolean;
  selective: boolean;
  keys: string[];
  secondaryKeys: string[];
  position: 'before_char' | 'after_char';
  insertionOrder: number;
}

export interface WorldBookManager {
  entries: WorldBookEntry[];
  getConstantEntries(): WorldBookEntry[];
  getActiveEntries(userInput: string): WorldBookEntry[];
  getEnabledEntries(): WorldBookEntry[];
  toggleEntry(id: number): void;
  enableEntry(id: number): void;
  disableEntry(id: number): void;
  enableEntriesByPrefix(prefix: string): void;
  disableEntriesByPrefix(prefix: string): void;
  enableOnlyEntry(prefix: string, targetId: number): void;
  getEntriesByPrefix(prefix: string): WorldBookEntry[];
  /** 批量添加条目（用于加载世界专属世界书条目） */
  addEntries(newEntries: WorldBookEntry[]): void;
  buildInjection(userInput: string): { beforeChar: string; afterChar: string };
}

// 从角色卡 JSON 解析世界书
export function parseWorldBook(cardData: any): WorldBookEntry[] {
  const book = cardData?.data?.character_book;
  if (!book?.entries) return [];

  return book.entries.map((entry: any) => ({
    id: entry.id,
    comment: entry.comment || '',
    content: entry.content || '',
    constant: entry.constant ?? false,
    enabled: entry.enabled ?? true,
    selective: entry.selective ?? false,
    keys: entry.keys || [],
    secondaryKeys: entry.secondary_keys || [],
    position: (entry.position || 'after_char') as 'before_char' | 'after_char',
    insertionOrder: entry.insertion_order ?? 0,
  }));
}

export function createWorldBookManager(initialEntries: WorldBookEntry[]): WorldBookManager {
  let entries = [...initialEntries];

  return {
    entries,

    getConstantEntries() {
      return entries
        .filter(e => e.constant && e.enabled)
        .sort((a, b) => a.insertionOrder - b.insertionOrder);
    },

    getActiveEntries(userInput: string) {
      const lowerInput = userInput.toLowerCase();
      return entries
        .filter(e => {
          if (!e.enabled) return false;
          if (e.constant) return false;
          if (e.selective) {
            const allKeys = [...e.keys, ...e.secondaryKeys];
            if (allKeys.length === 0) return false;
            return allKeys.some(key => lowerInput.includes(key.toLowerCase()));
          }
          return true;
        })
        .sort((a, b) => a.insertionOrder - b.insertionOrder);
    },

    getEnabledEntries() {
      return entries.filter(e => e.enabled);
    },

    toggleEntry(id: number) {
      entries = entries.map(e =>
        e.id === id ? { ...e, enabled: !e.enabled } : e
      );
    },

    enableEntry(id: number) {
      entries = entries.map(e => e.id === id ? { ...e, enabled: true } : e);
    },

    disableEntry(id: number) {
      entries = entries.map(e => e.id === id ? { ...e, enabled: false } : e);
    },

    // 启用匹配前缀的所有条目（如 "[WB]" 或 "[mvu_plot]👧系统人格"）
    enableEntriesByPrefix(prefix: string) {
      entries = entries.map(e =>
        e.comment.includes(prefix) ? { ...e, enabled: true } : e
      );
    },

    // 禁用匹配前缀的所有条目
    disableEntriesByPrefix(prefix: string) {
      entries = entries.map(e =>
        e.comment.includes(prefix) ? { ...e, enabled: false } : e
      );
    },

    // 启用指定条目，同时禁用同前缀的其他条目（用于互斥选择）
    enableOnlyEntry(prefix: string, targetId: number) {
      entries = entries.map(e => {
        if (!e.comment.includes(prefix)) return e;
        return { ...e, enabled: e.id === targetId };
      });
    },

    // 按 comment 前缀获取条目
    getEntriesByPrefix(prefix: string) {
      return entries.filter(e => e.comment.includes(prefix));
    },

    // 批量添加新条目（用于加载世界专属世界书条目）
    addEntries(newEntries: WorldBookEntry[]) {
      // 用负数 ID 避免与已有条目冲突
      const minId = entries.length > 0 ? Math.min(...entries.map(e => e.id)) : 0;
      let nextId = Math.min(minId, 0) - 1;
      const toAdd = newEntries.map(e => ({
        ...e,
        id: e.id < 0 ? e.id : nextId--,
      }));
      entries = [...entries, ...toAdd];
    },

    buildInjection(userInput: string) {
      const constant = this.getConstantEntries();
      const active = this.getActiveEntries(userInput);

      const beforeChar = [...constant, ...active]
        .filter(e => e.position === 'before_char')
        .map(e => e.content)
        .join('\n\n');

      const afterChar = [...constant, ...active]
        .filter(e => e.position === 'after_char')
        .map(e => e.content)
        .join('\n\n');

      return { beforeChar, afterChar };
    },
  };
}
