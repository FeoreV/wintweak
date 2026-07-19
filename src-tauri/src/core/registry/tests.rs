use std::{
    cell::RefCell,
    collections::HashMap,
    rc::Rc,
    sync::atomic::{AtomicBool, Ordering},
};

use super::*;
use crate::types::{
    AffectedPath, LocalizedText, ProviderKind, RegistryHive, RestartRequirement, TweakCategory,
    TweakDesiredState, TweakRequest, TweakRisk, WindowsArchitecture, WindowsSupport,
};

#[derive(Clone, Default)]
struct MockRegistry {
    values: Rc<RefCell<HashMap<String, RegistryValue>>>,
    calls: Rc<RefCell<Vec<&'static str>>>,
    writes: Rc<RefCell<Vec<RegistryValue>>>,
}

impl RegistryBackend for MockRegistry {
    fn read(&self, action: &RegistryAction) -> Result<RegistryValue, AppError> {
        self.calls.borrow_mut().push("read");
        Ok(self
            .values
            .borrow()
            .get(&action.value_name)
            .cloned()
            .unwrap_or(RegistryValue::Missing))
    }

    fn write(&self, action: &RegistryAction) -> Result<(), AppError> {
        self.calls.borrow_mut().push("write");
        self.writes.borrow_mut().push(action.value.clone());
        if action.value == RegistryValue::Missing {
            self.values.borrow_mut().remove(&action.value_name);
        } else {
            self.values
                .borrow_mut()
                .insert(action.value_name.clone(), action.value.clone());
        }
        Ok(())
    }
}

#[test]
fn reads_before_every_write() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let calls = Rc::clone(&registry.calls);
    let mut engine = TweakEngine::with_parts(
        registry,
        RecoveryStore::at(temp).expect("test recovery store"),
    );

    engine
        .apply_batch(
            &test_config(),
            &[test_definition(vec![RegistryValue::Dword(1)])],
        )
        .expect("apply batch");

    assert_eq!(&*calls.borrow(), &["read", "read", "write", "read"]);
}

#[test]
fn no_op_apply_does_not_create_a_recovery_session() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    registry
        .values
        .borrow_mut()
        .insert("Value".to_owned(), RegistryValue::Dword(1));
    let mut engine = TweakEngine::with_parts(
        registry,
        RecoveryStore::at(&temp).expect("test recovery store"),
    );

    let report = engine
        .apply_batch(
            &test_config(),
            &[test_definition(vec![RegistryValue::Dword(1)])],
        )
        .expect("no-op batch");

    assert_eq!(report.session_id, None);
    assert_eq!(report.committed_change_count, 0);
    assert!(
        std::fs::read_dir(temp)
            .expect("test directory")
            .next()
            .is_none()
    );
}

#[derive(Clone, Default)]
struct FailingRegistry(MockRegistry);

impl RegistryBackend for FailingRegistry {
    fn read(&self, action: &RegistryAction) -> Result<RegistryValue, AppError> {
        self.0.read(action)
    }

    fn write(&self, action: &RegistryAction) -> Result<(), AppError> {
        if self.0.writes.borrow().len() == 1 {
            return Err(AppError::RegistryOperation {
                path: action.value_name.clone(),
                message: "simulated write failure".to_owned(),
                raw_code: 5,
            });
        }
        self.0.write(action)
    }
}

#[test]
fn controlled_apply_emits_events_in_commit_order() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let mut engine = TweakEngine::with_parts(
        registry,
        RecoveryStore::at(temp).expect("test recovery store"),
    );
    let events = RefCell::new(Vec::new());
    let cancelled = AtomicBool::new(false);

    let execution = engine.apply_batch_controlled(
        &test_config(),
        &[test_definition(vec![
            RegistryValue::Dword(1),
            RegistryValue::Dword(2),
        ])],
        2,
        &cancelled,
        &|event| events.borrow_mut().push(event),
    );

    assert!(matches!(execution.outcome, ApplyOutcome::Completed));
    assert_eq!(execution.report.committed_change_count, 2);
    assert_eq!(
        events.borrow().iter().map(event_kind).collect::<Vec<_>>(),
        [
            "batch_started",
            "tweak_started",
            "change_committed",
            "change_committed",
            "tweak_completed",
            "batch_completed",
        ]
    );
}

#[test]
fn cancellation_stops_before_the_next_registry_change() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let writes = Rc::clone(&registry.writes);
    let mut engine = TweakEngine::with_parts(
        registry,
        RecoveryStore::at(temp).expect("test recovery store"),
    );
    let events = RefCell::new(Vec::new());
    let cancelled = AtomicBool::new(false);

    let execution = engine.apply_batch_controlled(
        &test_config(),
        &[test_definition(vec![
            RegistryValue::Dword(1),
            RegistryValue::Dword(2),
        ])],
        2,
        &cancelled,
        &|event| {
            if matches!(event, ApplyOperationEvent::ChangeCommitted { .. }) {
                cancelled.store(true, Ordering::Release);
            }
            events.borrow_mut().push(event);
        },
    );

    assert!(matches!(execution.outcome, ApplyOutcome::Cancelled));
    assert_eq!(execution.report.committed_change_count, 1);
    assert!(execution.report.session_id.is_some());
    assert_eq!(&*writes.borrow(), &[RegistryValue::Dword(1)]);
    assert_eq!(
        events.borrow().iter().map(event_kind).collect::<Vec<_>>(),
        [
            "batch_started",
            "tweak_started",
            "change_committed",
            "cancelled",
        ]
    );
}

#[test]
fn cancellation_before_the_first_tweak_has_no_recovery_session() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let writes = Rc::clone(&registry.writes);
    let mut engine = TweakEngine::with_parts(
        registry,
        RecoveryStore::at(temp).expect("test recovery store"),
    );
    let events = RefCell::new(Vec::new());
    let cancelled = AtomicBool::new(true);

    let execution = engine.apply_batch_controlled(
        &test_config(),
        &[test_definition(vec![RegistryValue::Dword(1)])],
        1,
        &cancelled,
        &|event| events.borrow_mut().push(event),
    );

    assert!(matches!(execution.outcome, ApplyOutcome::Cancelled));
    assert_eq!(execution.report.committed_change_count, 0);
    assert_eq!(execution.report.session_id, None);
    assert!(writes.borrow().is_empty());
    assert_eq!(
        events.borrow().iter().map(event_kind).collect::<Vec<_>>(),
        ["batch_started", "cancelled"]
    );
}

#[test]
fn failure_retains_the_partial_recovery_report() {
    let temp = test_directory();
    let registry = FailingRegistry::default();
    let writes = Rc::clone(&registry.0.writes);
    let mut engine = TweakEngine::with_parts(
        registry,
        RecoveryStore::at(temp).expect("test recovery store"),
    );
    let events = RefCell::new(Vec::new());
    let cancelled = AtomicBool::new(false);

    let execution = engine.apply_batch_controlled(
        &test_config(),
        &[test_definition(vec![
            RegistryValue::Dword(1),
            RegistryValue::Dword(2),
        ])],
        2,
        &cancelled,
        &|event| events.borrow_mut().push(event),
    );

    assert!(matches!(execution.outcome, ApplyOutcome::Failed(_)));
    assert_eq!(execution.report.committed_change_count, 1);
    assert!(execution.report.session_id.is_some());
    assert_eq!(&*writes.borrow(), &[RegistryValue::Dword(1)]);
    assert_eq!(
        events.borrow().iter().map(event_kind).collect::<Vec<_>>(),
        [
            "batch_started",
            "tweak_started",
            "change_committed",
            "failed",
        ]
    );
}

#[test]
fn unknown_apply_task_is_rejected() {
    assert!(matches!(
        apply_operation_status(Uuid::new_v4()),
        Err(AppError::OperationNotAllowed { .. })
    ));
}

#[test]
fn cancelling_a_completed_task_does_not_change_its_phase() {
    let task_id = Uuid::new_v4();
    let task = ApplyTask {
        cancelled: Arc::new(AtomicBool::new(false)),
        events: Arc::new(Mutex::new(Vec::new())),
        report: Arc::new(Mutex::new(Some(ApplyBatchReport {
            session_id: None,
            applied_tweaks: Vec::new(),
            committed_change_count: 0,
            restart_requirement: RestartRequirement::None,
            warnings: Vec::new(),
        }))),
        error: Arc::new(Mutex::new(None)),
        phase: Arc::new(Mutex::new(ApplyOperationPhase::Completed)),
        finished_at: Arc::new(Mutex::new(Some(Instant::now()))),
    };
    apply_tasks()
        .lock()
        .expect("apply task map lock")
        .insert(task_id, task);

    cancel_apply_operation(task_id).expect("cancel completed task");
    let status = apply_operation_status(task_id).expect("completed task status");

    assert_eq!(status.phase, ApplyOperationPhase::Completed);
}

#[test]
fn expired_completed_tasks_are_pruned_without_removing_recent_tasks() {
    let expired_id = Uuid::new_v4();
    let recent_id = Uuid::new_v4();
    let task = |finished_at| ApplyTask {
        cancelled: Arc::new(AtomicBool::new(false)),
        events: Arc::new(Mutex::new(Vec::new())),
        report: Arc::new(Mutex::new(None)),
        error: Arc::new(Mutex::new(None)),
        phase: Arc::new(Mutex::new(ApplyOperationPhase::Completed)),
        finished_at: Arc::new(Mutex::new(Some(finished_at))),
    };
    let mut tasks = apply_tasks().lock().expect("apply task map lock");
    tasks.insert(
        expired_id,
        task(
            Instant::now()
                .checked_sub(APPLY_TASK_RETENTION + Duration::from_secs(1))
                .expect("retention interval must fit"),
        ),
    );
    tasks.insert(recent_id, task(Instant::now()));

    prune_expired_apply_tasks(&mut tasks);

    assert!(!tasks.contains_key(&expired_id));
    assert!(tasks.remove(&recent_id).is_some());
}

#[test]
fn restore_replays_completed_entries_in_reverse_and_supports_missing_values() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let mut apply_engine = TweakEngine::with_parts(
        registry.clone(),
        RecoveryStore::at(temp.clone()).expect("apply recovery store"),
    );
    let source = apply_engine
        .apply_batch(
            &test_config(),
            &[test_definition(vec![
                RegistryValue::Dword(1),
                RegistryValue::Dword(2),
            ])],
        )
        .expect("apply batch");

    let mut restore_engine = TweakEngine::with_parts(
        registry.clone(),
        RecoveryStore::at(temp).expect("restore recovery store"),
    );
    let report = restore_engine
        .restore_session(
            Uuid::parse_str(source.session_id.as_deref().expect("source session"))
                .expect("source UUID"),
        )
        .expect("restore session");

    assert_eq!(report.restored_entry_count, 2);
    assert_eq!(report.skipped_pending_entry_count, 0);
    assert_eq!(
        &*registry.writes.borrow(),
        &[
            RegistryValue::Dword(1),
            RegistryValue::Dword(2),
            RegistryValue::Dword(1),
            RegistryValue::Missing,
        ]
    );
    assert_eq!(
        registry.values.borrow().get("Value"),
        None,
        "a value absent before apply must be deleted during restore"
    );
}

#[test]
fn restore_skips_pending_entry_when_the_write_did_not_happen() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let mut source = RecoveryStore::at(temp.clone()).expect("source recovery store");
    let source_id = source.session_id();
    source
        .begin_entry(
            &test_action(RegistryValue::Dword(1)),
            RegistryValue::Missing,
        )
        .expect("persist pending entry");
    let mut engine = TweakEngine::with_parts(
        registry.clone(),
        RecoveryStore::at(temp).expect("restore recovery store"),
    );

    let report = engine.restore_session(source_id).expect("restore session");

    assert_eq!(report.restored_entry_count, 0);
    assert_eq!(report.skipped_pending_entry_count, 1);
    assert!(registry.writes.borrow().is_empty());
}

#[test]
fn restore_recovers_pending_entry_when_the_write_reached_the_registry() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let action = test_action(RegistryValue::Dword(1));
    let mut source = RecoveryStore::at(temp.clone()).expect("source recovery store");
    let source_id = source.session_id();
    source
        .begin_entry(&action, RegistryValue::Missing)
        .expect("persist pending entry");
    registry
        .write(&action)
        .expect("simulate completed registry write");
    let mut engine = TweakEngine::with_parts(
        registry.clone(),
        RecoveryStore::at(temp).expect("restore recovery store"),
    );

    let report = engine.restore_session(source_id).expect("restore session");

    assert_eq!(report.restored_entry_count, 1);
    assert_eq!(report.skipped_pending_entry_count, 0);
    assert_eq!(registry.values.borrow().get("Value"), None);
}

fn test_directory() -> std::path::PathBuf {
    std::env::temp_dir().join(format!("optimizer-test-{}", Uuid::new_v4()))
}

fn test_config() -> TweakBatchConfig {
    TweakBatchConfig {
        schema_version: 1,
        tweaks: vec![TweakRequest {
            id: "test_tweak".to_owned(),
            desired_state: TweakDesiredState::Enabled,
        }],
    }
}

fn test_definition(values: Vec<RegistryValue>) -> TweakDefinition {
    TweakDefinition {
        id: "test_tweak".to_owned(),
        title: LocalizedText {
            en: "Test".to_owned(),
            ru: "Test".to_owned(),
        },
        description: LocalizedText {
            en: "Test".to_owned(),
            ru: "Test".to_owned(),
        },
        category: TweakCategory::Privacy,
        goals: Vec::new(),
        risk: TweakRisk::Low,
        references: Vec::new(),
        support: WindowsSupport {
            versions: vec![crate::types::SupportedWindows::Windows11],
            minimum_build: 22_000,
            maximum_build: None,
            notes: LocalizedText {
                en: "Test".to_owned(),
                ru: "Test".to_owned(),
            },
        },
        architectures: vec![WindowsArchitecture::X86_64],
        requires_admin: false,
        detect: values.iter().cloned().map(test_action).collect(),
        apply: values.into_iter().map(test_action).collect(),
        restore: vec![test_action(RegistryValue::Missing)],
        affected_paths: vec![AffectedPath {
            provider: ProviderKind::Registry,
            path: "HKCU\\test".to_owned(),
        }],
        restart_requirement: RestartRequirement::None,
        reversible: true,
        irreversible_reason: None,
        warnings: Vec::new(),
    }
}

fn test_action(value: RegistryValue) -> RegistryAction {
    RegistryAction {
        hive: RegistryHive::CurrentUser,
        key_path: "Software\\NativeWindowsOptimizer\\Tests".to_owned(),
        value_name: "Value".to_owned(),
        value,
    }
}

#[test]
fn unsupported_windows_is_refused_before_registry_reads() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let calls = Rc::clone(&registry.calls);
    let mut engine = TweakEngine::with_parts(
        registry,
        RecoveryStore::at(temp).expect("test recovery store"),
    );
    engine.set_test_environment(crate::types::EnvironmentCheck {
        windows: crate::types::SupportedWindows::Windows10,
        build: 19_045,
        architecture: "x86_64".to_owned(),
        is_admin: true,
    });
    let mut definition = test_definition(vec![RegistryValue::Dword(1)]);
    definition.support.versions = vec![crate::types::SupportedWindows::Windows11];

    assert!(matches!(
        engine.plan_batch(&test_config(), &[definition]),
        Err(AppError::UnsupportedEnvironment { .. })
    ));
    assert!(calls.borrow().is_empty());
}

#[test]
fn administrator_tweak_is_refused_before_registry_reads_for_standard_user() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    let calls = Rc::clone(&registry.calls);
    let mut engine = TweakEngine::with_parts(
        registry,
        RecoveryStore::at(temp).expect("test recovery store"),
    );
    engine.set_test_environment(crate::types::EnvironmentCheck {
        windows: crate::types::SupportedWindows::Windows11,
        build: 26_100,
        architecture: "x86_64".to_owned(),
        is_admin: false,
    });
    let mut definition = test_definition(vec![RegistryValue::Dword(1)]);
    definition.requires_admin = true;

    assert!(matches!(
        engine.plan_batch(&test_config(), &[definition]),
        Err(AppError::UnsupportedEnvironment { .. })
    ));
    assert!(calls.borrow().is_empty());
}

#[test]
fn disabled_desired_state_uses_catalog_restore_and_session_undo_preserves_exact_value() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    registry
        .values
        .borrow_mut()
        .insert("Value".to_owned(), RegistryValue::Dword(7));
    let mut engine = TweakEngine::with_parts(
        registry.clone(),
        RecoveryStore::at(temp.clone()).expect("apply recovery store"),
    );
    let config = TweakBatchConfig {
        schema_version: 1,
        tweaks: vec![TweakRequest {
            id: "test_tweak".to_owned(),
            desired_state: TweakDesiredState::Disabled,
        }],
    };

    let report = engine
        .apply_batch(&config, &[test_definition(vec![RegistryValue::Dword(1)])])
        .expect("apply disabled state");
    assert_eq!(registry.values.borrow().get("Value"), None);

    let mut restore_engine = TweakEngine::with_parts(
        registry.clone(),
        RecoveryStore::at(temp).expect("undo recovery store"),
    );
    restore_engine
        .restore_session(
            Uuid::parse_str(report.session_id.as_deref().expect("session id")).expect("UUID"),
        )
        .expect("undo disabled state");
    assert_eq!(
        registry.values.borrow().get("Value"),
        Some(&RegistryValue::Dword(7))
    );
}

#[test]
fn inventory_distinguishes_mixed_unknown_and_restart_required() {
    let temp = test_directory();
    let registry = MockRegistry::default();
    registry
        .values
        .borrow_mut()
        .insert("First".to_owned(), RegistryValue::Dword(1));
    registry
        .values
        .borrow_mut()
        .insert("Second".to_owned(), RegistryValue::Dword(0));
    let engine = TweakEngine::with_parts(
        registry.clone(),
        RecoveryStore::at(temp).expect("test recovery store"),
    );
    let mut definition = test_definition(vec![RegistryValue::Dword(1)]);
    definition.detect = vec![
        test_named_action("First", RegistryValue::Dword(1)),
        test_named_action("Second", RegistryValue::Dword(1)),
    ];
    definition.apply = definition.detect.clone();
    definition.restore = vec![
        test_named_action("First", RegistryValue::Dword(0)),
        test_named_action("Second", RegistryValue::Dword(0)),
    ];
    assert_eq!(
        engine
            .tweak_status(&definition)
            .expect("mixed status")
            .state,
        TweakState::Mixed
    );

    registry
        .values
        .borrow_mut()
        .insert("Second".to_owned(), RegistryValue::Dword(9));
    assert_eq!(
        engine
            .tweak_status(&definition)
            .expect("unknown status")
            .state,
        TweakState::Unknown
    );

    registry
        .values
        .borrow_mut()
        .insert("Second".to_owned(), RegistryValue::Dword(1));
    definition.restart_requirement = RestartRequirement::ExplorerRestart;
    assert_eq!(
        engine
            .tweak_status(&definition)
            .expect("restart status")
            .state,
        TweakState::RequiresRestart
    );
}

fn test_named_action(value_name: &str, value: RegistryValue) -> RegistryAction {
    RegistryAction {
        value_name: value_name.to_owned(),
        ..test_action(value)
    }
}

const fn event_kind(event: &ApplyOperationEvent) -> &'static str {
    match event {
        ApplyOperationEvent::BatchStarted { .. } => "batch_started",
        ApplyOperationEvent::TweakStarted { .. } => "tweak_started",
        ApplyOperationEvent::ChangeCommitted { .. } => "change_committed",
        ApplyOperationEvent::TweakCompleted { .. } => "tweak_completed",
        ApplyOperationEvent::BatchCompleted { .. } => "batch_completed",
        ApplyOperationEvent::Cancelled { .. } => "cancelled",
        ApplyOperationEvent::Failed { .. } => "failed",
    }
}
