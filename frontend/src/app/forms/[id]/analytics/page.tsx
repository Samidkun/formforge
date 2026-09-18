'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fetchForm, getAnalytics } from '@/lib/api';
import { AnalyticsDashboard } from '@/analytics/components/AnalyticsDashboard';
import type { AnalyticsData } from '@/analytics/types';

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

function LoadingSpinner() {
  return (
    <div
      role="status"
      aria-label="Memuat data analitik"
      className="flex items-center justify-center py-16 text-sm text-[var(--color-text-muted)]"
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border-hairline)] border-t-[var(--color-accent-primary)] mr-3" />
      <span>Memuat data analitik...</span>
    </div>
  );
}

function AnalyticsContent({ params }: PageProps) {
  const resolvedParams =
    params && typeof (params as any).then === 'function'
      ? use(params as Promise<{ id: string }>)
      : (params as { id: string } | undefined);
  const formId = resolvedParams?.id || '';

  const [formTitle, setFormTitle] = useState<string>('Form Analytics');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) return;
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      const fetchFormFn = (api && (api.fetchForm || api.getForm)) || fetchForm;
      const getAnalyticsFn = (api && api.getAnalytics) || getAnalytics;

      try {
        const [formRes, analyticsRes] = await Promise.all([
          fetchFormFn(formId).catch(() => null),
          getAnalyticsFn(formId),
        ]);

        if (isCancelled) return;

        if (formRes) {
          const formObj = (formRes as any)?.data ?? formRes;
          if (formObj?.title) {
            setFormTitle(formObj.title);
          }
        }

        const rawAnalytics = (analyticsRes as any)?.data ?? analyticsRes;
        setData(rawAnalytics);
      } catch (err: any) {
        if (isCancelled) return;
        setError(err?.message || 'Gagal memuat data analitik');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [formId]);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2.5 bg-[var(--color-surface-primary)]">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold">{formTitle}</h1>
          <nav aria-label="Tab navigasi" className="flex items-center gap-1 rounded-md bg-[var(--color-surface-elevated)] p-1">
            <Link
              href={`/forms/${formId}/edit`}
              className="rounded px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Builder
            </Link>
            <Link
              href={`/forms/${formId}/responses`}
              className="rounded px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Responses
            </Link>
            <span
              aria-current="page"
              className="rounded px-2.5 py-1 text-xs font-semibold bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]"
            >
              Analytics
            </span>
          </nav>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <div
            role="alert"
            className="rounded-md border border-[var(--color-accent-danger)]/30 bg-[var(--color-accent-danger)]/10 p-4 text-sm text-[var(--color-accent-danger)]"
          >
            {error}
          </div>
        ) : data ? (
          <AnalyticsDashboard data={data} />
        ) : null}
      </main>
    </div>
  );
}

export default function AnalyticsPage(props: PageProps) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AnalyticsContent {...props} />
    </Suspense>
  );
}
