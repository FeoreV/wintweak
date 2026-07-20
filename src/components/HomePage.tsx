import type {
  AdvisorReport,
  SystemAudit,
  TweakDefinition,
  TweakStatus,
  UserGoal,
} from "../types/backend.generated";

type HomePageProps = {
  audit?: SystemAudit;
  tweakStatuses: TweakStatus[];
  catalog: TweakDefinition[];
  advisorReport?: AdvisorReport;
  goals: UserGoal[];
  onGoalsChange: (goals: UserGoal[]) => void;
  onNavigateToView: (view: string) => void;
  onSelectTweak: (id: string) => void;
  onScan: () => void;
  scanning: boolean;
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "Just started";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export function HomePage({
  audit,
  tweakStatuses = [],
  catalog = [],
  advisorReport,
  goals,
  onGoalsChange,
  onNavigateToView,
  onSelectTweak,
  onScan,
  scanning,
}: HomePageProps) {
  const totalTweaks = tweakStatuses.length;
  const activeTweaks = tweakStatuses.filter(
    (s) => s.state === "enabled" || s.state === "requires_restart",
  ).length;

  const sysInfo = audit?.system_info;

  const toggleGoal = (goal: UserGoal) => {
    if (goals.includes(goal)) {
      onGoalsChange(goals.filter((g) => g !== goal));
    } else {
      onGoalsChange([...goals, goal]);
    }
  };

  const recommendations = (advisorReport?.recommendations || [])
    .filter((r) => r.disposition === "recommended" || r.disposition === "review_required")
    .map((rec) => {
      const tweak = catalog.find((t) => t.id === rec.tweak_id);
      return {
        id: rec.tweak_id,
        title: tweak?.title.en || rec.tweak_id,
        description: tweak?.description.en || "",
        risk: tweak?.risk || "low",
        disposition: rec.disposition,
      };
    })
    .slice(0, 4);

  const totalRam = sysInfo?.total_memory_bytes || 0;
  const freeRam = sysInfo?.available_memory_bytes || 0;
  const usedRam = Math.max(0, totalRam - freeRam);
  const ramPercent = totalRam > 0 ? Math.round((usedRam / totalRam) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app">
      <div className="flex-1 overflow-y-auto p-margin-main pb-24 custom-scrollbar">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-[28px] font-bold text-on-surface leading-tight flex items-center gap-3">
              {sysInfo?.computer_name || "Windows Device"}
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase ${
                  sysInfo?.is_admin
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-surface-3 text-text-tertiary"
                }`}
              >
                {sysInfo?.is_admin ? "Administrator" : "User Mode"}
              </span>
            </h2>
            <p className="text-text-secondary font-supporting flex items-center gap-2 mt-1">
              <span className="material-symbols-outlined text-sm leading-none text-primary">
                laptop_mac
              </span>
              {sysInfo ? `${sysInfo.os_product_name} (${sysInfo.os_display_version}, Build ${sysInfo.os_build})` : "Windows System Audit"}
            </p>
          </div>

          <button
            onClick={onScan}
            disabled={scanning}
            className="bg-primary text-on-primary hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all px-6 py-2.5 rounded-xl text-item-title font-item-title flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
          >
            <span className={`material-symbols-outlined ${scanning ? "animate-spin" : ""}`}>
              {scanning ? "refresh" : "sync"}
            </span>
            {scanning ? "Scanning System..." : "Refresh Status"}
          </button>
        </div>

        {/* System Overview Dashboard Cards */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Hardware Stats */}
          <div className="col-span-12 lg:col-span-8 bg-surface-1 rounded-2xl border border-border-subtle p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-title font-section-title text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">developer_board</span>
                Hardware Specifications
              </h3>
              <span className="text-metadata text-text-tertiary font-medium">
                Uptime: {formatUptime(sysInfo?.uptime_seconds || 0)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* CPU Card */}
              <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle">
                <div className="text-metadata text-on-surface-variant font-medium mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">memory</span>
                  Processor (CPU)
                </div>
                <div className="text-supporting font-semibold text-on-surface truncate">
                  {sysInfo?.cpu_name || "Central Processor"}
                </div>
                <div className="text-metadata text-text-tertiary mt-1">
                  {sysInfo?.logical_cores || 1} Logical Cores
                </div>
              </div>

              {/* Memory Card */}
              <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-metadata text-on-surface-variant font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">speed</span>
                    RAM Memory
                  </div>
                  <span className="text-metadata font-semibold text-on-surface">
                    {ramPercent}% Used
                  </span>
                </div>
                <div className="text-supporting font-semibold text-on-surface">
                  {formatBytes(usedRam)} / {formatBytes(totalRam)}
                </div>
                <div className="w-full bg-surface-3 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full transition-all duration-500 ${ramPercent > 85 ? "bg-danger" : "bg-primary"}`}
                    style={{ width: `${ramPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Storage Volumes */}
            <div>
              <div className="text-metadata font-semibold text-on-surface mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">hard_drive</span>
                Storage Drives
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(sysInfo?.volumes || []).map((vol) => {
                  const used = vol.total_bytes - vol.free_bytes;
                  const pct = Math.round((used / (vol.total_bytes || 1)) * 100);
                  return (
                    <div
                      key={vol.mount_point}
                      className="bg-surface-2 p-4 rounded-xl border border-border-subtle"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-supporting font-semibold text-on-surface">
                          {vol.mount_point} ({vol.label})
                        </span>
                        <span
                          className={`text-metadata font-semibold ${
                            vol.low_space ? "text-danger" : "text-on-surface-variant"
                          }`}
                        >
                          {formatBytes(vol.free_bytes)} free
                        </span>
                      </div>
                      <div className="w-full bg-surface-3 h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full transition-all duration-500 ${
                            vol.low_space ? "bg-danger" : "bg-success"
                          }`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Metrics Summary */}
          <div className="col-span-12 lg:col-span-4 bg-surface-1 rounded-2xl border border-border-subtle p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-section-title font-section-title text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary flex-none">dns</span>
                System Overview
              </h3>

              <div className="space-y-3">
                {/* Installed Apps Count */}
                <div
                  onClick={() => onNavigateToView("apps")}
                  className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle hover:border-primary transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">apps</span>
                    <div>
                      <span className="text-supporting font-semibold text-on-surface block">
                        Installed Applications
                      </span>
                      <span className="text-metadata text-on-surface-variant">Win32 & Appx</span>
                    </div>
                  </div>
                  <span className="text-item-title font-bold text-on-surface">
                    {audit?.installed_apps_count || audit?.appx_package_count || 0}
                  </span>
                </div>

                {/* Active Tweaks Count */}
                <div
                  onClick={() => onNavigateToView("optimize")}
                  className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle hover:border-primary transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-success">tune</span>
                    <div>
                      <span className="text-supporting font-semibold text-on-surface block">
                        Active Tweaks
                      </span>
                      <span className="text-metadata text-on-surface-variant">Desired State</span>
                    </div>
                  </div>
                  <span className="text-item-title font-bold text-on-surface">
                    {activeTweaks} / {totalTweaks}
                  </span>
                </div>

                {/* Pending Restart Status */}
                <div className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`material-symbols-outlined ${
                        audit?.pending_restart ? "text-warning" : "text-success"
                      }`}
                    >
                      {audit?.pending_restart ? "restart_alt" : "check_circle"}
                    </span>
                    <div>
                      <span className="text-supporting font-semibold text-on-surface block">
                        Pending Restart
                      </span>
                      <span className="text-metadata text-on-surface-variant">
                        {audit?.pending_restart ? "System restart needed" : "No restart required"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-metadata font-semibold px-2 py-0.5 rounded ${
                      audit?.pending_restart
                        ? "bg-warning/20 text-warning"
                        : "bg-success/20 text-success"
                    }`}
                  >
                    {audit?.pending_restart ? "Required" : "Clean"}
                  </span>
                </div>

                {/* Package Providers */}
                <div className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">terminal</span>
                    <div>
                      <span className="text-supporting font-semibold text-on-surface block">
                        Package Managers
                      </span>
                      <span className="text-metadata text-on-surface-variant">
                        Winget & Chocolatey
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {(audit?.package_providers || []).map((prov) => (
                      <span
                        key={prov.manager}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase ${
                          prov.available
                            ? "bg-success/20 text-success"
                            : "bg-surface-3 text-text-tertiary"
                        }`}
                      >
                        {prov.manager}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advisor Goals & Recommendations */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 bg-surface-1 rounded-2xl border border-border-subtle p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-tertiary">lightbulb</span>
              <h3 className="text-item-title font-item-title text-on-surface">Advisor Focus</h3>
            </div>
            <p className="text-metadata text-on-surface-variant mb-4">
              Select your optimization goals to receive local recommendations.
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border-subtle hover:bg-surface-3 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={goals.includes("privacy")}
                  onChange={() => toggleGoal("privacy")}
                  className="form-checkbox h-5 w-5 text-primary rounded border-outline bg-transparent focus:ring-0"
                />
                <div>
                  <span className="text-supporting font-semibold text-on-surface block">
                    Privacy Safeguards
                  </span>
                  <span className="text-[12px] text-on-surface-variant">
                    Disable telemetry and ad tracking
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border-subtle hover:bg-surface-3 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={goals.includes("development")}
                  onChange={() => toggleGoal("development")}
                  className="form-checkbox h-5 w-5 text-primary rounded border-outline bg-transparent focus:ring-0"
                />
                <div>
                  <span className="text-supporting font-semibold text-on-surface block">
                    Developer Mode
                  </span>
                  <span className="text-[12px] text-on-surface-variant">
                    Show file extensions, index path, etc.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border-subtle hover:bg-surface-3 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={goals.includes("reduce_distractions")}
                  onChange={() => toggleGoal("reduce_distractions")}
                  className="form-checkbox h-5 w-5 text-primary rounded border-outline bg-transparent focus:ring-0"
                />
                <div>
                  <span className="text-supporting font-semibold text-on-surface block">
                    Focus Tweaks
                  </span>
                  <span className="text-[12px] text-on-surface-variant">
                    Optimize search, widgets and notifications
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-surface-1 rounded-2xl border border-border-subtle p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-title font-section-title text-on-surface">
                Recommended Actions
              </h3>
              {goals.length === 0 && (
                <span className="text-metadata text-warning font-medium">
                  Select goals to generate actions
                </span>
              )}
            </div>

            {recommendations.length === 0 ? (
              <div className="text-center py-10 text-on-surface-variant text-supporting">
                {goals.length > 0
                  ? "No pending recommendations. Your system is fully optimized for selected goals!"
                  : "Choose optimization goals to view personalized suggestions."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => {
                      onSelectTweak(rec.id);
                      onNavigateToView("optimize");
                    }}
                    className="bg-surface-2 p-4 rounded-xl border border-border-subtle hover:border-primary transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-supporting font-semibold text-on-surface group-hover:text-primary transition-colors">
                          {rec.title}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            rec.risk === "low"
                              ? "bg-success/20 text-success"
                              : rec.risk === "moderate"
                                ? "bg-warning/20 text-warning"
                                : "bg-danger/20 text-danger"
                          }`}
                        >
                          {rec.risk}
                        </span>
                      </div>
                      <p className="text-metadata text-on-surface-variant line-clamp-2">
                        {rec.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-primary text-metadata font-semibold group-hover:underline">
                      Configure
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
