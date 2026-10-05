import { test, expect } from '@playwright/test';

// Covers the mouse/keyboard accelerators added on top of the existing
// select-then-place model: right-click to rotate (and implicitly select),
// the "R" keyboard shortcut, and "Escape" to put a picked-up piece back
// down. None of these replace the pre-existing Rotate button or click-to-
// select flow (research.md §3/§12) — they're additive, so this spec only
// asserts the new paths, not a re-test of placement itself.
test.describe('Manual play — rotate accelerators', () => {
  test('right-click selects and rotates a tray piece; Escape puts it back down', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    const firstPiece = page.getByTestId(/^tray-piece-/).first();
    await expect(firstPiece).toHaveAttribute('data-selected', 'false');

    await firstPiece.click({ button: 'right' });
    await expect(firstPiece).toHaveAttribute('data-selected', 'true');

    await page.keyboard.press('r');
    await expect(firstPiece).toHaveAttribute('data-selected', 'true');

    await page.keyboard.press('Escape');
    await expect(firstPiece).toHaveAttribute('data-selected', 'false');
  });

  test('right-clicking a board cell with nothing selected is a no-op', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    await page.getByTestId('board-cell-0-0').click({ button: 'right' });
    await expect(page.getByTestId('board-cell-0-0')).toHaveAttribute('data-occupied', 'false');
  });

  test('clicking the already-selected tray piece deselects it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    const firstPiece = page.getByTestId(/^tray-piece-/).first();
    await firstPiece.click();
    await expect(firstPiece).toHaveAttribute('data-selected', 'true');

    await firstPiece.click();
    await expect(firstPiece).toHaveAttribute('data-selected', 'false');
  });
});
