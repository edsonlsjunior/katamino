import { test, expect } from '@playwright/test';

// Covers the mouse/keyboard accelerators on top of the pick-up-then-drop
// model: right-click to rotate (picking the piece up first if needed), the
// "R" keyboard shortcut, and "Escape" to put a held piece back where it
// came from. None of these replace the always-present Rotate button
// (research.md §3/§12) — they're additive, so this spec only asserts these
// paths, not a re-test of placement itself.
test.describe('Manual play — rotate accelerators', () => {
  test('right-click picks up and rotates a piece; Escape puts it back down', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    const firstPiece = page.getByTestId(/^tray-piece-/).first();
    await expect(firstPiece).toHaveAttribute('data-selected', 'false');

    await firstPiece.click({ button: 'right' });
    await expect(firstPiece).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('held-piece')).toBeVisible();

    await page.keyboard.press('r');
    await expect(firstPiece).toHaveAttribute('data-selected', 'true');

    await page.keyboard.press('Escape');
    await expect(firstPiece).toHaveAttribute('data-selected', 'false');
    await expect(page.getByTestId('held-piece')).toHaveCount(0);
  });

  test('right-click rotates the held piece even away from the board', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    await page.getByTestId(/^tray-piece-/).first().click();
    const held = page.getByTestId('held-piece');
    const before = (await held.boundingBox())!;

    // Over the app header: nowhere near the board or the pieces.
    await page.locator('header h1').click({ button: 'right' });
    const after = (await held.boundingBox())!;
    expect(Math.round(after.width)).toBe(Math.round(before.height));
    expect(Math.round(after.height)).toBe(Math.round(before.width));
  });

  test('right-clicking a board cell with nothing held is a no-op', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    await page.getByTestId('board-cell-0-0').click({ button: 'right' });
    await expect(page.getByTestId('board-cell-0-0')).toHaveAttribute('data-occupied', 'false');
    await expect(page.getByTestId('held-piece')).toHaveCount(0);
  });
});
