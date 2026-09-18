'use client';

import React from 'react';
import type { SubmissionItem } from '@/lib/api';

export interface TableField {
  key: string;
  label?: string;
  type?: string;
  [key: string]: any;
}

export interface TableSchema {
  fields?: TableField[];
  [key: string]: any;
}

export interface ResponsesTableProps {
  schema?: TableSchema | null;
  items: SubmissionItem[];
  total: number;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onExport: () => void;
  isLoading?: boolean;
}

function formatTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export function ResponsesTable({
  schema,
  items,
  total,
  statusFilter,
  onStatusFilterChange,
  onExport,
  isLoading = false,
}: ResponsesTableProps) {
  const fields = schema?.fields || [];

  return (
    <div className="flex flex-col gap-4 text-[var(--color-text-primary)]">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Filter:</span>
          {['all', 'complete', 'partial'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onStatusFilterChange(st)}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)] font-semibold'
                  : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {st}
            </button>
          ))}
          <span className="ml-2 font-mono text-xs text-[var(--color-text-muted)]">
            Total: {total}
          </span>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={items.length === 0}
          className="flex items-center gap-1.5 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span>↓</span> Export CSV
        </button>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--color-border-hairline)] bg-[var(--color-surface-elevated)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 font-mono">Session ID</th>
              <th className="px-3 py-2.5">Waktu</th>
              {fields.map((f) => (
                <th key={f.key} className="px-3 py-2.5">
                  {f.label || f.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-hairline)]">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + fields.length}
                  className="py-8 text-center text-[var(--color-text-muted)]"
                >
                  {isLoading ? 'Memuat data respons...' : 'Belum ada respons yang masuk.'}
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const answerMap = new Map(row.answers?.map((a) => [a.field_key, a.value]));
                const isComplete = row.status === 'complete';
                const timeStr = row.completed_at || row.started_at;

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--color-surface-elevated)]/50 transition-colors"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase font-mono ${
                          isComplete
                            ? 'bg-[var(--color-accent-success)]/10 text-[var(--color-accent-success)] border border-[var(--color-accent-success)]/20'
                            : 'bg-[var(--color-accent-warning)]/10 text-[var(--color-accent-warning)] border border-[var(--color-accent-warning)]/20'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
                      {row.session_id ? `${row.session_id.slice(0, 8)}...` : '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--color-text-muted)]">
                      {formatTimestamp(timeStr)}
                    </td>
                    {fields.map((f) => {
                      const val = answerMap.get(f.key);
                      let displayVal = '—';
                      if (val !== undefined && val !== null && val !== '') {
                        displayVal = Array.isArray(val)
                          ? val.join(', ')
                          : typeof val === 'object'
                          ? JSON.stringify(val)
                          : String(val);
                      }
                      return (
                        <td key={f.key} className="px-3 py-2.5 max-w-xs truncate">
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
