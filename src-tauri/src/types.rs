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
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct TweakDefinition {
    pub id: String,
    pub label: String,
    pub description: String,
    pub category: String,
    pub goals: Vec<UserGoal>,
    pub risk: TweakRisk,
    pub requires_restart: bool,
    pub references: Vec<String>,
    pub actions: Vec<RegistryAction>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum UserGoal {
    Privacy,
    Development,
    ReduceDistractions,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum TweakRisk {
    Low,
    Moderate,
    High,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct RegistryAction {
    pub hive: RegistryHive,
    pub key_path: String,
    pub value_name: String,
    pub value: RegistryValue,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Type)]
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
pub struct ApplyBatchReport {
    pub session_id: Option<String>,
    pub applied_tweaks: Vec<String>,
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
    pub tweaks: Vec<PlannedTweak>,
    pub change_count: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct PlannedTweak {
    pub id: String,
    pub changes: Vec<PlannedRegistryChange>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct PlannedRegistryChange {
    pub hive: RegistryHive,
    pub key_path: String,
    pub value_name: String,
    pub current: RegistryValue,
    pub target: RegistryValue,
    pub required: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(deny_unknown_fields)]
pub struct TweakStatus {
    pub id: String,
    pub state: TweakState,
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

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum TweakState {
    Applied,
    NotApplied,
    Mixed,
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
