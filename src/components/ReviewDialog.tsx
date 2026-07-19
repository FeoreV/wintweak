import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
} from "@fluentui/react-components";
import { ArrowUndoRegular, CheckmarkCircleRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type {
  ApplyBatchReport,
  ApplyOperationEvent,
  ApplyOperationStatus,
  BatchPlan,
} from "../types/backend.generated";

type ReviewDialogProps = {
  open: boolean;
  plan?: BatchPlan;
  loading: boolean;
  error: boolean;
  applying: boolean;
  cancelAvailable: boolean;
  cancelling: boolean;
  restoring: boolean;
  report?: ApplyBatchReport;
  operation?: ApplyOperationStatus;
  restored: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: () => void;
  onCancelApply: () => void;
  onRestore: (sessionId: string) => void;
};

function valueLabel(value: BatchPlan["tweaks"][number]["changes"][number]["target"]): string {
  if (value.kind === "missing") return "missing";
  return `${value.kind}: ${value.value}`;
}

export function ReviewDialog({
  open,
  plan,
  loading,
  error,
  applying,
  cancelAvailable,
  cancelling,
  restoring,
  report,
  operation,
  restored,
  onOpenChange,
  onApply,
  onCancelApply,
  onRestore,
}: ReviewDialogProps) {
  const { t } = useTranslation();
  const batchStarted = operation?.events.find((event) => event.kind === "batch_started");
  const totalChanges = batchStarted?.kind === "batch_started" ? batchStarted.total_changes : 0;
  const lastCommit = [...(operation?.events ?? [])]
    .reverse()
    .find((event) => event.kind === "change_committed");
  const committedChanges =
    report?.committed_change_count ??
    (lastCommit?.kind === "change_committed" ? lastCommit.committed_change_count : 0);
  const progressTotal = Math.max(totalChanges, committedChanges);
  const terminal = operation && ["completed", "cancelled", "failed"].includes(operation.phase);
  const successful = !operation || operation.phase === "completed";
  const title = report
    ? successful
      ? t("review.success")
      : operation?.phase === "cancelled"
        ? t("review.cancelled")
        : t("review.failed")
    : applying
      ? t("review.progressTitle")
      : t("review.title");

  return (
    <Dialog open={open} onOpenChange={(_, data) => !applying && onOpenChange(data.open)}>
      <DialogSurface className="review-dialog">
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            {loading ? <Spinner label={t("review.loading")} /> : null}
            {error ? (
              <MessageBar intent="error">
                <MessageBarBody>{t("review.error")}</MessageBarBody>
              </MessageBar>
            ) : null}
            {report ? (
              <div className="review-success" data-outcome={operation?.phase ?? "completed"}>
                {successful ? <CheckmarkCircleRegular /> : null}
                <p>{title}</p>
                {!successful ? (
                  <MessageBar intent={operation?.phase === "failed" ? "error" : "warning"}>
                    <MessageBarBody>
                      {operation?.error ??
                        t("review.partial", { count: report.committed_change_count })}
                    </MessageBarBody>
                  </MessageBar>
                ) : null}
                <strong>
                  {t("review.committed", {
                    committed: report.committed_change_count,
                    total: totalChanges || report.committed_change_count,
                  })}
                </strong>
                {report.session_id ? (
                  <div className="recovery-session">
                    <span>{t("review.recoverySession")}</span>
                    <code>{report.session_id}</code>
                  </div>
                ) : null}
                {restored ? (
                  <MessageBar intent="success">
                    <MessageBarBody>{t("review.undone")}</MessageBarBody>
                  </MessageBar>
                ) : null}
              </div>
            ) : applying && operation ? (
              <div className="apply-progress" aria-live="polite">
                <strong>
                  {t("review.committed", {
                    committed: committedChanges,
                    total: totalChanges,
                  })}
                </strong>
                <ProgressBar
                  aria-label={t("review.committed", {
                    committed: committedChanges,
                    total: totalChanges,
                  })}
                  value={progressTotal === 0 ? 0 : committedChanges / progressTotal}
                />
                <ol className="apply-progress__events">
                  {operation.events
                    .filter((event) => event.kind !== "batch_started")
                    .map((event, index) => (
                      <li key={`${event.kind}-${index}`}>{applyEventLabel(event, t)}</li>
                    ))}
                </ol>
              </div>
            ) : plan ? (
              <>
                <p>{t("review.body")}</p>
                <strong>{t("review.changeCount", { count: plan.change_count })}</strong>
                <div className="change-list">
                  {plan.tweaks.flatMap((tweak) =>
                    tweak.changes.map((change) => (
                      <article key={`${tweak.id}-${change.key_path}-${change.value_name}`}>
                        <div>
                          <strong>{change.value_name}</strong>
                          <span>
                            {change.hive}\\{change.key_path}
                          </span>
                        </div>
                        <code>
                          {valueLabel(change.current)} → {valueLabel(change.target)}
                        </code>
                        {!change.required ? <span>{t("review.unchanged")}</span> : null}
                      </article>
                    )),
                  )}
                </div>
              </>
            ) : null}
          </DialogContent>
          <DialogActions>
            {report?.session_id && !restored ? (
              <Button
                appearance="secondary"
                icon={<ArrowUndoRegular />}
                disabled={restoring}
                onClick={() => report.session_id && onRestore(report.session_id)}
              >
                {t("review.undo")}
              </Button>
            ) : null}
            {!report && !applying ? (
              <Button
                appearance="primary"
                disabled={!plan || plan.change_count === 0 || applying}
                onClick={onApply}
              >
                {t("review.apply")}
              </Button>
            ) : null}
            {applying && !terminal ? (
              <Button
                appearance="secondary"
                disabled={!cancelAvailable || cancelling}
                onClick={onCancelApply}
              >
                {cancelling ? t("review.cancelling") : t("review.cancelApply")}
              </Button>
            ) : null}
            <Button
              appearance="secondary"
              disabled={applying && !terminal}
              onClick={() => onOpenChange(false)}
            >
              {report ? t("review.close") : t("review.cancel")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function applyEventLabel(
  event: ApplyOperationEvent,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (event.kind === "tweak_started") {
    return t("review.events.tweakStarted", {
      tweak: t(`tweaks.${event.tweak_id}.label`, { defaultValue: event.tweak_id }),
    });
  }
  if (event.kind === "change_committed") {
    return t("review.events.changeCommitted", {
      change: event.change_index + 1,
      tweak: t(`tweaks.${event.tweak_id}.label`, { defaultValue: event.tweak_id }),
    });
  }
  if (event.kind === "tweak_completed") {
    return t("review.events.tweakCompleted", {
      tweak: t(`tweaks.${event.tweak_id}.label`, { defaultValue: event.tweak_id }),
    });
  }
  return "";
}
