import { useState } from "react";
import type { TweakDefinition, TweakDesiredState, TweakStatus } from "../types/backend.generated";

type OptimizePageProps = {
  catalog: TweakDefinition[];
  statuses: TweakStatus[];
  pendingTweaks: { id: string; desired_state: TweakDesiredState }[];
  onToggleTweak: (id: string, desired: TweakDesiredState) => void;
  onScan: () => void;
  scanning: boolean;
  searchQuery: string;
};

export function OptimizePage({
  catalog = [],
  statuses = [],
  pendingTweaks,
  onToggleTweak,
  onScan,
  scanning,
  searchQuery,
}: OptimizePageProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedTweakId, setExpandedTweakId] = useState<string | null>(null);

  // Derive available categories dynamically from backend catalog
  const catalogCategories = Array.from(new Set(catalog.map((t) => t.category)));
  const categories = ["all", "recommended", ...catalogCategories];

  const getTweakStatus = (id: string) => {
    return statuses.find((s) => s.id === id)?.state || "disabled";
  };

  const getPendingState = (id: string) => {
    return pendingTweaks.find((p) => p.id === id)?.desired_state;
  };

  // Dynamic filter based on catalog DTOs
  const filteredCatalog = catalog.filter((tweak) => {
    const matchesSearch =
      searchQuery === "" ||
      tweak.title.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tweak.description.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tweak.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const state = getTweakStatus(tweak.id);
    const isApplied = state === "enabled" || state === "requires_restart";

    if (activeCategory === "all") return true;
    if (activeCategory === "recommended") return !isApplied && tweak.risk !== "high";
    return tweak.category === activeCategory;
  });

  const notApplied = catalog.filter((t) => {
    const s = getTweakStatus(t.id);
    return s !== "enabled" && s !== "requires_restart";
  });
  const safeCount = notApplied.filter((t) => t.risk === "low").length;
  const reviewCount = notApplied.filter((t) => t.risk === "moderate").length;
  const dangerCount = notApplied.filter((t) => t.risk === "high").length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "privacy":
        return "shield";
      case "developer":
        return "code";
      case "search":
        return "search";
      case "taskbar":
      case "explorer":
        return "window";
      case "appearance":
        return "palette";
      case "input":
        return "keyboard";
      case "ai":
        return "smart_toy";
      default:
        return "settings";
    }
  };

  return (
    <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app">
      <div className="flex-1 overflow-y-auto p-margin-main pb-32 custom-scrollbar">
        {/* Status card */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-section-title font-section-title text-on-surface">Scan Status:</h2>
            <span className="text-on-surface-variant text-body-main font-body-main">
              {scanning ? "Scanning system..." : `Catalog validated (${catalog.length} tweaks)`}
            </span>
            {!scanning && (
              <span className="material-symbols-outlined text-success">check_circle</span>
            )}
          </div>

          <button
            onClick={onScan}
            disabled={scanning}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-supporting font-supporting flex items-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-primary/20"
          >
            <span className={`material-symbols-outlined text-sm ${scanning ? "animate-spin" : ""}`}>
              {scanning ? "refresh" : "search"}
            </span>
            {scanning ? "Scanning..." : "Run new scan"}
          </button>
        </div>

        {/* Audit recommendations summary */}
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 mb-8 flex items-center justify-between">
          <p className="text-body-main font-body-main text-on-surface">
            <span className="font-bold">{notApplied.length}</span> optimization{notApplied.length === 1 ? "" : "s"} available
            <span className="text-on-surface-variant">
              {" "}
              ({safeCount} safe, {reviewCount} review required, {dangerCount} optional)
            </span>
          </p>
          <span className="text-metadata font-semibold text-primary">
            {pendingTweaks.length} change{pendingTweaks.length === 1 ? "" : "s"} staged
          </span>
        </div>

        {/* Dynamic Category Tab Switcher */}
        <div className="flex border-b border-border-subtle mb-6 overflow-x-auto hide-scrollbar gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-3 font-item-title text-item-title whitespace-nowrap border-b-2 transition-all cursor-pointer capitalize font-semibold ${
                activeCategory === cat
                  ? "text-primary border-primary"
                  : "text-on-surface-variant border-transparent hover:text-on-surface"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tweaks list */}
        {filteredCatalog.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant text-supporting bg-surface-1 border border-border-subtle rounded-xl">
            No tweaks found in this category matching your search.
          </div>
        ) : (
          <div className="bg-surface-1 border border-border-subtle rounded-xl flex flex-col shadow-sm divide-y divide-border-subtle">
            {filteredCatalog.map((tweak) => {
              const currentStatus = getTweakStatus(tweak.id);
              const isApplied = currentStatus === "enabled" || currentStatus === "requires_restart";

              const pendingState = getPendingState(tweak.id);
              const isChecked = pendingState !== undefined ? pendingState === "enabled" : isApplied;
              const isExpanded = expandedTweakId === tweak.id;

              const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const checked = e.target.checked;
                if (checked) {
                  onToggleTweak(tweak.id, "enabled");
                } else {
                  onToggleTweak(tweak.id, "disabled");
                }
              };

              return (
                <div
                  key={tweak.id}
                  className={`flex flex-col ${isExpanded ? "bg-surface-2" : "hover:bg-surface-2/45"} transition-colors`}
                >
                  {/* Row Header */}
                  <div className="flex items-center p-4">
                    <div className="w-12 flex justify-center shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={handleCheckboxChange}
                        className="form-checkbox h-5 w-5 text-primary rounded border-outline bg-transparent focus:ring-0 cursor-pointer"
                      />
                    </div>
                    <div className="w-12 flex justify-center text-on-surface-variant shrink-0">
                      <span className="material-symbols-outlined">
                        {getCategoryIcon(tweak.category)}
                      </span>
                    </div>

                    <div
                      className="flex-1 pr-4 min-w-0 cursor-pointer"
                      onClick={() => setExpandedTweakId(isExpanded ? null : tweak.id)}
                    >
                      <div className="text-item-title font-item-title text-on-surface truncate flex items-center gap-2">
                        {tweak.title.en}
                        {tweak.requires_admin && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold uppercase"
                            title="Requires administrator privileges"
                          >
                            Admin
                          </span>
                        )}
                        {currentStatus === "requires_restart" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-semibold uppercase">
                            Reboot Pending
                          </span>
                        )}
                      </div>
                      <div className="text-metadata font-metadata text-on-surface-variant mt-0.5 truncate">
                        {tweak.description.en}
                      </div>
                    </div>

                    <div className="w-32 flex justify-start shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase border ${
                          tweak.risk === "low"
                            ? "bg-success/10 text-success border-success/20"
                            : tweak.risk === "moderate"
                              ? "bg-warning/10 text-warning border-warning/20"
                              : "bg-danger/10 text-danger border-danger/20"
                        }`}
                      >
                        {tweak.risk === "low"
                          ? "Safe"
                          : tweak.risk === "moderate"
                            ? "Review"
                            : "Risk"}
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedTweakId(isExpanded ? null : tweak.id)}
                      className="w-8 flex justify-end text-on-surface-variant hover:text-primary transition-colors cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined">
                        {isExpanded ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="pl-[96px] pr-8 pb-6 pt-3 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border-subtle bg-surface-3/30 animate-fadeIn">
                      <div className="space-y-4">
                        <h4 className="text-supporting font-semibold text-on-surface">
                          What will change
                        </h4>
                        <p className="text-metadata font-metadata text-on-surface-variant leading-relaxed">
                          {tweak.description.en}
                        </p>
                        {tweak.affected_paths.length > 0 && (
                          <div className="mt-2">
                            <span className="text-[11px] uppercase font-bold text-on-surface-variant block mb-1">
                              Affected Registry / System Path
                            </span>
                            <code className="text-[11px] bg-surface-2 p-2 rounded block font-mono text-primary truncate border border-border-subtle">
                              {tweak.affected_paths[0].path}
                            </code>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-supporting font-semibold text-on-surface mb-1">
                            Restart Impact & Protection
                          </h4>
                          <div
                            className={`flex items-center gap-2 ${tweak.restart_requirement !== "none" ? "text-warning" : "text-on-surface-variant"}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {tweak.restart_requirement !== "none" ? "info" : "check_circle"}
                            </span>
                            <span className="text-metadata font-metadata">
                              {tweak.restart_requirement === "none"
                                ? "No restart required (immediate effect)"
                                : tweak.restart_requirement === "explorer_restart"
                                  ? "Explorer restart required"
                                  : "System reboot required"}
                            </span>
                          </div>
                        </div>

                        {tweak.warnings.length > 0 && (
                          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-warning">
                            <h5 className="text-[11px] uppercase font-bold flex items-center gap-1.5 mb-1">
                              <span className="material-symbols-outlined text-sm leading-none">
                                warning
                              </span>
                              Caution / Rationale
                            </h5>
                            <p className="text-metadata font-metadata leading-relaxed">
                              {tweak.warnings[0].en}
                            </p>
                          </div>
                        )}

                        {tweak.references.length > 0 && (
                          <div>
                            <span className="text-[11px] uppercase font-bold text-on-surface-variant block mb-1">
                              Documentation & Provenance
                            </span>
                            <a
                              href={tweak.references[0]}
                              target="_blank"
                              rel="noreferrer"
                              className="text-metadata text-primary hover:underline font-mono text-[11px] flex items-center gap-1 truncate"
                            >
                              {tweak.references[0]}
                              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
