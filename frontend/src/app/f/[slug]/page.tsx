'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { FormRenderer, type AnswerItem, type FormSchema } from '@/renderer/FormRenderer';

interface PublishedFormData {
  slug: string;
  title: string;
  version_id: string;
  schema: FormSchema;
  settings?: Record<string, unknown>;
}

function getOrCreateSessionId(slug: string): string {
  const key = `ff_sess_${slug}`;
  if (typeof window !== 'undefined') {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
      sessionStorage.setItem(key, id);
    }
    return id;
  }
  return '00000000-0000-0000-0000-000000000000';
}

function LoadingSpinner() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div
        role="status"
        aria-label="Memuat form"
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border-hairline)] border-t-[var(--color-accent-primary)]"
      />
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Memuat form...</p>
    </main>
  );
}

function PublicFormContent({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const resolvedParams =
    params && typeof (params as any).then === 'function'
      ? use(params as Promise<{ slug: string }>)
      : (params as { slug: string });
  const slug = resolvedParams?.slug;

  const edgeUrl = process.env.NEXT_PUBLIC_EDGE_URL || 'http://localhost:8081';

  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PublishedFormData | null>(null);

  useEffect(() => {
    if (!slug) return;
    let isCancelled = false;

    async function loadPublishedForm() {
      setIsLoading(true);
      setIsNotFound(false);
      setLoadError(null);

      try {
        const res = await fetch(`${edgeUrl}/f/${slug}`);
        if (res.status === 404) {
          if (!isCancelled) {
            setIsNotFound(true);
            setIsLoading(false);
          }
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          if (!isCancelled) {
            setLoadError(json?.error?.message || 'Gagal memuat form.');
            setIsLoading(false);
          }
          return;
        }

        if (!isCancelled) {
          setFormData(json.data);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setLoadError(err?.message || 'Terjadi kesalahan jaringan.');
          setIsLoading(false);
        }
      }
    }

    loadPublishedForm();

    return () => {
      isCancelled = true;
    };
  }, [slug, edgeUrl]);

  const handleSubmit = async (answers: AnswerItem[]) => {
    const sessionId = getOrCreateSessionId(slug);
    const res = await fetch(`${edgeUrl}/f/${slug}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        status: 'complete',
        answers,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      let errMsg = json?.error?.message || 'Gagal mengirim form.';
      if (json?.error?.details) {
        const details = Object.values(json.error.details).join(' ');
        if (details) errMsg = details;
      }
      throw new Error(errMsg);
    }

    return json;
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isNotFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-8 shadow-lg">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Form Tidak Ditemukan
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Form ini tidak ditemukan atau belum dipublikasikan.
          </p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md rounded-lg border border-[var(--color-accent-danger)]/40 bg-[var(--color-surface-primary)] p-8 shadow-lg">
          <h1 className="text-xl font-semibold text-[var(--color-accent-danger)]">
            Terjadi Kesalahan
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{loadError}</p>
        </div>
      </main>
    );
  }

  if (!formData || !formData.schema) {
    return null;
  }

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6">
      <FormRenderer
        schema={formData.schema}
        slug={slug}
        title={formData.title}
        onSubmit={handleSubmit}
      />
    </main>
  );
}

export default function PublicFormPage(props: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PublicFormContent {...props} />
    </Suspense>
  );
}
