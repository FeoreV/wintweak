//! Headless runner. This module never imports or initializes Tauri.

use std::{fs, path::Path, process::ExitCode};

use crate::{
    cli::HeadlessMode,
    core::{
        apps, appx::AppxProvider, profiles, provider::InventoryProvider,
        registry::WindowsTweakEngine, registry_data, system_info::SystemInfoProvider,
    },
    errors::AppError,
    types::{ProfileDocument, TweakBatchConfig},
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
        HeadlessMode::Inventory => inventory(),
        HeadlessMode::Audit => audit(),
        HeadlessMode::AppCatalog => app_catalog(),
        HeadlessMode::Profile {
            profile,
            dry_run,
            apply,
        } => {
            require_profile_action(dry_run, apply)?;
            let catalog = registry_data::built_in_catalog()?;
            run_batch(
                &profiles::plan(profile.into(), &catalog)?,
                &catalog,
                dry_run,
            )
        }
        HeadlessMode::ExportProfile { profile, path } => {
            let document = profiles::export_document(profile.into())?;
            let json = serde_json::to_string_pretty(&document).map_err(|error| {
                AppError::InvalidConfigSchema {
                    message: error.to_string(),
                }
            })?;
            fs::write(&path, json).map_err(|error| AppError::io(path.display().to_string(), &error))
        }
        HeadlessMode::ImportProfile {
            path,
            dry_run,
            apply,
        } => {
            require_profile_action(dry_run, apply)?;
            let catalog = registry_data::built_in_catalog()?;
            let document: ProfileDocument = serde_json::from_str(
                &fs::read_to_string(&path)
                    .map_err(|error| AppError::io(path.display().to_string(), &error))?,
            )
            .map_err(|error| AppError::InvalidConfigSchema {
                message: error.to_string(),
            })?;
            run_batch(
                &profiles::document_to_batch(&document, &catalog)?,
                &catalog,
                dry_run,
            )
        }
    }
}

fn require_profile_action(dry_run: bool, apply: bool) -> Result<(), AppError> {
    if dry_run == apply {
        return Err(AppError::InvalidConfigSchema {
            message: "profile execution requires exactly one of --dry-run or --apply".to_owned(),
        });
    }
    Ok(())
}

fn apply(config_path: &Path, dry_run: bool) -> Result<(), AppError> {
    let config = load_config(config_path)?;
    let catalog = registry_data::built_in_catalog()?;
    run_batch(&config, &catalog, dry_run)
}

fn run_batch(
    config: &TweakBatchConfig,
    catalog: &[crate::types::TweakDefinition],
    dry_run: bool,
) -> Result<(), AppError> {
    let mut engine = WindowsTweakEngine::new()?;
    if dry_run {
        let plan = engine.plan_batch(config, catalog)?;
        tracing::info!(
            windows = ?plan.environment.windows,
            build = plan.environment.build,
            architecture = %plan.environment.architecture,
            admin = plan.environment.is_admin,
            tweak_count = plan.tweaks.len(),
            change_count = plan.change_count,
            outcome = "planned",
            "dry run completed without mutation"
        );
        for tweak in plan.tweaks {
            for change in tweak.changes {
                tracing::info!(tweak_id = %tweak.id, hive = ?change.hive, key_path = %change.key_path, value_name = %change.value_name, current = ?change.current, target = ?change.target, required = change.required, explanation = %change.explanation, "planned registry change");
            }
        }
        return Ok(());
    }
    let report = engine.apply_batch(config, catalog)?;
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
            category = ?tweak.category,
            risk = ?tweak.risk,
            restart = ?tweak.restart_requirement,
            admin = tweak.requires_admin,
            title = %tweak.title.en,
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

fn inventory() -> Result<(), AppError> {
    for package in AppxProvider::new().inventory()? {
        tracing::info!(name = %package.name, full_name = %package.full_name, version = %package.version, architecture = %package.architecture, safety = ?package.safety, framework = package.is_framework, resource = package.is_resource, "installed Appx package");
    }
    Ok(())
}

fn audit() -> Result<(), AppError> {
    let audit = SystemInfoProvider::new().audit()?;
    tracing::info!(windows = ?audit.environment.windows, build = audit.environment.build, architecture = %audit.environment.architecture, admin = audit.environment.is_admin, pending_restart = audit.pending_restart, pending_restart_reasons = ?audit.pending_restart_reasons, appx_packages = audit.appx_package_count, recovery_sessions = audit.recovery_session_count, "system audit");
    for status in audit.tweak_statuses {
        tracing::info!(tweak_id = %status.id, state = ?status.state, restart = ?status.restart_requirement, "audit tweak evidence");
    }
    Ok(())
}

fn app_catalog() -> Result<(), AppError> {
    for app in apps::built_in_catalog()? {
        tracing::info!(app_id = %app.id, name = %app.name, category = %app.category, winget = %app.winget, choco = %app.choco, "reviewed application");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::require_profile_action;

    #[test]
    fn profile_execution_requires_exactly_one_explicit_action() {
        assert!(require_profile_action(true, false).is_ok());
        assert!(require_profile_action(false, true).is_ok());
        assert!(require_profile_action(false, false).is_err());
        assert!(require_profile_action(true, true).is_err());
    }
}
