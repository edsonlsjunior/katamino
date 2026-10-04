import { test, expect } from '@playwright/test';

// Covers quickstart.md Scenario 3 / User Story 3 acceptance scenarios.
test.describe('Strategy comparison', () => {
  test('running two strategies on the same challenge shows distinguishable metrics and a comparison', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByTestId('challenge-card-1')
      .getByRole('button', { name: /watch the solver/i })
      .click();

    // Run 1: backtracking (default selection).
    await page.getByTestId('start-solve').click();
    await expect(page.getByTestId('solver-complete')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('metrics-panel')).toBeVisible();
    const firstStepText = await page.getByTestId('metrics-step').textContent();

    // Run 2: constraint-guided, on the same challenge.
    await page.getByRole('radio').nth(1).check();
    await page.getByTestId('start-solve').click();
    await expect(page.getByTestId('solver-complete')).toBeVisible({ timeout: 30_000 });
    const secondStepText = await page.getByTestId('metrics-step').textContent();

    // The two runs are visibly different, and a side-by-side comparison is shown.
    expect(secondStepText).not.toBe(firstStepText);
    await expect(page.getByTestId('comparison-panel')).toBeVisible();
  });

  test('switching language updates the strategy descriptions', async ({ page }) => {
    await page.goto('/');
    await page
      .getByTestId('challenge-card-1')
      .getByRole('button', { name: /watch the solver/i })
      .click();

    await expect(page.getByText('Try, undo, try again')).toBeVisible();
    await page.getByRole('button', { name: 'Português' }).click();
    await expect(page.getByText('Tentar, desfazer, tentar de novo')).toBeVisible();
  });
});
