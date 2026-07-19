import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApplyOperationStatus } from "../types/backend.generated";
import { waitForApplyOperation } from "./waitForApplyOperation";

function status(
  phase: ApplyOperationStatus["phase"],
  report = phase === "completed" || phase === "cancelled"
    ? {
        applied_tweaks: [],
        committed_change_count: 0,
        restart_requirement: "none" as const,
        warnings: [],
      }
    : undefined,
): ApplyOperationStatus {
  return { task_id: "task-1", phase, events: [], report };
}

describe("waitForApplyOperation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["completed", "cancelled", "failed"] as const)(
    "returns the %s terminal phase",
    async (phase) => {
      const terminal = status(phase);
      if (phase === "failed") terminal.error = "Access denied";

      await expect(
        waitForApplyOperation("task-1", { readStatus: async () => terminal }),
      ).resolves.toEqual(terminal);
    },
  );

  it("reports an unreadable or missing task instead of treating it as success", async () => {
    const result = waitForApplyOperation("task-1", {
      readStatus: async () => {
        throw new Error("unknown registry apply task");
      },
    });

    await expect(result).rejects.toMatchObject({
      code: "unavailable",
      message: expect.stringContaining("may no longer exist"),
    });
  });

  it("times out even when a status request never settles", async () => {
    vi.useFakeTimers();
    const result = waitForApplyOperation("task-1", {
      readStatus: () => new Promise(() => undefined),
      timeoutMs: 1_000,
    });
    const assertion = expect(result).rejects.toMatchObject({
      code: "timeout",
      message: expect.stringContaining("did not finish within 1 seconds"),
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("stops polling when aborted", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const readStatus = vi.fn(async () => status("running", undefined));
    const result = waitForApplyOperation("task-1", {
      readStatus,
      signal: controller.signal,
      pollIntervalMs: 250,
    });
    const assertion = expect(result).rejects.toMatchObject({
      code: "aborted",
    });

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await assertion;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readStatus).toHaveBeenCalledTimes(1);
  });

  it("rejects a success response that has no final report", async () => {
    const result = waitForApplyOperation("task-1", {
      readStatus: async () => ({ ...status("completed"), report: undefined }),
    });

    await expect(result).rejects.toMatchObject({
      code: "invalid_response",
      message: expect.stringContaining("without a final report"),
    });
  });
});
