//! Runtime compatibility checks shared by plan, dry-run, and apply.
#![allow(clippy::missing_errors_doc)]

use crate::{
    errors::AppError,
    types::{EnvironmentCheck, SupportedWindows, TweakDefinition, WindowsArchitecture},
};

#[cfg(windows)]
pub fn current() -> Result<EnvironmentCheck, AppError> {
    let build = windows_build()?;
    let windows = if build >= 22_000 {
        SupportedWindows::Windows11
    } else {
        SupportedWindows::Windows10
    };
    let is_admin = crate::winapi_safe::is_user_admin();
    Ok(EnvironmentCheck {
        windows,
        build,
        architecture: std::env::consts::ARCH.to_owned(),
        is_admin,
    })
}

#[cfg(windows)]
fn windows_build() -> Result<u32, AppError> {
    use crate::{
        core::registry::RegistryBackend,
        types::{RegistryAction, RegistryHive, RegistryValue},
        winapi_safe::WindowsRegistry,
    };
    let action = RegistryAction {
        hive: RegistryHive::LocalMachine,
        key_path: "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion".to_owned(),
        value_name: "CurrentBuildNumber".to_owned(),
        value: RegistryValue::Missing,
    };
    match WindowsRegistry::new().read(&action)? {
        RegistryValue::String(value) => {
            value
                .parse()
                .map_err(|error| AppError::UnsupportedEnvironment {
                    reason: format!("invalid Windows build number '{value}': {error}"),
                })
        }
        value => Err(AppError::UnsupportedEnvironment {
            reason: format!("Windows build number is unavailable ({value:?})"),
        }),
    }
}

#[cfg(not(windows))]
pub fn current() -> Result<EnvironmentCheck, AppError> {
    Err(AppError::UnsupportedPlatform)
}

pub fn validate(
    definition: &TweakDefinition,
    environment: &EnvironmentCheck,
) -> Result<(), AppError> {
    validate_support(definition, environment)?;
    if definition.requires_admin && !environment.is_admin {
        return Err(AppError::UnsupportedEnvironment {
            reason: format!(
                "tweak '{}' requires an elevated administrator process",
                definition.id
            ),
        });
    }
    Ok(())
}

pub fn validate_support(
    definition: &TweakDefinition,
    environment: &EnvironmentCheck,
) -> Result<(), AppError> {
    if !definition.support.versions.contains(&environment.windows) {
        return Err(AppError::UnsupportedEnvironment {
            reason: format!(
                "tweak '{}' does not support {:?}",
                definition.id, environment.windows
            ),
        });
    }
    if environment.build < definition.support.minimum_build {
        return Err(AppError::UnsupportedEnvironment {
            reason: format!(
                "tweak '{}' requires Windows build {} or newer; found {}",
                definition.id, definition.support.minimum_build, environment.build
            ),
        });
    }
    if definition
        .support
        .maximum_build
        .is_some_and(|maximum| environment.build > maximum)
    {
        return Err(AppError::UnsupportedEnvironment {
            reason: format!(
                "tweak '{}' supports Windows builds through {}; found {}",
                definition.id,
                definition.support.maximum_build.unwrap_or_default(),
                environment.build
            ),
        });
    }
    let architecture = match environment.architecture.as_str() {
        "x86_64" => WindowsArchitecture::X86_64,
        "aarch64" => WindowsArchitecture::Arm64,
        _ => {
            return Err(AppError::UnsupportedEnvironment {
                reason: format!("unsupported architecture '{}'", environment.architecture),
            });
        }
    };
    if !definition.architectures.contains(&architecture) {
        return Err(AppError::UnsupportedEnvironment {
            reason: format!(
                "tweak '{}' does not support architecture '{}'",
                definition.id, environment.architecture
            ),
        });
    }
    Ok(())
}
