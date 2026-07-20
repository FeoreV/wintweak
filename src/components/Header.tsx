import React from "react";

type HeaderProps = {
  title: string;
  extra?: React.ReactNode;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onRescan?: () => void;
  scanning?: boolean;
};

export function Header({
  title,
  extra,
  searchQuery = "",
  onSearchQueryChange,
  onRescan,
  scanning = false,
}: HeaderProps) {
  return (
    <header className="flex justify-between items-center w-full px-gutter h-row-height-sm border-b border-outline-variant bg-background shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-4 min-w-0">
        <h2 className="text-page-title font-page-title font-black text-on-surface truncate">
          {title}
        </h2>
        {extra && <div className="hidden md:block min-w-0">{extra}</div>}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {onSearchQueryChange !== undefined && (
          <div className="hidden sm:flex items-center bg-surface-container-high rounded-full px-3 py-1.5 border border-border-subtle focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant mr-2">
              search
            </span>
            <input
              className="bg-transparent border-none text-supporting font-supporting text-on-surface focus:outline-none p-0 w-48 placeholder-on-surface-variant"
              placeholder="Search..."
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
          </div>
        )}

        {onRescan && (
          <button
            onClick={onRescan}
            disabled={scanning}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1 border border-border-subtle text-on-surface hover:bg-surface-2 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${scanning ? "animate-spin" : ""}`}
            >
              refresh
            </span>
            <span className="text-supporting font-supporting font-medium">
              {scanning ? "Scanning..." : "Rescan"}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
