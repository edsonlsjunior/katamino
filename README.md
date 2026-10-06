# Katamino

A static web app for playing all 500 Katamino pentomino challenges by hand, or
watching two different combinatorial-optimization algorithms (exhaustive
backtracking vs. constraint-guided search) solve them step by step. Built to
teach combinatorial optimization concepts through visualization. Available in
Portuguese and English.

Runs entirely client-side (React + TypeScript + Vite), no backend — designed
to be hosted on GitHub Pages.

See [`specs/001-katamino-solver-teaching/`](specs/001-katamino-solver-teaching/)
for the full feature spec, plan, and task breakdown (this project uses
[Spec Kit](.specify/)).

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build the production bundle to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the codebase with Prettier |
| `npm run test:unit` | Run unit + integration tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run verify:challenges` | Verify all 500 challenges are solvable within the solver's step limit |
| `npm run generate:challenges` | Regenerate the 500-challenge dataset |

## Tech stack

- React 18 + TypeScript (strict mode), Vite
- Zustand for client state
- react-i18next / i18next for PT/EN localization
- Solvers run inside a Web Worker so the UI thread stays responsive
- Vitest + Testing Library (unit/integration), Playwright (E2E)

## Deployment

CI (`.github/workflows/ci.yml`) runs lint, build, unit tests, E2E tests, and
the challenge-solvability check on every push/PR. On push to `main`,
`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages.
