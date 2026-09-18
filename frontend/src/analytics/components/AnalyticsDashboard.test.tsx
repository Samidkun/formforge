import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import type { AnalyticsData } from '../types';

describe('AnalyticsDashboard', () => {
  const mockData: AnalyticsData = {
    funnel: {
      views: 1200,
      starts: 800,
      completes: 400,
      conversion_rate: 50.0,
    },
    dropoff: [
      {
        field_key: 'f_name',
        label: 'Nama Lengkap',
        type: 'text',
        interactions: 800,
        dropouts: 160,
        drop_rate: 20.0,
      },
      {
        field_key: 'f_phone',
        label: 'Nomor Telepon',
        type: 'phone',
        interactions: 640,
        dropouts: 240,
        drop_rate: 37.5,
      },
      {
        field_key: 'f_feedback',
        label: 'Masukan & Saran',
        type: 'textarea',
        interactions: 400,
        dropouts: 0,
        drop_rate: 0.0,
      },
    ],
    daily: [
      { date: '2026-09-17', views: 500, starts: 300, completes: 150 },
      { date: '2026-09-18', views: 700, starts: 500, completes: 250 },
    ],
  };

  it('renders KPI metric cards with correct formatted numbers and conversion rate', () => {
    render(<AnalyticsDashboard data={mockData} />);

    // Check KPI Card labels
    expect(screen.getByText('Total Views')).toBeDefined();
    expect(screen.getByText('Total Starts')).toBeDefined();
    expect(screen.getByText('Total Submissions')).toBeDefined();
    expect(screen.getByText('Conversion Rate')).toBeDefined();

    // Check KPI Values inside specific KPI cards
    const viewsCard = screen.getByTestId('kpi-views');
    expect(within(viewsCard).getByText('1,200')).toBeDefined();

    const startsCard = screen.getByTestId('kpi-starts');
    expect(within(startsCard).getByText('800')).toBeDefined();

    const completesCard = screen.getByTestId('kpi-submissions');
    expect(within(completesCard).getByText('400')).toBeDefined();

    const convCard = screen.getByTestId('kpi-conversion');
    expect(within(convCard).getByText('50%')).toBeDefined();
  });

  it('renders funnel step visualizer with percentages and dropoff counts', () => {
    render(<AnalyticsDashboard data={mockData} />);

    // Funnel steps
    expect(screen.getByTestId('funnel-step-views')).toBeDefined();
    expect(screen.getByTestId('funnel-step-starts')).toBeDefined();
    expect(screen.getByTestId('funnel-step-completes')).toBeDefined();

    // Dropoffs between steps: 1200 -> 800 (drop: 400), 800 -> 400 (drop: 400)
    const drop1 = screen.getByTestId('funnel-drop-view-to-start');
    expect(within(drop1).getByText(/400 drop/i)).toBeDefined();

    const drop2 = screen.getByTestId('funnel-drop-start-to-complete');
    expect(within(drop2).getByText(/400 drop/i)).toBeDefined();
  });

  it('renders field dropout breakdown table with columns and badges', () => {
    render(<AnalyticsDashboard data={mockData} />);

    // Table headers
    expect(screen.getByText('No')).toBeDefined();
    expect(screen.getByText('Field')).toBeDefined();
    expect(screen.getByText('Tipe')).toBeDefined();
    expect(screen.getByText('Interaksi')).toBeDefined();
    expect(screen.getByText('Dropouts')).toBeDefined();
    expect(screen.getByText('Dropout Rate (%)')).toBeDefined();

    // Field row content
    expect(screen.getByText('Nama Lengkap')).toBeDefined();
    expect(screen.getByText('Nomor Telepon')).toBeDefined();
    expect(screen.getByText('Masukan & Saran')).toBeDefined();

    expect(screen.getByText('37.5%')).toBeDefined();
    expect(screen.getByText('20%')).toBeDefined();
    expect(screen.getByText('0%')).toBeDefined();

    // High drop rate (> 30%) badge
    const badge = screen.getByTestId('badge-drop-f_phone');
    expect(badge).toBeDefined();
    expect(badge.textContent).toMatch(/37\.5%/);
  });

  it('handles empty analytics data gracefully', () => {
    const emptyData: AnalyticsData = {
      funnel: {
        views: 0,
        starts: 0,
        completes: 0,
        conversion_rate: 0,
      },
      dropoff: [],
      daily: [],
    };

    render(<AnalyticsDashboard data={emptyData} />);

    // Metric cards show 0
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('0%')).toBeDefined();

    // Empty state message for table
    expect(screen.getByText(/belum ada data interaksi field/i)).toBeDefined();
  });

  it('shows empty state when fields exist but have zero interactions', () => {
    const zeroInteractionsData: AnalyticsData = {
      funnel: {
        views: 5,
        starts: 0,
        completes: 0,
        conversion_rate: 0,
      },
      dropoff: [
        {
          field_key: 'f_title',
          label: 'Judul',
          type: 'text',
          interactions: 0,
          dropouts: 0,
          drop_rate: 0,
        },
      ],
      daily: [],
    };

    render(<AnalyticsDashboard data={zeroInteractionsData} />);
    expect(screen.getByText(/belum ada data interaksi field/i)).toBeDefined();
  });
});
