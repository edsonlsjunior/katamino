import { test, expect } from '@playwright/test';

// Covers quickstart.md Scenario 1 / User Story 1 acceptance scenarios. Full multi-piece
// solving is exercised by the store's integration tests (tests/integration/state);
// here we drive real browser interaction for placement, invalid feedback, reset, and
// the read side of completion persistence.
test.describe('Manual play', () => {
  test('select a challenge, place a piece, get invalid feedback on overlap, then reset', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    const firstPiece = page.getByTestId(/^tray-piece-/).first();
    await firstPiece.click();
    await page.getByTestId('board-cell-0-0').click();
    await expect(page.getByTestId('board-cell-0-0')).toHaveAttribute('data-occupied', 'true');

    // Selecting the next piece and trying to occupy the same cell must be rejected.
    const secondPiece = page.getByTestId(/^tray-piece-/).first();
    await secondPiece.click();
    await page.getByTestId('board-cell-0-0').click();
    await expect(page.getByTestId('invalid-feedback')).toBeVisible();

    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByTestId('board-cell-0-0')).toHaveAttribute('data-occupied', 'false');
  });

  test('a challenge marked completed in storage shows as completed after reload (FR-007, SC-004)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem(
        'katamino:v1:progress',
        JSON.stringify({ version: 1, completed: { 1: true } }),
      );
    });
    await page.reload();
    await expect(page.getByTestId('challenge-card-1')).toHaveAttribute('data-completed', 'true');
    await expect(page.getByTestId('challenge-card-2')).toHaveAttribute('data-completed', 'false');
  });
});
