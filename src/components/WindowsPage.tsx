import { useState } from "react";
import type { TweakDefinition, TweakDesiredState, TweakStatus } from "../types/backend.generated";

type WindowsPageProps = {
  catalog: TweakDefinition[];
  statuses: TweakStatus[];
  pendingTweaks: { id: string; desired_state: TweakDesiredState }[];
  onToggleTweak: (id: string, desired: TweakDesiredState) => void;
};

export function WindowsPage({
  catalog = [],
  statuses = [],
  pendingTweaks,
  onToggleTweak,
}: WindowsPageProps) {
  const [selectedTweakId, setSelectedTweakId] = useState<string | null>(null);

  // Filter tweaks to telemetry, privacy, and search categories
  const windowsTweaks = catalog.filter(
    (t) => t.category === "privacy" || t.category === "search" || t.category === "taskbar",
  );

  const selectedTweak = windowsTweaks.find((t) => t.id === selectedTweakId) || windowsTweaks[0];

  const getTweakStatus = (id: string) => {
    return statuses.find((s) => s.id === id)?.state || "disabled";
  };

  const getPendingState = (id: string) => {
    return pendingTweaks.find((p) => p.id === id)?.desired_state;
  };

  const getCategoryIcon = (category: string) => {
    if (category === "privacy") return "lock";
    if (category === "search") return "search";
    return "settings";
  };

  return (
    <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app overflow-hidden">
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Main List Column */}
        <div className="flex-1 overflow-y-auto px-margin-main pb-32 pt-6 custom-scrollbar">
          <div className="mb-8">
            {/* Headers row */}
            <div className="flex justify-between items-end mb-4 border-b border-border-subtle pb-2 text-metadata text-on-surface-variant font-semibold">
              <h3 className="text-section-title font-section-title text-on-surface">
                Windows Settings
              </h3>
              <div className="hidden lg:flex gap-12">
                <span className="w-20 text-center">Current</span>
                <span className="w-24 text-center">Recommended</span>
                <span className="w-32 text-center">Safety</span>
                <span className="w-20 text-center">Action</span>
              </div>
            </div>

            {/* Tweaks list */}
            {windowsTweaks.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant text-supporting">
                No Windows tweaks available.
              </div>
            ) : (
              <div className="space-y-3">
                {windowsTweaks.map((tweak) => {
                  const currentStatus = getTweakStatus(tweak.id);
                  const isApplied =
                    currentStatus === "enabled" || currentStatus === "requires_restart";

                  const pendingState = getPendingState(tweak.id);
                  // Checked means we want it optimized (applied)
                  const isChecked =
                    pendingState !== undefined ? pendingState === "enabled" : isApplied;

                  const isCurrentSelected =
                    selectedTweakId === tweak.id ||
                    (!selectedTweakId && selectedTweak?.id === tweak.id);

                  const handleToggle = () => {
                    if (isChecked) {
                      onToggleTweak(tweak.id, "disabled");
                    } else {
                      onToggleTweak(tweak.id, "enabled");
                    }
                  };

                  return (
                    <div
                      key={tweak.id}
                      onClick={() => setSelectedTweakId(tweak.id)}
                      className={`bg-surface-2 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center p-3 gap-4 cursor-pointer transition-all ${
                        isCurrentSelected
                          ? "border-primary ring-1 ring-primary/50 shadow-md"
                          : "border-border-subtle hover:bg-surface-3/50"
                      }`}
                    >
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                        <span className="material-symbols-outlined">
                          {getCategoryIcon(tweak.category)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <h4 className="text-item-title font-item-title text-on-surface font-semibold truncate">
                          {tweak.title.en}
                        </h4>
                        <p className="text-metadata text-on-surface-variant truncate">
                          {tweak.description.en}
                        </p>
                      </div>

                      {/* Right metadata controls */}
                      <div className="flex items-center gap-6 sm:gap-12 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-border-subtle/50 pt-2 sm:pt-0 mt-2 sm:mt-0">
                        {/* Current */}
                        <div
                          className={`w-20 text-center text-metadata font-semibold ${isApplied ? "text-success" : "text-on-surface-variant"}`}
                        >
                          {isApplied ? "Applied" : "Default"}
                        </div>

                        {/* Recommended */}
                        <div className="w-24 text-center text-metadata text-primary font-semibold">
                          Applied
                        </div>

                        {/* Safety */}
                        <div className="w-32 flex justify-center">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase ${
                              tweak.risk === "low"
                                ? "bg-success/15 text-success border-success/30"
                                : tweak.risk === "moderate"
                                  ? "bg-warning/15 text-warning border-warning/30"
                                  : "bg-danger/15 text-danger border-danger/30"
                            }`}
                          >
                            {tweak.risk === "low"
                              ? "Safe"
                              : tweak.risk === "moderate"
                                ? "Review"
                                : "Risk"}
                          </span>
                        </div>

                        {/* Action Toggle */}
                        <div className="w-20 flex justify-center items-center shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggle();
                            }}
                            className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer border transition-colors ${
                              isChecked
                                ? "bg-primary/20 text-primary border-primary/45 hover:bg-primary/30"
                                : "bg-surface-3 text-text-primary border-border-subtle hover:bg-surface-2"
                            }`}
                          >
                            {isChecked ? "Optimize" : "Restore"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Details Aside Column */}
        {selectedTweak && (
          <aside className="w-[360px] hidden xl:flex flex-col border-l border-outline-variant bg-surface-dim p-6 gap-8 overflow-y-auto custom-scrollbar shrink-0">
            <header>
              <h3 className="text-section-title font-section-title text-on-surface mb-2 font-bold leading-tight">
                {selectedTweak.title.en}
              </h3>
              <span className="text-metadata text-on-surface-variant block font-mono bg-surface-2 p-1.5 rounded mt-2 select-all truncate">
                {selectedTweak.id}
              </span>
            </header>

            <section>
              <h4 className="text-item-title font-item-title text-on-surface font-semibold mb-2">
                Why this matters
              </h4>
              <p className="text-body-main text-on-surface-variant leading-relaxed text-sm">
                {selectedTweak.description.en}
              </p>
            </section>

            {selectedTweak.warnings.length > 0 && (
              <section className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-warning">
                <h4 className="text-item-title font-item-title font-bold flex items-center gap-1.5 mb-2 text-sm">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Warnings
                </h4>
                <p className="text-metadata leading-relaxed">{selectedTweak.warnings[0].en}</p>
              </section>
            )}

            <section className="border-t border-border-subtle pt-6">
              <h4 className="text-metadata font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                Tweak support info
              </h4>
              <ul className="space-y-1 text-metadata text-on-surface-variant font-metadata">
                <li>
                  <span className="font-semibold text-on-surface">Min Build:</span>{" "}
                  {selectedTweak.support.minimum_build}
                </li>
                <li>
                  <span className="font-semibold text-on-surface">Reversible:</span>{" "}
                  {selectedTweak.reversible ? "Yes" : "No"}
                </li>
                <li>
                  <span className="font-semibold text-on-surface">Admin Required:</span>{" "}
                  {selectedTweak.requires_admin ? "Yes" : "No"}
                </li>
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
