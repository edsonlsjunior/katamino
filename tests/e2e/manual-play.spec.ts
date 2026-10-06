import { test, expect } from '@playwright/test';

// Covers quickstart.md Scenario 1 / User Story 1 acceptance scenarios. Full multi-piece
// solving is exercised by the store's integration tests (tests/integration/state);
// here we drive real browser interaction for placement, overlap feedback, reset, and
// the read side of completion persistence.
test.describe('Manual play', () => {
  test('select a challenge, place a piece, overlap another on it, fix it, then reset', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    const firstPiece = page.getByTestId(/^tray-piece-/).first();
    await firstPiece.click();
    await page.getByTestId('board-cell-0-0').click();
    await expect(page.getByTestId('board-cell-0-0')).toHaveAttribute('data-occupied', 'true');
    await expect(page.getByTestId('invalid-feedback')).toHaveCount(0);

    // A second piece may go on top of the first, but the overlap is flagged
    // both as a warning and on the board cells themselves.
    const secondPiece = page.getByTestId(/^tray-piece-/).first();
    await secondPiece.click();
    await page.getByTestId('board-cell-0-0').click();
    await expect(page.getByTestId('invalid-feedback')).toBeVisible();
    expect(await page.locator('[data-conflict="true"]').count()).toBeGreaterThan(0);
    await expect(page.getByTestId('solved-banner')).toHaveCount(0);

    // Lifting one of the two back off the board clears the warning; the other stays.
    await page.getByTestId('board-cell-0-0').click();
    await expect(page.getByTestId('held-piece')).toBeVisible();
    await expect(page.getByTestId('invalid-feedback')).toHaveCount(0);
    await expect(page.locator('[data-conflict="true"]')).toHaveCount(0);
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('invalid-feedback')).toBeVisible();

    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByTestId('board-cell-0-0')).toHaveAttribute('data-occupied', 'false');
    await expect(page.getByTestId('invalid-feedback')).toHaveCount(0);
  });

  test('a held piece follows the pointer and can be left loose anywhere off the board', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();

    await page.getByTestId(/^tray-piece-/).first().click();
    const held = page.getByTestId('held-piece');
    await expect(held).toBeVisible();

    // An empty spot of the arena, well away from the board: its bottom-left corner.
    const arena = (await page.locator('.board-arena').boundingBox())!;
    const spot = { x: arena.x + arena.width * 0.12, y: arena.y + arena.height * 0.85 };
    await page.mouse.move(spot.x, spot.y, { steps: 5 });
    const heldBox = (await held.boundingBox())!;
    expect(Math.abs(heldBox.x + heldBox.width / 2 - spot.x)).toBeLessThan(2);
    expect(Math.abs(heldBox.y + heldBox.height / 2 - spot.y)).toBeLessThan(2);

    await page.mouse.click(spot.x, spot.y);
    await expect(held).toHaveCount(0);
    const loose = page.getByTestId(/^free-piece-/);
    await expect(loose).toHaveCount(1);
    const looseBox = (await loose.boundingBox())!;
    // Stays where it was dropped (nudged inward only if it would leave the arena).
    expect(Math.abs(looseBox.x + looseBox.width / 2 - spot.x)).toBeLessThan(looseBox.width / 2);
    expect(Math.abs(looseBox.y + looseBox.height / 2 - spot.y)).toBeLessThan(looseBox.height / 2);
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(0);

    // A loose piece can be picked up again from where it lies.
    await loose.click();
    await expect(held).toBeVisible();
    await expect(loose).toHaveCount(0);
  });

  test('the browser context menu is suppressed everywhere, not just over the board', async ({ page }) => {
    const prevented = (selector: string) =>
      page.evaluate((sel) => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        document.querySelector(sel)!.dispatchEvent(event);
        return event.defaultPrevented;
      }, selector);

    await page.goto('/');
    expect(await prevented('header')).toBe(true);
    expect(await prevented('main')).toBe(true);

    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('board')).toBeVisible();
    expect(await prevented('header')).toBe(true);
    expect(await prevented('.manual-play-page__toolbar')).toBe(true);
    expect(await prevented('.board-arena')).toBe(true);
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
