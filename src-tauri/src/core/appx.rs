//! Native Appx inventory and conservative removal classification.

use crate::{
    core::provider::InventoryProvider,
    errors::AppError,
    types::{AppxPackage, AppxRemovalPreview, AppxSafety},
};

const REVIEWED_OPTIONAL_PACKAGES: &[&str] = &[
    "Clipchamp.Clipchamp",
    "Microsoft.BingNews",
    "Microsoft.BingWeather",
    "Microsoft.GamingApp",
    "Microsoft.GetHelp",
    "Microsoft.Getstarted",
    "Microsoft.MicrosoftSolitaireCollection",
    "Microsoft.People",
    "Microsoft.PowerAutomateDesktop",
    "Microsoft.WindowsFeedbackHub",
    "Microsoft.YourPhone",
    "Microsoft.ZuneMusic",
    "Microsoft.ZuneVideo",
];

const PROTECTED_PREFIXES: &[&str] = &[
    "Microsoft.AAD.BrokerPlugin",
    "Microsoft.AccountsControl",
    "Microsoft.AsyncTextService",
    "Microsoft.BioEnrollment",
    "Microsoft.CredDialogHost",
    "Microsoft.DesktopAppInstaller",
    "Microsoft.LockApp",
    "Microsoft.SecHealthUI",
    "Microsoft.ShellExperienceHost",
    "Microsoft.StartMenuExperienceHost",
    "Microsoft.StorePurchaseApp",
    "Microsoft.UI.Xaml",
    "Microsoft.VCLibs",
    "Microsoft.Windows.CloudExperienceHost",
    "Microsoft.Windows.Search",
    "Microsoft.WindowsStore",
    "Microsoft.Win32WebViewHost",
    "MicrosoftWindows.Client",
    "windows.immersivecontrolpanel",
];

pub struct AppxProvider;

impl AppxProvider {
    pub const fn new() -> Self {
        Self
    }

    /// Builds a read-only safety preview for one installed package.
    ///
    /// # Errors
    /// Returns a typed provider error when inventory fails or the package is not installed.
    pub fn removal_preview(&self, full_name: &str) -> Result<AppxRemovalPreview, AppError> {
        preview_from_inventory(self.inventory()?, full_name)
    }
}

fn preview_from_inventory(
    inventory: Vec<AppxPackage>,
    full_name: &str,
) -> Result<AppxRemovalPreview, AppError> {
    let package = inventory
        .into_iter()
        .find(|package| package.full_name == full_name)
        .ok_or_else(|| AppError::OperationNotAllowed {
            operation: format!("Appx package '{full_name}' is not installed"),
        })?;
    let can_remove = package.safety == AppxSafety::ReviewedOptional;
    Ok(AppxRemovalPreview {
            package,
            can_remove,
            restore_blocked: true,
            explanation: if can_remove {
                "Removal is allow-listed, but apply is blocked because exact package restoration cannot be guaranteed by the current recovery engine.".to_owned()
            } else {
                "Removal is blocked: framework, resource, shell/security, or unreviewed packages are never removal targets.".to_owned()
            },
            references: vec![
                "https://learn.microsoft.com/windows/msix/desktop/managing-your-msix-deployment-overview".to_owned(),
                "https://learn.microsoft.com/uwp/api/windows.management.deployment.packagemanager".to_owned(),
            ],
        })
}

impl Default for AppxProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(windows)]
impl InventoryProvider for AppxProvider {
    type Item = AppxPackage;

    fn inventory(&self) -> Result<Vec<Self::Item>, AppError> {
        use windows::{Management::Deployment::PackageManager, core::HSTRING};

        let manager = PackageManager::new().map_err(appx_error)?;
        let packages = manager
            .FindPackagesByUserSecurityId(&HSTRING::new())
            .map_err(appx_error)?;
        let mut inventory = Vec::new();
        for package in packages {
            let id = package.Id().map_err(appx_error)?;
            let name = id.Name().map_err(appx_error)?.to_string();
            let full_name = id.FullName().map_err(appx_error)?.to_string();
            let publisher_id = id.PublisherId().map_err(appx_error)?.to_string();
            let version = id.Version().map_err(appx_error)?;
            let is_framework = package.IsFramework().map_err(appx_error)?;
            let is_resource = package.IsResourcePackage().map_err(appx_error)?;
            let safety = classify(&name, is_framework, is_resource);
            inventory.push(AppxPackage {
                name,
                full_name,
                publisher_id,
                version: format!(
                    "{}.{}.{}.{}",
                    version.Major, version.Minor, version.Build, version.Revision
                ),
                architecture: format!("{:?}", id.Architecture().map_err(appx_error)?)
                    .to_ascii_lowercase(),
                is_framework,
                is_resource,
                safety,
            });
        }
        inventory.sort_by(|left, right| {
            left.name
                .cmp(&right.name)
                .then(left.full_name.cmp(&right.full_name))
        });
        Ok(inventory)
    }
}

#[cfg(not(windows))]
impl InventoryProvider for AppxProvider {
    type Item = AppxPackage;

    fn inventory(&self) -> Result<Vec<Self::Item>, AppError> {
        Err(AppError::UnsupportedPlatform)
    }
}

fn classify(name: &str, is_framework: bool, is_resource: bool) -> AppxSafety {
    if is_framework {
        AppxSafety::ProtectedFramework
    } else if is_resource {
        AppxSafety::ProtectedResource
    } else if PROTECTED_PREFIXES
        .iter()
        .any(|prefix| name.starts_with(prefix))
    {
        AppxSafety::ProtectedSystem
    } else if REVIEWED_OPTIONAL_PACKAGES.contains(&name) {
        AppxSafety::ReviewedOptional
    } else {
        AppxSafety::Unreviewed
    }
}

#[cfg(windows)]
#[allow(clippy::needless_pass_by_value)]
fn appx_error(error: windows::core::Error) -> AppError {
    AppError::RegistryOperation {
        path: "Appx PackageManager".to_owned(),
        message: error.to_string(),
        raw_code: error.code().0.cast_unsigned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frameworks_and_shell_packages_are_never_optional() {
        assert_eq!(
            classify("Anything", true, false),
            AppxSafety::ProtectedFramework
        );
        assert_eq!(
            classify("Microsoft.SecHealthUI", false, false),
            AppxSafety::ProtectedSystem
        );
    }

    #[test]
    fn only_reviewed_optional_packages_are_removal_candidates() {
        assert_eq!(
            classify("Microsoft.BingWeather", false, false),
            AppxSafety::ReviewedOptional
        );
        assert_eq!(
            classify("Unknown.Package", false, false),
            AppxSafety::Unreviewed
        );
    }

    #[test]
    fn preview_explicitly_blocks_restore_and_apply() {
        let package = AppxPackage {
            name: "Microsoft.BingWeather".to_owned(),
            full_name: "Microsoft.BingWeather_1.0_x64_test".to_owned(),
            publisher_id: "test".to_owned(),
            version: "1.0.0.0".to_owned(),
            architecture: "x64".to_owned(),
            is_framework: false,
            is_resource: false,
            safety: AppxSafety::ReviewedOptional,
        };
        let preview = preview_from_inventory(vec![package], "Microsoft.BingWeather_1.0_x64_test")
            .expect("reviewed package preview");
        assert!(preview.can_remove);
        assert!(preview.restore_blocked);
        assert!(preview.explanation.contains("apply is blocked"));
    }
}
