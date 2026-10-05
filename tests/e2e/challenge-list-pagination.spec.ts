import { test, expect } from '@playwright/test';

// The Small Slam tier has 42 challenges (ids 1-42) with a page size of 24, so it's
// the smallest tier that still needs a second page — a good target for proving
// pagination is real (page 2's cards aren't already in the DOM on page 1).
test.describe('Challenge list pagination', () => {
  test('navigating Small Slam to page 2 swaps the visible cards and updates the indicator', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByTestId('challenge-card-1')).toBeVisible();
    await expect(page.getByTestId('challenge-card-24')).toBeVisible();
    await expect(page.getByTestId('challenge-card-25')).toHaveCount(0);

    const indicator = page.getByTestId('challenge-tier-small-slam-page-indicator');
    await expect(indicator).toHaveText('Page 1 of 2');
    await expect(page.getByTestId('challenge-tier-small-slam-prev')).toBeDisabled();

    await page.getByTestId('challenge-tier-small-slam-next').click();

    await expect(indicator).toHaveText('Page 2 of 2');
    await expect(page.getByTestId('challenge-tier-small-slam-next')).toBeDisabled();
    await expect(page.getByTestId('challenge-card-1')).toHaveCount(0);
    await expect(page.getByTestId('challenge-card-25')).toBeVisible();
    await expect(page.getByTestId('challenge-card-42')).toBeVisible();

    await page.getByTestId('challenge-tier-small-slam-prev').click();
    await expect(indicator).toHaveText('Page 1 of 2');
    await expect(page.getByTestId('challenge-card-1')).toBeVisible();
  });
});
