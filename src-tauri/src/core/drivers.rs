//! Native Windows driver inventory and Windows Update driver installation.

use crate::{
    core::runner::allowlist::{ManagedOperation, execute},
    errors::AppError,
    types::{DriverInventory, DriverUpdateReport, DriverUpdateRequest},
};

/// Reads installed signed Plug and Play drivers and available driver updates.
///
/// # Errors
/// Returns platform, process, or JSON parsing errors.
pub fn inventory() -> Result<DriverInventory, AppError> {
    ensure_windows()?;
    let output = execute(&ManagedOperation::DriverInventory)?;
    serde_json::from_str(&output).map_err(|error| AppError::InvalidConfigSchema {
        message: format!("driver inventory JSON could not be parsed: {error}"),
    })
}

/// Downloads and installs a Windows Update driver selected by update identity.
///
/// # Errors
/// Returns validation, platform, process, or JSON parsing errors.
pub fn install_update(request: DriverUpdateRequest) -> Result<DriverUpdateReport, AppError> {
    ensure_windows()?;
    let output = execute(&ManagedOperation::DriverInstallUpdate {
        update_id: request.update_id,
        revision_number: request.revision_number,
    })?;
    serde_json::from_str(&output).map_err(|error| AppError::InvalidConfigSchema {
        message: format!("driver update report JSON could not be parsed: {error}"),
    })
}

fn ensure_windows() -> Result<(), AppError> {
    if cfg!(windows) {
        Ok(())
    } else {
        Err(AppError::UnsupportedPlatform)
    }
}
