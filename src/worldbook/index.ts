// ═══════════════════════════════════════════════════════════════
//  世界书管理器 v2 — 最小 stub（v1.3 替换为完整实现）
// ═══════════════════════════════════════════════════════════════

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
  disable?: boolean;
  excludeRecursion?: boolean;
  preventRecursion?: boolean;
  delayUntilRecursion?: boolean;
  group?: string;
  groupOverride?: boolean;
  groupWeight?: number;
  scanDepth?: number;
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
  useRegex?: boolean;
  automationId?: string;
  triggerChance?: number;
  tags?: string[];
}

export interface ScanInjectionResult {
  beforeChar: string;
  afterChar: string;
  atDepthEntries: Array<{ depth: number; content: string }>;
  activatedEntries: WorldBookEntry[];
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
  addEntries(newEntries: WorldBookEntry[]): void;
  scanAndBuildInjection(
    chatHistory: Array<{ role?: string; content?: string }>,
    userText: string,
    options?: { depth?: number; recursionLevel?: number },
  ): ScanInjectionResult;
}

export function parseWorldBook(cardData: any): WorldBookEntry[] {
  const book = cardData?.data?.character_book;
  if (!book?.entries) return [];
  return book.entries.map((e: any, i: number) => ({
    id: e.id ?? i, comment: e.comment ?? '', content: e.content ?? '',
    constant: e.constant ?? false, enabled: e.enabled ?? true, selective: e.selective ?? false,
    keys: e.keys ?? [], secondaryKeys: e.secondaryKeys ?? [],
    position: e.position === 1 ? 'after_char' : 'before_char', insertionOrder: e.insertionOrder ?? 0,
  }));
}

export function createWorldBookManager(initialEntries: WorldBookEntry[]): WorldBookManager {
  let entries = [...initialEntries];
  const getConstantEntries = () => entries.filter(e => e.constant && e.enabled && !e.disable);
  const getEnabledEntries = () => entries.filter(e => e.enabled && !e.disable);
  const getActiveEntries = (userInput: string) => {
    const lower = userInput.toLowerCase();
    return entries.filter(e => {
      if (!e.enabled || e.disable) return false;
      if (e.constant) return true;
      return e.keys.some(k => lower.includes(k.toLowerCase()));
    });
  };
  return {
    get entries() { return entries; },
    getConstantEntries, getActiveEntries, getEnabledEntries,
    toggleEntry: (id) => { entries = entries.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e); },
    enableEntry: (id) => { entries = entries.map(e => e.id === id ? { ...e, enabled: true } : e); },
    disableEntry: (id) => { entries = entries.map(e => e.id === id ? { ...e, enabled: false } : e); },
    enableEntriesByPrefix: (p) => { entries = entries.map(e => e.comment.startsWith(p) ? { ...e, enabled: true } : e); },
    disableEntriesByPrefix: (p) => { entries = entries.map(e => e.comment.startsWith(p) ? { ...e, enabled: false } : e); },
    enableOnlyEntry: (p, t) => { entries = entries.map(e => e.comment.startsWith(p) ? { ...e, enabled: e.id === t } : e); },
    getEntriesByPrefix: (p) => entries.filter(e => e.comment.startsWith(p)),
    addEntries: (ne) => { entries = [...entries, ...ne]; },
    scanAndBuildInjection: (_ch, userText) => {
      const active = getActiveEntries(userText);
      return {
        beforeChar: active.filter(e => e.position === 'before_char').sort((a,b) => a.insertionOrder - b.insertionOrder).map(e => e.content).join('\n'),
        afterChar: active.filter(e => e.position === 'after_char').sort((a,b) => a.insertionOrder - b.insertionOrder).map(e => e.content).join('\n'),
        atDepthEntries: [], activatedEntries: active,
      };
    },
  };
}
