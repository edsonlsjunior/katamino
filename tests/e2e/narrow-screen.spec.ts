import { test, expect } from '@playwright/test';

// On a narrow screen there is no room for the pieces around the board: they
// live in one scrolling strip, and the board may be drawn transposed (long
// side down the screen) when that makes its cells bigger.
test.describe('Narrow screens', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('a 12-piece challenge shows a tall board beside a strip with every piece, all inside the screen', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-453').getByRole('button', { name: /play/i }).click();

    const board = page.getByTestId('board');
    await expect(board).toHaveAttribute('data-transposed', 'true');
    const boardBox = (await board.boundingBox())!;
    expect(boardBox.height).toBeGreaterThan(boardBox.width * 2); // 12 cells down, 5 across

    // Cells are comfortably larger than the 12px floor the old layout hit here.
    const cell = (await page.getByTestId('board-cell-0-0').boundingBox())!;
    expect(cell.width).toBeGreaterThanOrEqual(24);
    expect(Math.round(cell.width)).toBe(Math.round(cell.height));

    await expect(page.getByTestId('piece-strip')).toBeVisible();
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(12);
    // Loose pieces are drawn at the board's cell size.
    const pieceCell = (await page.locator('.piece-shape__cell').first().boundingBox())!;
    expect(Math.round(pieceCell.width)).toBe(Math.round(cell.width));

    // Nothing makes the page scroll or sticks out sideways.
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
    });
    expect(overflow).toBe(false);
    const stripBox = (await page.getByTestId('piece-strip').boundingBox())!;
    expect(stripBox.x + stripBox.width).toBeLessThanOrEqual(390);
  });

  test('a piece lands where its preview shows, and dropping it on the strip puts it back', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-453').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toHaveAttribute('data-transposed', 'true');

    await page.getByTestId(/^tray-piece-/).first().click();
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(11); // the strip closes the gap

    // Hover a cell in the middle of the board: the preview marks 5 cells...
    await page.getByTestId('board-cell-2-6').hover();
    const preview = page.locator('.board-cell--ghost-valid');
    await expect(preview).toHaveCount(5);
    const previewed = await preview.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')).sort());

    // ...and those are exactly the cells the piece occupies once dropped,
    // each of them under where the held piece was drawn.
    const held = (await page.getByTestId('held-piece').boundingBox())!;
    await page.getByTestId('board-cell-2-6').click();
    const occupied = page.locator('[data-occupied="true"]');
    await expect(occupied).toHaveCount(5);
    expect(await occupied.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')).sort())).toEqual(
      previewed,
    );
    const pitch = (await page.getByTestId('board-cell-0-0').boundingBox())!.width + 2;
    for (const box of await occupied.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }),
    )) {
      // Within one cell of the held piece's box (it snaps to the grid on drop).
      expect(box.x).toBeGreaterThan(held.x - pitch);
      expect(box.x).toBeLessThan(held.x + held.width + pitch);
      expect(box.y).toBeGreaterThan(held.y - pitch);
      expect(box.y).toBeLessThan(held.y + held.height + pitch);
    }

    // Pick it back up and drop it on the strip: it is unplaced again, not left loose.
    await occupied.first().click();
    await expect(page.getByTestId('held-piece')).toBeVisible();
    const strip = (await page.getByTestId('piece-strip').boundingBox())!;
    await page.mouse.click(strip.x + strip.width / 2, strip.y + strip.height / 2);
    await expect(page.getByTestId('held-piece')).toHaveCount(0);
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(12);
    await expect(page.getByTestId(/^free-piece-/)).toHaveCount(0);
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(0);
  });

  test('the solver panel is a drawer that folds away when a run starts', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-453').getByRole('button', { name: /play/i }).click();
    await page.getByRole('button', { name: /watch the solver/i }).click();

    const toggle = page.getByTestId('solver-panel-toggle');
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId('criterion-dead-regions')).toBeVisible();

    await page.getByTestId('start-solve').click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('criterion-dead-regions')).toBeHidden();
    // The board keeps a usable size with the drawer folded and the playback bar showing.
    const cell = (await page.getByTestId('board-cell-0-0').boundingBox())!;
    expect(cell.width).toBeGreaterThanOrEqual(22);
    await expect(page.getByRole('button', { name: /^(pause|play)$/i })).toBeVisible();

    await toggle.click();
    await expect(page.getByTestId('criterion-dead-regions')).toBeVisible();
  });
});
