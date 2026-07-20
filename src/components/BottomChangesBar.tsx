type BottomChangesBarProps = {
  tweakCount: number;
  appCount: number;
  driverCount: number;
  onDiscardAll: () => void;
  onApply: () => void;
  applying: boolean;
};

export function BottomChangesBar({
  tweakCount,
  appCount,
  driverCount,
  onDiscardAll,
  onApply,
  applying,
}: BottomChangesBarProps) {
  const total = tweakCount + appCount + driverCount;

  if (total === 0 && !applying) return null;

  const summaryParts: string[] = [];
  if (tweakCount > 0) summaryParts.push(`${tweakCount} tweak${tweakCount === 1 ? "" : "s"}`);
  if (appCount > 0) summaryParts.push(`${appCount} app${appCount === 1 ? "" : "s"}`);
  if (driverCount > 0) summaryParts.push(`${driverCount} driver${driverCount === 1 ? "" : "s"}`);
  const summaryText = summaryParts.join(", ");

  return (
    <div className="fixed bottom-0 left-0 md:left-sidebar-width right-0 z-40 flex justify-between items-center px-margin-main py-4 bg-surface-container-highest border-t border-outline-variant shadow-[0_-8px_30px_rgb(0,0,0,0.3)] rounded-t-xl transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="bg-surface-2 rounded-lg p-2 border border-border-subtle flex items-center justify-center shadow-inner">
          <span className="material-symbols-outlined text-primary text-[24px]">checklist</span>
        </div>
        <div>
          <h4 className="text-item-title font-item-title text-on-surface">
            Pending Changes: {total}
          </h4>
          <p className="text-metadata font-metadata text-on-surface-variant flex items-center gap-1">
            {summaryText || "Applying modifications..."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!applying && (
          <button
            onClick={onDiscardAll}
            className="text-item-title font-item-title text-on-surface-variant hover:text-on-surface px-4 py-2 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
          >
            Discard All
          </button>
        )}
        <button
          onClick={onApply}
          disabled={applying}
          className="bg-primary text-on-primary rounded-lg px-6 py-2 text-item-title font-item-title hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
        >
          {applying ? "Applying..." : "Apply Changes"}
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
        </button>
      </div>
    </div>
  );
}
