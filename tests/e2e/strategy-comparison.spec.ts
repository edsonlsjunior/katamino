import { test, expect } from '@playwright/test';

// Covers quickstart.md Scenario 3 / User Story 3 acceptance scenarios.
test.describe('Strategy criteria', () => {
  test('the strategy is a list of criteria that can be ticked and expanded', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await page.getByRole('button', { name: /watch the solver/i }).click();

    // The plain search is always there and can't be switched off.
    const base = page.getByTestId('criterion-base');
    await expect(base.getByRole('checkbox')).toBeChecked();
    await expect(base.getByRole('checkbox')).toBeDisabled();

    // Each criterion is independent of the others.
    const cells = page.getByTestId('criterion-stranded-cells');
    const regions = page.getByTestId('criterion-dead-regions');
    await expect(cells.getByRole('checkbox')).not.toBeChecked();
    await expect(regions.getByRole('checkbox')).toBeChecked();
    await cells.getByRole('checkbox').check();
    await expect(cells.getByRole('checkbox')).toBeChecked();
    await expect(regions.getByRole('checkbox')).toBeChecked();

    // ...and expands into an explanation of what it does.
    await expect(cells.getByText(/has no candidate left/i)).toHaveCount(0);
    await cells.getByRole('button', { name: /explain/i }).click();
    await expect(cells.getByText(/has no candidate left/i)).toBeVisible();
    await cells.getByRole('button', { name: /hide the explanation/i }).click();
    await expect(cells.getByText(/has no candidate left/i)).toHaveCount(0);
  });

  test('criteria are grouped into ordering and pruning ones', async ({ page }) => {
    await page.goto('/#/challenge/1/solver');

    const order = page.getByTestId('criteria-group-order');
    const prune = page.getByTestId('criteria-group-prune');
    await expect(order.getByRole('heading')).toHaveText('Ordering criteria');
    await expect(prune.getByRole('heading')).toHaveText('Pruning criteria');
    await expect(order.locator('[data-testid^="criterion-"]')).toHaveCount(2);
    await expect(order.getByTestId('criterion-most-constrained-cell')).toBeVisible();
    await expect(prune.locator('li[data-testid^="criterion-"]')).toHaveCount(3);
    await expect(prune.getByTestId('criterion-dead-regions')).toBeVisible();
  });

  test('the panel says how many combinations the challenge has', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await page.getByRole('button', { name: /watch the solver/i }).click();
    // Challenge #1: P, U and Y on a 5x3 board.
    await expect(page.getByTestId('arrangements')).toHaveText('12,800');
  });

  test('running two sets of criteria on the same challenge shows distinguishable metrics and a comparison', async ({
    page,
  }) => {
    await page.goto('/');
    // Challenge #353 (7 pieces): without hardest-square-first it takes far more steps.
    await page.getByTestId('challenge-card-353').getByRole('button', { name: /play/i }).click();
    await page.getByRole('button', { name: /watch the solver/i }).click();
    await page.getByTestId('start-solve').click();
    await page.getByLabel(/speed/i).selectOption('1000');

    // Run 1: the default criteria.
    await expect(page.getByTestId('solver-complete')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('metrics-panel')).toBeVisible();
    const firstStepText = await page.getByTestId('metrics-step').textContent();

    // Run 2: the same challenge without hardest-square-first. (On a narrow
    // screen the panel folded itself away when the run started.)
    const toggle = page.getByTestId('solver-panel-toggle');
    if ((await toggle.isVisible()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    await page.getByTestId('criterion-most-constrained-cell').getByRole('checkbox').uncheck();
    await page.getByTestId('start-solve').click();
    await expect(page.getByTestId('solver-complete')).toBeVisible({ timeout: 30_000 });
    const secondStepText = await page.getByTestId('metrics-step').textContent();
    // A pruning criterion reports how many branches it cut.
    await expect(page.getByTestId('criterion-cuts-dead-regions')).toHaveText(/^[1-9][\d,]* cuts?$/);

    // The two runs are visibly different, and both are listed side by side (latest first).
    expect(secondStepText).not.toBe(firstStepText);
    const runs = page.getByTestId('comparison-panel').locator('tbody tr');
    await expect(runs).toHaveCount(2);
    await expect(runs.first()).not.toContainText('Hardest square first');
    await expect(runs.last()).toContainText('Hardest square first');
  });

  test('switching language updates the criteria texts', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('challenge-card-1').getByRole('button', { name: /play/i }).click();
    await page.getByRole('button', { name: /watch the solver/i }).click();

    await expect(page.getByText('Try, undo, try again')).toBeVisible();
    await page.locator('.app-header').getByTestId('language-menu').click();
    await page.getByRole('option', { name: 'Português' }).click();
    await expect(page.getByText('Tentar, desfazer, tentar de novo')).toBeVisible();
    await expect(page.getByText('Casa mais difícil primeiro')).toBeVisible();
  });
});
