import { test, expect } from '@playwright/test';

test.describe('Solver starting point', () => {
  test('with nothing on the board, only the empty board can be the start', async ({ page }) => {
    await page.goto('/#/challenge/1/solver');

    await expect(page.getByTestId('solver-start-empty')).toBeChecked();
    await expect(page.getByTestId('solver-start-attempt')).toBeDisabled();
    await expect(page.getByTestId('solver-start-hint')).toContainText('Place pieces on the board');
  });

  test('a run can start from the pieces the player placed, which stay put', async ({ page }) => {
    await page.goto('/#/challenge/1');
    await page.getByTestId(/^tray-piece-/).first().click();
    await page.getByTestId('board-cell-0-0').click();
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
    const placed = await page
      .locator('[data-occupied="true"]')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-testid')).sort());

    await page.getByRole('button', { name: /watch the solver/i }).click();
    // By default the solver still starts from scratch.
    await expect(page.getByTestId('solver-start-empty')).toBeChecked();
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(0);
    await expect(page.getByTestId('arrangements')).toHaveText('12,800');

    await page.getByTestId('solver-start-attempt').check();
    // The board shows the starting point, and the haystack shrinks to the pieces left.
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
    await expect(page.getByTestId('arrangements')).not.toHaveText('12,800');
    await expect(page.getByTestId('solver-start-hint')).toContainText('keeps the 1 piece you placed');

    await page.getByTestId('start-solve').click();
    await page.getByRole('button', { name: /jump to the end/i }).click();
    await expect(page.getByTestId('solver-complete').or(page.getByTestId('solver-exhausted'))).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('comparison-panel')).toContainText('from 1 piece of yours');

    // Rewinding goes back to the player's piece, not to an empty board.
    await page.getByRole('button', { name: /restart/i }).click();
    const afterRewind = await page
      .locator('[data-occupied="true"]')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-testid')).sort());
    expect(afterRewind).toEqual(placed);

    // And the attempt itself is untouched when the solver is closed.
    await page.getByTestId('close-solver').click();
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
  });

  test('overlapping pieces cannot be a starting point', async ({ page }) => {
    await page.goto('/#/challenge/1');
    for (let i = 0; i < 2; i++) {
      await page.getByTestId(/^tray-piece-/).first().click();
      await page.getByTestId('board-cell-0-0').click();
    }
    await expect(page.getByTestId('invalid-feedback')).toBeVisible();

    await page.getByRole('button', { name: /watch the solver/i }).click();
    await expect(page.getByTestId('solver-start-attempt')).toBeDisabled();
    await expect(page.getByTestId('solver-start-hint')).toContainText('overlap');
  });
});
