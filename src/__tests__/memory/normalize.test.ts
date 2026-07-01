import { describe, it, expect } from 'bun:test';
import {
  ensureStrArray,
  asArr,
  normalizeObjectArrays,
  normalizeThread,
  normalizeEventCard,
  normalizeEntityCard,
  normalizeMemoryObject,
} from '../../memory/normalize';

// ========== ensureStrArray ==========

describe('ensureStrArray', () => {
  it('returns empty array for undefined', () => {
    expect(ensureStrArray(undefined)).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(ensureStrArray(null)).toEqual([]);
  });

  it('returns empty array for false', () => {
    expect(ensureStrArray(false)).toEqual([]);
  });

  it('wraps single string', () => {
    expect(ensureStrArray('hello')).toEqual(['hello']);
  });

  it('passes through string array', () => {
    expect(ensureStrArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('filters non-string from array', () => {
    expect(ensureStrArray(['a', 1, 'b', null, 'c'] as any)).toEqual(['a', 'b', 'c']);
  });

  it('returns empty for number', () => {
    expect(ensureStrArray(42)).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(ensureStrArray([])).toEqual([]);
  });
});

// ========== asArr ==========

describe('asArr', () => {
  it('returns empty array for undefined', () => {
    expect(asArr(undefined)).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(asArr(null)).toEqual([]);
  });

  it('wraps single value', () => {
    expect(asArr('hello')).toEqual(['hello']);
  });

  it('passes through array', () => {
    expect(asArr([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('wraps object', () => {
    expect(asArr({ key: 'val' })).toEqual([{ key: 'val' }]);
  });
});

// ========== normalizeObjectArrays ==========

describe('normalizeObjectArrays', () => {
  it('returns undefined/primitive as-is', () => {
    expect(normalizeObjectArrays(undefined as any)).toBeUndefined();
    expect(normalizeObjectArrays(42 as any)).toBe(42);
  });

  it('recursively normalizes nested objects', () => {
    const input = {
      inner: {
        arr: [1, 2, 3],
        notArr: 'string',
      },
    };
    const result = normalizeObjectArrays(input);
    expect(result.inner.arr).toEqual([1, 2, 3]);
  });

  it('normalizes arrays of objects recursively', () => {
    const input = {
      items: [
        { nested: [1, 2] },
        { nested: [3, 4] },
      ],
    };
    const result = normalizeObjectArrays(input);
    expect(result.items[0].nested).toEqual([1, 2]);
    expect(result.items[1].nested).toEqual([3, 4]);
  });

  it('preserves null values in objects', () => {
    const input = { key: null };
    const result = normalizeObjectArrays(input);
    expect(result.key).toBeNull();
  });
});

// ========== normalizeThread ==========

describe('normalizeThread', () => {
  it('normalizes thread with array fields as arrays', () => {
    const thread = {
      id: 't1',
      title: 'Test',
      relatedLocations: ['loc1', 'loc2'],
      tags: ['important'],
      keywords: ['quest'],
    };
    const result = normalizeThread(thread);
    expect(result.relatedLocations).toEqual(['loc1', 'loc2']);
    expect(result.tags).toEqual(['important']);
    expect(result.keywords).toEqual(['quest']);
  });

  it('converts undefined relatedLocations to empty array', () => {
    const thread = { id: 't2', title: 'Test', relatedLocations: undefined };
    const result = normalizeThread(thread);
    expect(result.relatedLocations).toEqual([]);
  });

  it('converts null array fields to empty array', () => {
    const thread = { id: 't3', title: 'Test', relatedLocations: null as any };
    const result = normalizeThread(thread);
    expect(result.relatedLocations).toEqual([]);
  });

  it('converts string to array for array fields', () => {
    const thread = {
      id: 't4',
      title: 'Test',
      tags: 'single_tag' as any,
      keywords: undefined,
    };
    const result = normalizeThread(thread);
    expect(result.tags).toEqual(['single_tag']);
  });

  it('preserves non-array scalar fields', () => {
    const thread = {
      id: 't5',
      title: 'Preserved Title',
      summary: 'A summary text',
      status: 'active',
    };
    const result = normalizeThread(thread);
    expect(result.id).toBe('t5');
    expect(result.title).toBe('Preserved Title');
    expect(result.summary).toBe('A summary text');
    expect(result.status).toBe('active');
  });

  it('handles participants field', () => {
    const thread = { id: 't6', title: 'Test', participants: ['npc_1', 'npc_2'] };
    const result = normalizeThread(thread);
    expect(result.participants).toEqual(['npc_1', 'npc_2']);
  });
});

// ========== normalizeEventCard ==========

describe('normalizeEventCard', () => {
  it('normalizes standard event card', () => {
    const card = {
      id: 'ev1',
      title: 'Battle',
      triggers: ['attack'],
      effects: ['damage'],
      tags: ['combat'],
    };
    const result = normalizeEventCard(card);
    expect(result.triggers).toEqual(['attack']);
    expect(result.effects).toEqual(['damage']);
    expect(result.tags).toEqual(['combat']);
  });

  it('converts undefined array fields', () => {
    const card = { id: 'ev2', title: 'Empty', triggers: undefined };
    const result = normalizeEventCard(card);
    expect(result.triggers).toEqual([]);
  });

  it('converts null array fields', () => {
    const card = { id: 'ev3', title: 'Null', tags: null as any };
    const result = normalizeEventCard(card);
    expect(result.tags).toEqual([]);
  });

  it('converts string to array', () => {
    const card = { id: 'ev4', title: 'Single', keywords: 'lone' as any };
    const result = normalizeEventCard(card);
    expect(result.keywords).toEqual(['lone']);
  });
});

// ========== normalizeEntityCard ==========

describe('normalizeEntityCard', () => {
  it('normalizes standard entity card', () => {
    const card = {
      id: 'ent1',
      name: 'Merchant',
      aliases: ['The Trader'],
      traits: ['cunning', 'wealthy'],
      tags: ['npc'],
    };
    const result = normalizeEntityCard(card);
    expect(result.aliases).toEqual(['The Trader']);
    expect(result.traits).toEqual(['cunning', 'wealthy']);
  });

  it('converts undefined array fields', () => {
    const card = { id: 'ent2', name: 'Void', aliases: undefined };
    const result = normalizeEntityCard(card);
    expect(result.aliases).toEqual([]);
  });

  it('converts string to array', () => {
    const card = { id: 'ent3', name: 'Str', aliases: 'The One' as any };
    const result = normalizeEntityCard(card);
    expect(result.aliases).toEqual(['The One']);
  });
});

// ========== normalizeMemoryObject ==========

describe('normalizeMemoryObject', () => {
  it('detects thread object by participants', () => {
    const obj = { id: 't1', participants: undefined, tags: 'tag1' as any };
    const result = normalizeMemoryObject(obj);
    expect(result.tags).toEqual(['tag1']);
  });

  it('detects event card by triggers', () => {
    const obj = { id: 'ev1', triggers: undefined, tags: 'evtag' as any };
    const result = normalizeMemoryObject(obj);
    expect(result.tags).toEqual(['evtag']);
  });

  it('detects entity card by aliases', () => {
    const obj = { id: 'ent1', aliases: undefined, traits: 'brave' as any };
    const result = normalizeMemoryObject(obj);
    expect(result.traits).toEqual(['brave']);
  });

  it('falls back to generic for unknown types', () => {
    const obj = { someField: 'value' };
    const result = normalizeMemoryObject(obj);
    expect(result.someField).toBe('value');
  });

  it('returns undefined/null as-is', () => {
    expect(normalizeMemoryObject(undefined as any)).toBeUndefined();
    expect(normalizeMemoryObject(null as any)).toBeNull();
  });
});
