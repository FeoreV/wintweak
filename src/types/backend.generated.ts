// This file mirrors the Specta output and is overwritten by a debug Tauri build.

export type UserGoal = "privacy" | "development" | "reduce_distractions";
export type TweakRisk = "low" | "moderate" | "high";
export type TweakState = "applied" | "not_applied" | "mixed";
export type RegistryHive = "current_user" | "local_machine";
export type RecommendationDisposition =
  | "recommended"
  | "review_required"
  | "already_applied"
  | "mixed"
  | "not_relevant";

export type RegistryValue =
  | { kind: "missing" }
  | { kind: "dword"; value: number }
  | { kind: "qword"; value: number }
  | { kind: "string"; value: string };

export type RegistryAction = {
  hive: RegistryHive;
  key_path: string;
  value_name: string;
  value: RegistryValue;
};

export type TweakDefinition = {
  id: string;
  label: string;
  description: string;
  category: string;
  goals: UserGoal[];
  risk: TweakRisk;
  requires_restart: boolean;
  references: string[];
  actions: RegistryAction[];
};

export type TweakStatus = { id: string; state: TweakState };
export type AdvisorRequest = { goals: UserGoal[] };
export type TweakRecommendation = {
  tweak_id: string;
  disposition: RecommendationDisposition;
  matched_goals: UserGoal[];
};
export type AdvisorReport = { recommendations: TweakRecommendation[] };
export type TweakBatchConfig = { schema_version: number; tweaks: { id: string }[] };
export type PlannedRegistryChange = {
  hive: RegistryHive;
  key_path: string;
  value_name: string;
  current: RegistryValue;
  target: RegistryValue;
  required: boolean;
};
export type PlannedTweak = { id: string; changes: PlannedRegistryChange[] };
export type BatchPlan = { tweaks: PlannedTweak[]; change_count: number };
export type ApplyBatchReport = { session_id?: string; applied_tweaks: string[] };
export type RecoverySessionSummary = {
  session_id: string;
  created_unix_seconds: number;
  entry_count: number;
};
export type RestoreSessionReport = {
  recovery_session_id: string;
  source_session_id: string;
  restored_entry_count: number;
  skipped_pending_entry_count: number;
};
export type AppPackageManager = "winget" | "choco";
export type AppDefinition = {
  id: string;
  category: string;
  choco: string;
  name: string;
  description: string;
  link: string;
  winget: string;
  foss: boolean;
};
export type AppProviderStatus = {
  manager: AppPackageManager;
  available: boolean;
  version?: string;
};
export type AppInstallRequest = { app_ids: string[]; package_manager: AppPackageManager };
export type AppInstallItemResult = {
  app_id: string;
  name: string;
  manager: AppPackageManager;
  package_id: string;
  success: boolean;
  message: string;
};
export type AppInstallReport = {
  requested_count: number;
  choco_bootstrapped: boolean;
  results: AppInstallItemResult[];
};
export type ChocolateyBootstrapRequest = { acknowledged_remote_script: boolean };
export type AppOperationKind = "install" | "update" | "bootstrap_chocolatey";
export type AppOperationPhase =
  | "queued"
  | "discovering"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";
export type AppOperationHandle = { task_id: string };
export type AppOperationEvent = {
  task_id: string;
  kind: AppOperationKind;
  phase: AppOperationPhase;
  current_app_id?: string;
  completed_count: number;
  total_count: number;
  message: string;
};
export type AppOperationStatus = {
  task_id: string;
  kind: AppOperationKind;
  phase: AppOperationPhase;
  events: AppOperationEvent[];
  report?: AppInstallReport;
};
