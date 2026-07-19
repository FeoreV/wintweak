//! DTO source of truth. Specta generates the frontend TypeScript mirror.

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct TweakBatchConfig {
    pub schema_version: u32,
    pub tweaks: Vec<TweakRequest>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppDefinition {
    #[serde(skip)]
    pub id: String,
    pub category: String,
    #[serde(default = "unavailable_package")]
    pub choco: String,
    #[serde(rename = "content")]
    pub name: String,
    pub description: String,
    pub link: String,
    pub winget: String,
    pub foss: bool,
}

fn unavailable_package() -> String {
    "na".to_owned()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum AppPackageManager {
    Winget,
    Choco,
}

impl AppPackageManager {
    pub fn executable(self) -> &'static str {
        match self {
            Self::Winget => "winget",
            Self::Choco => "choco",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppInstallRequest {
    pub app_ids: Vec<String>,
    pub package_manager: AppPackageManager,
}

/// A deliberately separate acknowledgement for the Chocolatey bootstrap.
#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ChocolateyBootstrapRequest {
    pub acknowledged_remote_script: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppProviderStatus {
    pub manager: AppPackageManager,
    pub available: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppInstallItemResult {
    pub app_id: String,
    pub name: String,
    pub manager: AppPackageManager,
    pub package_id: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppInstallReport {
    pub requested_count: u32,
    pub choco_bootstrapped: bool,
    pub results: Vec<AppInstallItemResult>,
    pub restore_blocked: bool,
    pub restore_explanation: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppOperationHandle {
    pub task_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum AppOperationKind {
    Install,
    Update,
    BootstrapChocolatey,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum AppOperationPhase {
    Queued,
    Discovering,
    Running,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppOperationEvent {
    pub task_id: String,
    pub kind: AppOperationKind,
    pub phase: AppOperationPhase,
    pub current_app_id: Option<String>,
    pub completed_count: u32,
    pub total_count: u32,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppOperationStatus {
    pub task_id: String,
    pub kind: AppOperationKind,
    pub phase: AppOperationPhase,
    pub events: Vec<AppOperationEvent>,
    pub report: Option<AppInstallReport>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct TweakRequest {
    pub id: String,
    pub desired_state: TweakDesiredState,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct TweakDefinition {
    pub id: String,
    pub title: LocalizedText,
    pub description: LocalizedText,
    pub category: TweakCategory,
    pub goals: Vec<UserGoal>,
    pub risk: TweakRisk,
    pub support: WindowsSupport,
    pub architectures: Vec<WindowsArchitecture>,
    pub requires_admin: bool,
    pub affected_paths: Vec<AffectedPath>,
    pub detect: Vec<RegistryAction>,
    pub apply: Vec<RegistryAction>,
    pub restore: Vec<RegistryAction>,
    pub references: Vec<String>,
    pub restart_requirement: RestartRequirement,
    pub reversible: bool,
    pub irreversible_reason: Option<LocalizedText>,
    pub warnings: Vec<LocalizedText>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct LocalizedText {
    pub en: String,
    pub ru: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum TweakCategory {
    Ai,
    Developer,
    Privacy,
    Search,
    Taskbar,
    Explorer,
    Appearance,
    Input,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct WindowsSupport {
    pub versions: Vec<SupportedWindows>,
    pub minimum_build: u32,
    pub maximum_build: Option<u32>,
    pub notes: LocalizedText,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum SupportedWindows {
    Windows10,
    Windows11,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum WindowsArchitecture {
    X86_64,
    Arm64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum UserGoal {
    Privacy,
    Development,
    ReduceDistractions,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum TweakRisk {
    Low,
    Moderate,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum TweakDesiredState {
    Enabled,
    Disabled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    Registry,
    Appx,
    Service,
    ScheduledTask,
    WindowsFeature,
    Winget,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum OperationKind {
    Detect,
    Apply,
    Restore,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum RestartRequirement {
    None,
    ExplorerRestart,
    Logoff,
    Reboot,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AffectedPath {
    pub provider: ProviderKind,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct RegistryAction {
    pub hive: RegistryHive,
    pub key_path: String,
    pub value_name: String,
    pub value: RegistryValue,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum RegistryHive {
    CurrentUser,
    LocalMachine,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, Type)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum RegistryValue {
    Missing,
    Dword(u32),
    Qword(u64),
    String(String),
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct RegistryRecoveryData {
    pub action: RegistryAction,
    pub previous: RegistryValue,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ProviderOperationResult<State, RecoveryData> {
    pub provider: ProviderKind,
    pub operation_kind: OperationKind,
    pub pre_state: State,
    pub post_state: State,
    pub explanation: String,
    pub recovery_data: RecoveryData,
    pub warnings: Vec<String>,
    pub restart_requirement: RestartRequirement,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ApplyBatchReport {
    pub session_id: Option<String>,
    pub applied_tweaks: Vec<String>,
    pub committed_change_count: u32,
    pub restart_requirement: RestartRequirement,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ApplyOperationHandle {
    pub task_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ApplyOperationPhase {
    Queued,
    Running,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum ApplyOperationEvent {
    BatchStarted {
        total_tweaks: u32,
        total_changes: u32,
    },
    TweakStarted {
        tweak_id: String,
        tweak_index: u32,
    },
    ChangeCommitted {
        tweak_id: String,
        tweak_index: u32,
        change_index: u32,
        committed_change_count: u32,
    },
    TweakCompleted {
        tweak_id: String,
        tweak_index: u32,
        completed_tweak_count: u32,
    },
    BatchCompleted {
        completed_tweak_count: u32,
        committed_change_count: u32,
        session_id: Option<String>,
    },
    Cancelled {
        completed_tweak_count: u32,
        committed_change_count: u32,
        session_id: Option<String>,
    },
    Failed {
        message: String,
        completed_tweak_count: u32,
        committed_change_count: u32,
        session_id: Option<String>,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ApplyOperationStatus {
    pub task_id: String,
    pub phase: ApplyOperationPhase,
    pub events: Vec<ApplyOperationEvent>,
    pub report: Option<ApplyBatchReport>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ValidationReport {
    pub valid: bool,
    pub tweak_count: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct BatchPlan {
    pub environment: EnvironmentCheck,
    pub tweaks: Vec<PlannedTweak>,
    pub change_count: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct EnvironmentCheck {
    pub windows: SupportedWindows,
    pub build: u32,
    pub architecture: String,
    pub is_admin: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct PlannedTweak {
    pub id: String,
    pub desired_state: TweakDesiredState,
    pub changes: Vec<PlannedRegistryChange>,
    pub warnings: Vec<String>,
    pub restart_requirement: RestartRequirement,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct PlannedRegistryChange {
    pub provider: ProviderKind,
    pub operation_kind: OperationKind,
    pub hive: RegistryHive,
    pub key_path: String,
    pub value_name: String,
    pub current: RegistryValue,
    pub target: RegistryValue,
    pub required: bool,
    pub explanation: String,
    pub recovery_data: RegistryRecoveryData,
    pub warnings: Vec<String>,
    pub restart_requirement: RestartRequirement,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct TweakStatus {
    pub id: String,
    pub state: TweakState,
    pub restart_requirement: RestartRequirement,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AdvisorRequest {
    pub goals: Vec<UserGoal>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AdvisorReport {
    pub recommendations: Vec<TweakRecommendation>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct TweakRecommendation {
    pub tweak_id: String,
    pub disposition: RecommendationDisposition,
    pub matched_goals: Vec<UserGoal>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum RecommendationDisposition {
    Recommended,
    ReviewRequired,
    AlreadyApplied,
    Mixed,
    NotRelevant,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum TweakState {
    Enabled,
    Disabled,
    Mixed,
    Unsupported,
    Unknown,
    RequiresRestart,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ProfileName {
    Privacy,
    Balanced,
    Performance,
    Developer,
    Minimal,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ProfileDefinition {
    pub name: ProfileName,
    pub title: LocalizedText,
    pub description: LocalizedText,
    pub tweaks: Vec<ProfileTweak>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ProfileTweak {
    pub id: String,
    pub desired_state: TweakDesiredState,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ProfileDocument {
    pub schema_version: u32,
    pub name: String,
    pub tweaks: Vec<ProfileTweak>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct RecoverySessionSummary {
    pub session_id: String,
    pub created_unix_seconds: u64,
    pub entry_count: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct RestoreSessionReport {
    pub recovery_session_id: String,
    pub source_session_id: String,
    pub restored_entry_count: u32,
    pub skipped_pending_entry_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum AppxSafety {
    ReviewedOptional,
    ProtectedFramework,
    ProtectedResource,
    ProtectedSystem,
    Unreviewed,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppxPackage {
    pub name: String,
    pub full_name: String,
    pub publisher_id: String,
    pub version: String,
    pub architecture: String,
    pub is_framework: bool,
    pub is_resource: bool,
    pub safety: AppxSafety,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct AppxRemovalPreview {
    pub package: AppxPackage,
    pub can_remove: bool,
    pub restore_blocked: bool,
    pub explanation: String,
    pub references: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct SystemAudit {
    pub environment: EnvironmentCheck,
    pub pending_restart: bool,
    pub pending_restart_reasons: Vec<String>,
    pub tweak_statuses: Vec<TweakStatus>,
    pub recovery_session_count: u32,
    pub appx_package_count: u32,
    pub package_providers: Vec<AppProviderStatus>,
}
