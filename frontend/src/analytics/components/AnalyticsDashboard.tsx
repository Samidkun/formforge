'use client';

import React from 'react';
import type { AnalyticsData } from '../types';

export interface AnalyticsDashboardProps {
  data: AnalyticsData;
}

function formatNumber(val: number): string {
  return (val || 0).toLocaleString('en-US');
}

function formatPercent(val: number): string {
  if (!val || isNaN(val)) return '0%';
  const rounded = Math.round(val * 10) / 10;
  return `${rounded}%`;
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  const { funnel, dropoff = [] } = data;
  const views = funnel?.views || 0;
  const starts = funnel?.starts || 0;
  const completes = funnel?.completes || 0;
  const conversionRate = funnel?.conversion_rate || 0;

  const startPct = views > 0 ? Math.round((starts / views) * 1000) / 10 : 0;
  const completePct = views > 0 ? Math.round((completes / views) * 1000) / 10 : 0;

  const viewToStartDrop = Math.max(0, views - starts);
  const startToCompleteDrop = Math.max(0, starts - completes);

  const hasFieldInteractions =
    dropoff.length > 0 && dropoff.some((f) => (f.interactions || 0) > 0);

  return (
    <div className="flex flex-col gap-6 text-[var(--color-text-primary)]">
      {/* KPI Metric Cards */}
      <section aria-label="KPI Metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Views */}
        <div data-testid="kpi-views" className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            Total Views
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[var(--color-text-primary)]">
            {formatNumber(views)}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Total impresi form dibuka
          </div>
        </div>

        {/* Total Starts */}
        <div data-testid="kpi-starts" className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            Total Starts
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[var(--color-text-primary)]">
            {formatNumber(starts)}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            {views > 0 ? `${startPct}% dari views` : 'Mulai mengisi'}
          </div>
        </div>

        {/* Total Submissions */}
        <div data-testid="kpi-submissions" className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            Total Submissions
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[var(--color-accent-success)]">
            {formatNumber(completes)}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Respons tersubmit lengkap
          </div>
        </div>

        {/* Conversion Rate */}
        <div data-testid="kpi-conversion" className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            Conversion Rate
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[var(--color-accent-primary)]">
            {formatPercent(conversionRate)}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Rasio selesai dari yang mulai
          </div>
        </div>
      </section>

      {/* Funnel Visualizer */}
      <section
        aria-label="Conversion Funnel"
        className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-5"
      >
        <div className="mb-4">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-text-primary)]">
            Conversion Funnel
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Visualisasi alur konversi dari impresi hingga penyelesaian
          </p>
        </div>

        <div className="space-y-4">
          {/* Step 1: Views */}
          <div data-testid="funnel-step-views" className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-sans font-medium text-[var(--color-text-secondary)]">
                1. Views
              </span>
              <span className="text-[var(--color-text-primary)]">
                {formatNumber(views)} (100%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--color-text-secondary)] transition-all"
                style={{ width: views > 0 ? '100%' : '0%' }}
              />
            </div>
          </div>

          {/* Drop connector 1 */}
          <div
            data-testid="funnel-drop-view-to-start"
            className="flex items-center gap-2 pl-4 text-xs font-mono text-[var(--color-text-muted)]"
          >
            <span>↓</span>
            <span className="text-[var(--color-accent-warning)]">
              {formatNumber(viewToStartDrop)} drop
            </span>
            <span>({views > 0 ? formatPercent((viewToStartDrop / views) * 100) : '0%'})</span>
          </div>

          {/* Step 2: Starts */}
          <div data-testid="funnel-step-starts" className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-sans font-medium text-[var(--color-text-secondary)]">
                2. Starts
              </span>
              <span className="text-[var(--color-text-primary)]">
                {formatNumber(starts)} ({views > 0 ? `${startPct}%` : '0%'})
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent-primary)] transition-all"
                style={{
                  width: views > 0 ? `${Math.min(100, (starts / views) * 100)}%` : '0%',
                }}
              />
            </div>
          </div>

          {/* Drop connector 2 */}
          <div
            data-testid="funnel-drop-start-to-complete"
            className="flex items-center gap-2 pl-4 text-xs font-mono text-[var(--color-text-muted)]"
          >
            <span>↓</span>
            <span className="text-[var(--color-accent-danger)]">
              {formatNumber(startToCompleteDrop)} drop
            </span>
            <span>({starts > 0 ? formatPercent((startToCompleteDrop / starts) * 100) : '0%'})</span>
          </div>

          {/* Step 3: Completes */}
          <div data-testid="funnel-step-completes" className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-sans font-medium text-[var(--color-text-secondary)]">
                3. Completes
              </span>
              <span className="text-[var(--color-text-primary)]">
                {formatNumber(completes)} ({views > 0 ? `${completePct}%` : '0%'})
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent-success)] transition-all"
                style={{
                  width: views > 0 ? `${Math.min(100, (completes / views) * 100)}%` : '0%',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Field Dropout Analysis Table */}
      <section
        aria-label="Field Dropoff Analysis"
        className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-5"
      >
        <div className="mb-4">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-text-primary)]">
            Analisis Dropout per Field
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Identifikasi field yang paling sering menyebabkan responden berhenti mengisi
          </p>
        </div>

        {!hasFieldInteractions ? (
          <div className="rounded border border-dashed border-[var(--color-border-hairline)] py-10 text-center text-xs text-[var(--color-text-muted)]">
            Belum ada data interaksi field.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-[var(--color-border-hairline)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border-hairline)] bg-[var(--color-surface-elevated)] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-3 py-2.5 font-mono">No</th>
                  <th className="px-3 py-2.5">Field</th>
                  <th className="px-3 py-2.5">Tipe</th>
                  <th className="px-3 py-2.5 font-mono">Interaksi</th>
                  <th className="px-3 py-2.5 font-mono">Dropouts</th>
                  <th className="px-3 py-2.5 font-mono">Dropout Rate (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-hairline)]">
                {dropoff.map((field, idx) => {
                  const isHighDrop = (field.drop_rate || 0) > 30;
                  const isSevereDrop = (field.drop_rate || 0) >= 50;

                  return (
                    <tr
                      key={field.field_key || idx}
                      className="hover:bg-[var(--color-surface-elevated)]/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 font-mono text-[var(--color-text-muted)]">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-[var(--color-text-primary)]">
                          {field.label || field.field_key}
                        </div>
                        {field.label && field.label !== field.field_key && (
                          <div className="font-mono text-[10px] text-[var(--color-text-muted)]">
                            {field.field_key}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-[var(--color-surface-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]">
                          {field.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[var(--color-text-primary)]">
                        {formatNumber(field.interactions)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[var(--color-text-primary)]">
                        {formatNumber(field.dropouts)}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {isHighDrop ? (
                          <span
                            data-testid={`badge-drop-${field.field_key}`}
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                              isSevereDrop
                                ? 'bg-[var(--color-accent-danger)]/15 text-[var(--color-accent-danger)] border border-[var(--color-accent-danger)]/30'
                                : 'bg-[var(--color-accent-warning)]/15 text-[var(--color-accent-warning)] border border-[var(--color-accent-warning)]/30'
                            }`}
                          >
                            {formatPercent(field.drop_rate)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-secondary)]">
                            {formatPercent(field.drop_rate)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default AnalyticsDashboard;
