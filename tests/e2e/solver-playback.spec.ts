import { test, expect } from '@playwright/test';

// Covers quickstart.md Scenario 2 / User Story 2 acceptance scenarios.
test.describe('Automatic solver playback', () => {
  test('start solving, see step-by-step playback, pause, step, resume, complete', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await page.getByRole('button', { name: /watch the solver/i }).click();

    // Solver mode is the challenge screen itself, with the solver panel beside the board.
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByTestId('solver-panel')).toBeVisible();

    await page.getByTestId('start-solve').click();

    // The solver reveals steps one at a time rather than jumping to the finished board.
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
    // Every piece went from around the board onto it.
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(0);
  });

  test('the solver opens beside the game without leaving it, and closing it gives the attempt back', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    // An attempt in progress: one piece on the board.
    await page.getByTestId(/^tray-piece-/).first().click();
    await page.getByTestId('board-cell-0-0').click();
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);

    await page.getByRole('button', { name: /watch the solver/i }).click();
    await expect(page.getByTestId('solver-panel')).toBeVisible();
    // The solver starts from an empty board, with all the pieces around it and
    // none of the play controls.
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(0);
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(3);
    await expect(page.getByRole('button', { name: /reset/i })).toHaveCount(0);

    // In solver mode the pieces can't be picked up.
    await page.getByTestId(/^tray-piece-/).first().click();
    await expect(page.getByTestId('held-piece')).toHaveCount(0);

    await page.getByTestId('start-solve').click();
    await expect(page.getByTestId('solver-complete')).toBeVisible({ timeout: 30_000 });

    // Back to playing: the solver's board is gone and the attempt is as it was left.
    await page.getByTestId('close-solver').click();
    await expect(page.getByTestId('solver-panel')).toHaveCount(0);
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(2);
    await expect(page.getByRole('button', { name: /reset/i })).toBeVisible();
  });

  test('a search that is too big stops at the step limit and says so', async ({ page }) => {
    await page.goto('/');
    // The 12-piece bonus tier is the last column.
    await page.getByTestId('challenge-card-453').getByRole('button', { name: /play/i }).click();
    await page.getByRole('button', { name: /watch the solver/i }).click();
    await expect(page.getByTestId('solver-panel')).toBeVisible();

    // Plain search only: untick the two default criteria.
    for (const id of ['most-constrained-cell', 'dead-regions']) {
      await page.getByTestId(`criterion-${id}`).getByRole('checkbox').uncheck();
    }
    await page.getByTestId('start-solve').click();

    // Nobody watches 200,000 steps one by one: keep jumping to the latest
    // step until the solver gives up.
    const skip = page.getByRole('button', { name: /jump to the end/i });
    await expect(async () => {
      if (await skip.isEnabled()) await skip.click();
      await expect(page.getByTestId('solver-limit')).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 120_000 });
    await expect(page.getByTestId('solver-complete')).toHaveCount(0);
  });
});
