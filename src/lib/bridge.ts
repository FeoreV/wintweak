import { invoke } from "@tauri-apps/api/core";
import upstreamAppCatalog from "../../src-tauri/data/apps/catalog.json";
import upstreamTweakCatalog from "../../src-tauri/data/tweaks/catalog.json";
import type {
  AdvisorReport,
  AdvisorRequest,
  AppDefinition,
  AppInstallReport,
  AppInstallRequest,
  ApplyBatchReport,
  ApplyOperationHandle,
  ApplyOperationStatus,
  AppOperationHandle,
  AppOperationStatus,
  AppPackageManager,
  AppProviderStatus,
  AppxPackage,
  AppxRemovalPreview,
  BatchPlan,
  ChocolateyBootstrapRequest,
  ProfileDefinition,
  ProfileName,
  RecoverySessionSummary,
  RegistryAction,
  RegistryValue,
  RestoreSessionReport,
  SystemAudit,
  TweakBatchConfig,
  TweakDefinition,
  TweakState,
  TweakStatus,
} from "../types/backend.generated";

const catalog = structuredClone(upstreamTweakCatalog) as unknown as TweakDefinition[];

const mockStates = new Map<string, TweakState>(catalog.map((item) => [item.id, "disabled"]));
const profiles: ProfileDefinition[] = [
  {
    name: "privacy",
    title: { en: "Privacy", ru: "Конфиденциальность" },
    description: {
      en: "Reduce documented Windows personalization and activity collection.",
      ru: "Сокращает документированную персонализацию Windows и сбор данных об активности.",
    },
    tweaks: [
      "reduce_diagnostic_data",
      "disable_advertising_id",
      "disable_activity_history",
      "disable_bing_search_suggestions",
      "disable_widgets",
    ].map((id) => ({ id, desired_state: "enabled" })),
  },
  {
    name: "balanced",
    title: { en: "Balanced", ru: "Сбалансированный" },
    description: {
      en: "Conservative privacy and Explorer usability defaults.",
      ru: "Осторожные настройки конфиденциальности и удобства Проводника.",
    },
    tweaks: [
      { id: "disable_advertising_id", desired_state: "enabled" },
      { id: "disable_bing_search_suggestions", desired_state: "enabled" },
      { id: "show_file_extensions", desired_state: "enabled" },
      { id: "show_hidden_files", desired_state: "disabled" },
      { id: "dark_mode", desired_state: "enabled" },
    ],
  },
  {
    name: "performance",
    title: { en: "Performance", ru: "Быстродействие" },
    description: {
      en: "Interaction-focused defaults without unverified performance claims.",
      ru: "Настройки взаимодействия без недоказанных обещаний прироста производительности.",
    },
    tweaks: ["disable_widgets", "disable_mouse_acceleration", "show_file_extensions"].map((id) => ({
      id,
      desired_state: "enabled",
    })),
  },
  {
    name: "developer",
    title: { en: "Developer", ru: "Разработчик" },
    description: {
      en: "Developer-friendly Explorer and shell defaults.",
      ru: "Удобные для разработки настройки Проводника и оболочки.",
    },
    tweaks: [
      { id: "show_file_extensions", desired_state: "enabled" },
      { id: "show_hidden_files", desired_state: "enabled" },
      { id: "dark_mode", desired_state: "enabled" },
      { id: "disable_bing_search_suggestions", desired_state: "disabled" },
    ],
  },
  {
    name: "minimal",
    title: { en: "Minimal", ru: "Минимальный" },
    description: {
      en: "Small, low-risk set with minimal policy impact.",
      ru: "Небольшой набор с низким риском и минимальным влиянием на политики.",
    },
    tweaks: [
      { id: "show_file_extensions", desired_state: "enabled" },
      { id: "show_hidden_files", desired_state: "disabled" },
    ],
  },
];
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
      report: {
        requested_count: results.length,
        choco_bootstrapped: false,
        results,
        restore_blocked: true,
        restore_explanation: "Preview package operations are not automatically reversible.",
      },
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
  if (
    command === "list_appx_packages" ||
    command === "preview_appx_removal" ||
    command === "get_system_audit"
  ) {
    throw new Error("Native Windows inventory is unavailable in browser preview mode.");
  }
  if (command === "list_profiles") return structuredClone(profiles);
  if (command === "plan_profile") {
    const profile = profiles.find((item) => item.name === args?.name);
    if (!profile) throw new Error("Unknown profile");
    return mockCall("plan_batch", { config: { schema_version: 1, tweaks: profile.tweaks } });
  }
  if (command === "get_tweak_statuses") {
    return catalog.map((item) => ({
      id: item.id,
      state: mockStates.get(item.id) ?? "disabled",
      restart_requirement: item.restart_requirement,
    }));
  }
  if (command === "get_advisor_report") {
    const request = args?.request as AdvisorRequest;
    return {
      recommendations: catalog.map((item) => {
        const matched = item.goals.filter((goal) => request.goals.includes(goal));
        const state = mockStates.get(item.id) ?? "disabled";
        const disposition =
          state === "enabled"
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
    const tweaks = config.tweaks.map(({ id, desired_state }) => {
      const item = catalog.find((candidate) => candidate.id === id);
      if (!item) throw new Error(`Unknown tweak: ${id}`);
      const operations = desired_state === "disabled" ? item.restore : item.apply;
      return {
        id,
        desired_state,
        warnings: item.warnings.map((warning) => warning.en),
        restart_requirement: item.restart_requirement,
        changes: operations.map((action) => {
          const current = previewCurrentValue(item, action);
          return {
            provider: "registry" as const,
            operation_kind:
              desired_state === "disabled" ? ("restore" as const) : ("apply" as const),
            hive: action.hive,
            key_path: action.key_path,
            value_name: action.value_name,
            current,
            target: action.value,
            required: !registryValuesEqual(current, action.value),
            explanation:
              desired_state === "enabled"
                ? item.description.en
                : `Return '${item.title.en}' to its reviewed catalog default; session undo preserves the exact pre-state.`,
            recovery_data: { action, previous: current },
            warnings: item.warnings.map((warning) => warning.en),
            restart_requirement: item.restart_requirement,
          };
        }),
      };
    });
    return {
      tweaks,
      environment: { windows: "windows11", build: 26100, architecture: "x86_64", is_admin: true },
      change_count: tweaks.flatMap((item) => item.changes).filter((item) => item.required).length,
    } satisfies BatchPlan;
  }
  if (command === "apply_batch") {
    const config = args?.config as TweakBatchConfig;
    const plan = mockCall("plan_batch", { config }) as BatchPlan;
    for (const item of config.tweaks) mockStates.set(item.id, item.desired_state);
    const changed = plan.tweaks.filter((tweak) => tweak.changes.some((change) => change.required));
    return {
      session_id: plan.change_count > 0 ? crypto.randomUUID() : undefined,
      applied_tweaks: config.tweaks.map(({ id }) => id),
      committed_change_count: plan.change_count,
      restart_requirement: changed.reduce(
        (requirement, tweak) =>
          restartRank(tweak.restart_requirement) > restartRank(requirement)
            ? tweak.restart_requirement
            : requirement,
        "none" as ApplyBatchReport["restart_requirement"],
      ),
      warnings: [...new Set(changed.flatMap((tweak) => tweak.warnings))],
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
    for (const item of catalog) mockStates.set(item.id, "disabled");
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
  listProfiles: () => call<ProfileDefinition[]>("list_profiles"),
  appxPackages: () => call<AppxPackage[]>("list_appx_packages"),
  previewAppxRemoval: (fullName: string) =>
    call<AppxRemovalPreview>("preview_appx_removal", { fullName }),
  systemAudit: () => call<SystemAudit>("get_system_audit"),
  planProfile: (name: ProfileName) => call<BatchPlan>("plan_profile", { name }),
  statuses: () => call<TweakStatus[]>("get_tweak_statuses"),
  advisor: (request: AdvisorRequest) => call<AdvisorReport>("get_advisor_report", { request }),
  plan: (config: TweakBatchConfig) => call<BatchPlan>("plan_batch", { config }),
  apply: (config: TweakBatchConfig) => call<ApplyBatchReport>("apply_batch", { config }),
  startApply: (config: TweakBatchConfig) =>
    call<ApplyOperationHandle>("start_apply_batch", { config }),
  applyOperation: (taskId: string) => call<ApplyOperationStatus>("get_apply_operation", { taskId }),
  cancelApplyOperation: (taskId: string) => call<void>("cancel_apply_operation", { taskId }),
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
  const operations = request.desired_state === "disabled" ? definition.restore : definition.apply;
  if (task.cancelRequested && (!task.tweakStarted || task.nextChangeIndex < operations.length)) {
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
  while (task.nextChangeIndex < operations.length) {
    const changeIndex = task.nextChangeIndex++;
    if (mockStates.get(request.id) === request.desired_state) continue;
    mockStates.set(request.id, request.desired_state);
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

function finishPreviewApply(task: PreviewApplyTask, phase: "completed" | "cancelled"): void {
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
  const changed = task.config.tweaks
    .filter((tweak) => task.appliedTweaks.includes(tweak.id))
    .map((tweak) => catalog.find((definition) => definition.id === tweak.id))
    .filter((definition): definition is TweakDefinition => Boolean(definition));
  return {
    session_id: task.sessionId,
    applied_tweaks: [...task.appliedTweaks],
    committed_change_count: task.committedChangeCount,
    restart_requirement: changed.reduce(
      (requirement, definition) =>
        restartRank(definition.restart_requirement) > restartRank(requirement)
          ? definition.restart_requirement
          : requirement,
      "none" as ApplyBatchReport["restart_requirement"],
    ),
    warnings: [
      ...new Set(changed.flatMap((definition) => definition.warnings.map((item) => item.en))),
    ],
  };
}

function previewCurrentValue(
  definition: TweakDefinition,
  operation: RegistryAction,
): RegistryValue {
  const state = mockStates.get(definition.id) ?? "disabled";
  const source =
    state === "enabled" || state === "requires_restart" ? definition.apply : definition.restore;
  return matchingAction(source, operation)?.value ?? { kind: "missing" };
}

function matchingAction(
  actions: RegistryAction[],
  target: RegistryAction,
): RegistryAction | undefined {
  return actions.find(
    (action) =>
      action.hive === target.hive &&
      action.key_path.toLocaleLowerCase() === target.key_path.toLocaleLowerCase() &&
      action.value_name.toLocaleLowerCase() === target.value_name.toLocaleLowerCase(),
  );
}

function registryValuesEqual(left: RegistryValue, right: RegistryValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function restartRank(requirement: ApplyBatchReport["restart_requirement"]): number {
  return ["none", "explorer_restart", "logoff", "reboot"].indexOf(requirement);
}
