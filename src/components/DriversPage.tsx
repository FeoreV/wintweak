import { useState } from "react";
import type {
  AvailableDriverUpdate,
  DriverInventory,
} from "../types/backend.generated";

type DriversPageProps = {
  inventory?: DriverInventory;
  loading: boolean;
  error: boolean;
  installingUpdateId?: string;
  onInstallUpdate: (update: AvailableDriverUpdate) => void;
  onInstallSelected: (updates: AvailableDriverUpdate[]) => void;
  onRefresh: () => void;
};

export function DriversPage({
  inventory,
  loading,
  error,
  installingUpdateId,
  onInstallUpdate,
  onInstallSelected,
  onRefresh,
}: DriversPageProps) {
  const [activeTab, setActiveTab] = useState<"updates" | "installed">("updates");
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Set<string>>(new Set());

  const updates = inventory?.updates || [];
  const installed = inventory?.devices || [];

  const toggleSelectUpdate = (updateId: string) => {
    setSelectedUpdateIds((prev) => {
      const next = new Set(prev);
      if (next.has(updateId)) {
        next.delete(updateId);
      } else {
        next.add(updateId);
      }
      return next;
    });
  };

  const toggleSelectAllUpdates = () => {
    if (selectedUpdateIds.size === updates.length) {
      setSelectedUpdateIds(new Set());
    } else {
      setSelectedUpdateIds(new Set(updates.map((u) => u.update_id)));
    }
  };

  const handleUpdateSelected = () => {
    const selectedList = updates.filter((u) => selectedUpdateIds.has(u.update_id));
    if (selectedList.length > 0) {
      onInstallSelected(selectedList);
      setSelectedUpdateIds(new Set());
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app justify-center items-center">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin mb-4">
          refresh
        </span>
        <p className="text-supporting text-on-surface-variant">Scanning Windows hardware & driver catalog...</p>
      </div>
    );
  }

  if (error || inventory?.update_search_error) {
    return (
      <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app justify-center items-center p-6 text-center">
        <span className="material-symbols-outlined text-4xl text-warning mb-4">warning</span>
        <h3 className="text-section-title font-section-title text-on-surface mb-2">
          Driver Update Search
        </h3>
        <p className="text-metadata text-on-surface-variant max-w-md mb-6">
          {inventory?.update_search_error ||
            "Could not query Windows Update Agent for available driver updates."}
        </p>
        <button
          onClick={onRefresh}
          className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-supporting font-semibold cursor-pointer shadow-md shadow-primary/20"
        >
          Retry Search
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:ml-sidebar-width h-full pb-24 bg-bg-app">
      {/* Upper Status Block */}
      <div className="px-margin-main py-6 flex flex-col gap-6 max-w-[1440px] mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-1 border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-success/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-success text-base font-bold">
                verified
              </span>
            </div>
            <div>
              <p className="font-supporting text-supporting text-on-surface font-semibold">
                Windows Update Driver Catalog Active
              </p>
              <p className="text-metadata text-on-surface-variant">
                Driver packages are sourced exclusively via official Microsoft Windows Update Agent APIs.
              </p>
            </div>
          </div>
          {updates.length > 0 && (
            <button
              onClick={() => onInstallSelected(updates)}
              className="bg-primary text-on-primary font-item-title text-item-title px-5 py-2 rounded-xl transition-all hover:brightness-110 shadow-md shadow-primary/20 cursor-pointer shrink-0"
            >
              Update All ({updates.length})
            </button>
          )}
        </div>

        {/* Tab Headers */}
        <div className="border-b border-border-subtle flex gap-6">
          <button
            onClick={() => setActiveTab("updates")}
            className={`pb-3 font-item-title text-item-title px-1 border-b-2 cursor-pointer transition-colors ${
              activeTab === "updates"
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Driver Updates ({updates.length})
          </button>
          <button
            onClick={() => setActiveTab("installed")}
            className={`pb-3 font-item-title text-item-title px-1 border-b-2 cursor-pointer transition-colors ${
              activeTab === "installed"
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Installed Drivers ({installed.length})
          </button>
        </div>

        {/* Grid Table Container */}
        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col">
          {activeTab === "updates" ? (
            updates.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant text-supporting">
                All device drivers are currently up to date!
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="grid grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_120px] items-center px-4 py-3 bg-surface-2 border-b border-border-subtle font-metadata text-metadata text-text-secondary">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={selectedUpdateIds.size === updates.length}
                      onChange={toggleSelectAllUpdates}
                      className="rounded border-outline cursor-pointer text-primary focus:ring-0"
                    />
                  </div>
                  <div>Driver Package Title</div>
                  <div>Manufacturer</div>
                  <div>Installed Version</div>
                  <div>Available Version</div>
                  <div>Source</div>
                  <div className="text-right">Actions</div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-border-subtle flex flex-col">
                  {updates.map((update) => {
                    const isSelected = selectedUpdateIds.has(update.update_id);
                    const isUpdating = installingUpdateId === update.update_id;
                    const matchingInstalled = installed.find(
                      (d) => d.manufacturer?.toLowerCase() === update.manufacturer?.toLowerCase(),
                    );

                    return (
                      <div
                        key={update.update_id}
                        className={`grid grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_120px] items-center px-4 py-3.5 min-h-row-height-sm hover:bg-surface-2/45 transition-colors ${
                          isSelected ? "bg-surface-3/20" : ""
                        }`}
                      >
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUpdate(update.update_id)}
                            className="rounded border-outline cursor-pointer text-primary focus:ring-0"
                          />
                        </div>
                        <div className="font-item-title text-item-title text-text-primary flex items-center gap-2 min-w-0 pr-2">
                          <span className="truncate" title={update.title}>
                            {update.title}
                          </span>
                        </div>
                        <div className="text-text-secondary truncate pr-2">
                          {update.manufacturer || "Generic"}
                        </div>
                        <div className="text-text-secondary font-mono text-[12px] truncate">
                          {matchingInstalled?.installed_version || "—"}
                        </div>
                        <div className="text-text-primary font-medium font-mono text-[12px] truncate">
                          {update.version || "Newest"}
                        </div>
                        <div>
                          <span className="px-2 py-0.5 rounded bg-success/10 text-success border border-success/20 text-[11px] font-semibold uppercase">
                            Windows Update
                          </span>
                        </div>
                        <div className="text-right">
                          <button
                            onClick={() => onInstallUpdate(update)}
                            disabled={isUpdating || installingUpdateId !== undefined}
                            className="bg-primary text-on-primary px-4 py-1.5 rounded-lg text-sm hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 font-semibold cursor-pointer shadow-sm shadow-primary/20"
                          >
                            {isUpdating ? "Installing..." : "Update"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : installed.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant text-supporting">
              No signed PnP drivers detected.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[48px_2fr_1.5fr_1.5fr_120px] items-center px-4 py-3 bg-surface-2 border-b border-border-subtle font-metadata text-metadata text-text-secondary">
                <div className="flex justify-center">#</div>
                <div>Device Name</div>
                <div>Manufacturer</div>
                <div>Driver Version</div>
                <div className="text-right">Signer Status</div>
              </div>

              <div className="divide-y divide-border-subtle flex flex-col">
                {installed.map((device, idx) => (
                  <div
                    key={device.device_id || idx}
                    className="grid grid-cols-[48px_2fr_1.5fr_1.5fr_120px] items-center px-4 py-3 min-h-row-height-sm hover:bg-surface-2/45 transition-colors"
                  >
                    <div className="flex justify-center text-text-tertiary font-mono text-xs">
                      {idx + 1}
                    </div>
                    <div
                      className="font-item-title text-item-title text-text-primary truncate pr-2 font-semibold"
                      title={device.device_name}
                    >
                      {device.device_name}
                    </div>
                    <div className="text-text-secondary truncate pr-2">{device.manufacturer}</div>
                    <div className="text-text-secondary font-mono text-[12px] truncate">
                      {device.installed_version || "—"}
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase ${
                          device.signed ? "text-success" : "text-warning"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {device.signed ? "verified" : "gpp_maybe"}
                        </span>
                        {device.signed ? "Signed" : "Unsigned"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Bottom Selection Bar for updates */}
      {activeTab === "updates" && selectedUpdateIds.size > 0 && (
        <div className="bg-surface-3 fixed bottom-0 right-0 z-40 flex justify-between items-center px-8 py-4 ml-[232px] w-[calc(100%-232px)] border-t border-outline-variant shadow-lg animate-slideUp">
          <span className="font-item-title text-item-title text-text-primary">
            {selectedUpdateIds.size} driver{selectedUpdateIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={handleUpdateSelected}
              disabled={installingUpdateId !== undefined}
              className="bg-primary text-on-primary rounded-xl px-6 py-2.5 font-item-title text-item-title shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
            >
              Update selected drivers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
