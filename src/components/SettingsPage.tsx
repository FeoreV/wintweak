import { useState } from "react";

type SettingsPageProps = {
  onFactoryReset: () => void;
  dark: boolean;
  onThemeToggle: () => void;
};

export function SettingsPage({ onFactoryReset, dark, onThemeToggle }: SettingsPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<string>("Protection");
  const [scanSchedule, setScanSchedule] = useState<string>("Weekly");
  const [scanIdle, setScanIdle] = useState<boolean>(true);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const handleSave = () => {
    setHasChanges(false);
    // Persist locally
    localStorage.setItem("wintweak.scan-schedule", scanSchedule);
    localStorage.setItem("wintweak.scan-idle", String(scanIdle));
  };

  const handleReset = () => {
    setScanSchedule(localStorage.getItem("wintweak.scan-schedule") || "Weekly");
    setScanIdle(localStorage.getItem("wintweak.scan-idle") !== "false");
    setHasChanges(false);
  };

  const updateSchedule = (val: string) => {
    setScanSchedule(val);
    setHasChanges(true);
  };

  const updateIdle = (val: boolean) => {
    setScanIdle(val);
    setHasChanges(true);
  };

  return (
    <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app">
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Side Settings Navigation */}
        <aside className="w-full md:w-56 bg-surface-dim border-r border-border-subtle p-6 shrink-0 md:block hidden">
          <h1 className="text-page-title font-page-title mb-6 tracking-tight font-black text-on-surface">
            Settings
          </h1>
          <nav className="space-y-1">
            {["General", "Scanning", "Protection", "Notifications", "Appearance"].map((item) => (
              <button
                key={item}
                onClick={() => setActiveSubTab(item)}
                className={`w-full block px-4 py-2.5 rounded-md text-supporting font-supporting text-left cursor-pointer transition-colors ${
                  activeSubTab === item
                    ? "bg-surface-2 text-primary border-l-4 border-primary"
                    : "text-on-surface-variant hover:bg-surface-1 hover:text-on-surface"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        {/* Right Settings Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          {/* Unsaved Changes Banner */}
          {hasChanges && (
            <div className="sticky top-0 z-10 mb-8 bg-surface-2 border border-border-subtle rounded-lg p-3 px-4 flex flex-col sm:flex-row items-center justify-between shadow-lg backdrop-blur-md">
              <div className="flex items-center mb-3 sm:mb-0">
                <span className="material-symbols-outlined text-tertiary mr-3">error</span>
                <span className="text-supporting text-on-surface">
                  You have unsaved changes in Settings.
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-surface-3 rounded text-supporting text-on-surface-variant cursor-pointer hover:bg-surface-2"
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-accent-blue-strong text-text-primary rounded text-supporting font-medium shadow-sm cursor-pointer hover:brightness-110"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto space-y-10 pb-24">
            {activeSubTab === "Protection" && (
              <section className="animate-fadeIn">
                <h2 className="text-section-title font-section-title text-on-surface mb-4 border-b border-border-subtle pb-2">
                  PROTECTION
                </h2>
                <div className="bg-surface-1 rounded-xl border border-border-subtle">
                  <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                    <div>
                      <h3 className="text-item-title font-item-title font-semibold text-on-surface">
                        Scan schedule
                      </h3>
                      <p className="text-supporting text-text-tertiary">
                        Set automated system integrity checks.
                      </p>
                    </div>
                    <select
                      value={scanSchedule}
                      onChange={(e) => updateSchedule(e.target.value)}
                      className="bg-surface-3 border border-border-subtle text-on-surface rounded-md px-3 py-2 outline-none"
                    >
                      <option value="Manual">Manual Only</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>

                  <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                    <label className="flex items-center gap-4 cursor-pointer w-full">
                      <input
                        type="checkbox"
                        checked={scanIdle}
                        onChange={(e) => updateIdle(e.target.checked)}
                        className="form-checkbox h-5 w-5 text-primary rounded bg-surface-3 cursor-pointer"
                      />
                      <div>
                        <h3 className="text-item-title font-item-title font-semibold text-on-surface">
                          Scan when PC is idle
                        </h3>
                        <p className="text-supporting text-text-tertiary">
                          Wait for user inactivity before scans.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </section>
            )}

            {activeSubTab === "Appearance" && (
              <section className="animate-fadeIn">
                <h2 className="text-section-title font-section-title text-on-surface mb-4 border-b border-border-subtle pb-2">
                  APPEARANCE
                </h2>
                <div className="bg-surface-1 rounded-xl border border-border-subtle p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-item-title font-item-title font-semibold text-on-surface">
                        Dark Mode Theme
                      </h3>
                      <p className="text-supporting text-text-tertiary">
                        Switch between dark and light colors.
                      </p>
                    </div>
                    <button
                      onClick={onThemeToggle}
                      className="bg-surface-3 hover:bg-surface-2 border border-border-subtle text-on-surface rounded-md px-4 py-2 font-semibold cursor-pointer"
                    >
                      {dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* General Settings */}
            {activeSubTab === "General" && (
              <section className="animate-fadeIn">
                <h2 className="text-section-title font-section-title text-on-surface mb-4 border-b border-border-subtle pb-2">
                  GENERAL SETTINGS
                </h2>
                <div className="bg-surface-1 rounded-xl border border-border-subtle p-5 space-y-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">Application Language</span>
                    <span className="text-text-secondary">English</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Run on Startup</span>
                    <span className="text-text-secondary">Disabled</span>
                  </div>
                </div>
              </section>
            )}

            {/* Scanning details */}
            {(activeSubTab === "Scanning" || activeSubTab === "Notifications") && (
              <section className="animate-fadeIn">
                <h2 className="text-section-title font-section-title text-on-surface mb-4 border-b border-border-subtle pb-2">
                  {activeSubTab.toUpperCase()}
                </h2>
                <div className="bg-surface-1 rounded-xl border border-border-subtle p-5 text-center text-on-surface-variant">
                  Settings in this section are active and managed by the local scheduler.
                </div>
              </section>
            )}

            {/* Diagnostic and factory reset (always show at the bottom of settings page) */}
            <section className="mt-8">
              <h2 className="text-section-title font-section-title text-on-surface mb-4 border-b border-border-subtle pb-2">
                DIAGNOSTIC & RESET
              </h2>
              <div className="bg-surface-1 rounded-xl border border-border-subtle p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <h3 className="text-item-title font-item-title text-danger mb-2 font-semibold">
                      Factory Reset
                    </h3>
                    <p className="text-supporting text-text-secondary">
                      Revert all WintTweaker configurations to their default state.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to reset all WintTweaker settings? This clears goals, cached updates and preferences.",
                        )
                      ) {
                        onFactoryReset();
                      }
                    }}
                    className="bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 px-5 py-2 rounded font-semibold cursor-pointer transition-colors shrink-0"
                  >
                    Reset all settings
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
