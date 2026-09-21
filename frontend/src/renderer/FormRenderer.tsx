'use client';

import React, { useState } from 'react';
import { isFieldVisible } from '@/builder/logic';
import type { FieldLogic, FormField } from '@/builder/types';
import { api } from '@/lib/api';

export interface FieldDefinition {
  key: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  logic?: FieldLogic;
}

export interface FormSchema {
  title?: string;
  fields: FieldDefinition[];
}

export interface AnswerItem {
  field_key: string;
  value: any;
}

export interface FormRendererProps {
  schema: FormSchema;
  slug?: string;
  title?: string;
  description?: string;
  onSubmit?: (answers: AnswerItem[]) => Promise<any> | any;
  submitting?: boolean;
  submitError?: string | null;
  onEvent?: (type: string, fieldKey?: string) => void;
  onUploadFile?: (file: File) => Promise<{ id?: string; filename: string; url: string }>;
  onChange?: (answers: AnswerItem[]) => void;
  statusBadge?: React.ReactNode;
}

export function FormRenderer({
  schema,
  slug: _slug,
  title,
  description,
  onSubmit,
  submitting: propsSubmitting,
  submitError: propsSubmitError,
  onEvent,
  onUploadFile,
  onChange,
  statusBadge,
}: FormRendererProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [isSubmittingInternal, setIsSubmittingInternal] = useState(false);
  const [submitErrorInternal, setSubmitErrorInternal] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const submitting = propsSubmitting ?? isSubmittingInternal;
  const submitError = propsSubmitError ?? submitErrorInternal;

  const triggerStart = () => {
    if (!hasStarted) {
      setHasStarted(true);
      onEvent?.('start');
    }
  };

  const handleBlur = (fieldKey: string) => {
    onEvent?.('field_blur', fieldKey);
  };

  const handleFieldChange = (key: string, value: any) => {
    triggerStart();
    const next = { ...values, [key]: value };
    setValues(next);

    if (onChange) {
      const answers: AnswerItem[] = [];
      for (const field of schema.fields || []) {
        if (!isFieldVisible(field as FormField, next)) {
          continue;
        }
        const val = next[field.key];
        if (val !== undefined && val !== null && val !== '') {
          if (Array.isArray(val) && val.length === 0) continue;
          answers.push({ field_key: field.key, value: val });
        }
      }
      onChange(answers);
    }

    if (errors[key]) {
      setErrors((prev) => {
        const nextErr = { ...prev };
        delete nextErr[key];
        return nextErr;
      });
    }
  };

  const handleFileUpload = async (fieldKey: string, file: File) => {
    triggerStart();
    setUploadingFields((prev) => ({ ...prev, [fieldKey]: true }));
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });

    try {
      const res = onUploadFile ? await onUploadFile(file) : await api.uploadFile(file);
      setFileNames((prev) => ({ ...prev, [fieldKey]: res.filename || file.name }));
      handleFieldChange(fieldKey, res.url || res.filename || file.name);
    } catch (err: any) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldKey]: err?.message || 'Gagal mengunggah berkas.',
      }));
    } finally {
      setUploadingFields((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const handleFileRemove = (fieldKey: string) => {
    handleFieldChange(fieldKey, '');
    setFileNames((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of schema.fields || []) {
      if (!isFieldVisible(field as FormField, values)) {
        continue;
      }
      const val = values[field.key];
      const isEmpty =
        val === undefined ||
        val === null ||
        (typeof val === 'string' && val.trim() === '') ||
        (Array.isArray(val) && val.length === 0);

      if (field.required && isEmpty) {
        newErrors[field.key] = `${field.label} is required.`;
        continue;
      }

      if (!isEmpty) {
        const normType = field.type.toLowerCase();
        if (normType === 'email') {
          const emailStr = String(val).trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailStr)) {
            newErrors[field.key] = 'Invalid email address format.';
          }
        } else if (normType === 'number') {
          if (typeof val !== 'number' && isNaN(Number(val))) {
            newErrors[field.key] = 'Value must be a valid number.';
          }
        } else if (normType === 'rating') {
          const num = Number(val);
          if (!Number.isInteger(num) || num < 1 || num > 5) {
            newErrors[field.key] = 'Rating must be an integer between 1 and 5.';
          }
        } else if (normType === 'date') {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(String(val))) {
            newErrors[field.key] = 'Date must be formatted as YYYY-MM-DD.';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    const answers: AnswerItem[] = [];
    for (const field of schema.fields || []) {
      if (!isFieldVisible(field as FormField, values)) {
        continue;
      }
      const val = values[field.key];
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val) && val.length === 0) continue;
        answers.push({ field_key: field.key, value: val });
      }
    }

    if (onSubmit) {
      setIsSubmittingInternal(true);
      setSubmitErrorInternal(null);
      try {
        const res = await onSubmit(answers);
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          setSubmitErrorInternal(res.error?.message || res.error || 'Submission failed.');
        } else {
          setIsSubmitted(true);
          onEvent?.('complete');
        }
      } catch (err: any) {
        setSubmitErrorInternal(err?.message || 'Submission failed.');
      } finally {
        setIsSubmittingInternal(false);
      }
    } else {
      setIsSubmitted(true);
      onEvent?.('complete');
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full max-w-xl mx-auto my-12 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Thank You!
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Your response has been recorded.
        </p>
      </div>
    );
  }

  const formTitle = title || schema.title;

  return (
    <div className="w-full max-w-xl mx-auto my-8 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-6 sm:p-8 shadow-xl">
      <div className="flex items-center justify-between gap-4 mb-2">
        {formTitle ? (
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {formTitle}
          </h1>
        ) : <div />}
        {statusBadge && <div className="shrink-0">{statusBadge}</div>}
      </div>
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">{description}</p>
      )}

      {submitError && (
        <div
          role="alert"
          className="mb-6 rounded border border-[var(--color-accent-danger)]/50 bg-[var(--color-accent-danger)]/10 p-3 text-sm text-[var(--color-accent-danger)]"
        >
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {(schema.fields || [])
          .filter((field) => isFieldVisible(field as FormField, values))
          .map((field) => {
            const fieldId = `field_${field.key}`;
          const normType = field.type.toLowerCase();
          const hasError = !!errors[field.key];

          return (
            <div key={field.key} className="flex flex-col">
              {/* Field Label (except choice/multi/rating which have group label) */}
              {normType === 'choice' || normType === 'multi_choice' || normType === 'rating' ? (
                <span className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-[var(--color-accent-danger)]">*</span>
                  )}
                </span>
              ) : (
                <label
                  htmlFor={fieldId}
                  className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                >
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-[var(--color-accent-danger)]">*</span>
                  )}
                </label>
              )}

              {/* Input Renderers for all 9 field types */}
              {normType === 'textarea' || normType === 'long_text' ? (
                <textarea
                  id={fieldId}
                  rows={4}
                  value={values[field.key] ?? ''}
                  onFocus={triggerStart}
                  onBlur={() => handleBlur(field.key)}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className={`w-full rounded border bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none transition ${
                    hasError
                      ? 'border-[var(--color-accent-danger)] focus:border-[var(--color-accent-danger)]'
                      : 'border-[var(--color-border-hairline)] focus:border-[var(--color-accent-primary)]'
                  }`}
                />
              ) : normType === 'choice' ? (
                <div role="radiogroup" aria-label={field.label} className="flex flex-col gap-2">
                  {(field.options || []).map((opt) => {
                    const optId = `${fieldId}_${opt}`;
                    const isChecked = values[field.key] === opt;
                    return (
                      <label
                        key={opt}
                        htmlFor={optId}
                        className={`flex items-center gap-3 rounded border p-3 cursor-pointer transition ${
                          isChecked
                            ? 'border-[var(--color-accent-primary)] bg-[var(--color-surface-elevated)]'
                            : 'border-[var(--color-border-hairline)] bg-[var(--color-bg-primary)] hover:border-[var(--color-text-muted)]'
                        }`}
                      >
                        <input
                          id={optId}
                          type="radio"
                          name={field.key}
                          value={opt}
                          checked={isChecked}
                          onFocus={triggerStart}
                          onBlur={() => handleBlur(field.key)}
                          onChange={() => handleFieldChange(field.key, opt)}
                          className="h-4 w-4 text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
                        />
                        <span className="text-sm text-[var(--color-text-primary)]">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : normType === 'multi_choice' ? (
                <div role="group" aria-label={field.label} className="flex flex-col gap-2">
                  {(field.options || []).map((opt) => {
                    const optId = `${fieldId}_${opt}`;
                    const currentList: string[] = Array.isArray(values[field.key])
                      ? values[field.key]
                      : [];
                    const isChecked = currentList.includes(opt);
                    return (
                      <label
                        key={opt}
                        htmlFor={optId}
                        className={`flex items-center gap-3 rounded border p-3 cursor-pointer transition ${
                          isChecked
                            ? 'border-[var(--color-accent-primary)] bg-[var(--color-surface-elevated)]'
                            : 'border-[var(--color-border-hairline)] bg-[var(--color-bg-primary)] hover:border-[var(--color-text-muted)]'
                        }`}
                      >
                        <input
                          id={optId}
                          type="checkbox"
                          value={opt}
                          checked={isChecked}
                          onFocus={triggerStart}
                          onBlur={() => handleBlur(field.key)}
                          onChange={(e) => {
                            const nextList = e.target.checked
                              ? [...currentList, opt]
                              : currentList.filter((item) => item !== opt);
                            handleFieldChange(field.key, nextList);
                          }}
                          className="h-4 w-4 rounded text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
                        />
                        <span className="text-sm text-[var(--color-text-primary)]">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : normType === 'rating' ? (
                <div role="group" aria-label={field.label} className="flex gap-2.5">
                  {[1, 2, 3, 4, 5].map((num) => {
                    const isSelected = Number(values[field.key]) === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        aria-label={String(num)}
                        onFocus={triggerStart}
                        onBlur={() => handleBlur(field.key)}
                        onClick={() => handleFieldChange(field.key, num)}
                        className={`flex h-11 w-11 items-center justify-center rounded border font-mono text-sm font-semibold transition ${
                          isSelected
                            ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]'
                            : 'border-[var(--color-border-hairline)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              ) : normType === 'file_upload' || normType === 'file' ? (
                <div className="flex flex-col gap-2">
                  {uploadingFields[field.key] ? (
                    <div className="flex items-center justify-center gap-2 rounded border border-dashed border-[var(--color-accent-primary)]/50 bg-[var(--color-accent-primary)]/5 p-6">
                      <svg
                        className="h-5 w-5 animate-spin text-[var(--color-accent-primary)]"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Mengunggah...
                      </span>
                    </div>
                  ) : values[field.key] ? (
                    <div className="flex items-center justify-between rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-elevated)] p-3">
                      <div className="flex items-center gap-2 overflow-hidden text-sm text-[var(--color-text-primary)]">
                        <svg
                          className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="truncate font-mono text-xs">
                          {fileNames[field.key] || (typeof values[field.key] === 'object' && values[field.key] !== null ? (values[field.key].filename || values[field.key].url) : String(values[field.key]))}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileRemove(field.key)}
                        className="ml-2 rounded px-2 py-1 text-xs font-medium text-[var(--color-accent-danger)] hover:bg-[var(--color-accent-danger)]/10 transition"
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor={fieldId}
                      className={`flex flex-col items-center justify-center rounded border-2 border-dashed p-6 cursor-pointer transition ${
                        hasError || uploadErrors[field.key]
                          ? 'border-[var(--color-accent-danger)] bg-[var(--color-accent-danger)]/5'
                          : 'border-[var(--color-border-hairline)] bg-[var(--color-bg-primary)] hover:border-[var(--color-accent-primary)]'
                      }`}
                    >
                      <svg
                        className="mb-2 h-7 w-7 text-[var(--color-text-muted)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                        Click or drag file to upload
                      </span>
                    </label>
                  )}
                  <input
                    id={fieldId}
                    type="file"
                    className="sr-only"
                    onFocus={triggerStart}
                    onBlur={() => handleBlur(field.key)}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(field.key, file);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              ) : normType === 'date' ? (
                <input
                  id={fieldId}
                  type="date"
                  value={values[field.key] ?? ''}
                  onFocus={triggerStart}
                  onBlur={() => handleBlur(field.key)}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className={`w-full rounded border bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none transition ${
                    hasError
                      ? 'border-[var(--color-accent-danger)] focus:border-[var(--color-accent-danger)]'
                      : 'border-[var(--color-border-hairline)] focus:border-[var(--color-accent-primary)]'
                  }`}
                />
              ) : normType === 'number' ? (
                <input
                  id={fieldId}
                  type="number"
                  value={values[field.key] ?? ''}
                  onFocus={triggerStart}
                  onBlur={() => handleBlur(field.key)}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    handleFieldChange(field.key, val);
                  }}
                  className={`w-full rounded border bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none transition ${
                    hasError
                      ? 'border-[var(--color-accent-danger)] focus:border-[var(--color-accent-danger)]'
                      : 'border-[var(--color-border-hairline)] focus:border-[var(--color-accent-primary)]'
                  }`}
                />
              ) : normType === 'email' ? (
                <input
                  id={fieldId}
                  type="email"
                  value={values[field.key] ?? ''}
                  onFocus={triggerStart}
                  onBlur={() => handleBlur(field.key)}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className={`w-full rounded border bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none transition ${
                    hasError
                      ? 'border-[var(--color-accent-danger)] focus:border-[var(--color-accent-danger)]'
                      : 'border-[var(--color-border-hairline)] focus:border-[var(--color-accent-primary)]'
                  }`}
                />
              ) : (
                <input
                  id={fieldId}
                  type="text"
                  value={values[field.key] ?? ''}
                  onFocus={triggerStart}
                  onBlur={() => handleBlur(field.key)}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className={`w-full rounded border bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none transition ${
                    hasError
                      ? 'border-[var(--color-accent-danger)] focus:border-[var(--color-accent-danger)]'
                      : 'border-[var(--color-border-hairline)] focus:border-[var(--color-accent-primary)]'
                  }`}
                />
              )}

              {/* Field Error */}
              {uploadErrors[field.key] ? (
                <p className="mt-1.5 text-xs text-[var(--color-accent-danger)]" role="alert">
                  {uploadErrors[field.key]}
                </p>
              ) : hasError ? (
                <p className="mt-1.5 text-xs text-[var(--color-accent-danger)]" role="alert">
                  {errors[field.key]}
                </p>
              ) : null}
            </div>
          );
        })}

        <button
          type="submit"
          disabled={submitting || Object.values(uploadingFields).some(Boolean)}
          className="mt-2 w-full rounded bg-[var(--color-accent-primary)] px-4 py-3 font-medium text-[var(--color-bg-primary)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
