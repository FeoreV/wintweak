import type { ApplyOperationStatus } from "../types/backend.generated";

export const APPLY_OPERATION_POLL_INTERVAL_MS = 250;
export const APPLY_OPERATION_TIMEOUT_MS = 120_000;

export type ApplyOperationWaitErrorCode =
  | "aborted"
  | "invalid_response"
  | "timeout"
  | "unavailable";

export class ApplyOperationWaitError extends Error {
  readonly code: ApplyOperationWaitErrorCode;

  constructor(code: ApplyOperationWaitErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApplyOperationWaitError";
    this.code = code;
  }
}

type WaitForApplyOperationOptions = {
  readStatus: (taskId: string) => Promise<ApplyOperationStatus>;
  onStatus?: (status: ApplyOperationStatus) => void;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

const TERMINAL_PHASES = new Set<ApplyOperationStatus["phase"]>([
  "completed",
  "cancelled",
  "failed",
]);

export async function waitForApplyOperation(
  taskId: string,
  {
    readStatus,
    onStatus,
    signal,
    pollIntervalMs = APPLY_OPERATION_POLL_INTERVAL_MS,
    timeoutMs = APPLY_OPERATION_TIMEOUT_MS,
  }: WaitForApplyOperationOptions,
): Promise<ApplyOperationStatus> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    throwIfAborted(signal);
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw timeoutError(timeoutMs);

    let status: ApplyOperationStatus;
    try {
      status = await raceWithDeadline(readStatus(taskId), remainingMs, signal, timeoutMs);
    } catch (error) {
      if (error instanceof ApplyOperationWaitError) throw error;
      throw new ApplyOperationWaitError(
        "unavailable",
        "WinTweak could not read the registry apply task. The task may no longer exist; its outcome was not treated as successful.",
        { cause: error },
      );
    }

    throwIfAborted(signal);
    if (status.task_id !== taskId) {
      throw new ApplyOperationWaitError(
        "invalid_response",
        "WinTweak received a status for a different registry apply task. The operation outcome could not be confirmed.",
      );
    }
    onStatus?.(status);

    if (TERMINAL_PHASES.has(status.phase)) {
      if (status.phase !== "failed" && !status.report) {
        throw new ApplyOperationWaitError(
          "invalid_response",
          `The registry apply task finished as ${status.phase} without a final report. The operation outcome could not be confirmed.`,
        );
      }
      return status;
    }

    const delayMs = Math.min(pollIntervalMs, deadline - Date.now());
    if (delayMs <= 0) throw timeoutError(timeoutMs);
    await abortableDelay(delayMs, signal);
  }
}

function raceWithDeadline<T>(
  operation: Promise<T>,
  remainingMs: number,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const timeoutId = setTimeout(() => finish(() => reject(timeoutError(timeoutMs))), remainingMs);
    const abort = () => finish(() => reject(abortedError()));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    operation.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

function abortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (callback: () => void) => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const timeoutId = setTimeout(() => finish(resolve), delayMs);
    const abort = () => {
      finish(() => reject(abortedError()));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortedError();
}

function abortedError(): ApplyOperationWaitError {
  return new ApplyOperationWaitError("aborted", "Registry apply monitoring was stopped.");
}

function timeoutError(timeoutMs: number): ApplyOperationWaitError {
  const seconds = Math.ceil(timeoutMs / 1_000);
  return new ApplyOperationWaitError(
    "timeout",
    `The registry apply task did not finish within ${seconds} seconds. Its outcome was not treated as successful.`,
  );
}
