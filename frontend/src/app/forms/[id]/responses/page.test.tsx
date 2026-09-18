import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResponsesPage from './page';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    getForm: vi.fn(),
    getResponses: vi.fn(),
    exportResponsesUrl: vi.fn().mockReturnValue('/mock-export-url'),
  },
}));

describe('ResponsesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads form and responses, rendering page with title, tab navigation, and ResponsesTable', async () => {
    vi.mocked(api.getForm).mockResolvedValue({
      data: {
        id: 'f-1',
        title: 'Survey Mahasiswa',
        slug: 'survey-mahasiswa',
        draft_schema: {
          fields: [{ key: 'f_name', type: 'text', label: 'Nama' }],
        },
      },
    } as any);

    vi.mocked(api.getResponses).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'sub-1',
            session_id: 'sess-1234',
            status: 'complete',
            started_at: '2026-09-18T10:00:00Z',
            completed_at: '2026-09-18T10:02:00Z',
            answers: [{ field_key: 'f_name', value: 'Budi' }],
          },
        ],
      },
      meta: { total: 1, current_page: 1, last_page: 1, per_page: 25 },
    } as any);

    render(<ResponsesPage params={Promise.resolve({ id: 'f-1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Survey Mahasiswa')).toBeDefined();
      expect(screen.getByText('Budi')).toBeDefined();
    });

    const builderLink = screen.getByRole('link', { name: /Builder/i });
    expect(builderLink).toBeDefined();
    expect(builderLink.getAttribute('href')).toBe('/forms/f-1/edit');

    expect(screen.getByText('Responses')).toBeDefined();
  });

  it('calls api.getResponses with new status when filter changes', async () => {
    vi.mocked(api.getForm).mockResolvedValue({
      data: {
        id: 'f-1',
        title: 'Survey Mahasiswa',
        draft_schema: {
          fields: [{ key: 'f_name', type: 'text', label: 'Nama' }],
        },
      },
    } as any);

    vi.mocked(api.getResponses).mockResolvedValue({
      success: true,
      data: { items: [] },
      meta: { total: 0, current_page: 1, last_page: 1, per_page: 25 },
    } as any);

    render(<ResponsesPage params={Promise.resolve({ id: 'f-1' })} />);

    await waitFor(() => {
      expect(api.getResponses).toHaveBeenCalledWith('f-1', 'all', 1);
    });

    const completeBtn = screen.getByRole('button', { name: /^Complete$/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(api.getResponses).toHaveBeenCalledWith('f-1', 'complete', 1);
    });
  });

  it('triggers CSV export download when export button is clicked', async () => {
    vi.mocked(api.getForm).mockResolvedValue({
      data: {
        id: 'f-1',
        title: 'Survey Mahasiswa',
        draft_schema: { fields: [] },
      },
    } as any);

    vi.mocked(api.getResponses).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'sub-1',
            session_id: 'sess-1234',
            status: 'complete',
            started_at: '2026-09-18T10:00:00Z',
            completed_at: '2026-09-18T10:02:00Z',
            answers: [],
          },
        ],
      },
      meta: { total: 1, current_page: 1, last_page: 1, per_page: 25 },
    } as any);

    const fetchSpy = vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['col1,col2\nval1,val2'], { type: 'text/csv' }),
    }));
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-blob');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(<ResponsesPage params={Promise.resolve({ id: 'f-1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Survey Mahasiswa')).toBeDefined();
    });

    const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(api.exportResponsesUrl).toHaveBeenCalledWith('f-1');
      expect(fetch).toHaveBeenCalledWith('/mock-export-url', expect.any(Object));
      expect(createObjectURLMock).toHaveBeenCalled();
    });
  });
});
