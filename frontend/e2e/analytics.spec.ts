import { test, expect } from '@playwright/test';

test.describe('Form Analytics Dashboard E2E', () => {
  test('renders KPI cards, funnel visualizer, dropout table, and navigates tabs', async ({ page }) => {
    // Mock GET /api/forms/form-123
    await page.route('**/api/forms/form-123', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/forms/form-123')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'form-123',
              title: 'Feedback Survey',
              slug: 'feedback-survey',
              status: 'published',
              draft_schema: { fields: [] },
            },
          }),
        });
      }
      return route.continue();
    });

    // Mock GET /api/forms/form-123/analytics
    await page.route('**/api/forms/form-123/analytics*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            funnel: {
              views: 1500,
              starts: 1000,
              completes: 500,
              conversion_rate: 50.0,
            },
            dropoff: [
              {
                field_key: 'f_name',
                label: 'Nama Lengkap',
                type: 'text',
                interactions: 1000,
                dropouts: 200,
                drop_rate: 20.0,
              },
              {
                field_key: 'f_feedback',
                label: 'Kritik & Saran',
                type: 'long_text',
                interactions: 800,
                dropouts: 300,
                drop_rate: 37.5,
              },
            ],
            daily: [
              { date: '2026-09-18', views: 1500, starts: 1000, completes: 500 },
            ],
          },
        }),
      });
    });

    // Mock GET /api/forms/form-123/responses
    await page.route('**/api/forms/form-123/responses*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [],
          },
          meta: { total: 0, current_page: 1, last_page: 1, per_page: 25 },
        }),
      });
    });

    // Navigate to /forms/form-123/analytics
    await page.goto('/forms/form-123/analytics');

    // Verify page title "Feedback Survey" is displayed
    await expect(page.getByRole('heading', { name: 'Feedback Survey' })).toBeVisible();

    // Verify "Analytics" navigation tab has aria-current="page"
    const nav = page.getByRole('navigation', { name: 'Tab navigasi' });
    await expect(nav.getByText('Analytics')).toHaveAttribute('aria-current', 'page');

    // Verify KPI cards render (e.g. Total Views 1,500, Conversion Rate 50%)
    await expect(page.getByTestId('kpi-views')).toContainText('1,500');
    await expect(page.getByTestId('kpi-starts')).toContainText('1,000');
    await expect(page.getByTestId('kpi-submissions')).toContainText('500');
    await expect(page.getByTestId('kpi-conversion')).toContainText('50%');

    // Verify Funnel section is visible
    await expect(page.getByRole('region', { name: 'Conversion Funnel' })).toBeVisible();
    await expect(page.getByTestId('funnel-step-views')).toContainText('1,500');
    await expect(page.getByTestId('funnel-step-starts')).toContainText('1,000');
    await expect(page.getByTestId('funnel-step-completes')).toContainText('500');

    // Verify Field Dropout table renders rows for "Nama Lengkap" and "Kritik & Saran"
    await expect(page.getByRole('region', { name: 'Field Dropoff Analysis' })).toBeVisible();
    await expect(page.getByText('Nama Lengkap')).toBeVisible();
    await expect(page.getByText('Kritik & Saran')).toBeVisible();
    await expect(page.getByText('20%')).toBeVisible();
    await expect(page.getByText('37.5%')).toBeVisible();

    // Click "Responses" tab to verify tab navigation functions
    await nav.getByRole('link', { name: 'Responses' }).click();
    await expect(page).toHaveURL(/\/forms\/form-123\/responses/);
    const responsesNav = page.getByRole('navigation', { name: 'Tab navigasi' });
    await expect(responsesNav.getByText('Responses')).toHaveAttribute('aria-current', 'page');
  });
});
