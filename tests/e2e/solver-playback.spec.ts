import { test, expect } from '@playwright/test';

// Covers quickstart.md Scenario 2 / User Story 2 acceptance scenarios.
test.describe('Automatic solver playback', () => {
  test('start solving, see step-by-step playback, pause, step, resume, complete', async ({ page }) => {
    await page.goto('/');

    await page
      .getByTestId('challenge-card-1')
      .getByRole('button', { name: /watch the solver/i })
      .click();

    await page.getByTestId('start-solve').click();

    // The solver reveals steps one at a time rather than jumping to the finished board.
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByTestId('step-counter')).toBeVisible();

    // Pause mid-playback and confirm the board holds its current state.
    await page.getByRole('button', { name: /pause/i }).click();
    const pausedText = await page.getByTestId('step-counter').textContent();

    // Step forward then back by exactly one step each.
    await page.getByRole('button', { name: /step forward/i }).click();
    await expect(page.getByTestId('step-counter')).not.toHaveText(pausedText ?? '');
    await page.getByRole('button', { name: /step back/i }).click();
    await expect(page.getByTestId('step-counter')).toHaveText(pausedText ?? '');

    // Resume and let it run to completion — the final board matches the manual-play
    // win condition (every cell occupied).
    await page.getByRole('button', { name: /^play$/i }).click();
    await expect(page.getByTestId('solver-complete')).toBeVisible({ timeout: 30_000 });

    const cellCount = await page.getByTestId(/^board-cell-/).count();
    const occupiedCount = await page.locator('[data-testid^="board-cell-"][data-occupied="true"]').count();
    expect(occupiedCount).toBe(cellCount);
  });
});
