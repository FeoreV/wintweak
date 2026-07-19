import { Button } from "@fluentui/react-components";
import {
  AppsRegular,
  ArrowClockwiseRegular,
  ArrowRightRegular,
  CheckmarkCircleRegular,
  HistoryRegular,
  InfoRegular,
  SettingsRegular,
  WarningRegular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type { HomeState } from "../lib/deriveHomeState";
import type {
  AppProviderStatus,
  RecoverySessionSummary,
  SystemAudit,
  TweakDefinition,
} from "../types/backend.generated";

type HomeWorkspaceProps = {
  state: HomeState;
  audit?: SystemAudit;
  providers: AppProviderStatus[];
  recoveries: RecoverySessionSummary[];
  onRetry: () => void;
  onOpenOptimize: (recommendedOnly?: boolean) => void;
  onReviewTweak: (tweakId: string) => void;
  onOpenApps: () => void;
  onOpenWindows: () => void;
  onOpenRecovery: () => void;
};

export function HomeWorkspace({
  state,
  audit,
  providers,
  recoveries,
  onRetry,
  onOpenOptimize,
  onReviewTweak,
  onOpenApps,
  onOpenWindows,
  onOpenRecovery,
}: HomeWorkspaceProps) {
  const { i18n } = useTranslation();

  return (
    <section className="home-workspace workspace-enter" aria-label="Home">
      <div className="home-upper-grid">
        <article className="home-recommendation">
          <HomeLead
            state={state}
            onRetry={onRetry}
            onOpenOptimize={onOpenOptimize}
            onReviewTweak={onReviewTweak}
            onOpenApps={onOpenApps}
            onOpenWindows={onOpenWindows}
          />
          <RecommendationContext state={state} language={i18n.language} />
        </article>

        <aside className="home-health" aria-labelledby="home-health-title">
          <h2 id="home-health-title">System health</h2>
          <HealthRows
            audit={audit}
            providers={providers}
            recoveries={recoveries}
            onOpenOptimize={onOpenOptimize}
            onOpenApps={onOpenApps}
            onOpenWindows={onOpenWindows}
            onOpenRecovery={onOpenRecovery}
          />
        </aside>
      </div>

      <RecentActivity recoveries={recoveries} onOpenRecovery={onOpenRecovery} />

      <section className="home-area-panel" aria-labelledby="home-area-title">
        <h2 id="home-area-title">System areas</h2>
        <StatusRail
          audit={audit}
          providers={providers}
          recoveries={recoveries}
          onOpenOptimize={onOpenOptimize}
          onOpenApps={onOpenApps}
          onOpenWindows={onOpenWindows}
          onOpenRecovery={onOpenRecovery}
        />
      </section>
    </section>
  );
}

function HomeLead({
  state,
  onRetry,
  onOpenOptimize,
  onReviewTweak,
  onOpenApps,
  onOpenWindows,
}: Pick<
  HomeWorkspaceProps,
  "state" | "onRetry" | "onOpenOptimize" | "onReviewTweak" | "onOpenApps" | "onOpenWindows"
>) {
  const { i18n } = useTranslation();

  if (state.kind === "loading") {
    return (
      <div className="home-lead home-lead--loading" aria-live="polite">
        <span className="home-section-label">Reading Windows evidence</span>
        <div className="home-lead-skeleton" />
        <div className="home-lead-skeleton home-lead-skeleton--short" />
        <div className="home-lead-skeleton home-lead-skeleton--button" />
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="home-lead" role="alert">
        <span className="home-section-label">Audit unavailable</span>
        <WarningRegular className="home-lead-icon home-lead-icon--warning" />
        <h1>WinTweak could not read the current system state</h1>
        <p>No recommendation is shown because the required audit evidence is unavailable.</p>
        <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={onRetry}>
          Try audit again
        </Button>
      </div>
    );
  }

  if (state.kind === "nativeAuditUnavailable") {
    return (
      <div className="home-lead">
        <span className="home-section-label">Native audit unavailable</span>
        <InfoRegular className="home-lead-icon" />
        <h1>Open the Windows desktop app to read this PC</h1>
        <p>
          The browser preview cannot access native Windows inventory. Documented changes remain
          available to inspect.
        </p>
        <Button appearance="primary" onClick={() => onOpenOptimize()}>
          Browse documented changes
          <ArrowRightRegular />
        </Button>
      </div>
    );
  }

  if (state.kind === "restartEvidence") {
    return (
      <div className="home-lead">
        <span className="home-section-label">Recommended next action</span>
        <WarningRegular className="home-lead-icon home-lead-icon--warning" />
        <h1>Review the pending Windows restart</h1>
        <p>Windows returned restart evidence that should be reviewed before further changes.</p>
        <Button appearance="primary" onClick={onOpenWindows}>
          Review Windows evidence
          <ArrowRightRegular />
        </Button>
      </div>
    );
  }

  if (state.kind === "actionableTweak" || state.kind === "reviewRequired") {
    const title = localized(state.tweak.title, i18n.language);
    const description = localized(state.tweak.description, i18n.language);
    return (
      <div className="home-lead">
        <span className="home-section-label">
          {state.kind === "actionableTweak" ? "Recommended next action" : "Review required"}
        </span>
        {state.kind === "actionableTweak" ? (
          <SettingsRegular className="home-lead-icon" />
        ) : (
          <WarningRegular className="home-lead-icon home-lead-icon--warning" />
        )}
        <h1>{title}</h1>
        <p>{description}</p>
        <Button appearance="primary" onClick={() => onReviewTweak(state.tweak.id)}>
          Review recommendation
          <ArrowRightRegular />
        </Button>
      </div>
    );
  }

  if (state.kind === "providerAttention") {
    const names = state.providers.map((provider) => provider.manager).join(", ");
    return (
      <div className="home-lead">
        <span className="home-section-label">Recommended next action</span>
        <AppsRegular className="home-lead-icon home-lead-icon--warning" />
        <h1>Review unavailable app providers</h1>
        <p>{names} could not be reached during the current provider check.</p>
        <Button appearance="primary" onClick={onOpenApps}>
          Open Apps
          <ArrowRightRegular />
        </Button>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className="home-lead">
        <span className="home-section-label">Choose what matters</span>
        <InfoRegular className="home-lead-icon" />
        <h1>Select optimization goals for this PC</h1>
        <p>
          The local advisor needs your goals before it can compare relevant documented tweaks with
          the current system state.
        </p>
        <Button appearance="primary" onClick={() => onOpenOptimize()}>
          Choose optimization goals
          <ArrowRightRegular />
        </Button>
      </div>
    );
  }

  return (
    <div className="home-lead">
      <span className="home-section-label">Current audit</span>
      <CheckmarkCircleRegular className="home-lead-icon home-lead-icon--confirmed" />
      <h1>No recommendation is currently returned</h1>
      <p>Review recorded system evidence or choose goals to request local recommendations.</p>
      <Button appearance="primary" onClick={() => onOpenOptimize()}>
        Open Optimize
        <ArrowRightRegular />
      </Button>
    </div>
  );
}

function RecommendationContext({ state, language }: { state: HomeState; language: string }) {
  if (state.kind === "actionableTweak" || state.kind === "reviewRequired") {
    const tweak = state.tweak;
    return (
      <aside className="home-recommendation-context" aria-label="Recommendation details">
        <div className="home-context-orbit" aria-hidden="true">
          <span />
          <span />
          <SettingsRegular />
        </div>
        <dl>
          <div>
            <dt>Risk</dt>
            <dd>{tweak.risk}</dd>
          </div>
          <div>
            <dt>Recovery</dt>
            <dd>{tweak.reversible ? "Reversible" : "Not reversible"}</dd>
          </div>
          <div>
            <dt>Restart</dt>
            <dd>{formatRestart(tweak.restart_requirement)}</dd>
          </div>
        </dl>
        {tweak.warnings.length > 0 ? (
          <p>{localized(tweak.warnings[0], language)}</p>
        ) : tweak.affected_paths.length > 0 ? (
          <code>{tweak.affected_paths[0].path}</code>
        ) : null}
      </aside>
    );
  }

  const icon =
    state.kind === "restartEvidence" || state.kind === "providerAttention" ? (
      <WarningRegular />
    ) : state.kind === "loading" ? (
      <ArrowClockwiseRegular />
    ) : (
      <InfoRegular />
    );

  return (
    <div className="home-technical-visual" aria-hidden="true">
      <span className="home-technical-visual__plane home-technical-visual__plane--one" />
      <span className="home-technical-visual__plane home-technical-visual__plane--two" />
      <span className="home-technical-visual__plane home-technical-visual__plane--three" />
      <span className="home-technical-visual__core">{icon}</span>
    </div>
  );
}

function HealthRows({
  audit,
  providers,
  recoveries,
  onOpenOptimize,
  onOpenApps,
  onOpenWindows,
  onOpenRecovery,
}: Omit<HomeWorkspaceProps, "state" | "onRetry" | "onReviewTweak">) {
  const applied = audit?.tweak_statuses.filter((item) =>
    ["enabled", "requires_restart"].includes(item.state),
  ).length;
  const availableProviders = providers.filter((provider) => provider.available).length;

  return (
    <nav className="home-health-rows" aria-label="System health areas">
      <HealthRow
        icon={<SettingsRegular />}
        label="Optimize"
        value={
          audit ? `${applied ?? 0} of ${audit.tweak_statuses.length} applied` : "No native audit"
        }
        tone="neutral"
        onClick={() => onOpenOptimize()}
      />
      <HealthRow
        icon={<AppsRegular />}
        label="Apps"
        value={
          providers.length > 0
            ? `${availableProviders} of ${providers.length} providers available`
            : "No provider evidence"
        }
        tone={providers.some((provider) => !provider.available) ? "attention" : "neutral"}
        onClick={onOpenApps}
      />
      <HealthRow
        icon={<WarningRegular />}
        label="Windows"
        value={
          audit
            ? audit.pending_restart
              ? `${audit.pending_restart_reasons.length} restart signal${audit.pending_restart_reasons.length === 1 ? "" : "s"}`
              : `${formatWindows(audit)} build ${audit.environment.build}`
            : "Native evidence unavailable"
        }
        tone={audit?.pending_restart ? "attention" : "neutral"}
        onClick={onOpenWindows}
      />
      <HealthRow
        icon={<HistoryRegular />}
        label="Recovery"
        value={`${recoveries.length} saved session${recoveries.length === 1 ? "" : "s"}`}
        tone="neutral"
        onClick={onOpenRecovery}
      />
    </nav>
  );
}

function HealthRow({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "neutral" | "attention";
  onClick: () => void;
}) {
  return (
    <button type="button" data-tone={tone} onClick={onClick}>
      <span className="home-health-row__icon">{icon}</span>
      <strong>{label}</strong>
      <small>{value}</small>
      <ArrowRightRegular />
    </button>
  );
}

function RecentActivity({
  recoveries,
  onOpenRecovery,
}: Pick<HomeWorkspaceProps, "recoveries" | "onOpenRecovery">) {
  const { i18n } = useTranslation();
  return (
    <section className="home-recent-activity" aria-labelledby="home-activity-title">
      <header>
        <h2 id="home-activity-title">Recent activity</h2>
        {recoveries.length > 0 ? (
          <Button appearance="subtle" onClick={onOpenRecovery}>
            View all
            <ArrowRightRegular />
          </Button>
        ) : null}
      </header>
      {recoveries.length === 0 ? (
        <div className="home-activity-empty">
          <HistoryRegular />
          <span>
            <strong>No recovery activity recorded</strong>
            <small>Completed changes will appear here when recovery sessions exist.</small>
          </span>
        </div>
      ) : (
        <ul className="home-activity-list">
          {recoveries.slice(0, 4).map((session) => (
            <li key={session.session_id}>
              <span className="home-activity-list__icon">
                <HistoryRegular />
              </span>
              <time dateTime={new Date(session.created_unix_seconds * 1000).toISOString()}>
                {new Date(session.created_unix_seconds * 1000).toLocaleString(i18n.language)}
              </time>
              <strong>Recovery session recorded</strong>
              <small>{session.entry_count} change entries</small>
              <span className="home-activity-list__result">
                <CheckmarkCircleRegular /> Recorded
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusRail({
  audit,
  providers,
  recoveries,
  onOpenOptimize,
  onOpenApps,
  onOpenWindows,
  onOpenRecovery,
}: Omit<HomeWorkspaceProps, "state" | "onRetry" | "onReviewTweak">) {
  const applied = audit?.tweak_statuses.filter((item) =>
    ["enabled", "requires_restart"].includes(item.state),
  ).length;
  const availableProviders = providers.filter((provider) => provider.available).length;
  return (
    <nav className="home-status-rail" aria-label="System evidence areas">
      <StatusButton
        icon={<SettingsRegular />}
        label="Optimize"
        value={audit ? `${applied ?? 0} applied` : "Audit unavailable"}
        tone="neutral"
        onClick={() => onOpenOptimize()}
      />
      <StatusButton
        icon={<AppsRegular />}
        label="Apps"
        value={
          providers.length > 0
            ? `${availableProviders}/${providers.length} providers`
            : "No evidence"
        }
        tone={providers.some((provider) => !provider.available) ? "attention" : "neutral"}
        onClick={onOpenApps}
      />
      <StatusButton
        icon={<WarningRegular />}
        label="Windows"
        value={audit ? `Build ${audit.environment.build}` : "Audit unavailable"}
        tone={audit?.pending_restart ? "attention" : "neutral"}
        onClick={onOpenWindows}
      />
      <StatusButton
        icon={<HistoryRegular />}
        label="Recovery"
        value={`${recoveries.length} sessions`}
        tone="neutral"
        onClick={onOpenRecovery}
      />
      <StatusButton
        icon={<AppsRegular />}
        label="Appx inventory"
        value={audit ? `${audit.appx_package_count} packages` : "Audit unavailable"}
        tone="neutral"
        onClick={onOpenWindows}
      />
    </nav>
  );
}

function StatusButton({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "neutral" | "attention";
  onClick: () => void;
}) {
  return (
    <button type="button" data-tone={tone} onClick={onClick}>
      <span className="home-status-rail__icon">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{value}</small>
      </span>
      <ArrowRightRegular />
    </button>
  );
}

function localized(value: { en: string; ru: string }, language: string): string {
  return language.startsWith("ru") ? value.ru : value.en;
}

function formatWindows(audit: SystemAudit): string {
  return audit.environment.windows === "windows11" ? "Windows 11" : "Windows 10";
}

function formatRestart(value: TweakDefinition["restart_requirement"]): string {
  if (value === "none") return "None";
  if (value === "explorer_restart") return "File Explorer";
  if (value === "logoff") return "Sign out";
  return "Windows";
}
