use std::{cell::RefCell, collections::HashMap, rc::Rc};

use super::*;
use crate::types::{RegistryHive, TweakRequest, TweakRisk};

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

    assert_eq!(&*calls.borrow(), &["read", "write"]);
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
    assert!(
        std::fs::read_dir(temp)
            .expect("test directory")
            .next()
            .is_none()
    );
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
        }],
    }
}

fn test_definition(values: Vec<RegistryValue>) -> TweakDefinition {
    TweakDefinition {
        id: "test_tweak".to_owned(),
        label: "Test".to_owned(),
        description: "Test".to_owned(),
        category: "test".to_owned(),
        goals: Vec::new(),
        risk: TweakRisk::Low,
        requires_restart: false,
        references: Vec::new(),
        actions: values.into_iter().map(test_action).collect(),
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
