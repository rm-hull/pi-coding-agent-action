import { describe, expect, test } from 'vitest';
import {
  parseBooleanInput,
  parsePositiveIntInput,
  parseStringListInput,
  parseLoadedTools,
  validateRequiredInputs,
} from '../../src/adapters/config';

describe('config adapter extra coverage', () => {
  test('parseBooleanInput', () => {
    expect(parseBooleanInput('true', false)).toBe(true);
    expect(parseBooleanInput('TRUE', false)).toBe(true);
    expect(parseBooleanInput('false', true)).toBe(false);
    expect(parseBooleanInput('', true)).toBe(true);
  });

  test('parsePositiveIntInput', () => {
    expect(parsePositiveIntInput('10')).toBe(10);
    expect(parsePositiveIntInput('0')).toBeUndefined();
    expect(parsePositiveIntInput('-5')).toBeUndefined();
    expect(parsePositiveIntInput('')).toBeUndefined();
    expect(parsePositiveIntInput('abc')).toBeUndefined();
  });

  test('parseStringListInput', () => {
    expect(parseStringListInput('a, b, c', ',')).toEqual(['a', 'b', 'c']);
    expect(parseStringListInput('', ',')).toBeUndefined();
    expect(parseStringListInput('   ', ',')).toBeUndefined();
  });

  test('parseLoadedTools', () => {
    expect(parseLoadedTools('all')).toBeUndefined();
    expect(parseLoadedTools('  ')).toBeUndefined();
    expect(parseLoadedTools('tool1\ntool2\ntool1')).toEqual(['tool1', 'tool2']);
  });

  test('validateRequiredInputs', () => {
    expect(() => validateRequiredInputs('', 'model')).toThrow();
    expect(() => validateRequiredInputs('provider', '')).toThrow();
    expect(() => validateRequiredInputs('provider', 'model')).not.toThrow();
  });
});
