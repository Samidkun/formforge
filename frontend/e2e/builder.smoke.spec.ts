import { test, expect } from '@playwright/test';

test.describe('Form Builder UI Smoke', () => {
  test('halaman edit memuat palette dengan 9 tombol dan canvas awal', async ({ page }) => {
    // Intercept API call ke backend agar test UI independen dari data seed
    await page.route('**/api/forms/smoke-form-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'smoke-form-1',
            title: 'Formulir Pendaftaran Uji',
            slug: 'formulir-pendaftaran-uji',
            status: 'draft',
            draft_schema: { fields: [] },
          },
          meta: {},
        }),
      });
    });

    await page.goto('/forms/smoke-form-1/edit');

    // 1. Header menampilkan judul form
    await expect(page.getByRole('heading', { name: 'Formulir Pendaftaran Uji' })).toBeVisible();

    // 2. Palette memiliki 9 jenis field
    const paletteButtons = page.getByRole('button', { name: /^Tambah field / });
    await expect(paletteButtons).toHaveCount(9);

    // 3. Tambah field Email ke canvas
    await page.getByRole('button', { name: 'Tambah field Email' }).click();

    // 4. Canvas menampilkan item Email
    await expect(page.getByText('Email · f_1')).toBeVisible();

    // 5. Config panel muncul dan menampilkan label field
    await expect(page.getByLabel('Label Field')).toHaveValue('Email');
  });
});
