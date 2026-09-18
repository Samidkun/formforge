import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnalyticsPage from './page';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    fetchForm: vi.fn(),
    getForm: vi.fn(),
    getAnalytics: vi.fn(),
  },
  fetchForm: vi.fn(),
  getAnalytics: vi.fn(),
}));

describe('AnalyticsPage (/forms/[id]/analytics)', () => {
  const mockFormData = {
    id: 'form-123',
    title: 'Customer Feedback Survey',
    slug: 'customer-feedback',
    status: 'published',
    draft_schema: { fields: [] },
  };

  const mockAnalyticsData = {
    funnel: {
      views: 1200,
      starts: 800,
      completes: 400,
      conversion_rate: 33.3,
    },
    dropoff: [
      {
        field_key: 'rating_1',
        label: 'Overall Satisfaction',
        type: 'rating',
        interactions: 750,
        dropouts: 15,
        drop_rate: 2.0,
      },
    ],
    daily: [
      {
        date: '2026-09-18',
        views: 1200,
        starts: 800,
        completes: 400,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form title and unified navigation tabs with Analytics marked active', async () => {
    vi.mocked(api.fetchForm).mockResolvedValue(mockFormData as any);
    vi.mocked(api.getAnalytics).mockResolvedValue({
      success: true,
      data: mockAnalyticsData,
    } as any);

    await act(async () => {
      render(<AnalyticsPage params={Promise.resolve({ id: 'form-123' })} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Customer Feedback Survey')).toBeInTheDocument();
    });

    const builderLink = screen.getByRole('link', { name: /Builder/i });
    expect(builderLink).toBeInTheDocument();
    expect(builderLink).toHaveAttribute('href', '/forms/form-123/edit');

    const responsesLink = screen.getByRole('link', { name: /Responses/i });
    expect(responsesLink).toBeInTheDocument();
    expect(responsesLink).toHaveAttribute('href', '/forms/form-123/responses');

    const analyticsTab = screen.getByText('Analytics');
    expect(analyticsTab).toBeInTheDocument();
    expect(analyticsTab).toHaveAttribute('aria-current', 'page');
    expect(analyticsTab.className).toContain('bg-[var(--color-accent-primary)]');
  });

  it('renders loading state while data is being fetched', async () => {
    vi.mocked(api.fetchForm).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getAnalytics).mockReturnValue(new Promise(() => {}));

    await act(async () => {
      render(<AnalyticsPage params={Promise.resolve({ id: 'form-123' })} />);
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Memuat data analitik/i)).toBeInTheDocument();
  });

  it('renders AnalyticsDashboard upon successful fetch', async () => {
    vi.mocked(api.fetchForm).mockResolvedValue(mockFormData as any);
    vi.mocked(api.getAnalytics).mockResolvedValue({
      success: true,
      data: mockAnalyticsData,
    } as any);

    await act(async () => {
      render(<AnalyticsPage params={Promise.resolve({ id: 'form-123' })} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('kpi-views')).toBeInTheDocument();
      expect(screen.getByText('1,200')).toBeInTheDocument();
      expect(screen.getByText('Overall Satisfaction')).toBeInTheDocument();
    });
  });

  it('renders error message if fetching fails', async () => {
    vi.mocked(api.fetchForm).mockResolvedValue(mockFormData as any);
    vi.mocked(api.getAnalytics).mockRejectedValue(new Error('Gagal memuat data analitik'));

    await act(async () => {
      render(<AnalyticsPage params={Promise.resolve({ id: 'form-123' })} />);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Gagal memuat data analitik')).toBeInTheDocument();
    });
  });

  it('handles synchronous params object gracefully', async () => {
    vi.mocked(api.fetchForm).mockResolvedValue(mockFormData as any);
    vi.mocked(api.getAnalytics).mockResolvedValue({
      success: true,
      data: mockAnalyticsData,
    } as any);

    render(<AnalyticsPage params={{ id: 'form-123' }} />);

    await waitFor(() => {
      expect(screen.getByText('Customer Feedback Survey')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-views')).toBeInTheDocument();
    });
  });
});
