import { invoke } from "@tauri-apps/api/core";
import upstreamAppCatalog from "../../src-tauri/data/apps/catalog.json";
import type {
  AdvisorReport,
  AdvisorRequest,
  AppDefinition,
  AppInstallReport,
  AppInstallRequest,
  ApplyBatchReport,
  AppOperationHandle,
  AppOperationStatus,
  AppPackageManager,
  AppProviderStatus,
  ApplyOperationHandle,
  ApplyOperationStatus,
  BatchPlan,
  ChocolateyBootstrapRequest,
  RecoverySessionSummary,
  RestoreSessionReport,
  TweakBatchConfig,
  TweakDefinition,
  TweakState,
  TweakStatus,
} from "../types/backend.generated";

const catalog: TweakDefinition[] = [
  {
    id: "enable_long_paths",
    label: "Enable Win32 long paths",
    description: "Allow compatible apps to use paths beyond the legacy MAX_PATH limit.",
    category: "system",
    goals: ["development"],
    risk: "low",
    requires_restart: true,
    references: ["https://learn.microsoft.com/windows/win32/fileio/maximum-file-path-limitation"],
    actions: [
      {
        hive: "local_machine",
        key_path: "SYSTEM\\CurrentControlSet\\Control\\FileSystem",
        value_name: "LongPathsEnabled",
        value: { kind: "dword", value: 1 },
      },
    ],
  },
  {
    id: "disable_advertising_id",
    label: "Disable the Windows advertising ID",
    description: "Prevent apps from using the Windows advertising identifier.",
    category: "privacy",
    goals: ["privacy"],
    risk: "low",
    requires_restart: false,
    references: [
      "https://learn.microsoft.com/windows/client-management/mdm/policy-csp-privacy#disableadvertisingid",
    ],
    actions: [
      {
        hive: "local_machine",
        key_path: "SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo",
        value_name: "DisabledByGroupPolicy",
        value: { kind: "dword", value: 1 },
      },
    ],
  },
  {
    id: "disable_consumer_features",
    label: "Disable Microsoft consumer experiences",
    description: "Stop Windows from adding consumer suggestions through Cloud Content policy.",
    category: "privacy",
    goals: ["privacy", "reduce_distractions"],
    risk: "moderate",
    requires_restart: true,
    references: [
      "https://learn.microsoft.com/windows/client-management/mdm/policy-csp-experience#allowwindowsconsumerfeatures",
    ],
    actions: [
      {
        hive: "local_machine",
        key_path: "SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent",
        value_name: "DisableWindowsConsumerFeatures",
        value: { kind: "dword", value: 1 },
      },
    ],
  },
  {
    id: "reduce_diagnostic_data",
    label: "Limit diagnostic data to required",
    description: "Set Windows diagnostic policy to the supported required-data level.",
    category: "privacy",
    goals: ["privacy"],
    risk: "moderate",
    requires_restart: true,
    references: [
      "https://learn.microsoft.com/windows/privacy/configure-windows-diagnostic-data-in-your-organization",
    ],
    actions: [
      {
        hive: "local_machine",
        key_path: "SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
        value_name: "AllowTelemetry",
        value: { kind: "dword", value: 1 },
      },
    ],
  },
];

const mockStates = new Map<string, TweakState>(catalog.map((item) => [item.id, "not_applied"]));
type UpstreamApp = Omit<AppDefinition, "id" | "name" | "choco"> & {
  content: string;
  choco?: string;
};
const mockApps: AppDefinition[] = Object.entries(
  upstreamAppCatalog as Record<string, UpstreamApp>,
).map(([id, app]) => ({
  id,
  category: app.category,
  choco: app.choco ?? "na",
  name: app.content,
  description: app.description,
  link: app.link,
  winget: app.winget,
  foss: app.foss,
}));
const previewOperations = new Map<string, AppOperationStatus>();
type PreviewApplyTask = {
  status: ApplyOperationStatus;
  config: TweakBatchConfig;
  tweakIndex: number;
  nextChangeIndex: number;
  tweakStarted: boolean;
  committedChangeCount: number;
  appliedTweaks: string[];
  sessionId?: string;
  cancelRequested: boolean;
  totalChanges: number;
};
const previewApplyOperations = new Map<string, PreviewApplyTask>();

export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(command, args);
  if (!import.meta.env.DEV) throw new Error("The native WinTweak AI bridge is unavailable.");
  return mockCall(command, args) as T;
}

export function mockCall(command: string, args?: Record<string, unknown>): unknown {
  if (command === "list_apps") return structuredClone(mockApps);
  if (command === "get_app_provider_statuses") {
    return [
      { manager: "winget", available: true, version: "Preview provider" },
      { manager: "choco", available: false },
    ] satisfies AppProviderStatus[];
  }
  if (command === "start_app_install" || command === "start_app_update") {
    const request = args?.request as AppInstallRequest;
    const results = request.app_ids.map((id) => {
      const app = mockApps.find((item) => item.id === id);
      if (!app) throw new Error(`Unknown application: ${id}`);
      const manager: AppPackageManager =
        request.package_manager === "choco" && app.choco !== "na" ? "choco" : "winget";
      return {
        app_id: id,
        name: app.name,
        manager,
        package_id: manager === "choco" ? app.choco : app.winget,
        success: true,
        message: "Preview: no package was installed.",
      };
    });
    const task_id = crypto.randomUUID();
    previewOperations.set(task_id, {
      task_id,
      kind: command === "start_app_install" ? "install" : "update",
      phase: "completed",
      events: [],
      report: { requested_count: results.length, choco_bootstrapped: false, results },
    });
    return { task_id } satisfies AppOperationHandle;
  }
  if (command === "start_chocolatey_bootstrap") {
    const request = args?.request as ChocolateyBootstrapRequest;
    if (!request.acknowledged_remote_script)
      throw new Error("Chocolatey bootstrap requires acknowledgement");
    const task_id = crypto.randomUUID();
    previewOperations.set(task_id, {
      task_id,
      kind: "bootstrap_chocolatey",
      phase: "completed",
      events: [],
    });
    return { task_id } satisfies AppOperationHandle;
  }
  if (command === "get_app_operation") {
    const task = previewOperations.get(String(args?.taskId));
    if (!task) throw new Error("Unknown application task");
    return structuredClone(task);
  }
  if (command === "cancel_app_operation") {
    return;
  }
  if (command === "list_tweaks") return structuredClone(catalog);
  if (command === "get_tweak_statuses") {
    return catalog.map((item) => ({
      id: item.id,
      state: mockStates.get(item.id) ?? "not_applied",
    }));
  }
  if (command === "get_advisor_report") {
    const request = args?.request as AdvisorRequest;
    return {
      recommendations: catalog.map((item) => {
        const matched = item.goals.filter((goal) => request.goals.includes(goal));
        const state = mockStates.get(item.id) ?? "not_applied";
        const disposition =
          state === "applied"
            ? "already_applied"
            : state === "mixed"
              ? "mixed"
              : matched.length === 0
                ? "not_relevant"
                : item.risk === "low"
                  ? "recommended"
                  : "review_required";
        return { tweak_id: item.id, disposition, matched_goals: matched };
      }),
    } satisfies AdvisorReport;
  }
  if (command === "plan_batch") {
    const config = args?.config as TweakBatchConfig;
    const tweaks = config.tweaks.map(({ id }) => {
      const item = catalog.find((candidate) => candidate.id === id);
      if (!item) throw new Error(`Unknown tweak: ${id}`);
      return {
        id,
        changes: item.actions.map((action) => ({
          hive: action.hive,
          key_path: action.key_path,
          value_name: action.value_name,
          current: mockStates.get(id) === "applied" ? action.value : ({ kind: "missing" } as const),
          target: action.value,
          required: mockStates.get(id) !== "applied",
        })),
      };
    });
    return {
      tweaks,
      change_count: tweaks.flatMap((item) => item.changes).filter((item) => item.required).length,
    } satisfies BatchPlan;
  }
  if (command === "apply_batch") {
    const config = args?.config as TweakBatchConfig;
    const plan = mockCall("plan_batch", { config }) as BatchPlan;
    for (const item of config.tweaks) mockStates.set(item.id, "applied");
    return {
      session_id: plan.change_count > 0 ? crypto.randomUUID() : undefined,
      applied_tweaks: config.tweaks.map(({ id }) => id),
      committed_change_count: plan.change_count,
    } satisfies ApplyBatchReport;
  }
  if (command === "start_apply_batch") {
    const config = structuredClone(args?.config as TweakBatchConfig);
    const plan = mockCall("plan_batch", { config }) as BatchPlan;
    const task_id = crypto.randomUUID();
    previewApplyOperations.set(task_id, {
      status: { task_id, phase: "queued", events: [] },
      config,
      tweakIndex: 0,
      nextChangeIndex: 0,
      tweakStarted: false,
      committedChangeCount: 0,
      appliedTweaks: [],
      cancelRequested: false,
      totalChanges: plan.change_count,
    });
    return { task_id } satisfies ApplyOperationHandle;
  }
  if (command === "get_apply_operation") {
    const task = previewApplyOperations.get(String(args?.taskId));
    if (!task) throw new Error("Unknown registry apply task");
    advancePreviewApply(task);
    return structuredClone(task.status);
  }
  if (command === "cancel_apply_operation") {
    const task = previewApplyOperations.get(String(args?.taskId));
    if (!task) throw new Error("Unknown registry apply task");
    if (!["completed", "cancelled", "failed"].includes(task.status.phase)) {
      task.cancelRequested = true;
    }
    return;
  }
  if (command === "restore_session") {
    for (const item of catalog) mockStates.set(item.id, "not_applied");
    return {
      recovery_session_id: crypto.randomUUID(),
      source_session_id: String(args?.sessionId ?? ""),
      restored_entry_count: 1,
      skipped_pending_entry_count: 0,
    } satisfies RestoreSessionReport;
  }
  if (command === "list_recovery_sessions") return [];
  throw new Error(`Mock bridge does not implement ${command}`);
}

export const bridge = {
  listTweaks: () => call<TweakDefinition[]>("list_tweaks"),
  statuses: () => call<TweakStatus[]>("get_tweak_statuses"),
  advisor: (request: AdvisorRequest) => call<AdvisorReport>("get_advisor_report", { request }),
  plan: (config: TweakBatchConfig) => call<BatchPlan>("plan_batch", { config }),
  apply: (config: TweakBatchConfig) => call<ApplyBatchReport>("apply_batch", { config }),
  startApply: (config: TweakBatchConfig) =>
    call<ApplyOperationHandle>("start_apply_batch", { config }),
  applyOperation: (taskId: string) =>
    call<ApplyOperationStatus>("get_apply_operation", { taskId }),
  cancelApplyOperation: (taskId: string) =>
    call<void>("cancel_apply_operation", { taskId }),
  recoveries: () => call<RecoverySessionSummary[]>("list_recovery_sessions"),
  restore: (sessionId: string) => call<RestoreSessionReport>("restore_session", { sessionId }),
  listApps: () => call<AppDefinition[]>("list_apps"),
  appProviders: () => call<AppProviderStatus[]>("get_app_provider_statuses"),
  startAppInstall: (request: AppInstallRequest) =>
    call<AppOperationHandle>("start_app_install", { request }),
  startAppUpdate: (request: AppInstallRequest) =>
    call<AppOperationHandle>("start_app_update", { request }),
  bootstrapChocolatey: (request: ChocolateyBootstrapRequest) =>
    call<AppOperationHandle>("start_chocolatey_bootstrap", { request }),
  appOperation: (taskId: string) => call<AppOperationStatus>("get_app_operation", { taskId }),
  cancelAppOperation: (taskId: string) => call<void>("cancel_app_operation", { taskId }),
};

function advancePreviewApply(task: PreviewApplyTask): void {
  if (["completed", "cancelled", "failed"].includes(task.status.phase)) return;
  if (task.status.phase === "queued") {
    task.status.phase = "running";
    task.status.events.push({
      kind: "batch_started",
      total_tweaks: task.config.tweaks.length,
      total_changes: task.totalChanges,
    });
    return;
  }
  const request = task.config.tweaks[task.tweakIndex];
  if (!request) {
    finishPreviewApply(task, "completed");
    return;
  }
  const definition = catalog.find((item) => item.id === request.id);
  if (!definition) {
    task.status.phase = "failed";
    task.status.error = `Unknown tweak: ${request.id}`;
    task.status.events.push({
      kind: "failed",
      message: task.status.error,
      completed_tweak_count: task.appliedTweaks.length,
      committed_change_count: task.committedChangeCount,
      session_id: task.sessionId,
    });
    task.status.report = previewApplyReport(task);
    return;
  }
  if (
    task.cancelRequested &&
    (!task.tweakStarted || task.nextChangeIndex < definition.actions.length)
  ) {
    finishPreviewApply(task, "cancelled");
    return;
  }
  if (!task.tweakStarted) {
    task.status.events.push({
      kind: "tweak_started",
      tweak_id: request.id,
      tweak_index: task.tweakIndex,
    });
    task.tweakStarted = true;
    return;
  }
  while (task.nextChangeIndex < definition.actions.length) {
    const changeIndex = task.nextChangeIndex++;
    if (mockStates.get(request.id) === "applied") continue;
    mockStates.set(request.id, "applied");
    task.sessionId ??= crypto.randomUUID();
    task.committedChangeCount += 1;
    task.status.events.push({
      kind: "change_committed",
      tweak_id: request.id,
      tweak_index: task.tweakIndex,
      change_index: changeIndex,
      committed_change_count: task.committedChangeCount,
    });
    return;
  }
  task.appliedTweaks.push(request.id);
  task.status.events.push({
    kind: "tweak_completed",
    tweak_id: request.id,
    tweak_index: task.tweakIndex,
    completed_tweak_count: task.appliedTweaks.length,
  });
  task.tweakIndex += 1;
  task.nextChangeIndex = 0;
  task.tweakStarted = false;
  if (task.config.tweaks[task.tweakIndex]) {
    if (task.cancelRequested) finishPreviewApply(task, "cancelled");
  } else {
    finishPreviewApply(task, "completed");
  }
}

function finishPreviewApply(
  task: PreviewApplyTask,
  phase: "completed" | "cancelled",
): void {
  task.status.phase = phase;
  task.status.report = previewApplyReport(task);
  task.status.events.push({
    kind: phase === "completed" ? "batch_completed" : "cancelled",
    completed_tweak_count: task.appliedTweaks.length,
    committed_change_count: task.committedChangeCount,
    session_id: task.sessionId,
  });
}

function previewApplyReport(task: PreviewApplyTask): ApplyBatchReport {
  return {
    session_id: task.sessionId,
    applied_tweaks: [...task.appliedTweaks],
    committed_change_count: task.committedChangeCount,
  };
}
