'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FieldPalette } from './FieldPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { FieldConfigPanel } from './FieldConfigPanel';
import { canAddField, nextFieldKey } from '../schema';
import type { Field, Schema, SchemaAction } from '../types';
import type { SaveStatus } from '../hooks/useFormBuilder';

interface BuilderViewProps {
  schema: Schema;
  dispatch: React.Dispatch<SchemaAction>;
  title: string;
  id?: string;
  formId?: string;
  slug?: string;
  status?: string;
  form?: {
    id?: string;
    slug?: string;
    status?: string;
  };
  saveStatus?: SaveStatus;
  onSave?: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
  publishError?: string | null;
  isLoading?: boolean;
}

export function BuilderView({
  schema,
  dispatch,
  title,
  id,
  formId,
  slug,
  status,
  form,
  saveStatus = 'idle',
  onSave,
  onPublish,
  isPublishing = false,
  publishError = null,
  isLoading,
}: BuilderViewProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const selectedField = schema.fields.find((f) => f.key === selectedKey) ?? null;

  const formIdResolved = formId || form?.id || id;
  const currentSlug = slug || form?.slug;
  const currentStatus = status || form?.status || 'draft';

  const handleCopyLink = async () => {
    if (!currentSlug) return;
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
    const fullUrl = `${origin}/f/${currentSlug}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (isLoading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] text-sm">
        Memuat form...
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2 bg-[var(--color-surface-primary)]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{title}</h1>
          <nav aria-label="Tab navigasi" className="flex items-center gap-1 rounded-md bg-[var(--color-surface-elevated)] p-1">
            <span
              aria-current="page"
              className="rounded px-2.5 py-1 text-xs font-semibold bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]"
            >
              Builder
            </span>
            <Link
              href={formIdResolved ? `/forms/${formIdResolved}/responses` : '#'}
              className="rounded px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Responses
            </Link>
          </nav>
          {currentStatus === 'published' && (
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--color-accent-success)]/10 text-[var(--color-accent-success)] px-2 py-0.5 text-xs font-medium border border-[var(--color-accent-success)]/20">
                Published
              </span>
              {currentSlug && (
                <>
                  <a
                    href={`/f/${currentSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline underline-offset-2"
                  >
                    /f/{currentSlug}
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-xs rounded border border-[var(--color-border-hairline)] px-2 py-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </>
              )}
            </div>
          )}
          {saveStatus === 'saving' && <span className="text-xs text-[var(--color-accent-warning)]">Menyimpan...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-[var(--color-accent-success)]">Draft tersimpan</span>}
          {saveStatus === 'error' && <span className="text-xs text-[var(--color-accent-danger)]">Gagal simpan</span>}
          {publishError && <span className="text-xs text-[var(--color-accent-danger)]">{publishError}</span>}
        </div>
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === 'saving' || isPublishing}
              className="rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-border-hairline)] disabled:opacity-50 transition-opacity"
            >
              Simpan Draft
            </button>
          )}
          {onPublish && (
            <button
              type="button"
              onClick={onPublish}
              disabled={isPublishing || saveStatus === 'saving'}
              className="rounded bg-[var(--color-accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg-primary)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <FieldPalette
          onAdd={(type) => {
            if (canAddField(schema)) {
              const newKey = nextFieldKey(schema);
              dispatch({ type: 'add_field', fieldType: type });
              setSelectedKey(newKey);
            }
          }}
        />
        <BuilderCanvas
          schema={schema}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onRemove={(key) => {
            dispatch({ type: 'remove_field', key });
            if (selectedKey === key) setSelectedKey(null);
          }}
          onMove={(key, toIndex) => dispatch({ type: 'move_field', key, toIndex })}
        />
        <FieldConfigPanel
          selectedField={selectedField}
          allFields={schema.fields}
          onUpdate={(key, patch) => dispatch({ type: 'update_field', key, patch })}
          onSetOptions={(key, options) => dispatch({ type: 'set_options', key, options })}
          dispatch={(action) => {
            if (action.type === 'UPDATE_FIELD' && 'payload' in action) {
              const payload = action.payload as { key: string; field: Field };
              dispatch({ type: 'set_logic', key: payload.key, logic: payload.field.logic });
            }
          }}
        />
      </div>
    </div>
  );
}
