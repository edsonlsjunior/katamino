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

    const trayPieces = page.getByTestId(/^tray-piece-/);
    const total = await trayPieces.count();
    const held = page.getByTestId('held-piece');

    // Once in hand, the piece is gone from its starting slot.
    await trayPieces.first().click({ button: 'right' });
    await expect(held).toBeVisible();
    await expect(trayPieces).toHaveCount(total - 1);

    await page.keyboard.press('r');
    await expect(held).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(held).toHaveCount(0);
    await expect(trayPieces).toHaveCount(total);
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

test.describe('Manual play — mirror accelerators', () => {
  // The held piece's cells as sorted "row,col" pairs (1-based grid lines).
  async function heldCells(page: import('@playwright/test').Page): Promise<Array<[number, number]>> {
    const cells = await page
      .getByTestId('held-piece')
      .locator('.piece-shape__cell')
      .evaluateAll((els) =>
        els.map((el) => {
          const style = (el as HTMLElement).style;
          return [parseInt(style.gridRowStart, 10), parseInt(style.gridColumnStart, 10)] as [number, number];
        }),
      );
    return cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  function mirrored(cells: Array<[number, number]>, axis: 'horizontal' | 'vertical') {
    const maxRow = Math.max(...cells.map(([r]) => r));
    const maxCol = Math.max(...cells.map(([, c]) => c));
    return cells
      .map(([r, c]) => (axis === 'horizontal' ? [r, maxCol + 1 - c] : [maxRow + 1 - r, c]) as [number, number])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  test('"E" mirrors the held piece; dragging mirrors it along the dragged direction', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    // The P piece: asymmetric both left-right and top-bottom.
    await page.getByTestId(/^tray-piece-piece-P-/).click();
    const held = page.getByTestId('held-piece');
    await expect(held).toBeVisible();
    const original = await heldCells(page);
    expect(mirrored(original, 'horizontal')).not.toEqual(original);
    expect(mirrored(original, 'vertical')).not.toEqual(original);

    await page.keyboard.press('e');
    expect(await heldCells(page)).toEqual(mirrored(original, 'horizontal'));

    // Sideways drag: mirrored left-right again, i.e. back to the original.
    const arena = (await page.locator('.board-arena').boundingBox())!;
    const start = { x: arena.x + arena.width * 0.15, y: arena.y + arena.height * 0.8 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y + 5, { steps: 6 });
    await page.mouse.up();
    expect(await heldCells(page)).toEqual(original);

    // Vertical drag: mirrored top-bottom.
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y - 80, { steps: 6 });
    await page.mouse.up();
    expect(await heldCells(page)).toEqual(mirrored(original, 'vertical'));

    // Neither drag dropped the piece.
    await expect(held).toBeVisible();
    await expect(page.getByTestId(/^free-piece-/)).toHaveCount(0);
  });

  test('dragging a piece that is not in hand picks it up and mirrors it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    const piece = page.getByTestId(/^tray-piece-piece-P-/);
    const box = (await piece.boundingBox())!;
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    // Reference: the same piece picked up with a plain click.
    await piece.click();
    const original = await heldCells(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('held-piece')).toHaveCount(0);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y, { steps: 6 });
    await page.mouse.up();

    await expect(page.getByTestId('held-piece')).toBeVisible();
    expect(await heldCells(page)).toEqual(mirrored(original, 'horizontal'));
  });
});
