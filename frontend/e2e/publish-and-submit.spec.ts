import { test, expect } from '@playwright/test';

test.describe('Publish & Submit Public Form E2E', () => {
  test('renders published customer-survey, fills inputs, and submits successfully', async ({ page }) => {
    let submitPayload: any = null;

    // 1. Mock Edge GET /f/customer-survey
    await page.route('**/f/customer-survey', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            slug: 'customer-survey',
            title: 'Customer Satisfaction Survey',
            version_id: 'ver-e2e-1',
            schema: {
              title: 'Customer Satisfaction Survey',
              fields: [
                { key: 'name', type: 'text', label: 'Name', required: true },
                { key: 'email', type: 'email', label: 'Email', required: true },
                { key: 'rating', type: 'rating', label: 'Rating', required: true },
              ],
            },
          },
        }),
      });
    });

    // 2. Mock Edge POST /f/customer-survey/submit
    await page.route('**/f/customer-survey/submit', async (route) => {
      submitPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            submission_id: 'sub-e2e-1',
            status: 'complete',
          },
        }),
      });
    });

    // 3. Navigate to /f/customer-survey
    await page.goto('/f/customer-survey');

    // 4. Verify title and input fields are visible
    await expect(page.getByRole('heading', { name: 'Customer Satisfaction Survey' })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Rating' })).toBeVisible();

    // 5. Fill in inputs (Name, Email, Rating button)
    await page.getByLabel('Name').fill('Jane Doe');
    await page.getByLabel('Email').fill('jane.doe@example.com');
    await page.getByRole('group', { name: 'Rating' }).getByRole('button', { name: '5' }).click();

    // 6. Submit form
    await page.getByRole('button', { name: 'Submit' }).click();

    // 7. Assert Thank You / submission successful screen is displayed
    await expect(page.getByRole('heading', { name: 'Thank You!' })).toBeVisible();
    await expect(page.getByText('Your response has been recorded.')).toBeVisible();

    // 8. Verify Edge POST payload
    expect(submitPayload).not.toBeNull();
    expect(submitPayload.status).toBe('complete');
    expect(submitPayload.session_id).toBeTruthy();
    expect(submitPayload.answers).toEqual([
      { field_key: 'name', value: 'Jane Doe' },
      { field_key: 'email', value: 'jane.doe@example.com' },
      { field_key: 'rating', value: 5 },
    ]);
  });
});
