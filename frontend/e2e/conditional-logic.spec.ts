import { test, expect } from '@playwright/test';

test.describe('Conditional Logic E2E', () => {
  test('dynamically shows dependent field and submits successfully', async ({ page }) => {
    // Mock Edge GET /f/logic-survey
    await page.route('**/f/logic-survey', async (route) => {
      if (route.request().resourceType() === 'document') {
        return route.continue();
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              slug: 'logic-survey',
              title: 'Membership Form',
              version_id: 'v-logic-1',
              schema: {
                fields: [
                  {
                    key: 'f_member',
                    type: 'choice',
                    label: 'Do you have membership?',
                    required: true,
                    options: ['Yes', 'No'],
                  },
                  {
                    key: 'f_card_num',
                    type: 'text',
                    label: 'Member ID Number',
                    required: true,
                    logic: {
                      showIf: { field: 'f_member', op: 'equals', value: 'Yes' },
                    },
                  },
                ],
              },
              settings: {},
            },
          }),
        });
      }
      return route.continue();
    });

    // Mock Edge POST /f/logic-survey/submit
    await page.route('**/f/logic-survey/submit', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { submission_id: 'sub-logic-1', status: 'complete' },
        }),
      });
    });

    await page.goto('/f/logic-survey');

    // Member ID Number should be hidden initially
    await expect(page.getByLabel('Member ID Number')).not.toBeVisible();

    // Click "Yes"
    await page.getByLabel('Yes').click();

    // Member ID Number should now be visible
    await expect(page.getByLabel('Member ID Number')).toBeVisible();

    // Fill in Member ID Number
    await page.getByLabel('Member ID Number').fill('MEM-999');

    // Submit
    await page.getByRole('button', { name: /submit/i }).click();

    // Success screen
    await expect(page.getByText(/terima kasih|thank you/i)).toBeVisible();
  });
});
