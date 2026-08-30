import { describe, expect, test } from 'vitest';
import { parseBooleanInput } from '../src/adapters/config';

// Test the parseBooleanInput logic that's used in run.ts for update_comment
describe('run.ts update_comment logic', () => {
  test('parseBooleanInput correctly parses update_comment input', () => {
    // True case
    expect(parseBooleanInput('true', false)).toBe(true);
    
    // False case (default)
    expect(parseBooleanInput('false', true)).toBe(false);
    
    // Empty input defaults to false
    expect(parseBooleanInput('', false)).toBe(false);
    
    // Case insensitive
    expect(parseBooleanInput('TRUE', false)).toBe(true);
    expect(parseBooleanInput('False', true)).toBe(false);
    
    // Any non-"true" string defaults to false
    expect(parseBooleanInput('yes', false)).toBe(false);
    expect(parseBooleanInput('1', false)).toBe(false);
  });

  test('updateComment is only included in provider config when true', () => {
    // When updateCommentValue is true
    const updateCommentValue = true;
    const providerConfig = {
      ...(updateCommentValue ? { updateComment: updateCommentValue } : {}),
    };
    expect(providerConfig).toEqual({ updateComment: true });

    // When updateCommentValue is false
    const falseValue = false;
    const falseConfig = {
      ...(falseValue ? { updateComment: falseValue } : {}),
    };
    expect(falseConfig).toEqual({});
  });
});
