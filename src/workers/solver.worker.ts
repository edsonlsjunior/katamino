/// <reference lib="webworker" />
import { runSolve } from './solverEngine';
import type { SolveRequest, WorkerMessage, WorkerRequest } from './protocol';
import type { SolveStep } from '../domain/types';

declare const self: DedicatedWorkerGlobalScope;

/** Steps are sent in batches: whichever of these comes first closes one. */
const MAX_BATCH_SIZE = 2000;
const MAX_BATCH_MS = 40;

let activeRequestId: string | null = null;

// Yields to the event loop without setTimeout's minimum delay, which adds up
// to most of the run time over the hundreds of batches of a long search.
const yieldChannel = new MessageChannel();
function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    yieldChannel.port1.onmessage = () => resolve();
    yieldChannel.port2.postMessage(null);
  });
}

function post(message: WorkerMessage) {
  self.postMessage(message);
}

async function handleRequest(request: SolveRequest): Promise<void> {
  const { requestId } = request;
  activeRequestId = requestId;
  let batch: SolveStep[] = [];
  let batchStartedAt = performance.now();

  // Sends what has accumulated, then gives the event loop a turn so a newer
  // request or a cancel can get through. Returns false if this run was superseded.
  async function flush(): Promise<boolean> {
    if (batch.length > 0) {
      post({ type: 'steps', requestId, steps: batch });
      batch = [];
    }
    await nextTask();
    batchStartedAt = performance.now();
    return activeRequestId === requestId;
  }

  for (const event of runSolve(request)) {
    if (event.type === 'step') {
      batch.push(event.step);
      // The first step goes out on its own so playback can start right away.
      const due =
        event.step.index === 0 ||
        batch.length >= MAX_BATCH_SIZE ||
        performance.now() - batchStartedAt >= MAX_BATCH_MS;
      if (due && !(await flush())) return;
      continue;
    }
    if (!(await flush())) return;
    post(event);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request?.type === 'cancel') {
    activeRequestId = null;
    return;
  }
  if (request?.type !== 'solve') return;
  void handleRequest(request);
};
