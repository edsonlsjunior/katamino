import { test, expect } from '@playwright/test';

test.describe('Board in solver mode', () => {
  test('trying to play says the board is locked and points at the way back', async ({ page }) => {
    await page.goto('/#/challenge/1/solver');
    await expect(page.getByTestId('solver-locked')).toHaveCount(0);

    await page.getByTestId('board-cell-0-0').click();
    await expect(page.getByTestId('solver-locked')).toContainText('The board is locked');
    await expect(page.getByTestId('close-solver')).toHaveClass(/btn-attention/);
    await expect(page.getByRole('button', { name: 'Close the solver' })).toHaveClass(/btn-attention/);

    // The pieces around the board are locked too.
    await page.getByTestId(/^tray-piece-/).first().click();
    await expect(page.getByTestId('solver-locked')).toBeVisible();

    // Back in the game the notice is gone and the board works again.
    await page.getByTestId('close-solver').click();
    await expect(page.getByTestId('solver-locked')).toHaveCount(0);
    await page.getByTestId(/^tray-piece-/).first().click();
    await page.getByTestId('board-cell-0-0').click();
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
  });
});
