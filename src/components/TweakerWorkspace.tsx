import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Link,
  MessageBar,
  MessageBarBody,
  Spinner,
  Tooltip,
} from "@fluentui/react-components";
import {
  AppsRegular,
  ArrowClockwiseRegular,
  ArrowRightRegular,
  ArrowUpRightRegular,
  CheckmarkCircleRegular,
  ChevronDownRegular,
  CodeRegular,
  EyeOffRegular,
  HistoryRegular,
  HomeRegular,
  LocalLanguageRegular,
  PowerRegular,
  SearchRegular,
  SettingsRegular,
  ShieldLockRegular,
  WarningRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from "@fluentui/react-icons";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { deriveHomeState } from "../lib/deriveHomeState";
import type {
  AdvisorReport,
  AppDefinition,
  AppInstallReport,
  AppPackageManager,
  AppProviderStatus,
  AppxPackage,
  AppxRemovalPreview,
  ProfileDefinition,
  RecommendationDisposition,
  RecoverySessionSummary,
  SystemAudit,
  TweakDefinition,
  TweakStatus,
  UserGoal,
} from "../types/backend.generated";
import { HomeWorkspace } from "./HomeWorkspace";

type ProductArea = "understand" | "choose" | "store" | "diagnostics" | "recover" | "settings";
type Filter = "all" | "recommended" | TweakStatus["state"];

type TweakerWorkspaceProps = {
  dark: boolean;
  catalog: TweakDefinition[];
  statuses: TweakStatus[];
  advisor?: AdvisorReport;
  recoveries: RecoverySessionSummary[];
  profiles: ProfileDefinition[];
  goals: UserGoal[];
  selectedIds: Set<string>;
  loading: boolean;
  error: boolean;
  onThemeChange: () => void;
  onRestoreSession: (sessionId: string) => void;
  recoveryRestoring: boolean;
  recoveryRestoreError: boolean;
  restoredSessionId?: string;
  onGoalsChange: (goals: UserGoal[]) => void;
  onToggle: (id: string) => void;
  onReview: () => void;
  onPreviewProfile: (profile: ProfileDefinition) => void;
  onRetry: () => void;
  apps: AppDefinition[];
  appProviders: AppProviderStatus[];
  appxPackages: AppxPackage[];
  appxPreview?: AppxRemovalPreview;
  appxLoading: boolean;
  onPreviewAppx: (fullName: string) => void;
  systemAudit?: SystemAudit;
  systemAuditLoading: boolean;
  systemAuditError: boolean;
  nativeAuditAvailable: boolean;
  advisorLoading: boolean;
  advisorError: boolean;
  lastDataUpdatedAt: number;
  selectedApps: Set<string>;
  appManager: AppPackageManager;
  appInstalling: boolean;
  appUpdating: boolean;
  appsLoading: boolean;
  appsError: boolean;
  appInstallError: boolean;
  appInstallReport?: AppInstallReport;
  appUpdateReport?: AppInstallReport;
  appTaskId?: string;
  onToggleApp: (id: string) => void;
  onAppManagerChange: (manager: AppPackageManager) => void;
  onInstallApps: () => void;
  onUpdateAllApps: () => void;
  onBootstrapChocolatey: () => void;
  onCancelAppOperation: () => void;
  onRefreshProviders: () => void;
};

const goalIcons = {
  privacy: ShieldLockRegular,
  development: CodeRegular,
  reduce_distractions: EyeOffRegular,
} satisfies Record<UserGoal, typeof ShieldLockRegular>;

const goals: UserGoal[] = ["privacy", "development", "reduce_distractions"];

const dispositionPriority: Record<RecommendationDisposition, number> = {
  recommended: 0,
  review_required: 1,
  mixed: 2,
  already_applied: 3,
  not_relevant: 4,
};

export function TweakerWorkspace({
  dark,
  catalog,
  statuses,
  advisor,
  recoveries,
  profiles,
  goals: selectedGoals,
  selectedIds,
  loading,
  error,
  onThemeChange,
  onRestoreSession,
  recoveryRestoring,
  recoveryRestoreError,
  restoredSessionId,
  onGoalsChange,
  onToggle,
  onReview,
  onPreviewProfile,
  onRetry,
  apps,
  appProviders,
  appxPackages,
  appxPreview,
  appxLoading,
  onPreviewAppx,
  systemAudit,
  systemAuditLoading,
  systemAuditError,
  nativeAuditAvailable,
  advisorLoading,
  advisorError,
  lastDataUpdatedAt,
  selectedApps,
  appManager,
  appInstalling,
  appUpdating,
  appsLoading,
  appsError,
  appInstallError,
  appInstallReport,
  appUpdateReport,
  appTaskId,
  onToggleApp,
  onAppManagerChange,
  onInstallApps,
  onUpdateAllApps,
  onBootstrapChocolatey,
  onCancelAppOperation,
  onRefreshProviders,
}: TweakerWorkspaceProps) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<ProductArea>("understand");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("all");
  const [risk, setRisk] = useState<"all" | TweakDefinition["risk"]>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string>();

  const stateById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status.state])),
    [statuses],
  );
  const dispositionById = useMemo(
    () => new Map(advisor?.recommendations.map((item) => [item.tweak_id, item.disposition]) ?? []),
    [advisor],
  );
  const recommendations = useMemo(
    () =>
      [...(advisor?.recommendations ?? [])]
        .filter((item) => item.disposition !== "not_relevant")
        .sort(
          (left, right) =>
            dispositionPriority[left.disposition] - dispositionPriority[right.disposition],
        ),
    [advisor],
  );
  const appliedCount = statuses.filter((status) =>
    ["enabled", "requires_restart"].includes(status.state),
  ).length;
  const homeState = useMemo(
    () =>
      deriveHomeState({
        loading: loading || systemAuditLoading || advisorLoading,
        error: error || systemAuditError || advisorError,
        nativeAuditAvailable,
        audit: systemAudit,
        advisor,
        catalog,
        providers: appProviders,
        recoveries,
      }),
    [
      advisor,
      advisorError,
      advisorLoading,
      appProviders,
      catalog,
      error,
      loading,
      nativeAuditAvailable,
      recoveries,
      systemAudit,
      systemAuditError,
      systemAuditLoading,
    ],
  );
  const categories = useMemo(
    () => [...new Set(catalog.map((tweak) => tweak.category))].sort(),
    [catalog],
  );
  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return catalog.filter((tweak) => {
      const label = t(`tweaks.${tweak.id}.label`, {
        defaultValue: i18n.language.startsWith("ru") ? tweak.title.ru : tweak.title.en,
      });
      const description = t(`tweaks.${tweak.id}.description`, {
        defaultValue: i18n.language.startsWith("ru") ? tweak.description.ru : tweak.description.en,
      });
      const matchesSearch =
        term.length === 0 ||
        label.toLocaleLowerCase().includes(term) ||
        description.toLocaleLowerCase().includes(term);
      const state = stateById.get(tweak.id);
      const disposition = dispositionById.get(tweak.id);
      const matchesFilter =
        filter === "all" ||
        filter === state ||
        (filter === "recommended" &&
          disposition !== undefined &&
          ["recommended", "review_required", "mixed"].includes(disposition));
      const matchesCategory = category === "all" || tweak.category === category;
      const matchesRisk = risk === "all" || tweak.risk === risk;
      return matchesSearch && matchesFilter && matchesCategory && matchesRisk;
    });
  }, [catalog, category, dispositionById, filter, i18n.language, risk, search, stateById, t]);

  const changeLanguage = () => {
    const next = i18n.language.startsWith("ru") ? "en" : "ru";
    localStorage.setItem("wintweak.locale", next);
    void i18n.changeLanguage(next);
  };

  const toggleGoal = (goal: UserGoal) => {
    onGoalsChange(
      selectedGoals.includes(goal)
        ? selectedGoals.filter((item) => item !== goal)
        : [...selectedGoals, goal],
    );
  };

  const openAllTweaks = (nextFilter: Filter = "all") => {
    setFilter(nextFilter);
    setView("choose");
  };

  const headerCopy: Record<ProductArea, { title: string; subtitle: string }> = {
    understand: {
      title: t("workspace.understand.title"),
      subtitle: t("workspace.understand.subtitle"),
    },
    choose: { title: t("workspace.choose.title"), subtitle: t("workspace.choose.subtitle") },
    store: { title: t("workspace.apps.title"), subtitle: t("workspace.apps.subtitle") },
    diagnostics: {
      title: t("workspace.diagnostics.title"),
      subtitle: t("workspace.diagnostics.subtitle"),
    },
    recover: { title: t("workspace.recover.title"), subtitle: t("workspace.recover.subtitle") },
    settings: { title: t("workspace.settings.title"), subtitle: t("workspace.settings.subtitle") },
  };
  const { title, subtitle } = headerCopy[view];

  return (
    <div className="utility-shell">
      <a className="skip-link" href="#workspace-main">
        {t("workspace.skip")}
      </a>
      <aside className="utility-rail" aria-label={t("workspace.navigation")}>
        <div className="brand-mark" aria-label="WinTweak">
          <span>W</span>
          <strong>WinTweak</strong>
        </div>
        <nav className="rail-nav">
          <RailItem
            icon={<HomeRegular />}
            label="Home"
            active={view === "understand"}
            onClick={() => setView("understand")}
          />
          <RailItem
            icon={<SettingsRegular />}
            label="Optimize"
            active={view === "choose"}
            onClick={() => openAllTweaks()}
          />
          <RailItem
            icon={<AppsRegular />}
            label="Apps"
            active={view === "store"}
            onClick={() => setView("store")}
          />
          <RailItem
            icon={<HistoryRegular />}
            label="Recovery"
            active={view === "recover"}
            badge={recoveries.length > 0 ? recoveries.length : undefined}
            onClick={() => setView("recover")}
          />
          <RailItem
            icon={<WarningRegular />}
            label="Windows"
            active={view === "diagnostics"}
            onClick={() => setView("diagnostics")}
          />
        </nav>
        <div className="rail-actions">
          <RailItem
            icon={<SettingsRegular />}
            label="Settings"
            active={view === "settings"}
            onClick={() => setView("settings")}
          />
          {systemAudit ? (
            <div className="rail-device" aria-label="Current Windows device">
              <span className="rail-device__icon">
                <CodeRegular />
              </span>
              <div>
                <strong>
                  {systemAudit.environment.windows === "windows11" ? "Windows 11" : "Windows 10"}
                </strong>
                <small>Build {systemAudit.environment.build}</small>
                <small>{systemAudit.environment.architecture}</small>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="workspace" id="workspace-main">
        <header className="workspace-commandbar workspace-enter" aria-label="System commands">
          <div className="workspace-commandbar__heading">
            <h1>{view === "understand" ? greeting() : title}</h1>
            <p>{view === "understand" ? homeSubtitle(homeState, systemAudit) : subtitle}</p>
          </div>
          <div className="command-header">
            <span className="workspace-commandbar__updated">
              Last update: {formatUpdatedAt(lastDataUpdatedAt, i18n.language)}
            </span>
            <Input
              className="command-search"
              contentBefore={<SearchRegular />}
              placeholder={t("workspace.commandSearch")}
              onChange={(_, data) => {
                setSearch(data.value);
                if (data.value) setView("choose");
              }}
            />
            <Button appearance="subtle" icon={<ArrowClockwiseRegular />} onClick={onRetry}>
              Rescan
            </Button>
          </div>
        </header>

        {view !== "understand" && error ? (
          <section className="error-state workspace-enter" aria-live="polite">
            <WarningRegular />
            <div>
              <h2>{t("workspace.error.title")}</h2>
              <p>{t("workspace.error.body")}</p>
            </div>
            <Button icon={<ArrowClockwiseRegular />} onClick={onRetry}>
              {t("workspace.error.retry")}
            </Button>
          </section>
        ) : view !== "understand" && loading ? (
          <section className="loading-grid workspace-enter" aria-label={t("review.loading")}>
            <div className="skeleton skeleton-wide" />
            <div className="skeleton" />
            <div className="skeleton" />
          </section>
        ) : view === "understand" ? (
          <HomeWorkspace
            state={homeState}
            audit={systemAudit}
            providers={appProviders}
            recoveries={recoveries}
            onRetry={onRetry}
            onOpenOptimize={(recommendedOnly) =>
              openAllTweaks(recommendedOnly ? "recommended" : "all")
            }
            onReviewTweak={(tweakId) => {
              if (!selectedIds.has(tweakId)) onToggle(tweakId);
              onReview();
            }}
            onOpenApps={() => setView("store")}
            onOpenWindows={() => setView("diagnostics")}
            onOpenRecovery={() => setView("recover")}
          />
        ) : view === "store" ? (
          <ApplicationsWorkspace
            apps={apps}
            providers={appProviders}
            appxPackages={appxPackages}
            appxPreview={appxPreview}
            appxLoading={appxLoading}
            onPreviewAppx={onPreviewAppx}
            selectedIds={selectedApps}
            manager={appManager}
            installing={appInstalling}
            appUpdating={appUpdating}
            loading={appsLoading}
            error={appsError}
            installError={appInstallError}
            installReport={appInstallReport}
            appUpdateReport={appUpdateReport}
            taskId={appTaskId}
            onToggle={onToggleApp}
            onManagerChange={onAppManagerChange}
            onInstall={onInstallApps}
            onUpdateAll={onUpdateAllApps}
            onBootstrapChocolatey={onBootstrapChocolatey}
            onCancel={onCancelAppOperation}
            onRefreshProviders={onRefreshProviders}
          />
        ) : view === "diagnostics" ? (
          <DiagnosticsWorkspace audit={systemAudit} />
        ) : view === "recover" ? (
          <RecoveryWorkspace
            recoveries={recoveries}
            restoring={recoveryRestoring}
            restoreError={recoveryRestoreError}
            restoredSessionId={restoredSessionId}
            onRestore={onRestoreSession}
          />
        ) : view === "settings" ? (
          <SettingsWorkspace
            dark={dark}
            language={i18n.language}
            onThemeChange={onThemeChange}
            onLanguageChange={changeLanguage}
          />
        ) : (
          <div className="choose-workspace workspace-enter">
            <GoalPicker selectedGoals={selectedGoals} onToggleGoal={toggleGoal} />
            <section className="profile-preview" aria-label={t("workspace.profiles.title")}>
              <div className="section-title-row">
                <div>
                  <h2>{t("workspace.profiles.title")}</h2>
                  <p>{t("workspace.profiles.body")}</p>
                </div>
              </div>
              <div className="goal-strip">
                {profiles.map((profile) => (
                  <button
                    type="button"
                    key={profile.name}
                    onClick={() => onPreviewProfile(profile)}
                  >
                    <SettingsRegular />
                    <span>
                      <strong>
                        {i18n.language.startsWith("ru") ? profile.title.ru : profile.title.en}
                      </strong>
                      <small>
                        {i18n.language.startsWith("ru")
                          ? profile.description.ru
                          : profile.description.en}{" "}
                        · {t("workspace.profiles.count", { count: profile.tweaks.length })}
                      </small>
                    </span>
                    <ArrowRightRegular />
                  </button>
                ))}
              </div>
            </section>
            <RecommendationSummary
              catalog={catalog}
              recommendations={recommendations}
              stateById={stateById}
              selectedIds={selectedIds}
              selectedGoals={selectedGoals}
              onToggle={onToggle}
            />
            <section className="catalog-workspace" aria-label={t("workspace.tweaks.title")}>
              <div className="catalog-toolbar">
                <div
                  className="category-tabs"
                  role="group"
                  aria-label={t("workspace.tweaks.categoryLabel")}
                >
                  {["all", ...categories].map((item) => (
                    <button
                      type="button"
                      key={item}
                      data-active={category === item}
                      onClick={() => setCategory(item)}
                    >
                      {t(`workspace.tweaks.categories.${item}`)}
                    </button>
                  ))}
                </div>
                <Input
                  className="search-input"
                  contentBefore={<SearchRegular />}
                  placeholder={t("workspace.tweaks.search")}
                  value={search}
                  onChange={(_, data) => setSearch(data.value)}
                />
                <select
                  value={risk}
                  onChange={(event) => setRisk(event.target.value as typeof risk)}
                  aria-label={t("workspace.tweaks.riskLabel")}
                >
                  <option value="all">{t("workspace.tweaks.categories.all")}</option>
                  {(["low", "moderate", "high"] as const).map((item) => (
                    <option key={item} value={item}>
                      {t(`risk.${item}`)}
                    </option>
                  ))}
                </select>
                <div
                  className="filter-tabs"
                  role="group"
                  aria-label={t("workspace.tweaks.filterLabel")}
                >
                  {(
                    [
                      "all",
                      "recommended",
                      "enabled",
                      "disabled",
                      "mixed",
                      "unsupported",
                      "unknown",
                      "requires_restart",
                    ] as Filter[]
                  ).map((item) => (
                    <button
                      type="button"
                      key={item}
                      data-active={filter === item}
                      onClick={() => setFilter(item)}
                    >
                      {t(`workspace.tweaks.filters.${item}`)}
                    </button>
                  ))}
                </div>
                <span className="result-count">
                  {t("workspace.tweaks.count", { count: filteredCatalog.length })}
                </span>
              </div>

              <div className="tweak-table">
                {filteredCatalog.length === 0 ? (
                  <div className="empty-state">
                    <SearchRegular />
                    <h2>{t("workspace.tweaks.emptyTitle")}</h2>
                    <p>{t("workspace.tweaks.emptyBody")}</p>
                    <Button
                      appearance="subtle"
                      onClick={() => {
                        setSearch("");
                        setFilter("all");
                        setCategory("all");
                        setRisk("all");
                      }}
                    >
                      {t("workspace.tweaks.reset")}
                    </Button>
                  </div>
                ) : (
                  filteredCatalog.map((tweak) => {
                    const state = stateById.get(tweak.id);
                    const selected = selectedIds.has(tweak.id);
                    const expanded = expandedId === tweak.id;
                    return (
                      <article
                        className="tweak-item"
                        data-selected={selected}
                        data-expanded={expanded}
                        key={tweak.id}
                      >
                        <div className="tweak-item__summary">
                          <Checkbox
                            checked={selected}
                            disabled={
                              state === "enabled" ||
                              state === "requires_restart" ||
                              state === "unsupported" ||
                              state === "unknown"
                            }
                            aria-label={t(`tweaks.${tweak.id}.label`, {
                              defaultValue: i18n.language.startsWith("ru")
                                ? tweak.title.ru
                                : tweak.title.en,
                            })}
                            onChange={() => onToggle(tweak.id)}
                          />
                          <button
                            type="button"
                            className="tweak-item__toggle"
                            aria-expanded={expanded}
                            onClick={() => setExpandedId(expanded ? undefined : tweak.id)}
                          >
                            <span className="tweak-item__copy">
                              <strong>
                                {t(`tweaks.${tweak.id}.label`, {
                                  defaultValue: i18n.language.startsWith("ru")
                                    ? tweak.title.ru
                                    : tweak.title.en,
                                })}
                              </strong>
                              <span>
                                {t(`tweaks.${tweak.id}.description`, {
                                  defaultValue: i18n.language.startsWith("ru")
                                    ? tweak.description.ru
                                    : tweak.description.en,
                                })}
                              </span>
                            </span>
                            <span className="tweak-item__meta">
                              <RiskLabel risk={tweak.risk} />
                              <StateLabel state={state} />
                              <ChevronDownRegular className="expand-icon" />
                            </span>
                          </button>
                        </div>
                        {expanded ? (
                          <div className="tweak-details">
                            <div>
                              <span>{t("workspace.tweaks.target")}</span>
                              <code>
                                {tweak.apply[0]?.hive}\\{tweak.apply[0]?.key_path}
                              </code>
                            </div>
                            <div>
                              <span>{t("workspace.tweaks.restart")}</span>
                              <strong>
                                {t(
                                  tweak.restart_requirement !== "none"
                                    ? "catalog.restart"
                                    : "catalog.noRestart",
                                )}
                              </strong>
                            </div>
                            <div>
                              <span>{t("workspace.tweaks.support")}</span>
                              <strong>
                                {i18n.language.startsWith("ru")
                                  ? tweak.support.notes.ru
                                  : tweak.support.notes.en}
                              </strong>
                            </div>
                            <div>
                              <span>{t("workspace.tweaks.scope")}</span>
                              <strong>
                                {tweak.requires_admin
                                  ? t("workspace.tweaks.administrator")
                                  : t("workspace.tweaks.currentUser")}
                              </strong>
                            </div>
                            <div className="tweak-details__paths">
                              <span>{t("workspace.tweaks.affectedPaths")}</span>
                              {tweak.affected_paths.map((affected) => (
                                <code key={`${affected.provider}-${affected.path}`}>
                                  {affected.path}
                                </code>
                              ))}
                            </div>
                            {tweak.warnings.length > 0 ? (
                              <MessageBar intent="warning">
                                <MessageBarBody>
                                  {tweak.warnings
                                    .map((warning) =>
                                      i18n.language.startsWith("ru") ? warning.ru : warning.en,
                                    )
                                    .join(" ")}
                                </MessageBarBody>
                              </MessageBar>
                            ) : null}
                            {tweak.references[0] ? (
                              <Link href={tweak.references[0]} target="_blank" rel="noreferrer">
                                {t("catalog.source")} <ArrowUpRightRegular />
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {selectedIds.size > 0 ? (
        <div className="selection-tray" role="status">
          <div>
            <span>{t("workspace.selection.label")}</span>
            <strong>{t("workspace.selection.count", { count: selectedIds.size })}</strong>
          </div>
          <Button appearance="primary" icon={<PowerRegular />} onClick={onReview}>
            {t("workspace.selection.review")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type UnderstandWorkspaceProps = {
  catalog: TweakDefinition[];
  appliedCount: number;
  recoveryCount: number;
  onOpenAll: (filter?: Filter) => void;
};

function UnderstandWorkspace({
  catalog,
  appliedCount,
  recoveryCount,
  onOpenAll,
}: UnderstandWorkspaceProps) {
  const { t } = useTranslation();
  return (
    <section className="understand-workspace workspace-enter" aria-labelledby="understand-title">
      <div className="understand-intro">
        <span className="eyebrow">{t("workspace.understand.eyebrow")}</span>
        <h2 id="understand-title">{t("workspace.understand.statement")}</h2>
        <p>{t("workspace.understand.body")}</p>
        <Button
          appearance="primary"
          icon={<ArrowRightRegular />}
          iconPosition="after"
          onClick={() => onOpenAll()}
        >
          {t("workspace.understand.choose")}
        </Button>
      </div>

      <dl className="state-ledger" aria-label={t("workspace.understand.currentState")}>
        <div>
          <dt>{t("workspace.understand.available")}</dt>
          <dd>{t("workspace.understand.availableValue", { count: catalog.length })}</dd>
        </div>
        <div>
          <dt>{t("workspace.understand.applied")}</dt>
          <dd>{t("workspace.understand.appliedValue", { count: appliedCount })}</dd>
        </div>
        <div>
          <dt>{t("workspace.understand.recovery")}</dt>
          <dd>{t("workspace.understand.recoveryValue", { count: recoveryCount })}</dd>
        </div>
      </dl>

      <div className="workflow-explainer">
        <div>
          <span className="eyebrow">{t("workspace.understand.processLabel")}</span>
          <h3>{t("workspace.understand.processTitle")}</h3>
        </div>
        <ol>
          {(["understand", "choose", "review", "apply", "recover"] as const).map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{t(`workspace.flow.${step}.title`)}</strong>
                <p>{t(`workspace.flow.${step}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

type GoalPickerProps = {
  selectedGoals: UserGoal[];
  onToggleGoal: (goal: UserGoal) => void;
};

function GoalPicker({ selectedGoals, onToggleGoal }: GoalPickerProps) {
  const { t } = useTranslation();
  return (
    <section className="goal-section" aria-labelledby="goal-heading">
      <div className="section-title-row">
        <div>
          <h2 id="goal-heading">{t("workspace.goals.title")}</h2>
          <p>{t("workspace.goals.body")}</p>
        </div>
      </div>
      <div className="goal-strip">
        {goals.map((goal) => {
          const Icon = goalIcons[goal];
          const active = selectedGoals.includes(goal);
          return (
            <button
              type="button"
              key={goal}
              data-active={active}
              aria-pressed={active}
              onClick={() => onToggleGoal(goal)}
            >
              <Icon />
              <span>
                <strong>{t(`goals.${goal}.title`)}</strong>
                <small>{t(`goals.${goal}.body`)}</small>
              </span>
              {active ? <CheckmarkCircleRegular className="goal-check" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type RecommendationSummaryProps = {
  catalog: TweakDefinition[];
  recommendations: NonNullable<AdvisorReport["recommendations"]>;
  stateById: Map<string, TweakStatus["state"]>;
  selectedIds: Set<string>;
  selectedGoals: UserGoal[];
  onToggle: (id: string) => void;
};

function RecommendationSummary({
  catalog,
  recommendations,
  stateById,
  selectedIds,
  selectedGoals,
  onToggle,
}: RecommendationSummaryProps) {
  const { t } = useTranslation();
  return (
    <section className="recommendations-section" aria-labelledby="recommendations-title">
      <div className="section-title-row">
        <div>
          <h2 id="recommendations-title">{t("workspace.recommendations.title")}</h2>
          <p>{t("workspace.recommendations.body")}</p>
        </div>
      </div>
      {selectedGoals.length === 0 ? (
        <div className="recommendation-empty">
          <ShieldLockRegular />
          <div>
            <h3>{t("workspace.recommendations.emptyTitle")}</h3>
            <p>{t("workspace.recommendations.emptyBody")}</p>
          </div>
        </div>
      ) : (
        <div className="recommendation-list">
          {recommendations.slice(0, 4).map((recommendation) => {
            const tweak = catalog.find((item) => item.id === recommendation.tweak_id);
            if (!tweak) return null;
            const applied = ["enabled", "requires_restart"].includes(stateById.get(tweak.id) ?? "");
            return (
              <article key={tweak.id}>
                <div className="recommendation-icon">
                  {applied ? <CheckmarkCircleRegular /> : <SettingsRegular />}
                </div>
                <div>
                  <div className="recommendation-title">
                    <h3>{t(`tweaks.${tweak.id}.label`, { defaultValue: tweak.title.en })}</h3>
                    <RiskLabel risk={tweak.risk} />
                  </div>
                  <p>
                    {t(`tweaks.${tweak.id}.description`, { defaultValue: tweak.description.en })}
                  </p>
                </div>
                <Button
                  appearance={selectedIds.has(tweak.id) ? "secondary" : "primary"}
                  disabled={applied}
                  onClick={() => onToggle(tweak.id)}
                >
                  {applied
                    ? t("advisor.applied")
                    : selectedIds.has(tweak.id)
                      ? t("workspace.recommendations.selected")
                      : t("workspace.recommendations.add")}
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RiskLabel({ risk }: { risk: TweakDefinition["risk"] }) {
  const { t } = useTranslation();
  return (
    <Badge
      appearance="tint"
      color={risk === "low" ? "success" : risk === "high" ? "danger" : "warning"}
    >
      {t(`risk.${risk}`)}
    </Badge>
  );
}

function StateLabel({ state }: { state?: TweakStatus["state"] }) {
  const { t } = useTranslation();
  const labels = {
    enabled: "advisor.applied",
    disabled: "workspace.tweaks.inactive",
    mixed: "advisor.mixed",
    unsupported: "workspace.tweaks.unsupported",
    unknown: "workspace.tweaks.unknown",
    requires_restart: "workspace.tweaks.requiresRestart",
  } as const;
  return state ? (
    <span className={`state-label state-label--${state}`}>{t(labels[state])}</span>
  ) : null;
}

type RailItemProps = {
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
};

function RailItem({ icon, label, active, badge, onClick }: RailItemProps) {
  return (
    <Tooltip
      content={{ children: label, className: "rail-tooltip" }}
      relationship="label"
      positioning={{ position: "after", align: "center", offset: { crossAxis: 0, mainAxis: 10 } }}
      withArrow
    >
      <button
        type="button"
        className="rail-button"
        data-active={active}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        {icon}
        <span>{label}</span>
        {badge ? <b>{badge}</b> : null}
      </button>
    </Tooltip>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function homeSubtitle(state: ReturnType<typeof deriveHomeState>, audit?: SystemAudit): string {
  if (state.kind === "loading") return "Reading current Windows and application evidence.";
  if (state.kind === "error") return "Current system evidence could not be loaded.";
  if (state.kind === "nativeAuditUnavailable") {
    return "Open the desktop app for native Windows evidence.";
  }
  if (state.kind === "restartEvidence")
    return "Windows reports a restart signal that needs review.";
  if (state.kind === "providerAttention")
    return "One or more application providers need attention.";
  if (state.kind === "reviewRequired") return "A documented change needs your review.";
  if (state.kind === "actionableTweak") return "A recommendation is ready for review.";
  if (audit)
    return `${audit.environment.windows === "windows11" ? "Windows 11" : "Windows 10"} build ${audit.environment.build} evidence is available.`;
  return "Review documented changes and recovery activity.";
}

function formatUpdatedAt(value: number, locale: string): string {
  if (value <= 0) return "not yet available";
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (elapsedSeconds < 60) return formatter.format(-elapsedSeconds, "second");
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return formatter.format(-elapsedMinutes, "minute");
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return formatter.format(-elapsedHours, "hour");
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(value);
}

type SettingsWorkspaceProps = {
  dark: boolean;
  language: string;
  onThemeChange: () => void;
  onLanguageChange: () => void;
};

function SettingsWorkspace({
  dark,
  language,
  onThemeChange,
  onLanguageChange,
}: SettingsWorkspaceProps) {
  const { t } = useTranslation();
  return (
    <section className="settings-workspace workspace-enter" aria-labelledby="settings-title">
      <h2 id="settings-title">{t("workspace.settings.preferences")}</h2>
      <div className="settings-list">
        <div>
          <span className="settings-icon" aria-hidden="true">
            {dark ? <WeatherMoonRegular /> : <WeatherSunnyRegular />}
          </span>
          <div>
            <strong>{t("workspace.settings.appearance")}</strong>
            <p>{t("workspace.settings.appearanceBody")}</p>
          </div>
          <Button appearance="secondary" onClick={onThemeChange}>
            {dark ? t("workspace.settings.useLight") : t("workspace.settings.useDark")}
          </Button>
        </div>
        <div>
          <span className="settings-icon" aria-hidden="true">
            <LocalLanguageRegular />
          </span>
          <div>
            <strong>{t("workspace.settings.language")}</strong>
            <p>{t("workspace.settings.languageBody")}</p>
          </div>
          <Button appearance="secondary" onClick={onLanguageChange}>
            {language.startsWith("ru")
              ? t("workspace.settings.useEnglish")
              : t("workspace.settings.useRussian")}
          </Button>
        </div>
      </div>
    </section>
  );
}

type ApplicationsWorkspaceProps = {
  apps: AppDefinition[];
  providers: AppProviderStatus[];
  appxPackages: AppxPackage[];
  appxPreview?: AppxRemovalPreview;
  appxLoading: boolean;
  onPreviewAppx: (fullName: string) => void;
  selectedIds: Set<string>;
  manager: AppPackageManager;
  installing: boolean;
  appUpdating: boolean;
  loading: boolean;
  error: boolean;
  installError: boolean;
  installReport?: AppInstallReport;
  appUpdateReport?: AppInstallReport;
  taskId?: string;
  onToggle: (id: string) => void;
  onManagerChange: (manager: AppPackageManager) => void;
  onInstall: () => void;
  onUpdateAll: () => void;
  onBootstrapChocolatey: () => void;
  onCancel: () => void;
  onRefreshProviders: () => void;
};

function ApplicationsWorkspace({
  apps,
  providers,
  appxPackages,
  appxPreview,
  appxLoading,
  onPreviewAppx,
  selectedIds,
  manager,
  installing,
  appUpdating,
  loading,
  error,
  installError,
  installReport,
  appUpdateReport,
  taskId,
  onToggle,
  onManagerChange,
  onInstall,
  onUpdateAll,
  onBootstrapChocolatey,
  onCancel,
  onRefreshProviders,
}: ApplicationsWorkspaceProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [fossOnly, setFossOnly] = useState(false);
  const [sort, setSort] = useState<"name" | "category">("name");
  const [confirmation, setConfirmation] = useState<"install" | "update" | null>(null);
  const categories = useMemo(() => [...new Set(apps.map((app) => app.category))].sort(), [apps]);
  const filteredApps = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return apps
      .filter((app) => category === "all" || app.category === category)
      .filter((app) => !fossOnly || app.foss)
      .filter(
        (app) =>
          !term ||
          `${app.name} ${app.description} ${app.category}`.toLocaleLowerCase().includes(term),
      )
      .sort((left, right) =>
        sort === "category"
          ? left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
          : left.name.localeCompare(right.name),
      );
  }, [apps, category, fossOnly, search, sort]);
  const provider = (kind: AppPackageManager) => providers.find((item) => item.manager === kind);
  const selected = apps.filter((app) => selectedIds.has(app.id));
  const fallbackCount =
    manager === "choco" ? selected.filter((app) => app.choco === "na").length : 0;
  const selectedProvider = provider(manager);
  const canInstall = manager === "choco" || selectedProvider?.available === true;
  const canUpdate = selectedProvider?.available === true;
  const commandPreview =
    confirmation === "update"
      ? manager === "winget"
        ? "winget upgrade --all --silent --accept-package-agreements --accept-source-agreements"
        : "choco upgrade all --yes --no-progress"
      : manager === "winget"
        ? "winget install --id <package> --exact --silent"
        : "choco install <package> --yes --no-progress";
  const executeConfirmedAction = () => {
    if (confirmation === "install") {
      if (manager === "choco" && !selectedProvider?.available) onBootstrapChocolatey();
      else onInstall();
    }
    if (confirmation === "update") onUpdateAll();
    setConfirmation(null);
  };

  if (loading) {
    return (
      <section className="apps-workspace apps-empty workspace-enter">
        <Spinner label={t("workspace.apps.loading")} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="apps-workspace apps-empty workspace-enter">
        <WarningRegular />
        <h2>{t("workspace.apps.loadErrorTitle")}</h2>
        <p>{t("workspace.apps.loadErrorBody")}</p>
        <Button appearance="primary" onClick={onRefreshProviders}>
          {t("workspace.error.retry")}
        </Button>
      </section>
    );
  }

  return (
    <section className="apps-workspace workspace-enter" aria-labelledby="apps-title">
      <div className="provider-strip">
        {(["winget", "choco"] as const).map((kind) => {
          const status = provider(kind);
          return (
            <button
              type="button"
              className="provider-choice"
              data-active={manager === kind}
              key={kind}
              onClick={() => onManagerChange(kind)}
            >
              <span
                className={`provider-mark${kind === "choco" ? " provider-mark--secondary" : ""}`}
              >
                {kind === "winget" ? "W" : "C"}
              </span>
              <span>
                <strong>
                  {t(`workspace.apps.${kind === "winget" ? "winget" : "chocolatey"}`)}
                </strong>
                <small>
                  {status?.available
                    ? status.version || t("workspace.apps.available")
                    : kind === "choco"
                      ? t("workspace.apps.bootstrap")
                      : t("workspace.apps.unavailable")}
                </small>
              </span>
            </button>
          );
        })}
        <Button
          className="provider-refresh"
          appearance="subtle"
          icon={<ArrowClockwiseRegular />}
          onClick={onRefreshProviders}
        >
          {t("workspace.apps.refreshProviders")}
        </Button>
      </div>

      <div className="section-title-row apps-heading app-store-heading">
        <div>
          <span className="eyebrow">{t("workspace.apps.storeLabel")}</span>
          <h2 id="apps-title">{t("workspace.apps.catalogTitle")}</h2>
          <p>{t("workspace.apps.catalogBody", { count: apps.length })}</p>
        </div>
        <div className="app-store-actions">
          <Button
            appearance="secondary"
            disabled={!canUpdate || appUpdating || installing}
            onClick={() => setConfirmation("update")}
          >
            {appUpdating ? t("workspace.apps.updating") : t("workspace.apps.updateAll")}
          </Button>
          {taskId ? (
            <Button appearance="secondary" onClick={onCancel}>
              {t("review.cancel")}
            </Button>
          ) : null}
          <Button
            appearance="primary"
            disabled={selectedIds.size === 0 || installing || appUpdating || !canInstall}
            onClick={() => setConfirmation("install")}
          >
            {installing
              ? t("workspace.apps.installing")
              : t("workspace.apps.installSelected", { count: selectedIds.size })}
          </Button>
        </div>
      </div>

      <div className="apps-toolbar">
        <Input
          className="search-input"
          contentBefore={<SearchRegular />}
          placeholder={t("workspace.apps.search")}
          value={search}
          onChange={(_, data) => setSearch(data.value)}
        />
        <label>
          <span>{t("workspace.apps.category")}</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">{t("workspace.apps.allCategories")}</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("workspace.apps.sort")}</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "name" | "category")}
          >
            <option value="name">{t("workspace.apps.sortName")}</option>
            <option value="category">{t("workspace.apps.sortCategory")}</option>
          </select>
        </label>
        <Checkbox
          checked={fossOnly}
          label={t("workspace.apps.fossOnly")}
          onChange={(_, data) => setFossOnly(Boolean(data.checked))}
        />
        <span className="result-count">
          {t("workspace.apps.count", { count: filteredApps.length })}
        </span>
      </div>
      <details className="app-operation appx-inventory">
        <summary>
          {appxLoading
            ? t("workspace.appx.loading")
            : t("workspace.appx.inventory", { count: appxPackages.length })}
        </summary>
        <p>{t("workspace.appx.body")}</p>
        {appxPackages.slice(0, 100).map((item) => (
          <div className="appx-row" key={item.full_name}>
            <span>
              <strong>{item.name}</strong>
              <small>
                {item.version} · {item.architecture}
              </small>
            </span>
            <Badge
              appearance="tint"
              color={item.safety === "reviewed_optional" ? "informative" : "subtle"}
            >
              {item.safety}
            </Badge>
            <Button appearance="subtle" onClick={() => onPreviewAppx(item.full_name)}>
              {t("workspace.appx.preview")}
            </Button>
          </div>
        ))}
        {appxPreview ? (
          <MessageBar intent={appxPreview.can_remove ? "warning" : "info"}>
            <MessageBarBody>
              {appxPreview.package.name}: {appxPreview.explanation}
            </MessageBarBody>
          </MessageBar>
        ) : null}
      </details>
      {fallbackCount > 0 ? (
        <p className="app-notice">{t("workspace.apps.fallback", { count: fallbackCount })}</p>
      ) : null}
      {installError ? (
        <p className="app-notice app-notice--error">{t("workspace.apps.installError")}</p>
      ) : null}
      {installReport ? <OperationResult report={installReport} /> : null}
      {appUpdateReport ? <MaintenanceResult report={appUpdateReport} /> : null}

      <div className="app-grid">
        {filteredApps.map((app) => {
          const packageId = manager === "choco" && app.choco !== "na" ? app.choco : app.winget;
          return (
            <article data-selected={selectedIds.has(app.id)} key={app.id}>
              <Checkbox
                checked={selectedIds.has(app.id)}
                aria-label={app.name}
                onChange={() => onToggle(app.id)}
              />
              <div className="app-icon" aria-hidden="true">
                {app.name.slice(0, 1)}
              </div>
              <div>
                <h3>{app.name}</h3>
                <p>{app.category}</p>
              </div>
              <Badge appearance="tint" color={app.foss ? "success" : "informative"}>
                {app.foss ? "FOSS" : manager === "choco" && app.choco === "na" ? "Winget" : manager}
              </Badge>
              <p className="app-description">{app.description}</p>
              <code>{packageId}</code>
              <Link href={app.link} target="_blank" rel="noreferrer">
                {t("workspace.apps.website")} <ArrowUpRightRegular />
              </Link>
            </article>
          );
        })}
      </div>
      <Dialog
        open={confirmation !== null}
        onOpenChange={(_, data) => !data.open && setConfirmation(null)}
      >
        <DialogSurface className="app-confirmation">
          <DialogBody>
            <DialogTitle>
              {t(`workspace.apps.confirm.${confirmation ?? "install"}.title`)}
            </DialogTitle>
            <DialogContent>
              <p>
                {t(`workspace.apps.confirm.${confirmation ?? "install"}.body`, {
                  count: selectedIds.size,
                })}
              </p>
              {manager === "choco" && !selectedProvider?.available ? (
                <MessageBar intent="warning">
                  <MessageBarBody>{t("workspace.apps.chocoConsent")}</MessageBarBody>
                </MessageBar>
              ) : null}
              <code className="app-command-preview">{commandPreview}</code>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirmation(null)}>
                {t("review.cancel")}
              </Button>
              <Button appearance="primary" onClick={executeConfirmedAction}>
                {t("workspace.apps.confirm.run")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  );
}

function OperationResult({ report }: { report: AppInstallReport }) {
  const { t } = useTranslation();
  const successful = report.results.filter((item) => item.success).length;
  return (
    <details className="app-operation" open>
      <summary>
        {t("workspace.apps.installComplete", { count: successful, total: report.requested_count })}
      </summary>
      {report.results.map((item) => (
        <p key={item.app_id} data-success={item.success}>
          <strong>{item.name}</strong>
          <span>{item.message || item.package_id}</span>
        </p>
      ))}
      {report.restore_blocked ? <p className="app-notice">{report.restore_explanation}</p> : null}
    </details>
  );
}

function MaintenanceResult({ report }: { report: AppInstallReport }) {
  const { t } = useTranslation();
  const successful = report.results.filter((item) => item.success).length;
  return (
    <details className="app-operation" open>
      <summary data-success={successful === report.results.length}>
        {successful === report.results.length
          ? t("workspace.apps.updateComplete")
          : t("workspace.apps.updateError")}
      </summary>
      {report.results.map((item) => (
        <p key={item.app_id} data-success={item.success}>
          <strong>{item.name}</strong>
          <span>{item.message || t("workspace.apps.noUpdates")}</span>
        </p>
      ))}
      {report.restore_blocked ? <p className="app-notice">{report.restore_explanation}</p> : null}
    </details>
  );
}

function DiagnosticsWorkspace({ audit }: { audit?: SystemAudit }) {
  const { t } = useTranslation();
  if (!audit) {
    return (
      <section className="apps-empty workspace-enter">
        <Spinner label={t("workspace.diagnostics.loading")} />
      </section>
    );
  }
  const counts = audit.tweak_statuses.reduce<Record<string, number>>((result, item) => {
    result[item.state] = (result[item.state] ?? 0) + 1;
    return result;
  }, {});
  return (
    <section
      className="activity-workspace workspace-enter"
      aria-label={t("workspace.diagnostics.title")}
    >
      <div className="activity-list">
        <div className="activity-list__heading">
          <h2>{t("workspace.diagnostics.evidence")}</h2>
        </div>
        <div className="diagnostic-card">
          <strong>Windows</strong>
          <span>
            {audit.environment.windows} build {audit.environment.build}
          </span>
        </div>
        <div className="diagnostic-card">
          <strong>{t("workspace.diagnostics.architecture")}</strong>
          <span>{audit.environment.architecture}</span>
        </div>
        <div className="diagnostic-card">
          <strong>{t("workspace.diagnostics.elevation")}</strong>
          <span>
            {audit.environment.is_admin
              ? t("workspace.diagnostics.admin")
              : t("workspace.diagnostics.standard")}
          </span>
        </div>
        <div className="diagnostic-card">
          <strong>{t("workspace.diagnostics.appx")}</strong>
          <span>{audit.appx_package_count}</span>
        </div>
        <div className="diagnostic-card">
          <strong>{t("workspace.diagnostics.recovery")}</strong>
          <span>{audit.recovery_session_count}</span>
        </div>
      </div>
      <aside className="activity-inspector">
        <span>{t("workspace.diagnostics.audit")}</span>
        <h2>
          {audit.pending_restart
            ? t("workspace.diagnostics.pending")
            : t("workspace.diagnostics.clear")}
        </h2>
        <p>{audit.pending_restart_reasons.join(", ") || t("workspace.diagnostics.clearBody")}</p>
        <dl>
          {Object.entries(counts).map(([state, count]) => (
            <div key={state}>
              <dt>{state}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </section>
  );
}

type RecoveryWorkspaceProps = {
  recoveries: RecoverySessionSummary[];
  restoring: boolean;
  restoreError: boolean;
  restoredSessionId?: string;
  onRestore: (sessionId: string) => void;
};

function RecoveryWorkspace({
  recoveries,
  restoring,
  restoreError,
  restoredSessionId,
  onRestore,
}: RecoveryWorkspaceProps) {
  const { t, i18n } = useTranslation();
  const [activeId, setActiveId] = useState(recoveries[0]?.session_id);
  const active = recoveries.find((item) => item.session_id === activeId) ?? recoveries[0];

  return (
    <section className="activity-workspace workspace-enter" aria-labelledby="activity-title">
      <div className="activity-list">
        <div className="activity-list__heading">
          <h2 id="activity-title">{t("workspace.activity.sessions")}</h2>
          <Badge appearance="tint" color="informative">
            {recoveries.length}
          </Badge>
        </div>
        {recoveries.length === 0 ? (
          <div className="apps-empty">
            <HistoryRegular />
            <h3>{t("workspace.activity.emptyTitle")}</h3>
            <p>{t("workspace.activity.emptyBody")}</p>
          </div>
        ) : (
          recoveries.map((session) => (
            <button
              type="button"
              key={session.session_id}
              data-active={session.session_id === active?.session_id}
              onClick={() => setActiveId(session.session_id)}
            >
              <CheckmarkCircleRegular />
              <span>
                <strong>{t("workspace.activity.tweakSession")}</strong>
                <small>
                  {new Date(session.created_unix_seconds * 1000).toLocaleString(i18n.language)}
                </small>
              </span>
              <ArrowRightRegular />
            </button>
          ))
        )}
      </div>
      <aside className="activity-inspector">
        {active ? (
          <>
            <span>{t("workspace.activity.recovery")}</span>
            <h2>{t("workspace.activity.tweakSession")}</h2>
            <p>{t("workspace.activity.recoveryBody")}</p>
            {restoreError ? (
              <MessageBar intent="error">
                <MessageBarBody>{t("workspace.recover.restoreError")}</MessageBarBody>
              </MessageBar>
            ) : null}
            {restoredSessionId === active.session_id ? (
              <MessageBar intent="success">
                <MessageBarBody>{t("workspace.recover.restoreComplete")}</MessageBarBody>
              </MessageBar>
            ) : null}
            <dl>
              <div>
                <dt>{t("workspace.activity.entries")}</dt>
                <dd>{active.entry_count}</dd>
              </div>
              <div>
                <dt>{t("workspace.activity.sessionId")}</dt>
                <dd>
                  <code>{active.session_id}</code>
                </dd>
              </div>
            </dl>
            <Button
              appearance="secondary"
              disabled={restoring}
              onClick={() => onRestore(active.session_id)}
            >
              {restoring ? t("workspace.recover.restoring") : t("workspace.recover.restore")}
            </Button>
          </>
        ) : (
          <div className="activity-inspector__empty">
            <HistoryRegular />
            <p>{t("workspace.activity.selectSession")}</p>
          </div>
        )}
      </aside>
    </section>
  );
}
