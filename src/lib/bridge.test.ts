import { beforeEach, describe, expect, it } from "vitest";
import type {
  AdvisorReport,
  AppDefinition,
  AppInstallReport,
  ApplyBatchReport,
  ApplyOperationStatus,
  BatchPlan,
} from "../types/backend.generated";
import { mockCall } from "./bridge";

describe("development bridge", () => {
  beforeEach(() => {
    const result = mockCall("restore_session", { sessionId: crypto.randomUUID() });
    expect(result).toBeTruthy();
  });

  it("recommends low-risk goal matches and flags moderate-risk matches", () => {
    const report = mockCall("get_advisor_report", {
      request: { goals: ["privacy"] },
    }) as AdvisorReport;

    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tweak_id: "disable_advertising_id",
          disposition: "recommended",
        }),
        expect.objectContaining({
          tweak_id: "reduce_diagnostic_data",
          disposition: "review_required",
        }),
        expect.objectContaining({
          tweak_id: "show_file_extensions",
          disposition: "not_relevant",
        }),
      ]),
    );
  });

  it("plans, applies, and restores a selected tweak", () => {
    const config = {
      schema_version: 1,
      tweaks: [{ id: "disable_advertising_id", desired_state: "enabled" }],
    };
    const plan = mockCall("plan_batch", { config }) as BatchPlan;
    expect(plan.change_count).toBe(1);

    const applied = mockCall("apply_batch", { config }) as ApplyBatchReport;
    expect(applied.applied_tweaks).toEqual(["disable_advertising_id"]);

    const appliedReport = mockCall("get_advisor_report", {
      request: { goals: ["privacy"] },
    }) as AdvisorReport;
    expect(appliedReport.recommendations).toContainEqual(
      expect.objectContaining({
        tweak_id: "disable_advertising_id",
        disposition: "already_applied",
      }),
    );

    mockCall("restore_session", { sessionId: applied.session_id });
    const restoredPlan = mockCall("plan_batch", { config }) as BatchPlan;
    expect(restoredPlan.change_count).toBe(1);
  });

  it("exposes the real app catalog and simulates provider operations in preview", () => {
    const apps = mockCall("list_apps") as AppDefinition[];
    expect(apps).toHaveLength(204);
    const handle = mockCall("start_app_install", {
      request: { app_ids: ["7zip"], package_manager: "winget" },
    }) as { task_id: string };
    const report = mockCall("get_app_operation", { taskId: handle.task_id }) as {
      report?: AppInstallReport;
    };
    expect(report.report?.results[0]).toMatchObject({ name: "7-Zip", success: true });
  });

  it("stages registry apply progress and confirms cancellation at a safe boundary", () => {
    const config = {
      schema_version: 1,
      tweaks: [
        { id: "disable_advertising_id", desired_state: "enabled" },
        { id: "show_file_extensions", desired_state: "enabled" },
      ],
    };
    const handle = mockCall("start_apply_batch", { config }) as { task_id: string };

    const started = mockCall("get_apply_operation", {
      taskId: handle.task_id,
    }) as ApplyOperationStatus;
    expect(started).toMatchObject({ phase: "running" });
    expect(started.events).toEqual([
      expect.objectContaining({ kind: "batch_started", total_tweaks: 2, total_changes: 2 }),
    ]);

    mockCall("get_apply_operation", { taskId: handle.task_id });
    const committed = mockCall("get_apply_operation", {
      taskId: handle.task_id,
    }) as ApplyOperationStatus;
    expect(committed.events.at(-1)).toMatchObject({
      kind: "change_committed",
      tweak_id: "disable_advertising_id",
      committed_change_count: 1,
    });

    mockCall("cancel_apply_operation", { taskId: handle.task_id });
    const cancelled = mockCall("get_apply_operation", {
      taskId: handle.task_id,
    }) as ApplyOperationStatus;
    expect(cancelled).toMatchObject({
      phase: "cancelled",
      report: { committed_change_count: 1 },
    });
    expect(cancelled.report?.session_id).toBeTruthy();
    expect(cancelled.events.at(-1)?.kind).toBe("cancelled");
  });
});
