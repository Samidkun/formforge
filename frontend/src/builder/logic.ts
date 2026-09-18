import type { FormField } from './types';

export function getAvailableTriggerFields(fields: FormField[], currentFieldKey: string): FormField[] {
  const currentIndex = fields.findIndex((f) => f.key === currentFieldKey);
  if (currentIndex <= 0) {
    return [];
  }
  return fields.slice(0, currentIndex);
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}

export function isFieldVisible(field: FormField, answers: Record<string, any>): boolean {
  if (!field.logic?.showIf) {
    return true;
  }

  const { field: triggerKey, op, value: targetValue } = field.logic.showIf;
  const answer = answers?.[triggerKey];
  const exists = answers != null && Object.prototype.hasOwnProperty.call(answers, triggerKey);
  const hasAnswer = exists && !isEmptyValue(answer);

  switch (op) {
    case 'empty':
      return !hasAnswer;
    case 'filled':
      return hasAnswer;
    case 'equals': {
      if (!hasAnswer) return false;
      return String(answer) === String(targetValue ?? '');
    }
    case 'not_equals': {
      if (!hasAnswer) return false;
      return String(answer) !== String(targetValue ?? '');
    }
    case 'contains': {
      if (!hasAnswer) return false;
      const targetStr = String(targetValue ?? '');
      if (typeof answer === 'string') {
        return answer.includes(targetStr);
      }
      if (Array.isArray(answer)) {
        return answer.some((item) => String(item) === targetStr);
      }
      return String(answer).includes(targetStr);
    }
    default:
      return true;
  }
}
