//! Registry orchestration: plan, snapshot, apply, inspect, and restore.

mod snapshot;

use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    thread,
};

use uuid::Uuid;

use crate::{
    core::validator,
    errors::AppError,
    types::{
        ApplyBatchReport, ApplyOperationEvent, ApplyOperationHandle, ApplyOperationPhase,
        ApplyOperationStatus, BatchPlan, PlannedRegistryChange, PlannedTweak,
        RecoverySessionSummary, RegistryAction, RegistryValue, RestoreSessionReport,
        TweakBatchConfig, TweakDefinition, TweakState, TweakStatus,
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

#[derive(Clone)]
struct ApplyTask {
    cancelled: Arc<AtomicBool>,
    events: Arc<Mutex<Vec<ApplyOperationEvent>>>,
    report: Arc<Mutex<Option<ApplyBatchReport>>>,
    error: Arc<Mutex<Option<String>>>,
    phase: Arc<Mutex<ApplyOperationPhase>>,
}

static APPLY_TASKS: OnceLock<Mutex<HashMap<Uuid, ApplyTask>>> = OnceLock::new();

fn apply_tasks() -> &'static Mutex<HashMap<Uuid, ApplyTask>> {
    APPLY_TASKS.get_or_init(|| Mutex::new(HashMap::new()))
}

enum ApplyOutcome {
    Completed,
    Cancelled,
    Failed(AppError),
}

struct ApplyExecution {
    report: ApplyBatchReport,
    outcome: ApplyOutcome,
}

/// Starts a validated registry apply task on an in-process worker.
///
/// # Errors
/// Returns before spawning when catalog validation, planning, or registry reads fail.
///
/// # Panics
/// Panics if the in-process task registry mutex has been poisoned.
pub fn start_apply_batch(
    config: TweakBatchConfig,
    catalog: Vec<TweakDefinition>,
) -> Result<ApplyOperationHandle, AppError> {
    validator::validate_batch(&config, &catalog)?;
    let engine = WindowsTweakEngine::new()?;
    let plan = engine.plan_batch(&config, &catalog)?;
    let id = Uuid::new_v4();
    let task = ApplyTask {
        cancelled: Arc::new(AtomicBool::new(false)),
        events: Arc::new(Mutex::new(Vec::new())),
        report: Arc::new(Mutex::new(None)),
        error: Arc::new(Mutex::new(None)),
        phase: Arc::new(Mutex::new(ApplyOperationPhase::Queued)),
    };
    apply_tasks()
        .lock()
        .expect("apply task map lock poisoned")
        .insert(id, task.clone());
    thread::spawn(move || {
        let mut engine = engine;
        run_apply_task(&mut engine, &config, &catalog, plan.change_count, &task);
    });
    Ok(ApplyOperationHandle {
        task_id: id.to_string(),
    })
}

/// Returns accumulated progress and the terminal report for an apply task.
///
/// # Errors
/// Returns an operation error when the task ID is unknown or expired.
///
/// # Panics
/// Panics if an apply-task mutex has been poisoned.
pub fn apply_operation_status(task_id: Uuid) -> Result<ApplyOperationStatus, AppError> {
    let task = apply_tasks()
        .lock()
        .expect("apply task map lock poisoned")
        .get(&task_id)
        .cloned()
        .ok_or_else(|| AppError::OperationNotAllowed {
            operation: "unknown registry apply task".to_owned(),
        })?;
    Ok(ApplyOperationStatus {
        task_id: task_id.to_string(),
        phase: *task.phase.lock().expect("apply task phase lock poisoned"),
        events: task
            .events
            .lock()
            .expect("apply task event lock poisoned")
            .clone(),
        report: task
            .report
            .lock()
            .expect("apply task report lock poisoned")
            .clone(),
        error: task
            .error
            .lock()
            .expect("apply task error lock poisoned")
            .clone(),
    })
}

/// Requests cooperative cancellation before the next tweak or registry change.
///
/// # Errors
/// Returns an operation error when the task ID is unknown or expired.
///
/// # Panics
/// Panics if the in-process task registry mutex has been poisoned.
pub fn cancel_apply_operation(task_id: Uuid) -> Result<(), AppError> {
    let task = apply_tasks()
        .lock()
        .expect("apply task map lock poisoned")
        .get(&task_id)
        .cloned()
        .ok_or_else(|| AppError::OperationNotAllowed {
            operation: "unknown registry apply task".to_owned(),
        })?;
    task.cancelled.store(true, Ordering::Release);
    Ok(())
}

fn run_apply_task(
    engine: &mut WindowsTweakEngine,
    config: &TweakBatchConfig,
    catalog: &[TweakDefinition],
    total_changes: u32,
    task: &ApplyTask,
) {
    *task.phase.lock().expect("apply task phase lock poisoned") = ApplyOperationPhase::Running;
    let event_task = task.clone();
    let emit = move |event: ApplyOperationEvent| {
        event_task
            .events
            .lock()
            .expect("apply task event lock poisoned")
            .push(event);
    };
    let execution =
        engine.apply_batch_controlled(config, catalog, total_changes, &task.cancelled, &emit);
    let phase = match &execution.outcome {
        ApplyOutcome::Completed => ApplyOperationPhase::Completed,
        ApplyOutcome::Cancelled => ApplyOperationPhase::Cancelled,
        ApplyOutcome::Failed(error) => {
            *task.error.lock().expect("apply task error lock poisoned") = Some(error.to_string());
            ApplyOperationPhase::Failed
        }
    };
    *task.report.lock().expect("apply task report lock poisoned") = Some(execution.report);
    *task.phase.lock().expect("apply task phase lock poisoned") = phase;
}

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
        let cancelled = AtomicBool::new(false);
        let execution = self.apply_batch_controlled(config, catalog, 0, &cancelled, &drop);
        match execution.outcome {
            ApplyOutcome::Completed => Ok(execution.report),
            ApplyOutcome::Cancelled => unreachable!("synchronous apply cannot be cancelled"),
            ApplyOutcome::Failed(error) => Err(error),
        }
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

    fn apply_batch_controlled(
        &mut self,
        config: &TweakBatchConfig,
        catalog: &[TweakDefinition],
        total_changes: u32,
        cancelled: &AtomicBool,
        emit: &dyn Fn(ApplyOperationEvent),
    ) -> ApplyExecution {
        if let Err(error) = validator::validate_batch(config, catalog) {
            return self.failed_execution(error, Vec::new(), 0, emit);
        }
        let total_tweaks = u32::try_from(config.tweaks.len()).unwrap_or(u32::MAX);
        emit(ApplyOperationEvent::BatchStarted {
            total_tweaks,
            total_changes,
        });
        let by_id = catalog_by_id(catalog);
        let mut applied_tweaks = Vec::with_capacity(config.tweaks.len());
        let mut committed_change_count = 0_u32;

        for (tweak_index, request) in config.tweaks.iter().enumerate() {
            if cancelled.load(Ordering::Acquire) {
                return self.cancelled_execution(applied_tweaks, committed_change_count, emit);
            }
            let definition = match find_tweak(&by_id, &request.id) {
                Ok(definition) => definition,
                Err(error) => {
                    return self.failed_execution(
                        error,
                        applied_tweaks,
                        committed_change_count,
                        emit,
                    );
                }
            };
            let tweak_index = u32::try_from(tweak_index).unwrap_or(u32::MAX);
            emit(ApplyOperationEvent::TweakStarted {
                tweak_id: request.id.clone(),
                tweak_index,
            });
            let span = tracing::info_span!("apply_tweak", tweak_id = %definition.id);
            let _guard = span.enter();

            for (change_index, action) in definition.actions.iter().enumerate() {
                if cancelled.load(Ordering::Acquire) {
                    return self.cancelled_execution(applied_tweaks, committed_change_count, emit);
                }
                let result = self.apply_action(action);
                match result {
                    Ok(false) => {
                        tracing::debug!(outcome = "unchanged", "registry action already satisfied");
                    }
                    Ok(true) => {
                        committed_change_count = committed_change_count.saturating_add(1);
                        emit(ApplyOperationEvent::ChangeCommitted {
                            tweak_id: request.id.clone(),
                            tweak_index,
                            change_index: u32::try_from(change_index).unwrap_or(u32::MAX),
                            committed_change_count,
                        });
                    }
                    Err(error) => {
                        return self.failed_execution(
                            error,
                            applied_tweaks,
                            committed_change_count,
                            emit,
                        );
                    }
                }
            }
            tracing::info!(outcome = "success", "tweak applied");
            applied_tweaks.push(request.id.clone());
            emit(ApplyOperationEvent::TweakCompleted {
                tweak_id: request.id.clone(),
                tweak_index,
                completed_tweak_count: u32::try_from(applied_tweaks.len()).unwrap_or(u32::MAX),
            });
        }

        let report = self.apply_report(applied_tweaks, committed_change_count);
        emit(ApplyOperationEvent::BatchCompleted {
            completed_tweak_count: u32::try_from(report.applied_tweaks.len()).unwrap_or(u32::MAX),
            committed_change_count,
            session_id: report.session_id.clone(),
        });
        ApplyExecution {
            report,
            outcome: ApplyOutcome::Completed,
        }
    }

    fn apply_action(&mut self, action: &RegistryAction) -> Result<bool, AppError> {
        let previous = self.registry.read(action)?;
        if previous == action.value {
            return Ok(false);
        }
        let recovery_index = self.recovery_mut()?.begin_entry(action, previous)?;
        self.registry.write(action)?;
        self.recovery_mut()?.complete_entry(recovery_index)?;
        Ok(true)
    }

    fn cancelled_execution(
        &self,
        applied_tweaks: Vec<String>,
        committed_change_count: u32,
        emit: &dyn Fn(ApplyOperationEvent),
    ) -> ApplyExecution {
        let report = self.apply_report(applied_tweaks, committed_change_count);
        emit(ApplyOperationEvent::Cancelled {
            completed_tweak_count: u32::try_from(report.applied_tweaks.len()).unwrap_or(u32::MAX),
            committed_change_count,
            session_id: report.session_id.clone(),
        });
        ApplyExecution {
            report,
            outcome: ApplyOutcome::Cancelled,
        }
    }

    fn failed_execution(
        &self,
        error: AppError,
        applied_tweaks: Vec<String>,
        committed_change_count: u32,
        emit: &dyn Fn(ApplyOperationEvent),
    ) -> ApplyExecution {
        let report = self.apply_report(applied_tweaks, committed_change_count);
        emit(ApplyOperationEvent::Failed {
            message: error.to_string(),
            completed_tweak_count: u32::try_from(report.applied_tweaks.len()).unwrap_or(u32::MAX),
            committed_change_count,
            session_id: report.session_id.clone(),
        });
        ApplyExecution {
            report,
            outcome: ApplyOutcome::Failed(error),
        }
    }

    fn apply_report(
        &self,
        applied_tweaks: Vec<String>,
        committed_change_count: u32,
    ) -> ApplyBatchReport {
        ApplyBatchReport {
            session_id: self
                .recovery
                .as_ref()
                .filter(|recovery| !recovery.entries().is_empty())
                .map(|recovery| recovery.session_id().to_string()),
            applied_tweaks,
            committed_change_count,
        }
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
