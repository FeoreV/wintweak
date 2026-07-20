//! Closed set of reviewable external operations and the sole process boundary.

use std::process::Command;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::errors::AppError;

const DRIVER_INVENTORY_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$devices = @(
  Get-CimInstance Win32_PnPSignedDriver |
    Where-Object { $_.DeviceName } |
    ForEach-Object {
      $driverDate = $null
      if ($_.DriverDate) {
        try { $driverDate = ([System.Management.ManagementDateTimeConverter]::ToDateTime($_.DriverDate)).ToString('yyyy-MM-dd') }
        catch { $driverDate = [string]$_.DriverDate }
      }
      [pscustomobject]@{
        device_id = [string]$_.DeviceID
        device_name = [string]$_.DeviceName
        manufacturer = if ($_.Manufacturer) { [string]$_.Manufacturer } else { 'Unknown' }
        installed_version = if ($_.DriverVersion) { [string]$_.DriverVersion } else { $null }
        driver_date = $driverDate
        inf_name = if ($_.InfName) { [string]$_.InfName } else { $null }
        signed = [bool]$_.IsSigned
        signer = if ($_.Signer) { [string]$_.Signer } else { $null }
      }
    }
)
$updates = @()
$updateSearchError = $null
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $result = $searcher.Search("IsInstalled=0 and Type='Driver'")
  $updates = @(
    foreach ($update in $result.Updates) {
      $driverDate = $null
      try {
        if ($update.DriverVerDate) { $driverDate = ([datetime]$update.DriverVerDate).ToString('yyyy-MM-dd') }
      } catch { $driverDate = $null }
      [pscustomobject]@{
        update_id = [string]$update.Identity.UpdateID
        revision_number = [uint32]$update.Identity.RevisionNumber
        title = [string]$update.Title
        description = if ($update.Description) { [string]$update.Description } else { $null }
        manufacturer = if ($update.DriverManufacturer) { [string]$update.DriverManufacturer } else { $null }
        model = if ($update.DriverModel) { [string]$update.DriverModel } else { $null }
        driver_class = if ($update.DriverClass) { [string]$update.DriverClass } else { $null }
        version = if ($update.DriverVerVersion) { [string]$update.DriverVerVersion } else { $null }
        driver_date = $driverDate
        max_download_size = if ($update.MaxDownloadSize -ne $null) { [uint64]$update.MaxDownloadSize } else { $null }
        eula_accepted = [bool]$update.EulaAccepted
        downloaded = [bool]$update.IsDownloaded
      }
    }
  )
} catch {
  $updateSearchError = $_.Exception.Message
}
[pscustomobject]@{
  devices = $devices
  updates = $updates
  update_search_error = $updateSearchError
} | ConvertTo-Json -Depth 8 -Compress
"#;

const DRIVER_INSTALL_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$updateId = $args[0]
$revisionNumber = [uint32]$args[1]
$session = New-Object -ComObject Microsoft.Update.Session
$searcher = $session.CreateUpdateSearcher()
$result = $searcher.Search("IsInstalled=0 and Type='Driver'")
$selected = $null
foreach ($update in $result.Updates) {
  if ($update.Identity.UpdateID -eq $updateId -and [uint32]$update.Identity.RevisionNumber -eq $revisionNumber) {
    $selected = $update
    break
  }
}
if (-not $selected) { throw "Driver update was not found in Windows Update search results." }
if (-not $selected.EulaAccepted) { $selected.AcceptEula() }
$collection = New-Object -ComObject Microsoft.Update.UpdateColl
[void]$collection.Add($selected)
$downloader = $session.CreateUpdateDownloader()
$downloader.Updates = $collection
$download = $downloader.Download()
if ([int]$download.ResultCode -gt 3) { throw "Driver download failed with Windows Update result code $($download.ResultCode)." }
$installer = $session.CreateUpdateInstaller()
$installer.Updates = $collection
$install = $installer.Install()
$resultMessage = switch ([int]$install.ResultCode) {
  2 { 'Succeeded' }
  3 { 'Succeeded with errors' }
  4 { 'Failed' }
  5 { 'Aborted' }
  default { 'Not started' }
}
[pscustomobject]@{
  update_id = [string]$selected.Identity.UpdateID
  revision_number = [uint32]$selected.Identity.RevisionNumber
  title = [string]$selected.Title
  result_code = [int]$install.ResultCode
  reboot_required = [bool]$install.RebootRequired
  message = $resultMessage
} | ConvertTo-Json -Depth 4 -Compress
"#;

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(tag = "operation", rename_all = "snake_case")]
pub enum ManagedOperation {
    WingetInstall {
        package_id: String,
    },
    ChocoInstall {
        package_id: String,
    },
    WingetUpgrade {
        package_id: String,
    },
    ChocoUpgrade {
        package_id: String,
    },
    WingetListUpgrades,
    ChocoListUpgrades,
    BootstrapChocolatey,
    DismRemoveCapability {
        capability_name: String,
    },
    DriverInventory,
    DriverInstallUpdate {
        update_id: String,
        revision_number: u32,
    },
}

impl ManagedOperation {
    /// Rejects parameters that could be interpreted as command-line syntax.
    ///
    /// # Errors
    /// Returns a static validation reason for a disallowed parameter.
    pub fn validate(&self) -> Result<(), &'static str> {
        match self {
            Self::DriverInstallUpdate { update_id, .. } => {
                uuid::Uuid::parse_str(update_id).map_err(|_| "invalid driver update UUID")?;
                Ok(())
            }
            Self::WingetInstall { package_id }
            | Self::ChocoInstall { package_id }
            | Self::WingetUpgrade { package_id }
            | Self::ChocoUpgrade { package_id } => validate_safe_parameter(package_id),
            Self::DismRemoveCapability { capability_name } => {
                validate_safe_parameter(capability_name)
            }
            Self::WingetListUpgrades
            | Self::ChocoListUpgrades
            | Self::BootstrapChocolatey
            | Self::DriverInventory => Ok(()),
        }
    }
}

/// Executes a reviewed operation without accepting caller-provided executables or arguments.
/// Output is truncated before it crosses the core/IPC boundary.
/// Executes only the closed, typed operation variants declared in this module.
///
/// # Errors
/// Returns a structured process or allow-list error; caller-provided executables are impossible.
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
        ManagedOperation::BootstrapChocolatey
        | ManagedOperation::DriverInventory
        | ManagedOperation::DriverInstallUpdate { .. } => "powershell",
        ManagedOperation::DismRemoveCapability { .. } => "dism",
    }
}

fn arguments(operation: &ManagedOperation) -> Vec<String> {
    match operation {
        ManagedOperation::WingetInstall { package_id } => vec![
            "install".to_owned(),
            "--id".to_owned(),
            package_id.clone(),
            "--exact".to_owned(),
            "--silent".to_owned(),
            "--accept-package-agreements".to_owned(),
            "--accept-source-agreements".to_owned(),
            "--disable-interactivity".to_owned(),
        ],
        ManagedOperation::ChocoInstall { package_id } => vec![
            "install".to_owned(),
            package_id.clone(),
            "--yes".to_owned(),
            "--no-progress".to_owned(),
        ],
        ManagedOperation::WingetUpgrade { package_id } => vec![
            "upgrade".to_owned(),
            "--id".to_owned(),
            package_id.clone(),
            "--exact".to_owned(),
            "--silent".to_owned(),
            "--accept-package-agreements".to_owned(),
            "--accept-source-agreements".to_owned(),
            "--disable-interactivity".to_owned(),
        ],
        ManagedOperation::ChocoUpgrade { package_id } => vec![
            "upgrade".to_owned(),
            package_id.clone(),
            "--yes".to_owned(),
            "--no-progress".to_owned(),
        ],
        ManagedOperation::WingetListUpgrades => vec!["upgrade".to_owned(), "--output".to_owned(), "json".to_owned()],
        ManagedOperation::ChocoListUpgrades => vec![
            "outdated".to_owned(),
            "--limit-output".to_owned(),
            "--no-progress".to_owned(),
        ],
        // This is the official Chocolatey bootstrap command. It is intentionally fixed and can
        // only be reached through the explicit acknowledgement DTO.
        ManagedOperation::BootstrapChocolatey => vec![
            "-NoProfile".to_owned(),
            "-NonInteractive".to_owned(),
            "-ExecutionPolicy".to_owned(),
            "Bypass".to_owned(),
            "-Command".to_owned(),
            "Set-ExecutionPolicy Bypass -Scope Process -Force; [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; Invoke-Expression ((Invoke-WebRequest -UseBasicParsing 'https://community.chocolatey.org/install.ps1').Content)".to_owned(),
        ],
        ManagedOperation::DismRemoveCapability { capability_name } => vec![
            "/Online".to_owned(),
            "/Remove-Capability".to_owned(),
            "/CapabilityName:".to_owned(),
            capability_name.clone(),
        ],
        ManagedOperation::DriverInventory => powershell_arguments(DRIVER_INVENTORY_SCRIPT, &[]),
        ManagedOperation::DriverInstallUpdate {
            update_id,
            revision_number,
        } => powershell_arguments(
            DRIVER_INSTALL_SCRIPT,
            &[update_id.clone(), revision_number.to_string()],
        ),
    }
}

fn powershell_arguments(script: &str, args: &[String]) -> Vec<String> {
    let mut arguments = vec![
        "-NoProfile".to_owned(),
        "-NonInteractive".to_owned(),
        "-ExecutionPolicy".to_owned(),
        "Bypass".to_owned(),
        "-Command".to_owned(),
        format!("& {{\n{script}\n}}"),
    ];
    arguments.extend(args.iter().cloned());
    arguments
}

fn validate_safe_parameter(parameter: &str) -> Result<(), &'static str> {
    let valid = !parameter.is_empty()
        && parameter
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || ".-_~".contains(character));
    valid
        .then_some(())
        .ok_or("parameter contains disallowed characters")
}

fn bounded_text(bytes: &[u8]) -> String {
    const LIMIT: usize = 256 * 1024;
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
