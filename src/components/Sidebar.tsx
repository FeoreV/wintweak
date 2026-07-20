import type { SystemAudit } from "../types/backend.generated";

type SidebarProps = {
  currentView: string;
  onViewChange: (view: string) => void;
  audit?: SystemAudit;
  loading?: boolean;
};

export function Sidebar({ currentView, onViewChange, audit, loading }: SidebarProps) {
  const navItems = [
    { id: "home", label: "Home", icon: "home" },
    { id: "optimize", label: "Optimize", icon: "speed" },
    { id: "drivers", label: "Drivers", icon: "settings_input_component" },
    { id: "apps", label: "Apps", icon: "grid_view" },
    { id: "windows", label: "Windows", icon: "window" },
    { id: "recovery", label: "Recovery", icon: "settings_backup_restore" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  const env = audit?.environment;
  const osName =
    env?.windows === "windows11"
      ? "Windows 11"
      : env?.windows === "windows10"
        ? "Windows 10"
        : "Windows OS";
  const buildStr = env?.build ? `Build ${env.build}` : "Loading...";
  const archStr = env?.architecture ? env.architecture.toUpperCase() : "";
  const isAdmin = env?.is_admin ?? false;

  return (
    <nav className="fixed left-0 top-0 h-full w-sidebar-width flex flex-col py-4 space-y-2 border-r border-outline-variant bg-bg-sidebar z-20 shrink-0">
      {/* Brand logo & header */}
      <div className="px-gutter mb-6 flex items-center gap-3">
        <span
          className="material-symbols-outlined text-primary text-[28px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          hexagon
        </span>
        <div>
          <h1 className="text-section-title font-section-title font-bold text-on-surface tracking-tight leading-none">
            WinTweak
          </h1>
          <p className="text-metadata font-metadata text-on-surface-variant mt-1">v2.2.0</p>
        </div>
      </div>

      {/* Main navigation list */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 h-target-min rounded transition-all text-left ${
                active
                  ? "bg-surface-2 text-primary border-l-4 border-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-1"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-supporting font-supporting">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom PC details card */}
      <div className="px-4 mt-auto space-y-4">
        <div className="bg-surface-1 rounded-lg p-4 border border-border-subtle flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
              desktop_windows
            </span>
            {isAdmin && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Admin
              </span>
            )}
          </div>
          <div className="text-supporting font-supporting font-medium text-on-surface truncate">
            {loading ? "Scanning System..." : "Local PC"}
          </div>
          <div className="flex flex-col gap-1 mt-2 text-on-surface-variant text-metadata font-metadata">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">grid_view</span>
              <span className="truncate">{osName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">build</span>
              <span className="truncate">
                {buildStr} ({archStr})
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
