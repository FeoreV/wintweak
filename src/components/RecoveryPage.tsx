import type { RecoverySessionSummary } from "../types/backend.generated";

type RecoveryPageProps = {
  recoveries: RecoverySessionSummary[];
  onRestoreSession: (sessionId: string) => void;
  restoring: boolean;
  error: boolean;
  restoredSessionId?: string;
};

export function RecoveryPage({
  recoveries = [],
  onRestoreSession,
  restoring,
  error,
  restoredSessionId,
}: RecoveryPageProps) {
  return (
    <div className="flex-1 flex flex-col md:ml-sidebar-width h-full bg-bg-app">
      <div className="flex-1 overflow-y-auto p-margin-main pb-24 custom-scrollbar">
        <div className="mb-8">
          <h2 className="text-[28px] font-bold text-on-surface leading-tight">
            Recovery & Rollbacks
          </h2>
          <p className="text-text-secondary font-supporting mt-2">
            Roll back tweaks to their exact state prior to application. Snapshots are stored
            locally.
          </p>
        </div>

        {restoring && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 flex items-center gap-3 text-primary animate-pulse">
            <span className="material-symbols-outlined animate-spin">refresh</span>
            <span className="text-supporting font-semibold">
              Restoring system snapshot. Please do not close the application...
            </span>
          </div>
        )}

        {restoredSessionId && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-6 flex items-center gap-3 text-success">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span className="text-supporting font-semibold">
              Successfully restored backup session: {restoredSessionId.substring(0, 8)}...
            </span>
          </div>
        )}

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6 flex items-center gap-3 text-danger">
            <span className="material-symbols-outlined">warning</span>
            <span className="text-supporting font-semibold">
              Restore operation failed. Check application logs for registry permissions.
            </span>
          </div>
        )}

        {/* Sessions list */}
        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="grid grid-cols-[1fr_2fr_1fr_120px] items-center px-6 py-4 bg-surface-2 border-b border-border-subtle font-metadata text-metadata text-text-secondary uppercase font-semibold">
            <div>Backup Date</div>
            <div>Session ID</div>
            <div className="text-center">Modified Fields</div>
            <div className="text-right">Actions</div>
          </div>

          <div className="divide-y divide-border-subtle flex flex-col">
            {recoveries.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant text-supporting">
                No recovery logs found on this PC.
              </div>
            ) : (
              recoveries.map((session) => (
                <div
                  key={session.session_id}
                  className="grid grid-cols-[1fr_2fr_1fr_120px] items-center px-6 py-4 hover:bg-surface-2/45 transition-colors"
                >
                  <div className="text-supporting text-on-surface font-semibold">
                    {new Date(session.created_unix_seconds * 1000).toLocaleString()}
                  </div>

                  <div
                    className="text-metadata text-on-surface-variant font-mono select-all truncate pr-4"
                    title={session.session_id}
                  >
                    {session.session_id}
                  </div>

                  <div className="text-center text-supporting text-text-secondary">
                    {session.entry_count} registry path{session.entry_count === 1 ? "" : "s"}
                  </div>

                  <div className="text-right">
                    <button
                      onClick={() => onRestoreSession(session.session_id)}
                      disabled={restoring}
                      className="bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 disabled:opacity-50 px-4 py-1.5 rounded text-sm font-semibold cursor-pointer transition-colors"
                    >
                      Rollback
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
