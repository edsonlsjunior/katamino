import { test, expect, type CDPSession, type Page } from '@playwright/test';

// By touch there is no pointer hovering around with a piece in hand: a piece
// is moved by dragging it and turned by tapping it. Playwright's own click()
// and hover() are mouse input even on a touch device, so these go through
// real touch points instead.
test.describe('Playing by touch', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true });

  interface Point {
    x: number;
    y: number;
  }

  async function touchscreen(page: Page) {
    const cdp: CDPSession = await page.context().newCDPSession(page);
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Point[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    return {
      down: (at: Point) => send('touchStart', [at]),
      async moveTo(from: Point, to: Point, steps = 8) {
        for (let i = 1; i <= steps; i++) {
          await send('touchMove', [
            { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps },
          ]);
        }
      },
      up: () => send('touchEnd', []),
      async drag(from: Point, to: Point) {
        await this.down(from);
        await this.moveTo(from, to);
        await this.up();
      },
    };
  }

  async function centre(page: Page, testId: string | RegExp): Promise<Point> {
    const box = (await page.getByTestId(testId).first().boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  type Touchscreen = Awaited<ReturnType<typeof touchscreen>>;

  /** Starts dragging the piece under `from` and stops, finger still down, with the piece over the middle of the board. */
  async function carryOverBoard(page: Page, touch: Touchscreen, from: Point): Promise<Point> {
    const board = (await page.getByTestId('board').boundingBox())!;
    const middle = { x: board.x + board.width / 2, y: board.y + board.height / 2 };
    await touch.down(from);
    await touch.moveTo(from, middle);
    // The piece is drawn above the finger: bring the piece, not the finger, to the middle.
    const held = (await page.getByTestId('held-piece').boundingBox())!;
    const finger = { x: middle.x, y: middle.y + (middle.y - (held.y + held.height / 2)) };
    await touch.moveTo(middle, finger, 3);
    return finger;
  }

  async function dragOntoBoard(page: Page, touch: Touchscreen, from: Point) {
    await carryOverBoard(page, touch, from);
    await touch.up();
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
  }

  const occupiedCells = (page: Page) =>
    page
      .locator('[data-occupied="true"]')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-testid')).sort());

  async function openChallenge(page: Page) {
    await page.goto('/#/challenge/1');
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(3);
  }

  test('dragging a piece carries it above the finger and drops it where its preview shows', async ({ page }) => {
    await openChallenge(page);
    const touch = await touchscreen(page);
    const finger = await carryOverBoard(page, touch, await centre(page, /^tray-piece-/));

    // In hand, off the strip, and drawn clear of the finger.
    const held = page.getByTestId('held-piece');
    await expect(held).toBeVisible();
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(2);
    const heldBox = (await held.boundingBox())!;
    expect(heldBox.y + heldBox.height).toBeLessThan(finger.y);

    const preview = page.locator('.board-cell--ghost-valid');
    await expect(preview).toHaveCount(5);
    const previewed = await preview.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')).sort());

    await touch.up();
    await expect(held).toHaveCount(0);
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
    expect(await occupiedCells(page)).toEqual(previewed);
  });

  test('tapping a piece turns it where it lies, and the buttons then act on it', async ({ page }) => {
    await openChallenge(page);
    const touch = await touchscreen(page);
    const rotate = page.getByRole('button', { name: /rotate/i });
    const flip = page.getByRole('button', { name: /flip/i });
    await expect(flip).toBeDisabled();

    // In the strip: the piece turns and stays there.
    const first = page.getByTestId(/^tray-piece-/).first();
    // Layout size, which a hover or press effect doesn't change.
    const shapeSize = () =>
      first.locator('.piece-shape').evaluate((el: HTMLElement) => ({ w: el.offsetWidth, h: el.offsetHeight }));
    const before = await shapeSize();
    await first.tap();
    await expect(page.getByTestId('held-piece')).toHaveCount(0);
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(3);
    await expect.poll(shapeSize).toEqual({ w: before.h, h: before.w });
    await expect(flip).toBeEnabled();

    // On the board: it turns in place, still on the board.
    await dragOntoBoard(page, touch, await centre(page, /^tray-piece-/));
    const placed = await occupiedCells(page);

    await page.locator('[data-occupied="true"]').first().tap();
    await expect(page.getByTestId('held-piece')).toHaveCount(0);
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
    await expect.poll(() => occupiedCells(page)).not.toEqual(placed);
    const turned = await occupiedCells(page);
    expect(turned).toHaveLength(5);

    // Rotate and Flip work on the piece just touched, without picking it up.
    await rotate.tap();
    await expect.poll(() => occupiedCells(page)).not.toEqual(turned);
    await flip.tap();
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(5);
    await expect(page.getByTestId('held-piece')).toHaveCount(0);
  });

  test('a piece dragged back onto the strip is unplaced again', async ({ page }) => {
    await openChallenge(page);
    const touch = await touchscreen(page);
    await dragOntoBoard(page, touch, await centre(page, /^tray-piece-/));
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(2);

    const cell = (await page.locator('[data-occupied="true"]').first().boundingBox())!;
    await touch.drag({ x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }, await centre(page, 'piece-strip'));
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(0);
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(3);
    await expect(page.locator('.board-arena__loose')).toHaveCount(0);
  });

  test('swiping along the strip scrolls it instead of taking a piece out', async ({ page }) => {
    await openChallenge(page);
    const touch = await touchscreen(page);
    const below = await page.locator('.board-arena').evaluate((el) => el.classList.contains('board-arena--strip-below'));
    const from = await centre(page, /^tray-piece-/);
    const to = below ? { x: from.x + 90, y: from.y } : { x: from.x, y: from.y + 90 };

    await touch.down(from);
    await touch.moveTo(from, to);
    await expect(page.getByTestId('held-piece')).toHaveCount(0);
    await touch.up();
    await expect(page.getByTestId(/^tray-piece-/)).toHaveCount(3);
    await expect(page.locator('[data-occupied="true"]')).toHaveCount(0);
  });
});
