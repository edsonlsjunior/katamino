/**
 * Pure dispatch logic shared by the real Web Worker entry point (solver.worker.ts)
 * and by unit tests: given a SolveRequest, runs the solver with the requested
 * criteria and yields the SolveResponse stream described in
 * contracts/solver-worker-protocol.md. Kept free of any `self`/`postMessage` so
 * it's testable without spinning up a real worker.
 */
import { solve } from '../solvers/configurableSolver';
import { isCriterionId } from '../solvers/criteria';
import type { SolveRequest, SolveResponse } from './protocol';

export function* runSolve(request: SolveRequest): Generator<SolveResponse, void, void> {
  const { requestId, challenge, criteria, maxSteps, start } = request;
  const unknown = criteria.find((id) => !isCriterionId(id));
  if (unknown !== undefined) {
    yield { type: 'error', requestId, message: `Unknown solving criterion: ${unknown}` };
    return;
  }

  yield { type: 'started', requestId };

  try {
    let totalSteps = 0;
    const gen = solve(challenge, criteria, { start, ...(maxSteps === undefined ? {} : { maxSteps }) });
    let result = gen.next();
    while (!result.done) {
      totalSteps++;
      yield { type: 'step', requestId, step: result.value };
      result = gen.next();
    }
    yield { type: 'done', requestId, totalSteps, ...result.value };
  } catch (error) {
    yield {
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : 'Unknown solver error',
    };
  }
}
