'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type SubmissionItem } from '@/lib/api';
import { ResponsesTable, type TableSchema } from '@/responses/components/ResponsesTable';

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function ResponsesPage({ params }: PageProps) {
  const [id, setId] = useState<string | null>(() => {
    if (params && typeof (params as any).then !== 'function') {
      return (params as { id: string }).id;
    }
    return null;
  });

  useEffect(() => {
    let active = true;
    if (params && typeof (params as any).then === 'function') {
      (params as Promise<{ id: string }>).then((resolved) => {
        if (active && resolved?.id) {
          setId(resolved.id);
        }
      });
    } else if (params) {
      Promise.resolve().then(() => {
        if (active) {
          setId((params as { id: string }).id);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [params]);

  const [formTitle, setFormTitle] = useState<string>('Form Responses');
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [responses, setResponses] = useState<SubmissionItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    api
      .getForm(id)
      .then((formRes: any) => {
        if (!isMounted) return;
        const formData = formRes?.data ?? formRes;
        if (formData) {
          setFormTitle(formData.title || 'Form Responses');
          setSchema(formData.draft_schema || formData.schema || null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load form details:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    async function loadResponses() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.getResponses(id!, statusFilter, page);
        if (isCancelled) return;
        const items = res?.data?.items || (Array.isArray(res?.data) ? (res.data as SubmissionItem[]) : []);
        setResponses(items);
        setTotal(res?.meta?.total ?? items.length);
      } catch (err: any) {
        if (isCancelled) return;
        setError(err?.message || 'Gagal memuat responses');
        setResponses([]);
        setTotal(0);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadResponses();

    return () => {
      isCancelled = true;
    };
  }, [id, statusFilter, page]);

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleExport = () => {
    if (!id) return;
    const url = api.exportResponsesUrl(id);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2.5 bg-[var(--color-surface-primary)]">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold">{formTitle}</h1>
          <nav aria-label="Tab navigasi" className="flex items-center gap-1 rounded-md bg-[var(--color-surface-elevated)] p-1">
            <Link
              href={`/forms/${id || ''}/edit`}
              className="rounded px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Builder
            </Link>
            <span
              aria-current="page"
              className="rounded px-2.5 py-1 text-xs font-semibold bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)]"
            >
              Responses
            </span>
          </nav>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {error && (
          <div className="mb-4 rounded-md border border-[var(--color-accent-danger)]/30 bg-[var(--color-accent-danger)]/10 p-3 text-xs text-[var(--color-accent-danger)]">
            {error}
          </div>
        )}
        <ResponsesTable
          schema={schema}
          items={responses}
          total={total}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          onExport={handleExport}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}
