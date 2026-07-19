//! Thin typed IPC adapters. Business logic remains in `core`.

use crate::{
    core::{advisor, apps, registry, registry::WindowsTweakEngine, registry_data, validator},
    errors::AppError,
    types::{
        AdvisorReport, AdvisorRequest, AppDefinition, AppInstallRequest, AppOperationHandle,
        AppOperationStatus, AppProviderStatus, ApplyBatchReport, ApplyOperationHandle,
        ApplyOperationStatus, BatchPlan, ChocolateyBootstrapRequest, RecoverySessionSummary,
        RestoreSessionReport, TweakBatchConfig, TweakDefinition, TweakStatus, ValidationReport,
    },
};

#[tauri::command]
#[specta::specta]
/// Returns the embedded, strictly validated tweak catalog.
///
/// # Errors
/// Returns a schema error when the shipped catalog is invalid.
pub fn list_tweaks() -> Result<Vec<TweakDefinition>, AppError> {
    registry_data::built_in_catalog()
}

#[tauri::command]
#[specta::specta]
pub fn list_apps() -> Result<Vec<AppDefinition>, AppError> {
    apps::built_in_catalog()
}

#[tauri::command]
#[specta::specta]
pub fn get_app_provider_statuses() -> Vec<AppProviderStatus> {
    apps::provider_statuses()
}

#[tauri::command]
#[specta::specta]
#[allow(clippy::needless_pass_by_value)]
pub fn start_app_install(request: AppInstallRequest) -> Result<AppOperationHandle, AppError> {
    apps::start_install(request, None)
}

#[tauri::command]
#[specta::specta]
#[allow(clippy::needless_pass_by_value)]
pub fn start_app_update(request: AppInstallRequest) -> Result<AppOperationHandle, AppError> {
    apps::start_update(request, None)
}

#[tauri::command]
#[specta::specta]
#[allow(clippy::needless_pass_by_value)]
pub fn start_chocolatey_bootstrap(
    request: ChocolateyBootstrapRequest,
) -> Result<AppOperationHandle, AppError> {
    apps::start_chocolatey_bootstrap(request, None)
}

#[tauri::command]
#[specta::specta]
pub fn get_app_operation(task_id: String) -> Result<AppOperationStatus, AppError> {
    let task_id =
        uuid::Uuid::parse_str(&task_id).map_err(|error| AppError::InvalidConfigSchema {
            message: format!("invalid application task UUID: {error}"),
        })?;
    apps::operation_status(task_id)
}

#[tauri::command]
#[specta::specta]
pub fn cancel_app_operation(task_id: String) -> Result<(), AppError> {
    let task_id =
        uuid::Uuid::parse_str(&task_id).map_err(|error| AppError::InvalidConfigSchema {
            message: format!("invalid application task UUID: {error}"),
        })?;
    apps::cancel_operation(task_id)
}

#[tauri::command]
#[specta::specta]
/// Validates a complete batch without reading or mutating Windows.
///
/// # Errors
/// Returns a schema or unknown-tweak error for an invalid batch.
#[allow(clippy::needless_pass_by_value)]
pub fn validate_batch(config: TweakBatchConfig) -> Result<ValidationReport, AppError> {
    let catalog = registry_data::built_in_catalog()?;
    validator::validate_batch(&config, &catalog)
}

#[tauri::command]
#[specta::specta]
/// Applies a fully validated batch on a blocking worker.
///
/// # Errors
/// Returns the first catalog, registry, snapshot, or worker error.
pub async fn apply_batch(config: TweakBatchConfig) -> Result<ApplyBatchReport, AppError> {
    let catalog = registry_data::built_in_catalog()?;
    tauri::async_runtime::spawn_blocking(move || {
        WindowsTweakEngine::new()?.apply_batch(&config, &catalog)
    })
    .await
    .map_err(worker_error)?
}

#[tauri::command]
#[specta::specta]
/// Validates, plans, and starts a cancellable registry apply task.
///
/// # Errors
/// Returns before mutation on catalog, validation, planning, registry-read, or worker errors.
pub async fn start_apply_batch(config: TweakBatchConfig) -> Result<ApplyOperationHandle, AppError> {
    let catalog = registry_data::built_in_catalog()?;
    tauri::async_runtime::spawn_blocking(move || registry::start_apply_batch(config, catalog))
        .await
        .map_err(worker_error)?
}

#[tauri::command]
#[specta::specta]
/// Returns progress accumulated by a registry apply task.
///
/// # Errors
/// Returns an invalid-ID or unknown-task error.
#[allow(clippy::needless_pass_by_value)]
pub fn get_apply_operation(task_id: String) -> Result<ApplyOperationStatus, AppError> {
    let task_id =
        uuid::Uuid::parse_str(&task_id).map_err(|error| AppError::InvalidConfigSchema {
            message: format!("invalid registry apply task UUID: {error}"),
        })?;
    registry::apply_operation_status(task_id)
}

#[tauri::command]
#[specta::specta]
/// Requests cancellation at the next safe registry boundary.
///
/// # Errors
/// Returns an invalid-ID or unknown-task error.
#[allow(clippy::needless_pass_by_value)]
pub fn cancel_apply_operation(task_id: String) -> Result<(), AppError> {
    let task_id =
        uuid::Uuid::parse_str(&task_id).map_err(|error| AppError::InvalidConfigSchema {
            message: format!("invalid registry apply task UUID: {error}"),
        })?;
    registry::cancel_apply_operation(task_id)
}

#[tauri::command]
#[specta::specta]
/// Produces an exact read-only plan for a complete batch.
///
/// # Errors
/// Returns a catalog, validation, registry-read, or worker error.
pub async fn plan_batch(config: TweakBatchConfig) -> Result<BatchPlan, AppError> {
    let catalog = registry_data::built_in_catalog()?;
    tauri::async_runtime::spawn_blocking(move || {
        WindowsTweakEngine::new()?.plan_batch(&config, &catalog)
    })
    .await
    .map_err(worker_error)?
}

#[tauri::command]
#[specta::specta]
/// Reads the effective state of every built-in tweak.
///
/// # Errors
/// Returns a catalog, registry-read, or worker error.
pub async fn get_tweak_statuses() -> Result<Vec<TweakStatus>, AppError> {
    let catalog = registry_data::built_in_catalog()?;
    tauri::async_runtime::spawn_blocking(move || WindowsTweakEngine::new()?.statuses(&catalog))
        .await
        .map_err(worker_error)?
}

#[tauri::command]
#[specta::specta]
/// Generates deterministic local recommendations for the requested goals.
///
/// # Errors
/// Returns a catalog, registry-read, or worker error.
pub async fn get_advisor_report(request: AdvisorRequest) -> Result<AdvisorReport, AppError> {
    let catalog = registry_data::built_in_catalog()?;
    tauri::async_runtime::spawn_blocking(move || {
        let statuses = WindowsTweakEngine::new()?.statuses(&catalog)?;
        Ok(advisor::advise(&request, &catalog, &statuses))
    })
    .await
    .map_err(worker_error)?
}

#[tauri::command]
#[specta::specta]
/// Lists recovery sessions newest first.
///
/// # Errors
/// Returns a snapshot I/O, schema, or worker error.
pub async fn list_recovery_sessions() -> Result<Vec<RecoverySessionSummary>, AppError> {
    tauri::async_runtime::spawn_blocking(WindowsTweakEngine::recovery_sessions)
        .await
        .map_err(worker_error)?
}

/// Restores a UUID recovery session; arbitrary filesystem paths are not accepted from IPC.
///
/// # Errors
/// Returns an invalid UUID, missing session, registry, snapshot, or worker error.
#[tauri::command]
#[specta::specta]
pub async fn restore_session(session_id: String) -> Result<RestoreSessionReport, AppError> {
    let session_id =
        uuid::Uuid::parse_str(&session_id).map_err(|error| AppError::InvalidConfigSchema {
            message: format!("invalid recovery session UUID: {error}"),
        })?;
    tauri::async_runtime::spawn_blocking(move || {
        WindowsTweakEngine::new()?.restore_session(session_id)
    })
    .await
    .map_err(worker_error)?
}

fn worker_error(error: impl std::fmt::Display) -> AppError {
    AppError::RegistryOperation {
        path: "background worker".to_owned(),
        message: error.to_string(),
        raw_code: 0,
    }
}

pub fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
        list_tweaks,
        list_apps,
        get_app_provider_statuses,
        start_app_install,
        start_app_update,
        start_chocolatey_bootstrap,
        get_app_operation,
        cancel_app_operation,
        validate_batch,
        apply_batch,
        start_apply_batch,
        get_apply_operation,
        cancel_apply_operation,
        plan_batch,
        get_tweak_statuses,
        get_advisor_report,
        list_recovery_sessions,
        restore_session
    ])
}
