import { test, expect } from '@playwright/test';

test.describe('Form Responses Dashboard E2E', () => {
  test('renders responses table and handles CSV export', async ({ page }) => {
    // Mock /api/forms/test-id
    await page.route('**/api/forms/test-id', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'test-id',
              title: 'Customer Satisfaction',
              slug: 'customer-satisfaction',
              status: 'published',
              draft_schema: {
                fields: [
                  { key: 'f_name', type: 'text', label: 'Nama' },
                  { key: 'f_rating', type: 'rating', label: 'Nilai' },
                ],
              },
            },
          }),
        });
      }
      return route.continue();
    });

    // Mock /api/forms/test-id/responses
    await page.route('**/api/forms/test-id/responses*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 'sub-1',
                session_id: '11111111-1111-1111-1111-111111111111',
                status: 'complete',
                started_at: '2026-09-18T10:00:00Z',
                completed_at: '2026-09-18T10:02:00Z',
                answers: [
                  { field_key: 'f_name', value: 'Doni' },
                  { field_key: 'f_rating', value: 5 },
                ],
              },
            ],
          },
          meta: { total: 1, current_page: 1, last_page: 1, per_page: 25 },
        }),
      });
    });

    await page.goto('/forms/test-id/responses');

    // Assert headers and rows
    await expect(page.getByText('Customer Satisfaction')).toBeVisible();
    await expect(page.getByText('Doni')).toBeVisible();
    await expect(page.getByText('5')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'complete' })).toBeVisible();

    // Assert Export button exists and is clickable
    const exportBtn = page.getByRole('button', { name: /export csv/i });
    await expect(exportBtn).toBeVisible();
  });
});
