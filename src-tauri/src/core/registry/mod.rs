//! Registry orchestration: plan, snapshot, apply, inspect, and restore.

mod snapshot;

use std::collections::HashMap;

use uuid::Uuid;

use crate::{
    core::validator,
    errors::AppError,
    types::{
        ApplyBatchReport, BatchPlan, PlannedRegistryChange, PlannedTweak, RecoverySessionSummary,
        RegistryAction, RegistryValue, RestoreSessionReport, TweakBatchConfig, TweakDefinition,
        TweakState, TweakStatus,
    },
    winapi_safe::WindowsRegistry,
};

pub use snapshot::RecoveryStore;

/// Safe registry interface used by production Win32 code and mutation-free tests.
pub trait RegistryBackend {
    /// Reads the current value addressed by an action.
    ///
    /// # Errors
    /// Returns a structured registry error when the value cannot be queried.
    fn read(&self, action: &RegistryAction) -> Result<RegistryValue, AppError>;

    /// Writes or deletes the target value in an action.
    ///
    /// # Errors
    /// Returns a structured registry error when the mutation fails.
    fn write(&self, action: &RegistryAction) -> Result<(), AppError>;
}

/// Applies catalog tweaks through a registry backend and durable recovery store.
pub struct TweakEngine<B> {
    registry: B,
    recovery_directory: std::path::PathBuf,
    recovery: Option<RecoveryStore>,
}

pub type WindowsTweakEngine = TweakEngine<WindowsRegistry>;

impl WindowsTweakEngine {
    /// Creates the production engine with a per-session recovery store.
    ///
    /// # Errors
    /// Returns an error when the recovery directory cannot be resolved.
    pub fn new() -> Result<Self, AppError> {
        Ok(Self {
            registry: WindowsRegistry::new(),
            recovery_directory: RecoveryStore::current_user_directory()?,
            recovery: None,
        })
    }
}

impl<B: RegistryBackend> TweakEngine<B> {
    #[cfg(test)]
    fn with_parts(registry: B, recovery: RecoveryStore) -> Self {
        let recovery_directory = recovery.directory().to_owned();
        Self {
            registry,
            recovery_directory,
            recovery: Some(recovery),
        }
    }

    /// Builds a read-only execution plan after validating the whole batch.
    ///
    /// # Errors
    /// Returns before mutation if validation or any registry read fails.
    pub fn plan_batch(
        &self,
        config: &TweakBatchConfig,
        catalog: &[TweakDefinition],
    ) -> Result<BatchPlan, AppError> {
        validator::validate_batch(config, catalog)?;
        let by_id = catalog_by_id(catalog);
        let mut tweaks = Vec::with_capacity(config.tweaks.len());
        let mut change_count = 0_u32;
        for request in &config.tweaks {
            let definition = find_tweak(&by_id, &request.id)?;
            let changes = self.plan_tweak(definition)?;
            let required_count = changes.iter().filter(|change| change.required).count();
            let required_count =
                u32::try_from(required_count).map_err(|_| AppError::InvalidConfigSchema {
                    message: "planned change count exceeds supported range".to_owned(),
                })?;
            change_count = change_count.checked_add(required_count).ok_or_else(|| {
                AppError::InvalidConfigSchema {
                    message: "planned change count exceeds supported range".to_owned(),
                }
            })?;
            tweaks.push(PlannedTweak {
                id: request.id.clone(),
                changes,
            });
        }
        Ok(BatchPlan {
            tweaks,
            change_count,
        })
    }

    /// Applies a fully prevalidated batch, snapshotting before every required write.
    ///
    /// # Errors
    /// Returns on validation or the first runtime read, snapshot, or write failure.
    pub fn apply_batch(
        &mut self,
        config: &TweakBatchConfig,
        catalog: &[TweakDefinition],
    ) -> Result<ApplyBatchReport, AppError> {
        validator::validate_batch(config, catalog)?;
        let by_id = catalog_by_id(catalog);
        let mut applied_tweaks = Vec::with_capacity(config.tweaks.len());
        for request in &config.tweaks {
            let definition = find_tweak(&by_id, &request.id)?;
            self.apply_tweak(definition)?;
            applied_tweaks.push(request.id.clone());
        }
        Ok(ApplyBatchReport {
            session_id: self
                .recovery
                .as_ref()
                .map(|recovery| recovery.session_id().to_string()),
            applied_tweaks,
        })
    }

    /// Reads the effective state of every catalog tweak.
    ///
    /// # Errors
    /// Returns an error when a registry value cannot be queried.
    pub fn statuses(&self, catalog: &[TweakDefinition]) -> Result<Vec<TweakStatus>, AppError> {
        catalog
            .iter()
            .map(|definition| self.tweak_status(definition))
            .collect()
    }

    /// Restores a prior session in reverse order and snapshots the restore itself.
    ///
    /// # Errors
    /// Returns an error if the session is invalid or a registry operation fails.
    pub fn restore_session(&mut self, session_id: Uuid) -> Result<RestoreSessionReport, AppError> {
        let source = RecoveryStore::open_at(&self.recovery_directory, session_id)?;
        let mut restored_entry_count = 0_u32;
        let mut skipped_pending_entry_count = 0_u32;
        for entry in source.entries().iter().rev() {
            let mut restore_action = entry.action.clone();
            restore_action.value = entry.previous.clone();
            let current = self.registry.read(&restore_action)?;
            if !entry.is_completed() && current != entry.action.value {
                skipped_pending_entry_count += 1;
                continue;
            }
            let recovery_index = self.recovery_mut()?.begin_entry(&restore_action, current)?;
            self.registry.write(&restore_action)?;
            self.recovery_mut()?.complete_entry(recovery_index)?;
            restored_entry_count += 1;
        }
        Ok(RestoreSessionReport {
            recovery_session_id: self.recovery_mut()?.session_id().to_string(),
            source_session_id: session_id.to_string(),
            restored_entry_count,
            skipped_pending_entry_count,
        })
    }

    /// Lists recovery sessions without mutating the registry.
    ///
    /// # Errors
    /// Returns an error if recovery storage cannot be read safely.
    pub fn recovery_sessions() -> Result<Vec<RecoverySessionSummary>, AppError> {
        RecoveryStore::list_current_user()
    }

    fn plan_tweak(
        &self,
        definition: &TweakDefinition,
    ) -> Result<Vec<PlannedRegistryChange>, AppError> {
        definition
            .actions
            .iter()
            .map(|action| {
                let current = self.registry.read(action)?;
                Ok(PlannedRegistryChange {
                    hive: action.hive,
                    key_path: action.key_path.clone(),
                    value_name: action.value_name.clone(),
                    required: current != action.value,
                    current,
                    target: action.value.clone(),
                })
            })
            .collect()
    }

    fn apply_tweak(&mut self, definition: &TweakDefinition) -> Result<(), AppError> {
        let span = tracing::info_span!("apply_tweak", tweak_id = %definition.id);
        let _guard = span.enter();
        for action in &definition.actions {
            let previous = self.registry.read(action)?;
            if previous == action.value {
                tracing::debug!(outcome = "unchanged", "registry action already satisfied");
                continue;
            }
            let recovery_index = self.recovery_mut()?.begin_entry(action, previous)?;
            self.registry.write(action)?;
            self.recovery_mut()?.complete_entry(recovery_index)?;
        }
        tracing::info!(outcome = "success", "tweak applied");
        Ok(())
    }

    fn tweak_status(&self, definition: &TweakDefinition) -> Result<TweakStatus, AppError> {
        let mut matching = 0_usize;
        for action in &definition.actions {
            if self.registry.read(action)? == action.value {
                matching += 1;
            }
        }
        let state = if matching == definition.actions.len() {
            TweakState::Applied
        } else if matching == 0 {
            TweakState::NotApplied
        } else {
            TweakState::Mixed
        };
        Ok(TweakStatus {
            id: definition.id.clone(),
            state,
        })
    }

    fn recovery_mut(&mut self) -> Result<&mut RecoveryStore, AppError> {
        if self.recovery.is_none() {
            self.recovery = Some(RecoveryStore::at(&self.recovery_directory)?);
        }
        self.recovery
            .as_mut()
            .ok_or_else(|| AppError::RecoverySnapshot {
                message: "recovery store could not be initialized".to_owned(),
            })
    }
}

fn catalog_by_id(catalog: &[TweakDefinition]) -> HashMap<&str, &TweakDefinition> {
    catalog
        .iter()
        .map(|item| (item.id.as_str(), item))
        .collect()
}

fn find_tweak<'a>(
    catalog: &'a HashMap<&str, &'a TweakDefinition>,
    tweak_id: &str,
) -> Result<&'a TweakDefinition, AppError> {
    catalog
        .get(tweak_id)
        .copied()
        .ok_or_else(|| AppError::UnknownTweak {
            tweak_id: tweak_id.to_owned(),
        })
}

#[cfg(test)]
mod tests;
