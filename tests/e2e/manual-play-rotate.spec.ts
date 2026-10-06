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

  // Regression: the landing preview was briefly computed with the previous
  // orientation's position, which near the edge fell outside the board and
  // crashed the whole screen.
  test('rotating and mirroring a held piece over the edge of the board keeps the game alive', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    // P and U fit the 3-column board in every orientation.
    for (const [type, cell] of [
      ['P', 'board-cell-4-2'],
      ['U', 'board-cell-0-2'],
    ]) {
      await page.getByTestId(new RegExp(`^tray-piece-piece-${type}-`)).click();
      await page.getByTestId(cell).hover();
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press(i % 3 === 2 ? 'e' : 'r');
        await page.getByTestId(cell).click({ button: 'right' });
      }
      await expect(page.getByTestId('board')).toBeVisible();
      await expect(page.getByTestId('held-piece')).toBeVisible();
      // The preview is always the 5 cells where the piece would actually land.
      await expect(page.locator('.board-cell--ghost-valid, .board-cell--ghost-invalid')).toHaveCount(5);
      await page.getByTestId(cell).click();
      await expect(page.getByTestId('held-piece')).toHaveCount(0);
    }
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
    const center = async () => {
      const box = (await held.boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y + 5, { steps: 6 });
    // While the button is down the piece stays where the press started...
    expect(await heldCells(page)).toEqual(original);
    expect(Math.abs((await center()).x - start.x)).toBeLessThan(2);
    expect(Math.abs((await center()).y - start.y)).toBeLessThan(2);
    // ...and goes back to following the pointer once it is released.
    await page.mouse.up();
    expect(Math.abs((await center()).x - (start.x + 80))).toBeLessThan(2);
    expect(Math.abs((await center()).y - (start.y + 5))).toBeLessThan(2);
    expect(await heldCells(page)).toEqual(original);

    // The mirroring keeps tracking the pointer for as long as the button is
    // down: up/down mirrors top-bottom, sideways left-right, and coming back
    // to where the press started undoes it.
    const from = { x: start.x + 80, y: start.y + 5 };
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 80, { steps: 6 });
    expect(await heldCells(page)).toEqual(mirrored(original, 'vertical'));
    await page.mouse.move(from.x - 90, from.y - 10, { steps: 6 });
    expect(await heldCells(page)).toEqual(mirrored(original, 'horizontal'));
    await page.mouse.move(from.x + 4, from.y + 4, { steps: 6 });
    expect(await heldCells(page)).toEqual(original);
    await page.mouse.move(from.x + 10, from.y + 70, { steps: 6 });
    expect(await heldCells(page)).toEqual(mirrored(original, 'vertical'));
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
    // Picked up, but held where it was grabbed until the button is released.
    const grabbed = (await page.getByTestId('held-piece').boundingBox())!;
    expect(Math.abs(grabbed.x + grabbed.width / 2 - from.x)).toBeLessThan(2);
    await page.mouse.up();
    const released = (await page.getByTestId('held-piece').boundingBox())!;
    expect(Math.abs(released.x + released.width / 2 - (from.x + 60))).toBeLessThan(2);

    await expect(page.getByTestId('held-piece')).toBeVisible();
    expect(await heldCells(page)).toEqual(mirrored(original, 'horizontal'));
  });
});
