//! Closed set of reviewable external operations and the sole process boundary.

use std::process::Command;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::errors::AppError;

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(tag = "operation", rename_all = "snake_case")]
pub enum ManagedOperation {
    WingetInstall { package_id: String },
    ChocoInstall { package_id: String },
    WingetUpgrade { package_id: String },
    ChocoUpgrade { package_id: String },
    WingetListUpgrades,
    ChocoListUpgrades,
    BootstrapChocolatey,
    DismRemoveCapability { capability_name: String },
}

impl ManagedOperation {
    /// Rejects parameters that could be interpreted as command-line syntax.
    ///
    /// # Errors
    /// Returns a static validation reason for a disallowed parameter.
    pub fn validate(&self) -> Result<(), &'static str> {
        let parameter = match self {
            Self::WingetInstall { package_id }
            | Self::ChocoInstall { package_id }
            | Self::WingetUpgrade { package_id }
            | Self::ChocoUpgrade { package_id } => package_id,
            Self::DismRemoveCapability { capability_name } => capability_name,
            Self::WingetListUpgrades | Self::ChocoListUpgrades | Self::BootstrapChocolatey => {
                return Ok(());
            }
        };
        let valid = !parameter.is_empty()
            && parameter
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || ".-_~".contains(character));
        valid
            .then_some(())
            .ok_or("parameter contains disallowed characters")
    }
}

/// Executes a reviewed operation without accepting caller-provided executables or arguments.
/// Output is truncated before it crosses the core/IPC boundary.
pub fn execute(operation: &ManagedOperation) -> Result<String, AppError> {
    operation
        .validate()
        .map_err(|reason| AppError::OperationNotAllowed {
            operation: reason.to_owned(),
        })?;
    let mut command = Command::new(executable(operation));
    command.args(arguments(operation));
    let output = command
        .output()
        .map_err(|error| AppError::ExternalProcessFailed {
            message: format!("could not start approved operation: {error}"),
        })?;
    let stdout = bounded_text(&output.stdout);
    let stderr = bounded_text(&output.stderr);
    if output.status.success() {
        return Ok(if stdout.is_empty() { stderr } else { stdout });
    }
    Err(AppError::ExternalProcessFailed {
        message: if stderr.is_empty() { stdout } else { stderr },
    })
}

fn executable(operation: &ManagedOperation) -> &'static str {
    match operation {
        ManagedOperation::WingetInstall { .. }
        | ManagedOperation::WingetUpgrade { .. }
        | ManagedOperation::WingetListUpgrades => "winget",
        ManagedOperation::ChocoInstall { .. }
        | ManagedOperation::ChocoUpgrade { .. }
        | ManagedOperation::ChocoListUpgrades => "choco",
        ManagedOperation::BootstrapChocolatey => "powershell",
        ManagedOperation::DismRemoveCapability { .. } => "dism",
    }
}

fn arguments(operation: &ManagedOperation) -> Vec<&str> {
    match operation {
        ManagedOperation::WingetInstall { package_id } => vec![
            "install",
            "--id",
            package_id,
            "--exact",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--disable-interactivity",
        ],
        ManagedOperation::ChocoInstall { package_id } => {
            vec!["install", package_id, "--yes", "--no-progress"]
        }
        ManagedOperation::WingetUpgrade { package_id } => vec![
            "upgrade",
            "--id",
            package_id,
            "--exact",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--disable-interactivity",
        ],
        ManagedOperation::ChocoUpgrade { package_id } => {
            vec!["upgrade", package_id, "--yes", "--no-progress"]
        }
        ManagedOperation::WingetListUpgrades => vec!["upgrade", "--output", "json"],
        ManagedOperation::ChocoListUpgrades => vec!["outdated", "--limit-output", "--no-progress"],
        // This is the official Chocolatey bootstrap command. It is intentionally fixed and can
        // only be reached through the explicit acknowledgement DTO.
        ManagedOperation::BootstrapChocolatey => vec![
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "Set-ExecutionPolicy Bypass -Scope Process -Force; [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; Invoke-Expression ((Invoke-WebRequest -UseBasicParsing 'https://community.chocolatey.org/install.ps1').Content)",
        ],
        ManagedOperation::DismRemoveCapability { capability_name } => {
            vec![
                "/Online",
                "/Remove-Capability",
                "/CapabilityName:",
                capability_name,
            ]
        }
    }
}

fn bounded_text(bytes: &[u8]) -> String {
    const LIMIT: usize = 16 * 1024;
    let mut text = String::from_utf8_lossy(&bytes[..bytes.len().min(LIMIT)])
        .trim()
        .to_owned();
    if bytes.len() > LIMIT {
        text.push_str("\n[output truncated]");
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_shell_metacharacters() {
        let operation = ManagedOperation::WingetInstall {
            package_id: "safe.id; injected-command".to_owned(),
        };
        assert!(operation.validate().is_err());
    }
}
