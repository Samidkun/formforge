import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResponsesTable } from './ResponsesTable';

describe('ResponsesTable', () => {
  const schema = {
    fields: [
      { key: 'f_name', type: 'text', label: 'Full Name', required: true },
      { key: 'f_score', type: 'rating', label: 'Satisfaction', required: false },
    ],
  };

  const items = [
    {
      id: 'sub-1',
      session_id: 'sess-uuid-1',
      status: 'complete',
      started_at: '2026-09-18T10:00:00Z',
      completed_at: '2026-09-18T10:02:00Z',
      answers: [
        { field_key: 'f_name', value: 'Alice' },
        { field_key: 'f_score', value: 5 },
      ],
    },
    {
      id: 'sub-2',
      session_id: 'sess-uuid-2',
      status: 'partial',
      started_at: '2026-09-18T10:05:00Z',
      completed_at: null,
      answers: [
        { field_key: 'f_name', value: 'Bob' },
      ],
    },
  ];

  it('renders table headers matching schema field labels', () => {
    render(
      <ResponsesTable
        schema={schema}
        items={items}
        total={2}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExport={vi.fn()}
      />
    );
    expect(screen.getByText('Full Name')).toBeDefined();
    expect(screen.getByText('Satisfaction')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Session ID')).toBeDefined();
    expect(screen.getByText('Waktu')).toBeDefined();
  });

  it('renders rows with respondent answers and status badges', () => {
    render(
      <ResponsesTable
        schema={schema}
        items={items}
        total={2}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExport={vi.fn()}
      />
    );
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getAllByText('complete').length).toBeGreaterThan(0);
    expect(screen.getAllByText('partial').length).toBeGreaterThan(0);
  });

  it('calls onExport when Export CSV button is clicked', () => {
    const onExport = vi.fn();
    render(
      <ResponsesTable
        schema={schema}
        items={items}
        total={2}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExport={onExport}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('calls onStatusFilterChange when filter buttons are clicked', () => {
    const onStatusFilterChange = vi.fn();
    render(
      <ResponsesTable
        schema={schema}
        items={items}
        total={2}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
        onExport={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /complete/i }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('complete');

    fireEvent.click(screen.getByRole('button', { name: /partial/i }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('partial');
  });

  it('renders empty state when items is empty', () => {
    render(
      <ResponsesTable
        schema={schema}
        items={[]}
        total={0}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExport={vi.fn()}
      />
    );
    expect(screen.getByText('Belum ada respons yang masuk.')).toBeDefined();
    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    expect(exportBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders loading state when isLoading is true and items is empty', () => {
    render(
      <ResponsesTable
        schema={schema}
        items={[]}
        total={0}
        statusFilter="all"
        isLoading={true}
        onStatusFilterChange={vi.fn()}
        onExport={vi.fn()}
      />
    );
    expect(screen.getByText('Memuat data respons...')).toBeDefined();
  });

  it('renders array answers joined by comma', () => {
    const arraySchema = {
      fields: [{ key: 'f_hobbies', type: 'multi_choice', label: 'Hobbies' }],
    };
    const arrayItems = [
      {
        id: 'sub-3',
        session_id: 'sess-uuid-3',
        status: 'complete',
        started_at: '2026-09-18T10:00:00Z',
        completed_at: '2026-09-18T10:02:00Z',
        answers: [{ field_key: 'f_hobbies', value: ['Reading', 'Gaming'] }],
      },
    ];

    render(
      <ResponsesTable
        schema={arraySchema}
        items={arrayItems}
        total={1}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExport={vi.fn()}
      />
    );
    expect(screen.getByText('Reading, Gaming')).toBeDefined();
  });
});
