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
  Spinner,
} from "@fluentui/react-components";
import { ArrowUndoRegular, CheckmarkCircleRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type { ApplyBatchReport, BatchPlan } from "../types/backend.generated";

type ReviewDialogProps = {
  open: boolean;
  plan?: BatchPlan;
  loading: boolean;
  error: boolean;
  applying: boolean;
  restoring: boolean;
  report?: ApplyBatchReport;
  restored: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: () => void;
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
  restoring,
  report,
  restored,
  onOpenChange,
  onApply,
  onRestore,
}: ReviewDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className="review-dialog">
        <DialogBody>
          <DialogTitle>{report ? t("review.success") : t("review.title")}</DialogTitle>
          <DialogContent>
            {loading ? <Spinner label={t("review.loading")} /> : null}
            {error ? (
              <MessageBar intent="error">
                <MessageBarBody>{t("review.error")}</MessageBarBody>
              </MessageBar>
            ) : null}
            {report ? (
              <div className="review-success">
                <CheckmarkCircleRegular />
                <p>{t("review.success")}</p>
                <code>{report.session_id}</code>
                {restored ? (
                  <MessageBar intent="success">
                    <MessageBarBody>{t("review.undone")}</MessageBarBody>
                  </MessageBar>
                ) : null}
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
            {report && !restored ? (
              <Button
                appearance="secondary"
                icon={<ArrowUndoRegular />}
                disabled={restoring || !report.session_id}
                onClick={() => report.session_id && onRestore(report.session_id)}
              >
                {t("review.undo")}
              </Button>
            ) : null}
            {!report ? (
              <Button
                appearance="primary"
                disabled={!plan || plan.change_count === 0 || applying}
                onClick={onApply}
              >
                {t("review.apply")}
              </Button>
            ) : null}
            <Button appearance="secondary" onClick={() => onOpenChange(false)}>
              {t("review.cancel")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
