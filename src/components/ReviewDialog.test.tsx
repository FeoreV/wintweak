import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import type { ApplyBatchReport, ApplyOperationStatus } from "../types/backend.generated";
import { ReviewDialog } from "./ReviewDialog";

const report: ApplyBatchReport = {
  session_id: "recovery-1",
  applied_tweaks: ["disable_advertising_id"],
  committed_change_count: 1,
  restart_requirement: "none",
  warnings: [],
};

function operation(
  phase: ApplyOperationStatus["phase"],
  overrides: Partial<ApplyOperationStatus> = {},
): ApplyOperationStatus {
  return {
    task_id: "task-1",
    phase,
    events: [{ kind: "batch_started", total_tweaks: 1, total_changes: 2 }],
    ...overrides,
  };
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof ReviewDialog>> = {}): void {
  render(
    <ReviewDialog
      open
      loading={false}
      error={false}
      applying={false}
      cancelAvailable={false}
      cancelling={false}
      restoring={false}
      restored={false}
      onOpenChange={vi.fn()}
      onApply={vi.fn()}
      onCancelApply={vi.fn()}
      onRestore={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ReviewDialog terminal states", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(async () => {
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("shows active apply progress", () => {
    renderDialog({ applying: true, cancelAvailable: true, operation: operation("running") });

    expect(screen.getByText("Applying reviewed changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel apply" })).toBeEnabled();
  });

  it("shows successful apply completion", () => {
    renderDialog({ operation: operation("completed", { report }), report });

    expect(screen.getAllByText("Changes applied safely")).not.toHaveLength(0);
    expect(document.querySelector('[data-outcome="completed"]')).toBeInTheDocument();
  });

  it("shows cancellation with partial progress", () => {
    renderDialog({ operation: operation("cancelled", { report }), report });

    expect(screen.getAllByText("Apply cancelled safely")).not.toHaveLength(0);
    expect(
      screen.getByText("1 registry changes were committed and remain recoverable."),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-outcome="cancelled"]')).toBeInTheDocument();
  });

  it("shows a timeout or waiter failure as a terminal error", () => {
    renderDialog({
      operation: operation("running"),
      applyError: "The registry apply task did not finish within 120 seconds.",
    });

    expect(screen.getAllByText("Apply stopped after an error")).not.toHaveLength(0);
    expect(
      screen.getByText("The registry apply task did not finish within 120 seconds."),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-outcome="failed"]')).toBeInTheDocument();
  });

  it("shows successful restoration as its own outcome", () => {
    renderDialog({ operation: operation("completed", { report }), report, restored: true });

    expect(screen.getAllByText("Session restored successfully")).not.toHaveLength(0);
    expect(screen.getByText("The session was restored")).toBeInTheDocument();
  });
});
