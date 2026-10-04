/// <reference lib="webworker" />
import { runSolve } from './solverEngine';
import type { SolveRequest, SolveResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const YIELD_EVERY_N_EVENTS = 2000;

let activeRequestId: string | null = null;

function post(message: SolveResponse) {
  self.postMessage(message);
}

async function handleRequest(request: SolveRequest): Promise<void> {
  activeRequestId = request.requestId;
  let sinceYield = 0;

  for (const event of runSolve(request)) {
    if (activeRequestId !== request.requestId) return; // superseded — drop remaining output
    post(event);

    if (++sinceYield >= YIELD_EVERY_N_EVENTS) {
      sinceYield = 0;
      // Give the event loop a chance to deliver a newer SolveRequest.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  const request = event.data;
  if (request?.type !== 'solve') return;
  void handleRequest(request);
};
