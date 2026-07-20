import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { bridge } from "../lib/bridge";
import type {
  AppDefinition,
  AppPackageManager,
  AppProviderStatus,
  InstalledApp,
} from "../types/backend.generated";

type AppsPageProps = {
  apps: AppDefinition[];
  providers: AppProviderStatus[];
  selectedApps: Set<string>;
  onToggleApp: (id: string) => void;
  appManager: AppPackageManager;
  onAppManagerChange: (manager: AppPackageManager) => void;
  onInstallApps: () => void;
  installing: boolean;
  loading: boolean;
  error: boolean;
  searchQuery: string;
};

export function AppsPage({
  apps = [],
  providers = [],
  selectedApps,
  onToggleApp,
  appManager,
  onAppManagerChange,
  onInstallApps,
  installing,
  loading,
  error,
  searchQuery,
}: AppsPageProps) {
  const [activeTab, setActiveTab] = useState<"installed" | "store">("installed");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Query native installed apps inventory
  const { data: installedApps = [], isLoading: loadingInstalled } = useQuery<InstalledApp[]>({
    queryKey: ["installedApps"],
    queryFn: () => bridge.listInstalledApps(),
  });

  const selectedApp = apps.find((app) => app.id === selectedAppId) || apps[0];
  const categories = ["All", ...new Set(apps.map((app) => app.category))];

  // Filtering for Store Apps
  const filteredStoreApps = apps.filter((app) => {
    const matchesCategory = activeCategory === "All" || app.category === activeCategory;
    const matchesSearch =
      searchQuery === "" ||
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filtering for Installed Apps
  const filteredInstalledApps = installedApps.filter((app) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.display_name.toLowerCase().includes(q) ||
      (app.publisher && app.publisher.toLowerCase().includes(q))
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getManagerStatus = (manager: AppPackageManager) => {
    const provider = providers.find((p) => p.manager === manager);
    return provider?.available ? `Available (${provider.version || "ok"})` : "Not Available";
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app justify-center items-center">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin mb-4">
          refresh
        </span>
        <p className="text-supporting text-on-surface-variant">Loading application index...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app justify-center items-center p-6 text-center">
        <span className="material-symbols-outlined text-4xl text-danger mb-4">warning</span>
        <h3 className="text-section-title font-section-title text-on-surface mb-2">
          App Inventory Error
        </h3>
        <p className="text-metadata text-on-surface-variant max-w-md mb-6">
          Could not load the application catalog from the packages backend.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app overflow-hidden">
      {/* Top Header & Tab Navigation */}
      <div className="px-8 pt-6 pb-4 border-b border-border-subtle bg-background/50 backdrop-blur-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-xl border border-border-subtle">
          <button
            onClick={() => setActiveTab("installed")}
            className={`px-5 py-2 rounded-lg text-supporting font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "installed"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">laptop_windows</span>
            Installed Apps ({installedApps.length})
          </button>
          <button
            onClick={() => setActiveTab("store")}
            className={`px-5 py-2 rounded-lg text-supporting font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "store"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">storefront</span>
            App Store ({apps.length})
          </button>
        </div>

        {activeTab === "store" && (
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar max-w-full">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-3 py-1 rounded-full text-metadata font-semibold transition-all cursor-pointer border shrink-0 ${
                  activeCategory === category
                    ? "bg-primary-container text-on-primary-container border-primary/30"
                    : "bg-surface-2 border-border-subtle text-on-surface hover:bg-surface-3"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Body */}
      {activeTab === "installed" ? (
        /* Installed Applications Table */
        <div className="flex-1 px-8 py-6 overflow-hidden flex flex-col">
          <div className="flex-1 bg-surface-1 rounded-xl border border-border-subtle flex flex-col overflow-hidden shadow-sm">
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 px-6 py-4 border-b border-border-subtle bg-surface-1/50 text-metadata uppercase tracking-wider text-text-secondary font-semibold">
              <div>Application Name</div>
              <div>Publisher</div>
              <div>Version</div>
              <div className="text-right">Source</div>
            </div>

            {loadingInstalled ? (
              <div className="flex-1 flex justify-center items-center p-12">
                <span className="material-symbols-outlined text-3xl text-primary animate-spin mr-3">
                  refresh
                </span>
                <span className="text-supporting text-on-surface-variant">
                  Scanning device installed applications...
                </span>
              </div>
            ) : filteredInstalledApps.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center p-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                <p className="text-supporting font-medium">No installed applications match your search query.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border-subtle">
                {filteredInstalledApps.map((app) => (
                  <div
                    key={app.id}
                    className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 px-6 py-3.5 items-center min-h-[52px] hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {getInitials(app.display_name)}
                      </div>
                      <span className="text-item-title font-item-title text-on-surface truncate font-semibold">
                        {app.display_name}
                      </span>
                    </div>

                    <div className="text-supporting text-text-secondary truncate pr-2">
                      {app.publisher || "Unknown Publisher"}
                    </div>

                    <div className="text-supporting text-text-secondary font-mono text-[12px] truncate pr-2">
                      {app.display_version || "—"}
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          app.source === "registry"
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : app.source === "appx"
                              ? "bg-tertiary/20 text-tertiary border border-tertiary/30"
                              : "bg-success/20 text-success border border-success/30"
                        }`}
                      >
                        {app.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* App Store double column catalog */
        <div className="flex-1 px-8 pb-8 pt-6 flex gap-6 overflow-hidden min-h-0">
          {/* Left Column Table */}
          <div className="flex-[2] bg-surface-1 rounded-xl border border-border-subtle flex flex-col overflow-hidden relative shadow-sm">
            <div className="grid grid-cols-[auto_2fr_1fr_1.5fr_1fr_auto] gap-4 px-6 py-4 border-b border-border-subtle bg-surface-1/50 text-metadata uppercase tracking-wider text-text-secondary font-semibold">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={
                    filteredStoreApps.length > 0 &&
                    filteredStoreApps.every((a) => selectedApps.has(a.id))
                  }
                  onChange={() => {
                    const allSelected = filteredStoreApps.every((a) => selectedApps.has(a.id));
                    filteredStoreApps.forEach((app) => {
                      if (allSelected) {
                        if (selectedApps.has(app.id)) onToggleApp(app.id);
                      } else {
                        if (!selectedApps.has(app.id)) onToggleApp(app.id);
                      }
                    });
                  }}
                  className="form-checkbox h-4 w-4 text-primary rounded border-outline cursor-pointer focus:ring-0"
                />
              </div>
              <div>App Name</div>
              <div>Category</div>
              <div>Package ID</div>
              <div>License</div>
              <div className="text-right">Actions</div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border-subtle">
              {filteredStoreApps.map((app) => {
                const isChecked = selectedApps.has(app.id);
                const isCurrentSelected =
                  selectedAppId === app.id || (!selectedAppId && selectedApp?.id === app.id);

                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    className={`grid grid-cols-[auto_2fr_1fr_1.5fr_1fr_auto] gap-4 px-6 py-3 items-center min-h-[56px] cursor-pointer transition-colors ${
                      isCurrentSelected
                        ? "bg-surface-3/30 border-l-2 border-primary"
                        : "hover:bg-surface-2/40"
                    }`}
                  >
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleApp(app.id)}
                        className="form-checkbox h-4 w-4 text-primary rounded border-outline cursor-pointer focus:ring-0"
                      />
                    </div>

                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {getInitials(app.name)}
                      </div>
                      <span className="text-item-title font-item-title text-on-surface truncate font-semibold">
                        {app.name}
                      </span>
                    </div>

                    <div className="text-supporting text-text-secondary truncate pr-2">
                      {app.category}
                    </div>
                    <div
                      className="text-supporting text-text-secondary font-mono text-[11px] truncate pr-2"
                      title={appManager === "winget" ? app.winget : app.choco}
                    >
                      {appManager === "winget" ? app.winget : app.choco}
                    </div>

                    <div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          app.foss
                            ? "bg-success/20 text-success"
                            : "bg-surface-2 border border-border-subtle text-text-secondary"
                        }`}
                      >
                        {app.foss ? "FOSS" : "Proprietary"}
                      </span>
                    </div>

                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleApp(app.id)}
                        className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer border ${
                          isChecked
                            ? "bg-primary text-on-primary border-primary"
                            : "bg-surface-3 text-text-primary border-border-subtle hover:bg-surface-2"
                        }`}
                      >
                        {isChecked ? "Selected" : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column App Details Pane */}
          {selectedApp && (
            <aside className="flex-[1] min-w-[320px] max-w-[400px] flex flex-col gap-4 overflow-y-auto pb-8 custom-scrollbar">
              <div className="bg-surface-1 rounded-xl border border-border-subtle p-5 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                  {getInitials(selectedApp.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-item-title font-item-title text-on-surface font-bold truncate leading-tight">
                    {selectedApp.name}
                  </h3>
                  <p className="text-success text-metadata font-medium mt-1">Available in App Store</p>
                </div>
              </div>

              <div className="bg-surface-1 rounded-xl border border-border-subtle p-5 flex flex-col gap-4 shadow-sm">
                <div>
                  <h4 className="text-supporting font-semibold text-on-surface mb-2">
                    Package Manager
                  </h4>
                  <div className="grid grid-cols-2 gap-2 bg-surface-2 p-1 rounded-lg border border-border-subtle">
                    <button
                      onClick={() => onAppManagerChange("winget")}
                      className={`py-1.5 rounded-md text-metadata font-semibold transition-all cursor-pointer ${
                        appManager === "winget"
                          ? "bg-primary text-on-primary shadow"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      winget
                    </button>
                    <button
                      disabled={selectedApp.choco === "na"}
                      onClick={() => onAppManagerChange("choco")}
                      className={`py-1.5 rounded-md text-metadata font-semibold transition-all cursor-pointer ${
                        appManager === "choco"
                          ? "bg-primary text-on-primary shadow"
                          : "text-on-surface-variant hover:text-on-surface disabled:opacity-40"
                      }`}
                    >
                      chocolatey
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-on-surface-variant border-t border-border-subtle pt-3">
                  <div className="flex justify-between mb-1">
                    <span>Selected Manager Status:</span>
                    <span className="font-semibold text-on-surface">
                      {getManagerStatus(appManager)}
                    </span>
                  </div>
                  {selectedApp.choco === "na" && (
                    <span className="text-warning block mt-1">
                      Note: Package is available exclusively via winget.
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-surface-1 rounded-xl border border-border-subtle p-5 flex flex-col gap-3 shadow-sm">
                <h4 className="text-supporting font-semibold text-on-surface">About</h4>
                <p className="text-metadata text-on-surface-variant leading-relaxed">
                  {selectedApp.description || "No description provided for this software package."}
                </p>
                {selectedApp.link && (
                  <a
                    href={selectedApp.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-metadata text-primary font-semibold flex items-center gap-1 hover:underline mt-2"
                  >
                    Visit Official Website
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                )}
              </div>

              <div className="bg-surface-1 rounded-xl border border-border-subtle p-5 flex flex-col gap-3 shadow-sm">
                <h4 className="text-supporting font-semibold text-on-surface">Action</h4>
                <button
                  onClick={() => {
                    if (!selectedApps.has(selectedApp.id)) {
                      onToggleApp(selectedApp.id);
                    }
                    onInstallApps();
                  }}
                  disabled={installing}
                  className="w-full bg-primary text-on-primary font-semibold py-2.5 rounded hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer shadow shadow-primary/25 text-supporting uppercase tracking-wider"
                >
                  {installing ? "Installing..." : "Install App"}
                </button>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Floating Bottom Bar for Store Selection */}
      {activeTab === "store" && selectedApps.size > 0 && (
        <div className="bg-surface-3 fixed bottom-0 right-0 z-40 flex justify-between items-center px-8 py-4 ml-[232px] w-[calc(100%-232px)] border-t border-outline-variant shadow-lg animate-slideUp">
          <span className="font-item-title text-item-title text-text-primary">
            {selectedApps.size} application{selectedApps.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={onInstallApps}
              disabled={installing}
              className="bg-primary text-on-primary rounded-lg px-6 py-2 font-item-title text-item-title shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
            >
              {installing ? "Installing selected..." : "Install apps"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
