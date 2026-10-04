/**
 * Pure dispatch logic shared by the real Web Worker entry point (solver.worker.ts)
 * and by unit tests: given a SolveRequest, runs the chosen strategy and yields the
 * SolveResponse stream described in contracts/solver-worker-protocol.md. Kept free
 * of any `self`/`postMessage` so it's testable without spinning up a real worker.
 */
import { solveBacktracking } from '../solvers/backtracking';
import { solveConstraintGuided } from '../solvers/constraintGuided';
import type { Challenge, SolveStep, SolvingStrategyId } from '../domain/types';
import type { SolveRequest, SolveResponse } from './protocol';

type SolverGenerator = Generator<SolveStep, { backtrackCount: number; solvedAtStepIndex: number }, void>;

const STRATEGIES: Record<SolvingStrategyId, (challenge: Challenge) => SolverGenerator> = {
  backtracking: solveBacktracking,
  'constraint-guided': solveConstraintGuided,
};

export function* runSolve(request: SolveRequest): Generator<SolveResponse, void, void> {
  const { requestId, challenge, strategyId } = request;
  const run = STRATEGIES[strategyId];
  if (!run) {
    yield { type: 'error', requestId, message: `Unknown solving strategy: ${strategyId}` };
    return;
  }

  yield { type: 'started', requestId };

  try {
    let totalSteps = 0;
    const gen = run(challenge);
    let result = gen.next();
    while (!result.done) {
      totalSteps++;
      yield { type: 'step', requestId, step: result.value };
      result = gen.next();
    }
    const { backtrackCount, solvedAtStepIndex } = result.value;
    yield { type: 'done', requestId, totalSteps, backtrackCount, solvedAtStepIndex };
  } catch (error) {
    yield {
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : 'Unknown solver error',
    };
  }
}
