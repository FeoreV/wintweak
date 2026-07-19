//! Read-only system audit evidence assembled from native providers.

use crate::{
    core::{
        apps, appx::AppxProvider, environment, provider::InventoryProvider,
        registry::WindowsTweakEngine, registry_data,
    },
    errors::AppError,
    types::SystemAudit,
};

pub struct SystemInfoProvider;

impl SystemInfoProvider {
    pub const fn new() -> Self {
        Self
    }

    /// Collects current read-only system, provider, tweak, and recovery evidence.
    ///
    /// # Errors
    /// Returns the first typed platform/provider error when evidence cannot be read.
    pub fn audit(&self) -> Result<SystemAudit, AppError> {
        let environment = environment::current()?;
        let catalog = registry_data::built_in_catalog()?;
        let tweak_statuses = WindowsTweakEngine::new()?.statuses(&catalog)?;
        let recovery_session_count =
            u32::try_from(WindowsTweakEngine::recovery_sessions()?.len()).unwrap_or(u32::MAX);
        let appx_package_count =
            u32::try_from(AppxProvider::new().inventory()?.len()).unwrap_or(u32::MAX);
        let pending_restart_reasons = crate::winapi_safe::pending_restart_reasons()?;
        Ok(SystemAudit {
            environment,
            pending_restart: !pending_restart_reasons.is_empty(),
            pending_restart_reasons,
            tweak_statuses,
            recovery_session_count,
            appx_package_count,
            package_providers: apps::provider_statuses(),
        })
    }
}

impl Default for SystemInfoProvider {
    fn default() -> Self {
        Self::new()
    }
}
