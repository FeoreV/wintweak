//! Curated application catalog, provider discovery, and cancellable operations.
#![allow(
    clippy::missing_errors_doc,
    clippy::missing_panics_doc,
    clippy::needless_pass_by_value,
    clippy::type_complexity,
    clippy::needless_borrow,
    clippy::cloned_instead_of_copied
)]

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
    core::{
        provider::InventoryProvider,
        runner::allowlist::{ManagedOperation, execute},
    },
    errors::AppError,
    types::{
        AppDefinition, AppInstallItemResult, AppInstallReport, AppInstallRequest,
        AppOperationEvent, AppOperationHandle, AppOperationKind, AppOperationPhase,
        AppOperationStatus, AppPackageManager, AppProviderStatus, ChocolateyBootstrapRequest,
    },
};

/// Typed package-provider facade over the reviewed catalog and fixed runner templates.
pub struct PackageProvider;

impl PackageProvider {
    pub const fn new() -> Self {
        Self
    }
    pub fn statuses(&self) -> Vec<AppProviderStatus> {
        provider_statuses()
    }
    pub fn install(&self, request: AppInstallRequest) -> Result<AppOperationHandle, AppError> {
        start_install(request, None)
    }
    pub fn update(&self, request: AppInstallRequest) -> Result<AppOperationHandle, AppError> {
        start_update(request, None)
    }
}

impl Default for PackageProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl InventoryProvider for PackageProvider {
    type Item = AppDefinition;
    fn inventory(&self) -> Result<Vec<Self::Item>, AppError> {
        built_in_catalog()
    }
}

const BUILT_IN_APPS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/data/apps/catalog.json"
));

type EventSink = Arc<dyn Fn(AppOperationEvent) + Send + Sync>;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct RawApplication {
    category: String,
    #[serde(default = "unavailable_package")]
    choco: String,
    #[serde(rename = "content")]
    name: String,
    description: String,
    link: String,
    winget: String,
    foss: bool,
}

#[derive(Clone)]
struct Task {
    kind: AppOperationKind,
    cancelled: Arc<AtomicBool>,
    events: Arc<Mutex<Vec<AppOperationEvent>>>,
    report: Arc<Mutex<Option<AppInstallReport>>>,
    phase: Arc<Mutex<AppOperationPhase>>,
}

static TASKS: OnceLock<Mutex<HashMap<Uuid, Task>>> = OnceLock::new();

fn tasks() -> &'static Mutex<HashMap<Uuid, Task>> {
    TASKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn unavailable_package() -> String {
    "na".to_owned()
}

/// Returns the embedded catalog after strict validation and deterministic sorting.
pub fn built_in_catalog() -> Result<Vec<AppDefinition>, AppError> {
    let entries: HashMap<String, RawApplication> =
        serde_json::from_str(BUILT_IN_APPS).map_err(|error| AppError::InvalidConfigSchema {
            message: format!("built-in application catalog: {error}"),
        })?;
    let mut apps = entries
        .into_iter()
        .map(|(id, raw)| AppDefinition {
            id,
            category: raw.category,
            choco: raw.choco,
            name: raw.name,
            description: raw.description,
            link: raw.link,
            winget: raw.winget,
            foss: raw.foss,
        })
        .collect::<Vec<_>>();
    validate_catalog(&apps)?;
    apps.sort_by(|left, right| {
        left.category
            .cmp(&right.category)
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(apps)
}

/// Detects providers through the reviewed process boundary.
pub fn provider_statuses() -> Vec<AppProviderStatus> {
    [AppPackageManager::Winget, AppPackageManager::Choco]
        .into_iter()
        .map(|manager| {
            let operation = match manager {
                AppPackageManager::Winget => ManagedOperation::WingetListUpgrades,
                AppPackageManager::Choco => ManagedOperation::ChocoListUpgrades,
            };
            let result = execute(&operation);
            AppProviderStatus {
                manager,
                available: result.is_ok(),
                version: result.ok().and_then(first_line),
            }
        })
        .collect()
}

/// Starts a sequential install task. Cancellation is checked before every package spawn.
pub fn start_install(
    request: AppInstallRequest,
    sink: Option<EventSink>,
) -> Result<AppOperationHandle, AppError> {
    let catalog = built_in_catalog()?;
    if request.app_ids.is_empty() {
        return Err(AppError::InvalidConfigSchema {
            message: "app_ids must contain at least one item".to_owned(),
        });
    }
    let apps = resolve_apps(&catalog, &request.app_ids)?;
    for app in &apps {
        resolve_package(app, request.package_manager)?;
    }
    Ok(start_task(
        AppOperationKind::Install,
        apps.len(),
        sink,
        move |_task_id, task, emit| {
            let mut results = Vec::with_capacity(apps.len());
            for app in apps {
                if task.cancelled.load(Ordering::Acquire) {
                    emit(
                        AppOperationPhase::Cancelled,
                        None,
                        results.len(),
                        "operation cancelled before starting another package",
                    );
                    break;
                }
                let (manager, package_id) = resolve_package(&app, request.package_manager)?;
                emit(
                    AppOperationPhase::Running,
                    Some(app.id.clone()),
                    results.len(),
                    "installing package",
                );
                let result = execute(&install_operation(manager, &package_id));
                results.push(item_result(&app, manager, package_id, result));
            }
            let report = AppInstallReport {
                requested_count: u32::try_from(results.len()).unwrap_or(u32::MAX),
                choco_bootstrapped: false,
                results,
                restore_blocked: true,
                restore_explanation: "Package installation is not automatically reversible; uninstall and application data restoration cannot be guaranteed.".to_owned(),
            };
            *task.report.lock().expect("app task report lock poisoned") = Some(report);
            let phase = if task.cancelled.load(Ordering::Acquire) {
                AppOperationPhase::Cancelled
            } else {
                AppOperationPhase::Completed
            };
            emit(
                phase,
                None,
                task.report
                    .lock()
                    .expect("app task report lock poisoned")
                    .as_ref()
                    .map_or(0, |value| value.results.len()),
                "operation finished",
            );
            Ok(())
        },
    ))
}

/// Starts an explicit Chocolatey bootstrap. It never resumes a previous install automatically.
pub fn start_chocolatey_bootstrap(
    request: ChocolateyBootstrapRequest,
    sink: Option<EventSink>,
) -> Result<AppOperationHandle, AppError> {
    if !request.acknowledged_remote_script {
        return Err(AppError::OperationNotAllowed {
            operation: "Chocolatey bootstrap requires explicit acknowledgement".to_owned(),
        });
    }
    Ok(start_task(
        AppOperationKind::BootstrapChocolatey,
        1,
        sink,
        move |_task_id, _task, emit| {
            emit(
                AppOperationPhase::Running,
                None,
                0,
                "running confirmed Chocolatey bootstrap",
            );
            execute(&ManagedOperation::BootstrapChocolatey)?;
            emit(
                AppOperationPhase::Completed,
                None,
                1,
                "Chocolatey bootstrap completed",
            );
            Ok(())
        },
    ))
}

/// Starts updates for selected catalog IDs. The caller must first inventory candidates.
pub fn start_update(
    request: AppInstallRequest,
    sink: Option<EventSink>,
) -> Result<AppOperationHandle, AppError> {
    let catalog = built_in_catalog()?;
    let apps = resolve_apps(&catalog, &request.app_ids)?;
    Ok(start_task(
        AppOperationKind::Update,
        apps.len(),
        sink,
        move |_task_id, task, emit| {
            let mut results = Vec::with_capacity(apps.len());
            emit(
                AppOperationPhase::Discovering,
                None,
                0,
                "checking selected provider updates",
            );
            for app in apps {
                if task.cancelled.load(Ordering::Acquire) {
                    emit(
                        AppOperationPhase::Cancelled,
                        None,
                        results.len(),
                        "operation cancelled before starting another package",
                    );
                    break;
                }
                let (manager, package_id) = resolve_package(&app, request.package_manager)?;
                emit(
                    AppOperationPhase::Running,
                    Some(app.id.clone()),
                    results.len(),
                    "updating package",
                );
                let result = execute(&upgrade_operation(manager, &package_id));
                results.push(item_result(&app, manager, package_id, result));
            }
            *task.report.lock().expect("app task report lock poisoned") = Some(AppInstallReport {
                requested_count: u32::try_from(results.len()).unwrap_or(u32::MAX),
                choco_bootstrapped: false,
                results,
                restore_blocked: true,
                restore_explanation: "Package updates are not automatically reversible; prior package versions and application data cannot be guaranteed.".to_owned(),
            });
            let phase = if task.cancelled.load(Ordering::Acquire) {
                AppOperationPhase::Cancelled
            } else {
                AppOperationPhase::Completed
            };
            emit(
                phase,
                None,
                task.report
                    .lock()
                    .expect("app task report lock poisoned")
                    .as_ref()
                    .map_or(0, |value| value.results.len()),
                "operation finished",
            );
            Ok(())
        },
    ))
}

pub fn operation_status(task_id: Uuid) -> Result<AppOperationStatus, AppError> {
    let task = tasks()
        .lock()
        .expect("app task map lock poisoned")
        .get(&task_id)
        .cloned()
        .ok_or_else(|| AppError::OperationNotAllowed {
            operation: "unknown application task".to_owned(),
        })?;
    Ok(AppOperationStatus {
        task_id: task_id.to_string(),
        kind: task.kind,
        phase: *task.phase.lock().expect("app task phase lock poisoned"),
        events: task
            .events
            .lock()
            .expect("app task event lock poisoned")
            .clone(),
        report: task
            .report
            .lock()
            .expect("app task report lock poisoned")
            .clone(),
    })
}

pub fn cancel_operation(task_id: Uuid) -> Result<(), AppError> {
    let task = tasks()
        .lock()
        .expect("app task map lock poisoned")
        .get(&task_id)
        .cloned()
        .ok_or_else(|| AppError::OperationNotAllowed {
            operation: "unknown application task".to_owned(),
        })?;
    task.cancelled.store(true, Ordering::Release);
    Ok(())
}

fn start_task<F>(
    kind: AppOperationKind,
    total: usize,
    sink: Option<EventSink>,
    run: F,
) -> AppOperationHandle
where
    F: FnOnce(
            Uuid,
            Task,
            Arc<dyn Fn(AppOperationPhase, Option<String>, usize, &str) + Send + Sync>,
        ) -> Result<(), AppError>
        + Send
        + 'static,
{
    let id = Uuid::new_v4();
    let task = Task {
        kind,
        cancelled: Arc::new(AtomicBool::new(false)),
        events: Arc::new(Mutex::new(Vec::new())),
        report: Arc::new(Mutex::new(None)),
        phase: Arc::new(Mutex::new(AppOperationPhase::Queued)),
    };
    tasks()
        .lock()
        .expect("app task map lock poisoned")
        .insert(id, task.clone());
    thread::spawn(move || {
        let event_task = task.clone();
        let emit: Arc<dyn Fn(AppOperationPhase, Option<String>, usize, &str) + Send + Sync> =
            Arc::new(move |phase, current_app_id, completed, message| {
                *event_task
                    .phase
                    .lock()
                    .expect("app task phase lock poisoned") = phase;
                let event = AppOperationEvent {
                    task_id: id.to_string(),
                    kind,
                    phase,
                    current_app_id,
                    completed_count: u32::try_from(completed).unwrap_or(u32::MAX),
                    total_count: u32::try_from(total).unwrap_or(u32::MAX),
                    message: message.to_owned(),
                };
                event_task
                    .events
                    .lock()
                    .expect("app task event lock poisoned")
                    .push(event.clone());
                if let Some(sink) = &sink {
                    sink(event);
                }
            });
        emit(AppOperationPhase::Queued, None, 0, "operation queued");
        if let Err(error) = run(id, task, Arc::clone(&emit)) {
            emit(AppOperationPhase::Failed, None, 0, &error.to_string());
        }
    });
    AppOperationHandle {
        task_id: id.to_string(),
    }
}

fn validate_catalog(apps: &[AppDefinition]) -> Result<(), AppError> {
    let mut ids = std::collections::HashSet::new();
    for app in apps {
        if app.id.trim().is_empty()
            || !ids.insert(&app.id)
            || app.name.trim().is_empty()
            || app.category.trim().is_empty()
            || app.winget.trim().is_empty()
            || !app.link.starts_with("https://")
        {
            return Err(AppError::InvalidConfigSchema {
                message: format!("invalid application catalog entry '{}'", app.id),
            });
        }
        if app.choco != "na" && !valid_package_id(&app.choco)
            || !valid_package_id(&app.winget.strip_prefix("msstore:").unwrap_or(&app.winget))
        {
            return Err(AppError::InvalidConfigSchema {
                message: format!("invalid package identifier for '{}'", app.id),
            });
        }
    }
    Ok(())
}

fn valid_package_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || ".-_~+".contains(character))
}

fn resolve_apps(catalog: &[AppDefinition], ids: &[String]) -> Result<Vec<AppDefinition>, AppError> {
    let by_id = catalog
        .iter()
        .map(|app| (app.id.as_str(), app))
        .collect::<HashMap<_, _>>();
    let mut seen = std::collections::HashSet::new();
    ids.iter()
        .map(|id| {
            if !seen.insert(id.as_str()) {
                return Err(AppError::InvalidConfigSchema {
                    message: format!("duplicate application id '{id}'"),
                });
            }
            by_id
                .get(id.as_str())
                .cloned()
                .cloned()
                .ok_or_else(|| AppError::UnknownApplication { app_id: id.clone() })
        })
        .collect()
}

fn resolve_package(
    app: &AppDefinition,
    manager: AppPackageManager,
) -> Result<(AppPackageManager, String), AppError> {
    match manager {
        AppPackageManager::Winget => Ok((manager, app.winget.clone())),
        AppPackageManager::Choco if app.choco != "na" => Ok((manager, app.choco.clone())),
        AppPackageManager::Choco => Err(AppError::OperationNotAllowed {
            operation: format!("{} is unavailable from Chocolatey", app.name),
        }),
    }
}

fn install_operation(manager: AppPackageManager, package_id: &str) -> ManagedOperation {
    match manager {
        AppPackageManager::Winget => ManagedOperation::WingetInstall {
            package_id: package_id.to_owned(),
        },
        AppPackageManager::Choco => ManagedOperation::ChocoInstall {
            package_id: package_id.to_owned(),
        },
    }
}
fn upgrade_operation(manager: AppPackageManager, package_id: &str) -> ManagedOperation {
    match manager {
        AppPackageManager::Winget => ManagedOperation::WingetUpgrade {
            package_id: package_id.to_owned(),
        },
        AppPackageManager::Choco => ManagedOperation::ChocoUpgrade {
            package_id: package_id.to_owned(),
        },
    }
}
fn item_result(
    app: &AppDefinition,
    manager: AppPackageManager,
    package_id: String,
    result: Result<String, AppError>,
) -> AppInstallItemResult {
    match result {
        Ok(message) => AppInstallItemResult {
            app_id: app.id.clone(),
            name: app.name.clone(),
            manager,
            package_id,
            success: true,
            message,
        },
        Err(error) => AppInstallItemResult {
            app_id: app.id.clone(),
            name: app.name.clone(),
            manager,
            package_id,
            success: false,
            message: error.to_string(),
        },
    }
}
fn first_line(value: String) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
}

/// Collects installed Win32 software from registry and Appx packages into a normalized list.
pub fn installed_apps() -> Result<Vec<crate::types::InstalledApp>, AppError> {
    let mut apps = Vec::new();
    #[cfg(windows)]
    {
        scan_uninstall_registry(&mut apps);
    }

    if let Ok(appx_packages) = crate::core::appx::AppxProvider::new().inventory() {
        for appx in appx_packages {
            if !appx.is_framework && !appx.is_resource {
                apps.push(crate::types::InstalledApp {
                    id: format!("appx:{}", appx.full_name),
                    display_name: appx.name,
                    display_version: Some(appx.version),
                    publisher: Some(appx.publisher_id),
                    install_location: None,
                    install_date: None,
                    source: crate::types::InstalledAppSource::Appx,
                    package_id: Some(appx.full_name),
                    is_system_component: appx.safety != crate::types::AppxSafety::ReviewedOptional,
                    update_available: false,
                    available_version: None,
                });
            }
        }
    }

    apps.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));
    apps.dedup_by(|a, b| a.id == b.id || (a.display_name == b.display_name && a.publisher == b.publisher));
    Ok(apps)
}

#[cfg(windows)]
fn scan_uninstall_registry(apps: &mut Vec<crate::types::InstalledApp>) {
    use crate::{
        core::registry::RegistryBackend,
        types::{RegistryAction, RegistryHive, RegistryValue},
        winapi_safe::{WindowsRegistry, list_subkeys},
    };
    let registry = WindowsRegistry::new();

    let uninstall_paths = [
        (RegistryHive::LocalMachine, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        (RegistryHive::LocalMachine, "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        (RegistryHive::CurrentUser, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
    ];

    for (hive, base_path) in uninstall_paths {
        if let Ok(subkeys) = list_subkeys(hive, base_path) {
            for subkey in subkeys {
                let key_path = format!("{base_path}\\{subkey}");
                let get_str = |val_name: &str| -> Option<String> {
                    let action = RegistryAction {
                        hive,
                        key_path: key_path.clone(),
                        value_name: val_name.to_owned(),
                        value: RegistryValue::Missing,
                    };
                    match registry.read(&action) {
                        Ok(RegistryValue::String(s)) => {
                            let trimmed = s.trim().to_owned();
                            if trimmed.is_empty() { None } else { Some(trimmed) }
                        }
                        _ => None,
                    }
                };
                let get_dword = |val_name: &str| -> Option<u32> {
                    let action = RegistryAction {
                        hive,
                        key_path: key_path.clone(),
                        value_name: val_name.to_owned(),
                        value: RegistryValue::Missing,
                    };
                    match registry.read(&action) {
                        Ok(RegistryValue::Dword(d)) => Some(d),
                        _ => None,
                    }
                };

                let display_name = get_str("DisplayName");
                let Some(name) = display_name else {
                    continue;
                };

                let is_system = get_dword("SystemComponent").unwrap_or(0) == 1
                    || get_str("ParentKeyName").is_some()
                    || subkey.starts_with("KB")
                    || name.starts_with("Security Update")
                    || name.starts_with("Update for ");

                let display_version = get_str("DisplayVersion");
                let publisher = get_str("Publisher");
                let install_location = get_str("InstallLocation");
                let install_date = get_str("InstallDate");

                apps.push(crate::types::InstalledApp {
                    id: format!("registry:{hive:?}:{subkey}"),
                    display_name: name,
                    display_version,
                    publisher,
                    install_location,
                    install_date,
                    source: crate::types::InstalledAppSource::Registry,
                    package_id: None,
                    is_system_component: is_system,
                    update_available: false,
                    available_version: None,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn built_in_catalog_is_valid_and_sorted() {
        let apps = built_in_catalog().expect("bundled catalog must validate");
        assert_eq!(apps.len(), 204);
        assert!(
            apps.windows(2).all(
                |pair| (&pair[0].category, &pair[0].name) <= (&pair[1].category, &pair[1].name)
            )
        );
    }
    #[test]
    fn package_id_validation_rejects_shell_syntax() {
        assert!(!valid_package_id("safe.id;whoami"));
    }
}
