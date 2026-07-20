// This file mirrors the Specta output and is overwritten by a debug Tauri build.

export type UserGoal = "privacy" | "development" | "reduce_distractions";
export type TweakRisk = "low" | "moderate" | "high";
export type TweakState =
  | "enabled"
  | "disabled"
  | "mixed"
  | "unsupported"
  | "unknown"
  | "requires_restart";
export type SupportedWindows = "windows10" | "windows11";
export type WindowsArchitecture = "x86_64" | "arm64";
export type TweakCategory =
  | "ai"
  | "developer"
  | "privacy"
  | "search"
  | "taskbar"
  | "explorer"
  | "appearance"
  | "input";
export type TweakDesiredState = "enabled" | "disabled";
export type ProviderKind =
  | "registry"
  | "appx"
  | "service"
  | "scheduled_task"
  | "windows_feature"
  | "winget";
export type OperationKind = "detect" | "apply" | "restore";
export type RestartRequirement = "none" | "explorer_restart" | "logoff" | "reboot";
export type ProfileName = "privacy" | "balanced" | "performance" | "developer" | "minimal";
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
export type LocalizedText = { en: string; ru: string };
export type WindowsSupport = {
  versions: SupportedWindows[];
  minimum_build: number;
  maximum_build?: number;
  notes: LocalizedText;
};
export type AffectedPath = { provider: ProviderKind; path: string };

export type TweakDefinition = {
  id: string;
  category: TweakCategory;
  title: LocalizedText;
  description: LocalizedText;
  goals: UserGoal[];
  risk: TweakRisk;
  support: WindowsSupport;
  architectures: WindowsArchitecture[];
  requires_admin: boolean;
  detect: RegistryAction[];
  apply: RegistryAction[];
  restore: RegistryAction[];
  affected_paths: AffectedPath[];
  references: string[];
  restart_requirement: RestartRequirement;
  reversible: boolean;
  irreversible_reason?: LocalizedText;
  warnings: LocalizedText[];
};

export type TweakStatus = {
  id: string;
  state: TweakState;
  restart_requirement: RestartRequirement;
};
export type AdvisorRequest = { goals: UserGoal[] };
export type TweakRecommendation = {
  tweak_id: string;
  disposition: RecommendationDisposition;
  matched_goals: UserGoal[];
};
export type AdvisorReport = { recommendations: TweakRecommendation[] };
export type TweakBatchConfig = {
  schema_version: number;
  tweaks: { id: string; desired_state: TweakDesiredState }[];
};
export type RegistryRecoveryData = { action: RegistryAction; previous: RegistryValue };
export type PlannedRegistryChange = {
  hive: RegistryHive;
  provider: ProviderKind;
  operation_kind: OperationKind;
  key_path: string;
  value_name: string;
  current: RegistryValue;
  target: RegistryValue;
  required: boolean;
  explanation: string;
  recovery_data: RegistryRecoveryData;
  warnings: string[];
  restart_requirement: RestartRequirement;
};
export type PlannedTweak = {
  id: string;
  desired_state: TweakDesiredState;
  changes: PlannedRegistryChange[];
  warnings: string[];
  restart_requirement: RestartRequirement;
};
export type EnvironmentCheck = {
  windows: SupportedWindows;
  build: number;
  architecture: string;
  is_admin: boolean;
};
export type BatchPlan = {
  environment: EnvironmentCheck;
  tweaks: PlannedTweak[];
  change_count: number;
};
export type ProfileTweak = { id: string; desired_state: TweakDesiredState };
export type ProfileDefinition = {
  name: ProfileName;
  title: LocalizedText;
  description: LocalizedText;
  tweaks: ProfileTweak[];
};
export type ProfileDocument = { schema_version: number; name: string; tweaks: ProfileTweak[] };
export type ApplyBatchReport = {
  session_id?: string;
  applied_tweaks: string[];
  committed_change_count: number;
  restart_requirement: RestartRequirement;
  warnings: string[];
};
export type ApplyOperationHandle = { task_id: string };
export type ApplyOperationPhase = "queued" | "running" | "completed" | "cancelled" | "failed";
export type ApplyOperationEvent =
  | { kind: "batch_started"; total_tweaks: number; total_changes: number }
  | { kind: "tweak_started"; tweak_id: string; tweak_index: number }
  | {
      kind: "change_committed";
      tweak_id: string;
      tweak_index: number;
      change_index: number;
      committed_change_count: number;
    }
  | {
      kind: "tweak_completed";
      tweak_id: string;
      tweak_index: number;
      completed_tweak_count: number;
    }
  | {
      kind: "batch_completed";
      completed_tweak_count: number;
      committed_change_count: number;
      session_id?: string;
    }
  | {
      kind: "cancelled";
      completed_tweak_count: number;
      committed_change_count: number;
      session_id?: string;
    }
  | {
      kind: "failed";
      message: string;
      completed_tweak_count: number;
      committed_change_count: number;
      session_id?: string;
    };
export type ApplyOperationStatus = {
  task_id: string;
  phase: ApplyOperationPhase;
  events: ApplyOperationEvent[];
  report?: ApplyBatchReport;
  error?: string;
};
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
export type AppxSafety =
  | "reviewed_optional"
  | "protected_framework"
  | "protected_resource"
  | "protected_system"
  | "unreviewed";
export type AppxPackage = {
  name: string;
  full_name: string;
  publisher_id: string;
  version: string;
  architecture: string;
  is_framework: boolean;
  is_resource: boolean;
  safety: AppxSafety;
};
export type AppxRemovalPreview = {
  package: AppxPackage;
  can_remove: boolean;
  restore_blocked: boolean;
  explanation: string;
  references: string[];
};
export type SystemVolume = {
  mount_point: string;
  label: string;
  total_bytes: number;
  free_bytes: number;
  low_space: boolean;
};
export type SystemOverview = {
  computer_name: string;
  os_product_name: string;
  os_display_version: string;
  os_build: number;
  os_architecture: string;
  is_admin: boolean;
  cpu_name: string;
  logical_cores: number;
  total_memory_bytes: number;
  available_memory_bytes: number;
  gpu_adapters: string[];
  volumes: SystemVolume[];
  uptime_seconds: number;
};
export type InstalledAppSource = "registry" | "appx" | "winget" | "choco";
export type InstalledApp = {
  id: string;
  display_name: string;
  display_version?: string;
  publisher?: string;
  install_location?: string;
  install_date?: string;
  source: InstalledAppSource;
  package_id?: string;
  is_system_component: boolean;
  update_available: boolean;
  available_version?: string;
};
export type SystemAudit = {
  environment: EnvironmentCheck;
  system_info: SystemOverview;
  pending_restart: boolean;
  pending_restart_reasons: string[];
  tweak_statuses: TweakStatus[];
  recovery_session_count: number;
  installed_apps_count: number;
  appx_package_count: number;
  driver_updates_count: number;
  driver_search_error?: string;
  package_providers: AppProviderStatus[];
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
  restore_blocked: boolean;
  restore_explanation: string;
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

export type InstalledDriver = {
  device_id: string;
  device_name: string;
  manufacturer: string;
  installed_version?: string;
  driver_date?: string;
  inf_name?: string;
  signed: boolean;
  signer?: string;
};
export type AvailableDriverUpdate = {
  update_id: string;
  revision_number: number;
  title: string;
  description?: string;
  manufacturer?: string;
  model?: string;
  driver_class?: string;
  version?: string;
  driver_date?: string;
  max_download_size?: number;
  eula_accepted: boolean;
  downloaded: boolean;
};
export type DriverInventory = {
  devices: InstalledDriver[];
  updates: AvailableDriverUpdate[];
  update_search_error?: string;
};
export type DriverUpdateRequest = { update_id: string; revision_number: number };
export type DriverUpdateReport = {
  update_id: string;
  revision_number: number;
  title: string;
  result_code: number;
  reboot_required: boolean;
  message: string;
};
