import { test, expect } from '@playwright/test';

test.describe('Challenge page — navigation and completion', () => {
  test('previous/following arrows move between challenges without solving the current one', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();

    const title = page.getByTestId('challenge-title');
    const previous = page.getByRole('button', { name: 'Previous challenge' });
    const following = page.getByRole('button', { name: 'Following challenge' });

    await expect(title).toContainText('#1');
    await expect(previous).toBeDisabled(); // the first challenge has nothing before it
    await expect(page.getByTestId(/^board-cell-0-/)).toHaveCount(3);

    // Leave an unfinished attempt behind and move on anyway.
    await page.getByTestId(/^tray-piece-/).first().click();
    await page.getByTestId('board-cell-0-0').click();
    await following.click();
    await expect(title).toContainText('#2');
    await expect(page.getByTestId(/^board-cell-0-/)).toHaveCount(4);
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(0);

    await previous.click();
    await expect(title).toContainText('#1');
    await expect(page.getByTestId(/^board-cell-0-/)).toHaveCount(3);
  });

  test('the arrows keep solver mode when it is open', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await page.getByRole('button', { name: /watch the solver/i }).click();
    await page.getByTestId('start-solve').click();
    await expect(page.getByTestId('solver-complete')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Following challenge' }).click();
    await expect(page.getByTestId('challenge-title')).toContainText('#2');
    // Still in solver mode, with a clean board and no leftover run.
    await expect(page.getByTestId('solver-panel')).toBeVisible();
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(0);
    await expect(page.getByTestId('solver-complete')).toHaveCount(0);
  });

  test('a completed challenge is marked as such on its own page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('katamino:v1:progress', JSON.stringify({ version: 1, completed: { 2: true } }));
    });
    await page.reload();
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();

    await expect(page.getByTestId('challenge-title')).toHaveAttribute('data-completed', 'false');
    await expect(page.getByTestId('challenge-completed')).toHaveCount(0);

    await page.getByRole('button', { name: 'Following challenge' }).click();
    await expect(page.getByTestId('challenge-title')).toHaveAttribute('data-completed', 'true');
    await expect(page.getByTestId('challenge-completed')).toContainText('Completed');

    // In solver mode too.
    await page.getByRole('button', { name: /watch the solver/i }).click();
    await expect(page.getByTestId('challenge-completed')).toBeVisible();
  });
});
