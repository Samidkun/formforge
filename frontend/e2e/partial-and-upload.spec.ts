import { test, expect } from '@playwright/test';

test.describe('Partial Autosave & File Upload Public Form E2E', () => {
  test('autosaves draft on input and uploads file before completing submission', async ({ page }) => {
    const submissions: any[] = [];

    // 1. Mock Edge GET /f/upload-survey
    await page.route('**/f/upload-survey', async (route) => {
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
            slug: 'upload-survey',
            title: 'Candidate Application Form',
            version_id: 'ver-upload-1',
            schema: {
              title: 'Candidate Application Form',
              fields: [
                { key: 'name', type: 'text', label: 'Candidate Name', required: true },
                { key: 'resume', type: 'file_upload', label: 'Resume File', required: false },
              ],
            },
          },
        }),
      });
    });

    // 2. Mock Edge POST /f/upload-survey/submit
    await page.route('**/f/upload-survey/submit', async (route) => {
      const payload = route.request().postDataJSON();
      submissions.push(payload);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            submission_id: 'sub-upload-1',
            status: payload.status,
          },
        }),
      });
    });

    // 3. Mock Edge POST /f/upload-survey/event
    await page.route('**/f/upload-survey/event', async (route) => {
      await route.fulfill({
        status: 204,
        contentType: 'application/json',
        body: '',
      });
    });

    // 4. Mock Backend POST /api/uploads
    await page.route('**/api/uploads', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'up-uuid-1',
            filename: 'candidate_cv.pdf',
            mime: 'application/pdf',
            size: 2048,
            url: '/storage/uploads/candidate_cv.pdf',
          },
        }),
      });
    });

    // 5. Navigate to /f/upload-survey
    await page.goto('/f/upload-survey');

    // 6. Verify page loaded
    await expect(page.getByRole('heading', { name: 'Candidate Application Form' })).toBeVisible();
    const nameInput = page.getByLabel('Candidate Name');
    await expect(nameInput).toBeVisible();

    // 7. Type in candidate name and verify autosave indicator
    await nameInput.fill('Jane Doe');
    await expect(page.getByText('Menyimpan draf...')).toBeVisible();

    // Wait for autosave (3s debounce) to complete and show "Tersimpan otomatis"
    await expect(page.getByText('Tersimpan otomatis')).toBeVisible({ timeout: 6000 });

    // Verify partial submission was sent
    const partialSub = submissions.find((s) => s.status === 'partial');
    expect(partialSub).toBeDefined();
    expect(partialSub.answers).toEqual(
      expect.arrayContaining([expect.objectContaining({ field_key: 'name', value: 'Jane Doe' })])
    );

    // 8. Upload a file
    const fileInput = page.getByLabel('Resume File');
    await fileInput.setInputFiles({
      name: 'candidate_cv.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('mock pdf content'),
    });

    // Verify uploaded file name is displayed
    await expect(page.getByText('candidate_cv.pdf')).toBeVisible();

    // 9. Submit the form
    const submitBtn = page.getByRole('button', { name: /submit/i });
    await submitBtn.click();

    // 10. Verify submission completion screen
    await expect(page.getByText('Thank You!')).toBeVisible();
    await expect(page.getByText('Your response has been recorded.')).toBeVisible();

    // Verify complete submission was sent
    const completeSub = submissions.find((s) => s.status === 'complete');
    expect(completeSub).toBeDefined();
    expect(completeSub.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field_key: 'name', value: 'Jane Doe' }),
        expect.objectContaining({
          field_key: 'resume',
          value: '/storage/uploads/candidate_cv.pdf',
        }),
      ])
    );
  });
});
