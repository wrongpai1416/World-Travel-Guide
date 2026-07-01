import { describe, it, expect } from 'bun:test';
import {
  parseKeywordInput,
  normalizeRecipeInputs,
  normalizeRecipeOutput,
  normalizeRecipe,
} from '../../utils/formatNormalize';

// ========== parseKeywordInput ==========

describe('parseKeywordInput', () => {
  it('returns empty array for undefined', () => {
    expect(parseKeywordInput(undefined)).toEqual([]);
  });

  it('returns empty array for null-like', () => {
    expect(parseKeywordInput('')).toEqual([]);
  });

  it('passes through array input', () => {
    expect(parseKeywordInput(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('filters empty strings from array', () => {
    expect(parseKeywordInput(['a', '', 'b', ''])).toEqual(['a', 'b']);
  });

  it('splits by English comma', () => {
    expect(parseKeywordInput('apple, banana, cherry')).toEqual(['apple', 'banana', 'cherry']);
  });

  it('splits by Chinese comma', () => {
    expect(parseKeywordInput('苹果，香蕉，樱桃')).toEqual(['苹果', '香蕉', '樱桃']);
  });

  it('splits by mixed commas', () => {
    expect(parseKeywordInput('苹果, 香蕉，樱桃')).toEqual(['苹果', '香蕉', '樱桃']);
  });

  it('splits by newline', () => {
    expect(parseKeywordInput('apple\nbanana\ncherry')).toEqual(['apple', 'banana', 'cherry']);
  });

  it('trims whitespace', () => {
    expect(parseKeywordInput('  apple  ,  banana  ')).toEqual(['apple', 'banana']);
  });

  it('handles single keyword', () => {
    expect(parseKeywordInput('solo')).toEqual(['solo']);
  });

  it('handles trailing comma', () => {
    expect(parseKeywordInput('a,b,')).toEqual(['a', 'b']);
  });
});

// ========== normalizeRecipeInputs ==========

describe('normalizeRecipeInputs', () => {
  it('returns empty object for undefined', () => {
    expect(normalizeRecipeInputs(undefined)).toEqual({});
  });

  it('returns empty object for null', () => {
    expect(normalizeRecipeInputs(null)).toEqual({});
  });

  it('handles object format', () => {
    expect(normalizeRecipeInputs({ wood: 2, stone: 1 })).toEqual({ wood: 2, stone: 1 });
  });

  it('filters zero amounts from object', () => {
    expect(normalizeRecipeInputs({ wood: 2, stone: 0 })).toEqual({ wood: 2 });
  });

  it('converts string amounts to number', () => {
    expect(normalizeRecipeInputs({ wood: '2', stone: '1' })).toEqual({ wood: 2, stone: 1 });
  });

  it('handles array format with id/amount', () => {
    const result = normalizeRecipeInputs([
      { id: 'wood', amount: 3 },
      { id: 'stone', amount: 1 },
    ]);
    expect(result).toEqual({ wood: 3, stone: 1 });
  });

  it('handles array format with resourceId/count', () => {
    const result = normalizeRecipeInputs([
      { resourceId: 'herb', count: 5 },
    ]);
    expect(result).toEqual({ herb: 5 });
  });

  it('handles array format with key/qty', () => {
    const result = normalizeRecipeInputs([
      { key: 'fish', qty: 2 },
    ]);
    expect(result).toEqual({ fish: 2 });
  });

  it('defaults missing amount to 1 in array format', () => {
    const result = normalizeRecipeInputs([{ id: 'water' }]);
    expect(result).toEqual({ water: 1 });
  });

  it('filters items with empty id', () => {
    const result = normalizeRecipeInputs([{ id: '', amount: 1 }]);
    expect(result).toEqual({});
  });

  it('returns empty for non-object non-array', () => {
    expect(normalizeRecipeInputs('invalid')).toEqual({});
  });

  it('returns empty for number', () => {
    expect(normalizeRecipeInputs(42)).toEqual({});
  });
});

// ========== normalizeRecipeOutput ==========

describe('normalizeRecipeOutput', () => {
  it('returns empty defaults for undefined', () => {
    expect(normalizeRecipeOutput(undefined)).toEqual({ resourceId: '', amount: 0 });
  });

  it('returns empty defaults for null', () => {
    expect(normalizeRecipeOutput(null)).toEqual({ resourceId: '', amount: 0 });
  });

  it('handles standard resourceId/amount', () => {
    expect(normalizeRecipeOutput({ resourceId: 'cooked_fish', amount: 1 }))
      .toEqual({ resourceId: 'cooked_fish', amount: 1 });
  });

  it('falls back to id field', () => {
    expect(normalizeRecipeOutput({ id: 'cooked_meat', amount: 2 }))
      .toEqual({ resourceId: 'cooked_meat', amount: 2 });
  });

  it('falls back to product field', () => {
    expect(normalizeRecipeOutput({ product: 'potion', amount: 3 }))
      .toEqual({ resourceId: 'potion', amount: 3 });
  });

  it('falls back to result field', () => {
    expect(normalizeRecipeOutput({ result: 'crafted_item', amount: 1 }))
      .toEqual({ resourceId: 'crafted_item', amount: 1 });
  });

  it('converts string amount to number', () => {
    expect(normalizeRecipeOutput({ resourceId: 'item', amount: '5' }))
      .toEqual({ resourceId: 'item', amount: 5 });
  });
});

// ========== normalizeRecipe ==========

describe('normalizeRecipe', () => {
  it('returns null for undefined', () => {
    expect(normalizeRecipe(undefined)).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(normalizeRecipe('not an object')).toBeNull();
  });

  it('normalizes a full valid recipe', () => {
    const recipe = normalizeRecipe({
      id: 'rec_001',
      name: '烤鱼',
      inputs: { fish: 1, wood: 2 },
      output: { resourceId: 'cooked_fish', amount: 1 },
      description: '用木材烤鱼',
    });
    expect(recipe).not.toBeNull();
    expect(recipe!.id).toBe('rec_001');
    expect(recipe!.name).toBe('烤鱼');
    expect(recipe!.inputs).toEqual({ fish: 1, wood: 2 });
    expect(recipe!.output).toEqual({ resourceId: 'cooked_fish', amount: 1 });
  });

  it('returns null if output resourceId is empty', () => {
    expect(normalizeRecipe({
      id: 'bad',
      name: 'Bad',
      inputs: {},
      output: { resourceId: '', amount: 0 },
    })).toBeNull();
  });

  it('generates id if missing', () => {
    const recipe = normalizeRecipe({
      name: '无名',
      inputs: { wood: 1 },
      output: { resourceId: 'plank', amount: 2 },
    });
    expect(recipe).not.toBeNull();
    expect(recipe!.id).toMatch(/^recipe_/);
  });
});
