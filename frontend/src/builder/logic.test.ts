import { describe, it, expect } from 'vitest';
import { isFieldVisible, getAvailableTriggerFields } from './logic';
import { FormField } from './types';

describe('conditional logic evaluator', () => {
  const fields: FormField[] = [
    { key: 'f_1', type: 'choice', label: 'Gender', required: true, options: ['Male', 'Female'] },
    { key: 'f_2', type: 'text', label: 'Maiden Name', required: false, logic: { showIf: { field: 'f_1', op: 'equals', value: 'Female' } } },
    { key: 'f_3', type: 'text', label: 'Other', required: false },
  ];

  it('returns available trigger fields strictly preceding current field', () => {
    const triggers = getAvailableTriggerFields(fields, 'f_2');
    expect(triggers.length).toBe(1);
    expect(triggers[0].key).toBe('f_1');

    // First field has no preceding fields
    expect(getAvailableTriggerFields(fields, 'f_1')).toEqual([]);

    // Third field has first two fields
    const f3Triggers = getAvailableTriggerFields(fields, 'f_3');
    expect(f3Triggers.map((f) => f.key)).toEqual(['f_1', 'f_2']);

    // Non-existent field returns empty list
    expect(getAvailableTriggerFields(fields, 'f_unknown')).toEqual([]);
  });

  it('returns true for fields with no logic', () => {
    expect(isFieldVisible(fields[0], {})).toBe(true);
    expect(isFieldVisible(fields[2], {})).toBe(true);
    expect(isFieldVisible({ key: 'f_empty', type: 'text', label: 'Empty Logic', logic: {} }, {})).toBe(true);
  });

  it('evaluates equals operator correctly', () => {
    expect(isFieldVisible(fields[1], { f_1: 'Female' })).toBe(true);
    expect(isFieldVisible(fields[1], { f_1: 'Male' })).toBe(false);
    expect(isFieldVisible(fields[1], {})).toBe(false);
    expect(isFieldVisible(fields[1], { f_1: '' })).toBe(false);
  });

  it('evaluates not_equals operator correctly', () => {
    const notEqualsField: FormField = {
      key: 'f_other',
      type: 'text',
      label: 'Specify',
      logic: { showIf: { field: 'f_1', op: 'not_equals', value: 'Male' } },
    };
    expect(isFieldVisible(notEqualsField, { f_1: 'Female' })).toBe(true);
    expect(isFieldVisible(notEqualsField, { f_1: 'Male' })).toBe(false);
    expect(isFieldVisible(notEqualsField, {})).toBe(false);
    expect(isFieldVisible(notEqualsField, { f_1: '' })).toBe(false);
  });

  it('evaluates filled and empty operators', () => {
    const filledField: FormField = {
      key: 'f_sub',
      type: 'text',
      label: 'Sub',
      required: false,
      logic: { showIf: { field: 'f_1', op: 'filled' } },
    };
    expect(isFieldVisible(filledField, { f_1: 'Male' })).toBe(true);
    expect(isFieldVisible(filledField, { f_1: '' })).toBe(false);
    expect(isFieldVisible(filledField, { f_1: '   ' })).toBe(false);
    expect(isFieldVisible(filledField, { f_1: [] })).toBe(false);
    expect(isFieldVisible(filledField, {})).toBe(false);

    const emptyField: FormField = {
      key: 'f_empty_check',
      type: 'text',
      label: 'Empty Check',
      logic: { showIf: { field: 'f_1', op: 'empty' } },
    };
    expect(isFieldVisible(emptyField, {})).toBe(true);
    expect(isFieldVisible(emptyField, { f_1: '' })).toBe(true);
    expect(isFieldVisible(emptyField, { f_1: '   ' })).toBe(true);
    expect(isFieldVisible(emptyField, { f_1: [] })).toBe(true);
    expect(isFieldVisible(emptyField, { f_1: 'Male' })).toBe(false);
  });

  it('evaluates contains operator for strings and arrays', () => {
    const containsField: FormField = {
      key: 'f_tags_detail',
      type: 'text',
      label: 'Tag Detail',
      logic: { showIf: { field: 'f_tags', op: 'contains', value: 'tech' } },
    };

    // String contains
    expect(isFieldVisible(containsField, { f_tags: 'fintech company' })).toBe(true);
    expect(isFieldVisible(containsField, { f_tags: 'health care' })).toBe(false);
    expect(isFieldVisible(containsField, {})).toBe(false);
    expect(isFieldVisible(containsField, { f_tags: '' })).toBe(false);

    // Array contains
    expect(isFieldVisible(containsField, { f_tags: ['design', 'tech'] })).toBe(true);
    expect(isFieldVisible(containsField, { f_tags: ['design', 'marketing'] })).toBe(false);
  });
});
