//! Headless runner. This module never imports or initializes Tauri.

use std::{fs, path::Path, process::ExitCode};

use crate::{
    cli::HeadlessMode,
    core::{registry::WindowsTweakEngine, registry_data},
    errors::AppError,
    types::TweakBatchConfig,
};

pub fn run_headless(mode: HeadlessMode) -> ExitCode {
    match execute(mode) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(error = %error, outcome = "failed", "headless operation failed");
            ExitCode::FAILURE
        }
    }
}

fn execute(mode: HeadlessMode) -> Result<(), AppError> {
    match mode {
        HeadlessMode::Apply { config, dry_run } => apply(&config, dry_run),
        HeadlessMode::Restore(session_id) => {
            let report = WindowsTweakEngine::new()?.restore_session(session_id)?;
            tracing::info!(
                recovery_session_id = %report.recovery_session_id,
                source_session_id = %report.source_session_id,
                restored_count = report.restored_entry_count,
                skipped_pending_count = report.skipped_pending_entry_count,
                outcome = "success",
                "recovery session restored"
            );
            Ok(())
        }
        HeadlessMode::ListTweaks => list_tweaks(),
        HeadlessMode::Status => show_status(),
        HeadlessMode::ListRecovery => list_recovery(),
    }
}

fn apply(config_path: &Path, dry_run: bool) -> Result<(), AppError> {
    let config = load_config(config_path)?;
    let catalog = registry_data::built_in_catalog()?;
    let mut engine = WindowsTweakEngine::new()?;
    if dry_run {
        let plan = engine.plan_batch(&config, &catalog)?;
        tracing::info!(
            tweak_count = plan.tweaks.len(),
            change_count = plan.change_count,
            outcome = "planned",
            "dry run completed without mutation"
        );
        for tweak in plan.tweaks {
            tracing::info!(tweak_id = %tweak.id, changes = tweak.changes.len(), "planned tweak");
        }
        return Ok(());
    }
    let report = engine.apply_batch(&config, &catalog)?;
    tracing::info!(
        session_id = ?report.session_id,
        applied_count = report.applied_tweaks.len(),
        outcome = "success",
        "headless batch completed"
    );
    Ok(())
}

fn load_config(config_path: &Path) -> Result<TweakBatchConfig, AppError> {
    let contents = fs::read_to_string(config_path)
        .map_err(|error| AppError::io(config_path.display().to_string(), &error))?;
    serde_json::from_str(&contents).map_err(|error| AppError::InvalidConfigSchema {
        message: error.to_string(),
    })
}

fn list_tweaks() -> Result<(), AppError> {
    for tweak in registry_data::built_in_catalog()? {
        tracing::info!(
            tweak_id = %tweak.id,
            category = %tweak.category,
            risk = ?tweak.risk,
            restart = tweak.requires_restart,
            label = %tweak.label,
            "available tweak"
        );
    }
    Ok(())
}

fn show_status() -> Result<(), AppError> {
    let catalog = registry_data::built_in_catalog()?;
    for status in WindowsTweakEngine::new()?.statuses(&catalog)? {
        tracing::info!(tweak_id = %status.id, state = ?status.state, "tweak status");
    }
    Ok(())
}

fn list_recovery() -> Result<(), AppError> {
    for session in WindowsTweakEngine::recovery_sessions()? {
        tracing::info!(
            session_id = %session.session_id,
            created_unix_seconds = session.created_unix_seconds,
            entry_count = session.entry_count,
            "recovery session"
        );
    }
    Ok(())
}
