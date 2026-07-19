import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReviewDialog } from "./components/ReviewDialog";
import { TweakerWorkspace } from "./components/TweakerWorkspace";
import { bridge } from "./lib/bridge";
import { readStorageValue, toggleId, writeStorageValue } from "./lib/storage";
import { APPLY_OPERATION_TIMEOUT_MS, waitForApplyOperation } from "./lib/waitForApplyOperation";
import type {
  AppInstallReport,
  ApplyOperationStatus,
  AppPackageManager,
  ProfileDefinition,
  TweakBatchConfig,
  UserGoal,
} from "./types/backend.generated";

const STORAGE_KEYS = {
  appManager: "wintweak.app-manager",
  goals: "wintweak.goals",
  theme: "wintweak.theme",
} as const;

const QUERY_KEYS = {
  advisor: ["advisor"],
  appProviders: ["appProviders"],
  apps: ["apps"],
  catalog: ["catalog"],
  recoveries: ["recoveries"],
  profiles: ["profiles"],
  statuses: ["statuses"],
} as const;

function initialDarkMode(): boolean {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function App() {
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(initialDarkMode);
  const [goals, setGoals] = useState<UserGoal[]>(() => readStorageValue(STORAGE_KEYS.goals, []));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profileTweaks, setProfileTweaks] = useState<TweakBatchConfig["tweaks"]>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [lastReport, setLastReport] = useState<Awaited<ReturnType<typeof bridge.apply>>>();
  const [applyOperation, setApplyOperation] = useState<ApplyOperationStatus>();
  const [applyTaskId, setApplyTaskId] = useState<string>();
  const [applyCancelling, setApplyCancelling] = useState(false);
  const applyWaitController = useRef<AbortController | undefined>(undefined);
  const [restored, setRestored] = useState(false);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [appManager, setAppManager] = useState<AppPackageManager>(() =>
    localStorage.getItem(STORAGE_KEYS.appManager) === "choco" ? "choco" : "winget",
  );
  const [appTaskId, setAppTaskId] = useState<string>();

  const waitForAppOperation = useCallback(async (taskId: string): Promise<AppInstallReport> => {
    for (;;) {
      const status = await bridge.appOperation(taskId);
      if (["completed", "cancelled", "failed"].includes(status.phase)) {
        if (!status.report)
          throw new Error(status.events.at(-1)?.message ?? "Application operation failed");
        return status.report;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
    }
  }, []);

  const waitForAppTask = useCallback(async (taskId: string): Promise<void> => {
    for (;;) {
      const status = await bridge.appOperation(taskId);
      if (["completed", "cancelled", "failed"].includes(status.phase)) {
        if (status.phase !== "completed")
          throw new Error(status.events.at(-1)?.message ?? "Application operation failed");
        return;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem(STORAGE_KEYS.theme, dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => writeStorageValue(STORAGE_KEYS.goals, goals), [goals]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.appManager, appManager), [appManager]);
  useEffect(() => {
    if (!reviewOpen) applyWaitController.current?.abort();
    return () => applyWaitController.current?.abort();
  }, [reviewOpen]);

  const catalog = useQuery({ queryKey: QUERY_KEYS.catalog, queryFn: bridge.listTweaks });
  const statuses = useQuery({ queryKey: QUERY_KEYS.statuses, queryFn: bridge.statuses });
  const advisor = useQuery({
    queryKey: [...QUERY_KEYS.advisor, goals],
    queryFn: () => bridge.advisor({ goals }),
    enabled: goals.length > 0,
  });
  const recoveries = useQuery({ queryKey: QUERY_KEYS.recoveries, queryFn: bridge.recoveries });
  const profiles = useQuery({ queryKey: QUERY_KEYS.profiles, queryFn: bridge.listProfiles });
  const apps = useQuery({ queryKey: QUERY_KEYS.apps, queryFn: bridge.listApps });
  const appProviders = useQuery({
    queryKey: QUERY_KEYS.appProviders,
    queryFn: bridge.appProviders,
  });
  const installApps = useMutation({
    mutationFn: async () => {
      const handle = await bridge.startAppInstall({
        app_ids: [...selectedApps],
        package_manager: appManager,
      });
      setAppTaskId(handle.task_id);
      return waitForAppOperation(handle.task_id);
    },
    onSuccess: async () => {
      setSelectedApps(new Set());
      await appProviders.refetch();
    },
    onSettled: () => setAppTaskId(undefined),
  });
  const updateAllApps = useMutation({
    mutationFn: async () => {
      const handle = await bridge.startAppUpdate({
        app_ids: [...selectedApps],
        package_manager: appManager,
      });
      setAppTaskId(handle.task_id);
      return waitForAppOperation(handle.task_id);
    },
    onSuccess: async () => {
      await appProviders.refetch();
    },
    onSettled: () => setAppTaskId(undefined),
  });
  const bootstrapChocolatey = useMutation({
    mutationFn: async () => {
      const handle = await bridge.bootstrapChocolatey({ acknowledged_remote_script: true });
      setAppTaskId(handle.task_id);
      await waitForAppTask(handle.task_id);
    },
    onSuccess: async () => {
      await appProviders.refetch();
    },
    onSettled: () => setAppTaskId(undefined),
  });
  const config = useMemo<TweakBatchConfig>(
    () => ({
      schema_version: 1,
      tweaks:
        profileTweaks ?? [...selectedIds].map((id) => ({ id, desired_state: "enabled" as const })),
    }),
    [profileTweaks, selectedIds],
  );
  const plan = useQuery({
    queryKey: ["plan", config.tweaks],
    queryFn: () => bridge.plan(config),
    enabled: reviewOpen && selectedIds.size > 0 && !lastReport,
  });
  const apply = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      applyWaitController.current?.abort();
      applyWaitController.current = controller;
      try {
        const handle = await bridge.startApply(config);
        setApplyTaskId(handle.task_id);
        return await waitForApplyOperation(handle.task_id, {
          readStatus: bridge.applyOperation,
          onStatus: setApplyOperation,
          signal: controller.signal,
        });
      } finally {
        if (applyWaitController.current === controller) applyWaitController.current = undefined;
      }
    },
    onSuccess: async (operation) => {
      setLastReport(operation.report);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statuses }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.advisor }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recoveries }),
      ]);
    },
    onError: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statuses }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.advisor }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recoveries }),
      ]);
    },
    onSettled: () => {
      setApplyTaskId(undefined);
      setApplyCancelling(false);
    },
  });
  const cancelApply = useMutation({
    mutationFn: async () => {
      if (!applyTaskId) return;
      await bridge.cancelApplyOperation(applyTaskId);
    },
    onError: () => setApplyCancelling(false),
  });
  const restore = useMutation({
    mutationFn: restoreWithTimeout,
    onSuccess: async () => {
      setRestored(true);
      setSelectedIds(new Set());
      setProfileTweaks(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statuses }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.advisor }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recoveries }),
      ]);
    },
    onError: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statuses }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.advisor }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recoveries }),
      ]);
    },
  });

  const toggleSelection = useCallback((id: string) => {
    setProfileTweaks(undefined);
    setSelectedIds((ids) => toggleId(ids, id));
  }, []);

  const openReview = () => {
    setLastReport(undefined);
    setApplyOperation(undefined);
    setApplyTaskId(undefined);
    setApplyCancelling(false);
    apply.reset();
    cancelApply.reset();
    setRestored(false);
    setReviewOpen(true);
  };

  const previewProfile = (profile: ProfileDefinition) => {
    setProfileTweaks(profile.tweaks);
    setSelectedIds(new Set(profile.tweaks.map((tweak) => tweak.id)));
    setLastReport(undefined);
    setApplyOperation(undefined);
    setRestored(false);
    setReviewOpen(true);
  };

  const retry = useCallback(() => {
    void catalog.refetch();
    void statuses.refetch();
    void recoveries.refetch();
    void profiles.refetch();
    if (goals.length > 0) void advisor.refetch();
    void apps.refetch();
    void appProviders.refetch();
  }, [advisor, appProviders, apps, catalog, goals.length, profiles, recoveries, statuses]);

  const toggleAppSelection = useCallback(
    (id: string) => setSelectedApps((ids) => toggleId(ids, id)),
    [],
  );

  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme} className="app-provider">
      <TweakerWorkspace
        dark={dark}
        catalog={catalog.data ?? []}
        statuses={statuses.data ?? []}
        advisor={advisor.data}
        recoveries={recoveries.data ?? []}
        profiles={profiles.data ?? []}
        goals={goals}
        selectedIds={selectedIds}
        loading={catalog.isLoading || statuses.isLoading || recoveries.isLoading}
        error={catalog.isError || statuses.isError || recoveries.isError}
        onThemeChange={() => setDark((value) => !value)}
        onRestoreSession={(sessionId) => restore.mutate(sessionId)}
        recoveryRestoring={restore.isPending}
        recoveryRestoreError={restore.isError}
        restoredSessionId={restore.data?.source_session_id}
        onGoalsChange={setGoals}
        onToggle={toggleSelection}
        onReview={openReview}
        onPreviewProfile={previewProfile}
        onRetry={retry}
        apps={apps.data ?? []}
        appProviders={appProviders.data ?? []}
        selectedApps={selectedApps}
        appManager={appManager}
        appInstalling={installApps.isPending || bootstrapChocolatey.isPending}
        appUpdating={updateAllApps.isPending}
        appsLoading={apps.isLoading || appProviders.isLoading}
        appsError={apps.isError || appProviders.isError}
        appInstallError={installApps.isError}
        appInstallReport={installApps.data}
        appUpdateReport={updateAllApps.data}
        onToggleApp={toggleAppSelection}
        onAppManagerChange={setAppManager}
        onInstallApps={() => installApps.mutate()}
        onUpdateAllApps={() => updateAllApps.mutate()}
        onBootstrapChocolatey={() => bootstrapChocolatey.mutate()}
        appTaskId={appTaskId}
        onCancelAppOperation={() => appTaskId && void bridge.cancelAppOperation(appTaskId)}
        onRefreshProviders={() => void appProviders.refetch()}
      />
      <ReviewDialog
        open={reviewOpen}
        plan={plan.data}
        loading={plan.isLoading}
        error={plan.isError || cancelApply.isError || restore.isError}
        applyError={apply.isError ? applyErrorMessage(apply.error) : undefined}
        applying={apply.isPending}
        cancelAvailable={Boolean(applyTaskId)}
        cancelling={applyCancelling}
        restoring={restore.isPending}
        report={lastReport}
        operation={applyOperation}
        restored={restored}
        onOpenChange={setReviewOpen}
        onApply={() => apply.mutate()}
        onCancelApply={() => {
          if (!applyTaskId || applyCancelling) return;
          setApplyCancelling(true);
          cancelApply.mutate();
        }}
        onRestore={(sessionId) => restore.mutate(sessionId)}
      />
    </FluentProvider>
  );
}

function applyErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (typeof error === "object" && error !== null) {
    const details = Reflect.get(error, "details");
    if (typeof details === "string" && details.trim()) return details;
    if (typeof details === "object" && details !== null) {
      const message = Reflect.get(details, "message");
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return "WinTweak could not start or monitor the registry apply task. Its outcome was not treated as successful.";
}

function restoreWithTimeout(
  sessionId: string,
): Promise<Awaited<ReturnType<typeof bridge.restore>>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback();
    };
    const timeoutId = setTimeout(
      () =>
        finish(() =>
          reject(
            new Error(
              "The registry restore did not finish within 120 seconds. Its outcome was not treated as successful.",
            ),
          ),
        ),
      APPLY_OPERATION_TIMEOUT_MS,
    );
    bridge.restore(sessionId).then(
      (report) => finish(() => resolve(report)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}
