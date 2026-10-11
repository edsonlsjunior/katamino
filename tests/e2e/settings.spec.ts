import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.describe('First visit', () => {
  // Every other test starts as a returning visitor (see playwright.config.ts).
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the root shows the about page once, then always the challenges', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'About the project' })).toBeVisible();
    await expect(page).toHaveURL(/#\/about$/);

    await page.goto('/');
    await page.reload();
    await expect(page.getByTestId('challenge-tier-small-slam')).toBeVisible();
  });

  test('a deep link is honoured even on the first visit', async ({ page }) => {
    await page.goto('/#/challenge/3');
    await expect(page.getByTestId('challenge-title')).toContainText('#3');
  });
});

test.describe('Language', () => {
  test('starts in the browser language and is changed from a dropdown with flags', async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: 'es-ES' });
    const page = await context.newPage();
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();

    const header = page.locator('.app-header');
    await header.getByTestId('language-menu').click();
    await expect(header.getByRole('option')).toHaveCount(4);
    await header.getByRole('option', { name: 'Français' }).click();
    await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible();

    // The choice outlives a reload.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible();
    await context.close();
  });
});

test.describe('Settings', () => {
  test('is reached from the header and switches between light and dark', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/#\/settings$/);

    const html = page.locator('html');
    await page.getByText('Dark', { exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.getByText('Light', { exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    const lightBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(lightBackground).not.toBe(darkBackground);

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.getByText('System', { exact: true }).click();
    await expect(html).not.toHaveAttribute('data-theme', /.*/);
  });

  test('exports progress to a JSON file and imports it back', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem(
        'katamino:v1:progress',
        JSON.stringify({ version: 1, completed: { 1: true, 7: true } }),
      );
    });
    await page.goto('/#/settings');
    await page.reload();
    await expect(page.getByTestId('settings-progress')).toContainText('2 of 500');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('settings-export').click(),
    ]);
    expect(download.suggestedFilename()).toBe('katamino-progress.json');
    const exported = JSON.parse(readFileSync(await download.path(), 'utf-8'));
    expect(exported).toMatchObject({ app: 'katamino', version: 1, completed: [1, 7] });

    // Importing a file with one challenge already done and two new ones adds the new ones.
    const file = testInfo.outputPath('progress.json');
    writeFileSync(file, JSON.stringify({ ...exported, completed: [7, 8, 9] }));
    await page.getByTestId('settings-import-file').setInputFiles(file);
    await expect(page.getByTestId('settings-import-result')).toContainText('2 new completed challenges');
    await expect(page.getByTestId('settings-progress')).toContainText('4 of 500');

    const junk = testInfo.outputPath('junk.json');
    writeFileSync(junk, 'not a progress file');
    await page.getByTestId('settings-import-file').setInputFiles(junk);
    await expect(page.getByTestId('settings-import-result')).toContainText('not a Katamino progress file');
    await expect(page.getByTestId('settings-progress')).toContainText('4 of 500');
  });
});
