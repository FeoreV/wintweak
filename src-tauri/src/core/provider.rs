//! Typed provider boundary for declarative tweak detection and mutation.
#![allow(clippy::missing_errors_doc)]

use crate::{
    core::registry::RegistryBackend,
    errors::AppError,
    types::{
        OperationKind, ProviderKind, ProviderOperationResult, RegistryAction, RegistryRecoveryData,
        RegistryValue, RestartRequirement,
    },
};

/// Metadata which is common to every provider operation.
pub struct OperationContext<'a> {
    pub kind: OperationKind,
    pub explanation: &'a str,
    pub warnings: &'a [String],
    pub restart_requirement: RestartRequirement,
}

/// Common provider contract. New providers use their own typed operation while returning the same
/// plan/recovery result shape. Mutations remain owned by the recovery-aware engine.
pub trait Provider {
    type Operation;
    type State;
    type RecoveryData;

    fn kind(&self) -> ProviderKind;
    fn read(&self, operation: &Self::Operation) -> Result<Self::State, AppError>;
    fn execute(
        &self,
        operation: &Self::Operation,
        pre_state: Self::State,
        context: &OperationContext<'_>,
    ) -> Result<ProviderOperationResult<Self::State, Self::RecoveryData>, AppError>;
}

/// Read-only provider boundary for live inventories and diagnostics.
pub trait InventoryProvider {
    type Item;

    /// Reads the current Windows state without mutation.
    ///
    /// # Errors
    /// Returns a typed platform/provider error when live discovery fails.
    fn inventory(&self) -> Result<Vec<Self::Item>, AppError>;
}

/// First provider implementation, backed by the safe Win32 registry abstraction.
pub struct RegistryProvider<B> {
    backend: B,
}

impl<B> RegistryProvider<B> {
    pub const fn new(backend: B) -> Self {
        Self { backend }
    }

    pub fn inspect(
        &self,
        operation: &RegistryAction,
        context: &OperationContext<'_>,
    ) -> Result<ProviderOperationResult<RegistryValue, RegistryRecoveryData>, AppError>
    where
        B: RegistryBackend,
    {
        let pre_state = self.read(operation)?;
        Ok(operation_result(
            operation,
            pre_state.clone(),
            pre_state,
            context,
        ))
    }
}

impl<B: RegistryBackend> Provider for RegistryProvider<B> {
    type Operation = RegistryAction;
    type State = RegistryValue;
    type RecoveryData = RegistryRecoveryData;

    fn kind(&self) -> ProviderKind {
        ProviderKind::Registry
    }

    fn read(&self, operation: &Self::Operation) -> Result<Self::State, AppError> {
        self.backend.read(operation)
    }

    fn execute(
        &self,
        operation: &Self::Operation,
        pre_state: Self::State,
        context: &OperationContext<'_>,
    ) -> Result<ProviderOperationResult<Self::State, Self::RecoveryData>, AppError> {
        self.backend.write(operation)?;
        let post_state = self.backend.read(operation)?;
        if post_state != operation.value {
            return Err(AppError::RegistryOperation {
                path: format!("{}\\{}", operation.key_path, operation.value_name),
                message: "provider postcondition did not match the declared target".to_owned(),
                raw_code: 0,
            });
        }
        Ok(operation_result(operation, pre_state, post_state, context))
    }
}

fn operation_result(
    operation: &RegistryAction,
    pre_state: RegistryValue,
    post_state: RegistryValue,
    context: &OperationContext<'_>,
) -> ProviderOperationResult<RegistryValue, RegistryRecoveryData> {
    ProviderOperationResult {
        provider: ProviderKind::Registry,
        operation_kind: context.kind,
        pre_state: pre_state.clone(),
        post_state,
        explanation: context.explanation.to_owned(),
        recovery_data: RegistryRecoveryData {
            action: operation.clone(),
            previous: pre_state,
        },
        warnings: context.warnings.to_vec(),
        restart_requirement: context.restart_requirement,
    }
}
