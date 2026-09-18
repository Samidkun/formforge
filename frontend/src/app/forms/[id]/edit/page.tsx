'use client';

import { use } from 'react';
import { BuilderView } from '@/builder/components/BuilderView';
import { useFormBuilder } from '@/builder/hooks/useFormBuilder';

export default function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    schema,
    dispatch,
    title,
    slug,
    status,
    isLoading,
    loadError,
    saveStatus,
    save,
    isPublishing,
    publish,
    publishError,
  } = useFormBuilder(id);

  if (loadError) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-[var(--color-accent-danger)]">{loadError}</p>
      </main>
    );
  }

  return (
    <BuilderView
      id={id}
      formId={id}
      schema={schema}
      dispatch={dispatch}
      title={title || `Form ${id}`}
      slug={slug}
      status={status}
      saveStatus={saveStatus}
      onSave={save}
      onPublish={publish}
      isPublishing={isPublishing}
      publishError={publishError}
      isLoading={isLoading}
    />
  );
}
