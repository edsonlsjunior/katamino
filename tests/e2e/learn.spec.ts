import { test, expect } from '@playwright/test';

test.describe('How it works page', () => {
  test('is reached from the header and explains the search', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'How it works' }).click();

    await expect(page).toHaveURL(/#\/learn$/);
    await expect(page.getByRole('heading', { name: 'How the solver thinks' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /depth-first search with backtracking/i }),
    ).toBeVisible();
    await expect(page.getByText(/A\*/)).toHaveCount(0);
    // Ordering criteria are a bet; pruning ones never add attempts.
    await expect(page.getByTestId('learn-kinds')).toContainText('Never raise them');
    // Challenge #2: L, P, T and V on a 5x4 board.
    await expect(page.getByTestId('learn-product-total')).toHaveText('1,566,720');
  });

  test('the pieces gallery shows every way a piece can be placed', async ({ page }) => {
    await page.goto('/#/learn');

    const orientations = page.getByTestId('learn-orientations');
    await expect(orientations.locator('.piece-orientations__item')).toHaveCount(8);

    await page.getByTestId('learn-piece-X').click();
    await expect(orientations).toContainText('Piece X can only be placed 1 way');
    await expect(orientations.locator('.piece-orientations__item')).toHaveCount(1);
  });

  test('the lab draws the search tree and shrinks it as criteria are switched on', async ({ page }) => {
    await page.goto('/#/learn');

    const lab = page.getByTestId('tree-lab');
    const nodes = lab.locator('.tree-node');
    // Plain search on challenge #2: the empty board plus 31 attempts, none of them cut.
    await expect(page.getByTestId('tree-lab-tried')).toHaveText('31');
    await expect(nodes).toHaveCount(32);
    await expect(lab.locator('[data-status="pruned"]')).toHaveCount(0);
    await expect(lab.locator('[data-status="solution"]')).toHaveCount(5);

    await page.getByTestId('tree-lab-criterion-most-constrained-cell').check();
    await expect(page.getByTestId('tree-lab-tried')).toHaveText('13');
    await expect(page.getByTestId('tree-lab-comparison')).toContainText('58% fewer attempts');

    await page.getByTestId('tree-lab-criterion-stranded-cells').check();
    await expect(lab.locator('[data-status="pruned"]').first()).toBeVisible();
    await expect(page.getByTestId('tree-lab-cuts')).not.toHaveText('0');

    // Clicking a board that was cut says which criterion cut it.
    await lab.locator('[data-status="pruned"]').first().click();
    await expect(page.getByTestId('tree-lab-detail')).toContainText('No square left without a way out');
  });

  test('the search can be replayed step by step', async ({ page }) => {
    await page.goto('/#/learn');

    const lab = page.getByTestId('tree-lab');
    await expect(page.getByTestId('tree-lab-step')).toHaveText('Step 58 of 58');

    // At the very start there is only the empty board.
    await page.getByLabel('Search step').fill('0');
    await expect(lab.locator('.tree-node')).toHaveCount(1);
    await page.getByLabel('Search step').fill('1');
    await expect(lab.locator('.tree-node')).toHaveCount(2);
    await expect(lab.locator('[data-status="open"]')).toHaveCount(2);

    await page.getByTestId('tree-lab-play').click();
    await expect(page.getByTestId('tree-lab-step')).not.toHaveText('Step 1 of 58');
    await page.getByRole('button', { name: 'Show everything' }).click();
    await expect(lab.locator('.tree-node')).toHaveCount(32);
  });

  test('the solver panel and the about page link to it', async ({ page }) => {
    await page.goto('/#/challenge/1/solver');
    // Pruning criteria come first in the solver panel.
    await expect(page.locator('[data-testid^="criteria-group-"]').first()).toHaveAttribute(
      'data-testid',
      'criteria-group-prune',
    );
    await page.getByTestId('solver-learn-more').click();
    await expect(page).toHaveURL(/#\/learn$/);
    await expect(page.getByRole('heading', { name: 'How the solver thinks' })).toBeVisible();

    await page.goto('/#/about');
    await page.getByTestId('about-learn-link').click();
    await expect(page.getByRole('heading', { name: 'How the solver thinks' })).toBeVisible();
  });

  test('the closing button opens a challenge in the real solver', async ({ page }) => {
    await page.goto('/#/learn');
    await page.getByTestId('learn-open-solver').click();

    await expect(page).toHaveURL(/#\/challenge\/5\/solver$/);
    await expect(page.getByTestId('solver-panel')).toBeVisible();
  });
});
