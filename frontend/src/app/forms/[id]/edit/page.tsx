'use client';

import { use } from 'react';
import { BuilderView } from '@/builder/components/BuilderView';
import { useFormBuilder } from '@/builder/hooks/useFormBuilder';

export default function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { schema, dispatch, title, isLoading, error, saveStatus, save } = useFormBuilder(id);

  if (error) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-[var(--color-accent-danger)]">{error}</p>
      </main>
    );
  }

  return (
    <BuilderView
      schema={schema}
      dispatch={dispatch}
      title={title || `Form ${id}`}
      saveStatus={saveStatus}
      onSave={save}
      isLoading={isLoading}
    />
  );
}
