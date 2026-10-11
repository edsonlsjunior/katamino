import { test, expect } from '@playwright/test';

const TIERS = ['small-slam', 'slam', 'grand-slam', 'super-slam', 'challenge', 'bonus'];

test.describe('Challenge list', () => {
  test('is the root: one column per tier, split by line, with every challenge reachable', async ({
    page,
  }) => {
    await page.goto('/');

    for (const tier of TIERS) {
      await expect(page.getByTestId(`challenge-tier-${tier}`)).toBeAttached();
    }
    await expect(page.locator('[data-testid^="challenge-card-"]')).toHaveCount(500);

    // Small Slam: lines A to G, six board sizes each.
    const smallSlam = page.getByTestId('challenge-tier-small-slam');
    await expect(smallSlam.locator('.challenge-line')).toHaveCount(7);
    await expect(smallSlam.locator('.challenge-line').first()).toContainText('A');
    await expect(page.getByTestId('challenge-tier-small-slam-count')).toHaveText('0/42');

    // No shortcut to the solver from here: it is opened from the challenge itself.
    await expect(page.getByRole('button', { name: /watch the solver/i })).toHaveCount(0);
  });

  test('progress bars follow what has been completed', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem(
        'katamino:v1:progress',
        JSON.stringify({ version: 1, completed: { 1: true, 2: true, 43: true } }),
      );
    });
    await page.reload();

    await expect(page.getByTestId('challenge-progress-total')).toContainText('3 of 500');
    await expect(page.getByTestId('challenge-tier-small-slam-count')).toHaveText('2/42');
    await expect(page.getByTestId('challenge-tier-slam-count')).toHaveText('1/118');
    await expect(
      page.getByTestId('challenge-tier-small-slam').getByRole('progressbar'),
    ).toHaveAttribute('aria-valuenow', '2');

    // "Continue" opens the first challenge still to be solved.
    await page.getByTestId('challenge-continue').click();
    await expect(page.getByTestId('challenge-title')).toContainText('#3');
  });

  test('screens have their own URLs, and the back button returns to the list', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page).toHaveURL(/#\/challenge\/1$/);

    await page.getByRole('button', { name: /watch the solver/i }).click();
    await expect(page).toHaveURL(/#\/challenge\/1\/solver$/);
    await page.getByRole('button', { name: 'Following challenge' }).click();
    await expect(page).toHaveURL(/#\/challenge\/2\/solver$/);

    await page.goBack();
    await expect(page.getByTestId('challenge-tier-small-slam')).toBeVisible();

    // A deep link opens the challenge directly; an unknown one falls back to the list.
    await page.goto('/#/challenge/7/solver');
    await expect(page.getByTestId('challenge-title')).toContainText('#7');
    await expect(page.getByTestId('solver-panel')).toBeVisible();
    await page.goto('/#/challenge/9999');
    await expect(page.getByTestId('challenge-tier-small-slam')).toBeVisible();
  });

  test('the header leads to the about page and back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'About' }).click();
    await expect(page).toHaveURL(/#\/about$/);
    await expect(page.getByRole('heading', { name: 'About the project' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to challenges' }).click();
    await expect(page.getByTestId('challenge-tier-small-slam')).toBeVisible();
  });
});
