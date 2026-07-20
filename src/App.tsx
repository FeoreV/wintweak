import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppsPage } from "./components/AppsPage";
import { BottomChangesBar } from "./components/BottomChangesBar";
import { DriversPage } from "./components/DriversPage";
import { Header } from "./components/Header";
import { HomePage } from "./components/HomePage";
import { OptimizePage } from "./components/OptimizePage";
import { RecoveryPage } from "./components/RecoveryPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { WindowsPage } from "./components/WindowsPage";
import { bridge, isTauri } from "./lib/bridge";
import { readStorageValue, toggleId, writeStorageValue } from "./lib/storage";
import { APPLY_OPERATION_TIMEOUT_MS, waitForApplyOperation } from "./lib/waitForApplyOperation";
import type {
  AppInstallReport,
  ApplyOperationStatus,
  AppPackageManager,
  AvailableDriverUpdate,
  DriverUpdateReport,
  SystemAudit,
  TweakBatchConfig,
  TweakDesiredState,
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
  audit: ["audit"],
  drivers: ["drivers"],
} as const;

function initialDarkMode(): boolean {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function App() {
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(initialDarkMode);
  const [goals, setGoals] = useState<UserGoal[]>(() => readStorageValue(STORAGE_KEYS.goals, []));
  const [currentView, setCurrentView] = useState<string>("home");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pending Actions States
  const [pendingTweaks, setPendingTweaks] = useState<
    { id: string; desired_state: TweakDesiredState }[]
  >([]);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [selectedDriverUpdates, setSelectedDriverUpdates] = useState<Set<string>>(new Set());

  // Apply Progress Overlay States
  const [applyProgressOpen, setApplyProgressOpen] = useState(false);
  const [applyOperation, setApplyOperation] = useState<ApplyOperationStatus>();
  const [applyTaskId, setApplyTaskId] = useState<string>();
  const [applyCancelling, setApplyCancelling] = useState(false);
  const applyWaitController = useRef<AbortController | undefined>(undefined);
  const [restored, setRestored] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [restoredSessionId, setRestoredSessionId] = useState<string>();

  // Packages & Sideloading Provider States
  const [appManager, setAppManager] = useState<AppPackageManager>(() =>
    localStorage.getItem(STORAGE_KEYS.appManager) === "choco" ? "choco" : "winget",
  );
  const [appTaskId, setAppTaskId] = useState<string>();
  const [driverInstallingUpdateId, setDriverInstallingUpdateId] = useState<string>();
  const [driverUpdateReports, setDriverUpdateReports] = useState<DriverUpdateReport[]>([]);

  // Sync dark mode class with DOM element
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEYS.theme, dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => writeStorageValue(STORAGE_KEYS.goals, goals), [goals]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.appManager, appManager), [appManager]);

  // Queries
  const catalog = useQuery({ queryKey: QUERY_KEYS.catalog, queryFn: bridge.listTweaks });
  const statuses = useQuery({ queryKey: QUERY_KEYS.statuses, queryFn: bridge.statuses });
  const advisor = useQuery({
    queryKey: [...QUERY_KEYS.advisor, goals],
    queryFn: () => bridge.advisor({ goals }),
    enabled: goals.length > 0,
  });
  const recoveries = useQuery({ queryKey: QUERY_KEYS.recoveries, queryFn: bridge.recoveries });
  const apps = useQuery({ queryKey: QUERY_KEYS.apps, queryFn: bridge.listApps });
  const appProviders = useQuery({
    queryKey: QUERY_KEYS.appProviders,
    queryFn: bridge.appProviders,
  });
  const audit = useQuery<SystemAudit>({
    queryKey: QUERY_KEYS.audit,
    queryFn: bridge.systemAudit,
    enabled: isTauri(),
    retry: false,
  });
  const drivers = useQuery({
    queryKey: QUERY_KEYS.drivers,
    queryFn: bridge.driverInventory,
    enabled: isTauri(),
    retry: false,
  });

  // App Install Mutation Helper
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

  // Mutations
  const installApps = useMutation({
    mutationFn: async (appIds: string[]) => {
      const handle = await bridge.startAppInstall({
        app_ids: appIds,
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

  const installDriverUpdate = useMutation({
    mutationFn: async (update: AvailableDriverUpdate) => {
      setDriverInstallingUpdateId(update.update_id);
      const report = await bridge.installDriverUpdate({
        update_id: update.update_id,
        revision_number: update.revision_number,
      });
      setDriverUpdateReports((reports) => [
        report,
        ...reports.filter((item) => item.update_id !== report.update_id),
      ]);
      return report;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.drivers });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.audit });
    },
    onSettled: () => setDriverInstallingUpdateId(undefined),
  });

  const installSelectedDrivers = useMutation({
    mutationFn: async (updatesList: AvailableDriverUpdate[]) => {
      const reports: DriverUpdateReport[] = [];
      for (const update of updatesList) {
        setDriverInstallingUpdateId(update.update_id);
        reports.push(
          await bridge.installDriverUpdate({
            update_id: update.update_id,
            revision_number: update.revision_number,
          }),
        );
      }
      setDriverUpdateReports(reports);
      return reports;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.drivers });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.audit });
    },
    onSettled: () => setDriverInstallingUpdateId(undefined),
  });

  const applyTweaks = useMutation({
    mutationFn: async () => {
      const config: TweakBatchConfig = {
        schema_version: 1,
        tweaks: pendingTweaks,
      };
      const controller = new AbortController();
      applyWaitController.current?.abort();
      applyWaitController.current = controller;
      try {
        setApplyProgressOpen(true);
        setApplyOperation(undefined);
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
    onSuccess: async () => {
      setPendingTweaks([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statuses }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.advisor }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recoveries }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.audit }),
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
    onSuccess: () => {
      setApplyCancelling(true);
    },
  });

  const restore = useMutation({
    mutationFn: async (sessionId: string) => {
      setRestored(false);
      setRestoreError(false);
      setRestoredSessionId(undefined);
      return bridge.restore(sessionId);
    },
    onSuccess: async (report) => {
      setRestored(true);
      setRestoredSessionId(report.source_session_id);
      setPendingTweaks([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statuses }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.advisor }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recoveries }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.audit }),
      ]);
    },
    onError: () => {
      setRestoreError(true);
    },
  });

  // Action Queuers
  const handleToggleTweak = useCallback(
    (id: string, desired: TweakDesiredState) => {
      setPendingTweaks((prev) => {
        const filtered = prev.filter((p) => p.id !== id);
        const currentStatus = statuses.data?.find((s) => s.id === id)?.state;
        const isCurrentlyApplied =
          currentStatus === "enabled" || currentStatus === "requires_restart";

        // If desired state matches current state, remove it from queue
        if (
          (desired === "enabled" && isCurrentlyApplied) ||
          (desired === "disabled" && !isCurrentlyApplied)
        ) {
          return filtered;
        }
        return [...filtered, { id, desired_state: desired }];
      });
    },
    [statuses.data],
  );

  const handleSelectTweakFromAdvisor = useCallback(
    (id: string) => {
      // Check tweak status
      const currentStatus = statuses.data?.find((s) => s.id === id)?.state;
      const isCurrentlyApplied =
        currentStatus === "enabled" || currentStatus === "requires_restart";

      if (!isCurrentlyApplied) {
        handleToggleTweak(id, "enabled");
      }
    },
    [statuses.data, handleToggleTweak],
  );

  const handleToggleAppSelection = useCallback((id: string) => {
    setSelectedApps((prev) => toggleId(prev, id));
  }, []);

  const handleDiscardAll = useCallback(() => {
    setPendingTweaks([]);
    setSelectedApps(new Set());
    setSelectedDriverUpdates(new Set());
  }, []);

  const handleApplyChanges = async () => {
    if (pendingTweaks.length > 0) {
      await applyTweaks.mutateAsync();
    }
    if (selectedApps.size > 0) {
      await installApps.mutateAsync([...selectedApps]);
    }
  };

  const handleRescan = useCallback(() => {
    void catalog.refetch();
    void statuses.refetch();
    void recoveries.refetch();
    if (goals.length > 0) void advisor.refetch();
    void apps.refetch();
    void appProviders.refetch();
    if (isTauri()) {
      void audit.refetch();
      void drivers.refetch();
    }
  }, [catalog, statuses, recoveries, goals.length, advisor, apps, appProviders, audit, drivers]);

  const handleFactoryReset = useCallback(() => {
    localStorage.clear();
    setGoals([]);
    setPendingTweaks([]);
    setSelectedApps(new Set());
    setSelectedDriverUpdates(new Set());
    setDark(true);
    handleRescan();
    setCurrentView("home");
  }, [handleRescan]);

  // Resolve Header Subtitle / Extra info
  const headerSubtitle = useMemo(() => {
    if (currentView === "optimize") {
      return (
        <span className="text-metadata text-on-surface-variant font-metadata">
          System tweaks catalog configuration
        </span>
      );
    }
    if (currentView === "drivers") {
      return (
        <span className="text-metadata text-on-surface-variant font-metadata">
          Hardware components and controller updates
        </span>
      );
    }
    if (currentView === "apps") {
      return (
        <span className="text-metadata text-on-surface-variant font-metadata">
          Sideload software utilities using native package managers
        </span>
      );
    }
    return undefined;
  }, [currentView]);

  return (
    <div className="flex h-screen w-full bg-bg-app text-on-surface overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          setSearchQuery("");
        }}
        audit={audit.data}
        loading={audit.isLoading}
      />

      {/* Main View Shell */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Universal Top App Bar */}
        <Header
          title={
            currentView === "home"
              ? "System Health"
              : currentView === "optimize"
                ? "Optimize"
                : currentView === "drivers"
                  ? "Drivers"
                  : currentView === "apps"
                    ? "Apps"
                    : currentView === "windows"
                      ? "Windows"
                      : currentView === "recovery"
                        ? "Recovery"
                        : "Settings"
          }
          extra={headerSubtitle}
          searchQuery={
            ["optimize", "apps", "windows", "drivers"].includes(currentView)
              ? searchQuery
              : undefined
          }
          onSearchQueryChange={setSearchQuery}
          onRescan={handleRescan}
          scanning={catalog.isFetching || statuses.isFetching || audit.isFetching}
        />

        {/* View Switcher Router */}
        <div className="flex-1 overflow-hidden relative">
          {currentView === "home" && (
            <HomePage
              audit={audit.data}
              tweakStatuses={statuses.data || []}
              catalog={catalog.data || []}
              advisorReport={advisor.data}
              goals={goals}
              onGoalsChange={setGoals}
              onNavigateToView={setCurrentView}
              onSelectTweak={handleSelectTweakFromAdvisor}
              onScan={handleRescan}
              scanning={catalog.isFetching || statuses.isFetching || audit.isFetching}
            />
          )}

          {currentView === "optimize" && (
            <OptimizePage
              catalog={catalog.data || []}
              statuses={statuses.data || []}
              pendingTweaks={pendingTweaks}
              onToggleTweak={handleToggleTweak}
              onScan={handleRescan}
              scanning={catalog.isFetching || statuses.isFetching || audit.isFetching}
              searchQuery={searchQuery}
            />
          )}

          {currentView === "drivers" && (
            <DriversPage
              inventory={drivers.data}
              loading={drivers.isLoading || drivers.isFetching}
              error={drivers.isError}
              installingUpdateId={driverInstallingUpdateId}
              onInstallUpdate={(u) => installDriverUpdate.mutate(u)}
              onInstallSelected={(u) => installSelectedDrivers.mutate(u)}
              onRefresh={() => void drivers.refetch()}
            />
          )}

          {currentView === "apps" && (
            <AppsPage
              apps={apps.data || []}
              providers={appProviders.data || []}
              selectedApps={selectedApps}
              onToggleApp={handleToggleAppSelection}
              appManager={appManager}
              onAppManagerChange={setAppManager}
              onInstallApps={() => installApps.mutate([...selectedApps])}
              installing={installApps.isPending}
              loading={apps.isLoading || appProviders.isLoading}
              error={apps.isError || appProviders.isError}
              searchQuery={searchQuery}
            />
          )}

          {currentView === "windows" && (
            <WindowsPage
              catalog={catalog.data || []}
              statuses={statuses.data || []}
              pendingTweaks={pendingTweaks}
              onToggleTweak={handleToggleTweak}
            />
          )}

          {currentView === "recovery" && (
            <RecoveryPage
              recoveries={recoveries.data || []}
              onRestoreSession={(id) => restore.mutate(id)}
              restoring={restore.isPending}
              error={restore.isError}
              restoredSessionId={restoredSessionId}
            />
          )}

          {currentView === "settings" && (
            <SettingsPage
              onFactoryReset={handleFactoryReset}
              dark={dark}
              onThemeToggle={() => setDark((prev) => !prev)}
            />
          )}
        </div>

        {/* Global Bottom Actions Queue Bar */}
        <BottomChangesBar
          tweakCount={pendingTweaks.length}
          appCount={selectedApps.size}
          driverCount={selectedDriverUpdates.size}
          onDiscardAll={handleDiscardAll}
          onApply={handleApplyChanges}
          applying={applyTweaks.isPending || installApps.isPending}
        />
      </div>

      {/* Progress Apply Overlay Modal */}
      {applyProgressOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-surface-container border border-border-subtle rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh] animate-scaleIn">
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-section-title font-section-title font-bold text-on-surface">
                  Executing Registry Adjustments
                </h3>
                <p className="text-metadata text-on-surface-variant font-metadata mt-1">
                  Do not close WinTweak while tweaks are active.
                </p>
              </div>
              {applyOperation?.phase === "running" && (
                <button
                  onClick={() => cancelApply.mutate()}
                  disabled={applyCancelling}
                  className="px-3 py-1 bg-danger/10 hover:bg-danger/25 text-danger border border-danger/30 rounded text-xs font-semibold cursor-pointer"
                >
                  {applyCancelling ? "Stopping..." : "Cancel"}
                </button>
              )}
            </div>

            {/* Event logs stream console */}
            <div className="flex-1 bg-surface-container-lowest border border-border-subtle rounded-lg p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar space-y-2 mb-6 min-h-[200px]">
              <div className="text-primary font-bold">--- TWEAK REGISTRY BATCH LAUNCHED ---</div>
              {applyOperation?.events.map((event, idx) => {
                if (event.kind === "batch_started") {
                  return (
                    <div key={idx} className="text-on-surface-variant">
                      &gt; Batch size: {event.total_tweaks} tweaks, {event.total_changes} actions
                      queued...
                    </div>
                  );
                }
                if (event.kind === "tweak_started") {
                  return (
                    <div key={idx} className="text-on-surface-variant">
                      &gt; Running adjustment [{event.tweak_id}]...
                    </div>
                  );
                }
                if (event.kind === "change_committed") {
                  return (
                    <div key={idx} className="text-success ml-4">
                      + Registry change applied. Committed total: {event.committed_change_count}
                    </div>
                  );
                }
                if (event.kind === "tweak_completed") {
                  return (
                    <div key={idx} className="text-primary ml-2 font-semibold">
                      ✔ Adjustment successfully verified. [{event.tweak_id}]
                    </div>
                  );
                }
                if (event.kind === "batch_completed") {
                  return (
                    <div key={idx} className="text-success font-bold mt-4">
                      ✔ BATCH COMPLETED. {event.completed_tweak_count} modifications verified.
                    </div>
                  );
                }
                if (event.kind === "cancelled") {
                  return (
                    <div key={idx} className="text-warning font-bold mt-4">
                      ⚠ Operation cancelled by user. Backup session saved.
                    </div>
                  );
                }
                if (event.kind === "failed") {
                  return (
                    <div key={idx} className="text-danger font-bold mt-4">
                      ✖ Operation failed: {event.message}
                    </div>
                  );
                }
                return null;
              })}
              {/* If no events yet */}
              {(!applyOperation || applyOperation.events.length === 0) && (
                <div className="text-on-surface-variant italic">Initialising worker process...</div>
              )}
            </div>

            {/* Modal Bottom control buttons */}
            <div className="flex justify-between items-center mt-auto border-t border-border-subtle pt-4">
              <div className="text-metadata text-on-surface-variant font-semibold">
                Status:{" "}
                <span className="capitalize text-primary">{applyOperation?.phase || "Queued"}</span>
              </div>
              <button
                onClick={() => setApplyProgressOpen(false)}
                disabled={applyOperation?.phase === "running" || applyOperation?.phase === "queued"}
                className="bg-primary text-on-primary font-semibold px-6 py-2 rounded-lg hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-primary/20"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
