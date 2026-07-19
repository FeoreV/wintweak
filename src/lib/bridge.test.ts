import { beforeEach, describe, expect, it } from "vitest";
import type {
  AdvisorReport,
  AppDefinition,
  AppInstallReport,
  ApplyBatchReport,
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
          tweak_id: "enable_long_paths",
          disposition: "not_relevant",
        }),
      ]),
    );
  });

  it("plans, applies, and restores a selected tweak", () => {
    const config = {
      schema_version: 1,
      tweaks: [{ id: "disable_advertising_id" }],
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
});
