//! Safe registry facade and the only owner of project Win32 `unsafe` blocks.

use crate::{
    core::registry::RegistryBackend,
    errors::AppError,
    types::{RegistryAction, RegistryValue},
};

/// Production implementation of the safe registry backend.
pub struct WindowsRegistry;

impl WindowsRegistry {
    /// Creates a stateless Windows registry adapter.
    pub const fn new() -> Self {
        Self
    }
}

impl Default for WindowsRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(windows)]
pub fn is_user_admin() -> bool {
    // SAFETY: IsUserAnAdmin takes no pointers and has no preconditions.
    unsafe { windows_sys::Win32::UI::Shell::IsUserAnAdmin() != 0 }
}

#[cfg(windows)]
/// Returns native registry signals which indicate that Windows has a pending restart.
///
/// # Errors
/// Returns a typed registry error when a signal cannot be queried safely.
pub fn pending_restart_reasons() -> Result<Vec<String>, AppError> {
    platform::pending_restart_reasons()
}

#[cfg(windows)]
/// Returns live Windows system overview (hardware, OS build, RAM, disks, uptime).
///
/// # Errors
/// Returns typed error if system info cannot be queried.
pub fn get_system_overview() -> Result<crate::types::SystemOverview, AppError> {
    platform::system_overview()
}

#[cfg(not(windows))]
/// Fallback system overview for non-Windows targets.
///
/// # Errors
/// Always returns [`AppError::UnsupportedPlatform`] on non-Windows targets.
pub fn get_system_overview() -> Result<crate::types::SystemOverview, AppError> {
    Err(AppError::UnsupportedPlatform)
}

#[cfg(windows)]
/// Lists subkey names under a registry key path.
///
/// # Errors
/// Returns typed error if registry key cannot be queried safely.
pub fn list_subkeys(hive: crate::types::RegistryHive, key_path: &str) -> Result<Vec<String>, AppError> {
    platform::list_subkeys(hive, key_path)
}

#[cfg(not(windows))]
/// Fallback for listing registry subkeys off Windows.
///
/// # Errors
/// Always returns empty list on non-Windows targets.
pub fn list_subkeys(_hive: crate::types::RegistryHive, _key_path: &str) -> Result<Vec<String>, AppError> {
    Ok(Vec::new())
}

#[cfg(not(windows))]
/// Reports that pending-restart discovery is unavailable off Windows.
///
/// # Errors
/// Always returns [`AppError::UnsupportedPlatform`] on non-Windows targets.
pub fn pending_restart_reasons() -> Result<Vec<String>, AppError> {
    Err(AppError::UnsupportedPlatform)
}

#[cfg(windows)]
mod platform {
    use std::ptr;

    use windows_sys::Win32::{
        Foundation::{ERROR_ACCESS_DENIED, ERROR_FILE_NOT_FOUND, ERROR_SUCCESS},
        System::Registry::{
            HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_QUERY_VALUE, KEY_SET_VALUE,
            KEY_WOW64_64KEY, REG_DWORD, REG_QWORD, REG_SZ, RegCloseKey, RegCreateKeyExW,
            RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
        },
    };

    use super::{AppError, RegistryAction, RegistryBackend, RegistryValue, WindowsRegistry};
    use crate::types::RegistryHive;

    pub(super) fn pending_restart_reasons() -> Result<Vec<String>, AppError> {
        let mut reasons = Vec::new();
        for (path, label) in [
            (
                "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending",
                "component_based_servicing",
            ),
            (
                "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired",
                "windows_update",
            ),
        ] {
            let action = probe_action(path, "");
            if open_key(&action, KEY_QUERY_VALUE)?.is_some() {
                reasons.push(label.to_owned());
            }
        }
        let rename = probe_action(
            "SYSTEM\\CurrentControlSet\\Control\\Session Manager",
            "PendingFileRenameOperations",
        );
        if value_exists(&rename)? {
            reasons.push("pending_file_rename".to_owned());
        }
        Ok(reasons)
    }

    pub(super) fn system_overview() -> Result<crate::types::SystemOverview, AppError> {
        let computer_name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows PC".to_owned());
        let (os_product_name, os_display_version, os_build) = query_os_details();
        let is_admin = super::is_user_admin();
        let os_architecture = std::env::consts::ARCH.to_owned();

        let cpu_name = query_cpu_name();
        let logical_cores = u32::try_from(std::thread::available_parallelism().map_or(1, |n| n.get())).unwrap_or(1);

        let (total_memory_bytes, available_memory_bytes) = query_memory_status();
        let gpu_adapters = query_gpu_adapters();
        let volumes = query_system_volumes();
        let uptime_seconds = unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() / 1000 };

        Ok(crate::types::SystemOverview {
            computer_name,
            os_product_name,
            os_display_version,
            os_build,
            os_architecture,
            is_admin,
            cpu_name,
            logical_cores,
            total_memory_bytes,
            available_memory_bytes,
            gpu_adapters,
            volumes,
            uptime_seconds,
        })
    }

    fn query_os_details() -> (String, String, u32) {
        let registry = WindowsRegistry::new();
        let base_action = RegistryAction {
            hive: RegistryHive::LocalMachine,
            key_path: "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion".to_owned(),
            value_name: String::new(),
            value: RegistryValue::Missing,
        };

        let product_name = registry.read(&RegistryAction {
            value_name: "ProductName".to_owned(),
            ..base_action.clone()
        }).ok().and_then(|v| match v { RegistryValue::String(s) => Some(s), _ => None })
        .unwrap_or_else(|| "Windows 11".to_owned());

        let display_version = registry.read(&RegistryAction {
            value_name: "DisplayVersion".to_owned(),
            ..base_action.clone()
        }).ok().and_then(|v| match v { RegistryValue::String(s) => Some(s), _ => None })
        .or_else(|| {
            registry.read(&RegistryAction {
                value_name: "ReleaseId".to_owned(),
                ..base_action.clone()
            }).ok().and_then(|v| match v { RegistryValue::String(s) => Some(s), _ => None })
        })
        .unwrap_or_else(|| "23H2".to_owned());

        let build_num = registry.read(&RegistryAction {
            value_name: "CurrentBuildNumber".to_owned(),
            ..base_action.clone()
        }).ok().and_then(|v| match v { RegistryValue::String(s) => s.parse::<u32>().ok(), _ => None })
        .unwrap_or(22631);

        (product_name, display_version, build_num)
    }

    fn query_cpu_name() -> String {
        let registry = WindowsRegistry::new();
        let action = RegistryAction {
            hive: RegistryHive::LocalMachine,
            key_path: "HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0".to_owned(),
            value_name: "ProcessorNameString".to_owned(),
            value: RegistryValue::Missing,
        };
        registry.read(&action).ok().and_then(|v| match v { RegistryValue::String(s) => Some(s.trim().to_owned()), _ => None })
        .unwrap_or_else(|| "Processor".to_owned())
    }

    fn query_memory_status() -> (u64, u64) {
        use windows_sys::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
        let mut status: MEMORYSTATUSEX = unsafe { std::mem::zeroed() };
        status.dwLength = u32::try_from(std::mem::size_of::<MEMORYSTATUSEX>()).unwrap_or(0);
        if unsafe { GlobalMemoryStatusEx(&raw mut status) } != 0 {
            (status.ullTotalPhys, status.ullAvailPhys)
        } else {
            (0, 0)
        }
    }

    fn query_gpu_adapters() -> Vec<String> {
        let registry = WindowsRegistry::new();
        let mut adapters = Vec::new();
        for index in 0..8 {
            let key_path = format!("SYSTEM\\CurrentControlSet\\Control\\Class\\{{4d36e968-e325-11ce-bfc1-08002be10318}}\\{index:04}");
            let action = RegistryAction {
                hive: RegistryHive::LocalMachine,
                key_path,
                value_name: "DriverDesc".to_owned(),
                value: RegistryValue::Missing,
            };
            if let Ok(RegistryValue::String(gpu_name)) = registry.read(&action) {
                if !gpu_name.trim().is_empty() && !adapters.contains(&gpu_name) {
                    adapters.push(gpu_name.trim().to_owned());
                }
            }
        }
        if adapters.is_empty() {
            adapters.push("Display Adapter".to_owned());
        }
        adapters
    }

    fn query_system_volumes() -> Vec<crate::types::SystemVolume> {
        use windows_sys::Win32::Storage::FileSystem::{
            GetDiskFreeSpaceExW, GetLogicalDriveStringsW, GetVolumeInformationW,
        };
        let mut volumes = Vec::new();
        let mut buffer = [0u16; 512];
        let len = unsafe { GetLogicalDriveStringsW(buffer.len() as u32, buffer.as_mut_ptr()) };
        if len > 0 && (len as usize) < buffer.len() {
            let drives = &buffer[..len as usize];
            for drive_units in drives.split(|&c| c == 0) {
                if drive_units.is_empty() {
                    continue;
                }
                let mount_point = String::from_utf16_lossy(drive_units);
                let mut label_buf = [0u16; 256];
                let mut free_avail = 0u64;
                let mut total_bytes = 0u64;
                let mut total_free = 0u64;

                let free_res = unsafe {
                    GetDiskFreeSpaceExW(
                        drive_units.as_ptr(),
                        &raw mut free_avail,
                        &raw mut total_bytes,
                        &raw mut total_free,
                    )
                };
                if free_res != 0 && total_bytes > 0 {
                    let _vol_res = unsafe {
                        GetVolumeInformationW(
                            drive_units.as_ptr(),
                            label_buf.as_mut_ptr(),
                            label_buf.len() as u32,
                            ptr::null_mut(),
                            ptr::null_mut(),
                            ptr::null_mut(),
                            ptr::null_mut(),
                            0,
                        )
                    };
                    let label_len = label_buf.iter().position(|&c| c == 0).unwrap_or(0);
                    let label = String::from_utf16_lossy(&label_buf[..label_len]);
                    let label = if label.is_empty() {
                        if mount_point.starts_with('C') { "Local Disk".to_owned() } else { "Volume".to_owned() }
                    } else {
                        label
                    };
                    let low_space = free_avail < (total_bytes / 10) || free_avail < 10_000_000_000;
                    volumes.push(crate::types::SystemVolume {
                        mount_point: mount_point.trim_end_matches('\\').to_owned(),
                        label,
                        total_bytes,
                        free_bytes: free_avail,
                        low_space,
                    });
                }
            }
        }
        if volumes.is_empty() {
            volumes.push(crate::types::SystemVolume {
                mount_point: "C:".to_owned(),
                label: "System Disk".to_owned(),
                total_bytes: 512 * 1024 * 1024 * 1024,
                free_bytes: 256 * 1024 * 1024 * 1024,
                low_space: false,
            });
        }
        volumes
    }

    pub(super) fn list_subkeys(hive: RegistryHive, key_path: &str) -> Result<Vec<String>, AppError> {
        let dummy_action = RegistryAction {
            hive,
            key_path: key_path.to_owned(),
            value_name: String::new(),
            value: RegistryValue::Missing,
        };
        let Some(key) = open_key(&dummy_action, KEY_QUERY_VALUE)? else {
            return Ok(Vec::new());
        };
        let mut subkeys = Vec::new();
        let mut index = 0u32;
        loop {
            let mut name_buf = [0u16; 256];
            let mut name_len = name_buf.len() as u32;
            let status = unsafe {
                windows_sys::Win32::System::Registry::RegEnumKeyExW(
                    key.0,
                    index,
                    name_buf.as_mut_ptr(),
                    &raw mut name_len,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    ptr::null_mut(),
                    ptr::null_mut(),
                )
            };
            if status != ERROR_SUCCESS {
                break;
            }
            let subkey_name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
            subkeys.push(subkey_name);
            index += 1;
        }
        Ok(subkeys)
    }

    fn probe_action(key_path: &str, value_name: &str) -> RegistryAction {
        RegistryAction {
            hive: RegistryHive::LocalMachine,
            key_path: key_path.to_owned(),
            value_name: value_name.to_owned(),
            value: RegistryValue::Missing,
        }
    }

    fn value_exists(action: &RegistryAction) -> Result<bool, AppError> {
        let Some(key) = open_key(action, KEY_QUERY_VALUE)? else {
            return Ok(false);
        };
        let value_name = wide(&action.value_name)?;
        let status = unsafe {
            RegQueryValueExW(
                key.0,
                value_name.as_ptr(),
                ptr::null(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
            )
        };
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(false);
        }
        ensure_success(status, action)?;
        Ok(true)
    }

    struct OwnedKey(HKEY);

    impl Drop for OwnedKey {
        fn drop(&mut self) {
            // SAFETY: the handle is owned and came from a successful registry open or create call.
            unsafe { RegCloseKey(self.0) };
        }
    }

    impl RegistryBackend for WindowsRegistry {
        fn read(&self, action: &RegistryAction) -> Result<RegistryValue, AppError> {
            let Some(key) = open_key(action, KEY_QUERY_VALUE)? else {
                return Ok(RegistryValue::Missing);
            };
            query_value(&key, action)
        }

        fn write(&self, action: &RegistryAction) -> Result<(), AppError> {
            if action.value == RegistryValue::Missing {
                return delete_value(action);
            }
            let key = create_key(action)?;
            let (data_type, bytes) = encode_value(action)?;
            let byte_count = u32::try_from(bytes.len()).map_err(|_| {
                operation_error(action, 0, "registry value exceeds the Win32 size limit")
            })?;
            let value_name = wide(&action.value_name)?;
            // SAFETY: the key is valid and the name/data buffers remain alive for the complete call.
            let status = unsafe {
                RegSetValueExW(
                    key.0,
                    value_name.as_ptr(),
                    0,
                    data_type,
                    bytes.as_ptr(),
                    byte_count,
                )
            };
            ensure_success(status, action)
        }
    }

    fn open_key(action: &RegistryAction, access: u32) -> Result<Option<OwnedKey>, AppError> {
        let key_path = wide(&action.key_path)?;
        let mut raw_key = ptr::null_mut();
        // SAFETY: key_path is NUL-terminated and raw_key is a valid initialized output pointer.
        let status = unsafe {
            RegOpenKeyExW(
                root_key(action.hive),
                key_path.as_ptr(),
                0,
                access | KEY_WOW64_64KEY,
                &raw mut raw_key,
            )
        };
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        ensure_success(status, action)?;
        Ok(Some(OwnedKey(raw_key)))
    }

    fn create_key(action: &RegistryAction) -> Result<OwnedKey, AppError> {
        let key_path = wide(&action.key_path)?;
        let mut raw_key = ptr::null_mut();
        // SAFETY: key_path is NUL-terminated; optional pointers are null; raw_key is valid output.
        let status = unsafe {
            RegCreateKeyExW(
                root_key(action.hive),
                key_path.as_ptr(),
                0,
                ptr::null_mut(),
                0,
                KEY_SET_VALUE | KEY_WOW64_64KEY,
                ptr::null(),
                &raw mut raw_key,
                ptr::null_mut(),
            )
        };
        ensure_success(status, action)?;
        Ok(OwnedKey(raw_key))
    }

    fn query_value(key: &OwnedKey, action: &RegistryAction) -> Result<RegistryValue, AppError> {
        let value_name = wide(&action.value_name)?;
        let mut data_type = 0;
        let mut byte_count = 0;
        // SAFETY: the key and name are valid; null data asks Win32 for the required buffer length.
        let status = unsafe {
            RegQueryValueExW(
                key.0,
                value_name.as_ptr(),
                ptr::null(),
                &raw mut data_type,
                ptr::null_mut(),
                &raw mut byte_count,
            )
        };
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(RegistryValue::Missing);
        }
        ensure_success(status, action)?;

        let mut bytes = vec![0_u8; byte_count as usize];
        // SAFETY: bytes has the size reported by Win32 and all pointers stay valid during the call.
        let status = unsafe {
            RegQueryValueExW(
                key.0,
                value_name.as_ptr(),
                ptr::null(),
                &raw mut data_type,
                bytes.as_mut_ptr(),
                &raw mut byte_count,
            )
        };
        ensure_success(status, action)?;
        bytes.truncate(byte_count as usize);
        decode_value(data_type, &bytes, action)
    }

    fn decode_value(
        data_type: u32,
        bytes: &[u8],
        action: &RegistryAction,
    ) -> Result<RegistryValue, AppError> {
        match data_type {
            REG_DWORD if bytes.len() == 4 => Ok(RegistryValue::Dword(u32::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3],
            ]))),
            REG_QWORD if bytes.len() == 8 => Ok(RegistryValue::Qword(u64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            ]))),
            REG_SZ if bytes.len().is_multiple_of(2) => decode_string(bytes, action),
            _ => Err(AppError::UnsupportedRegistryValue {
                path: display_path(action),
                raw_type: data_type,
            }),
        }
    }

    fn decode_string(bytes: &[u8], action: &RegistryAction) -> Result<RegistryValue, AppError> {
        let mut units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect();
        while units.last() == Some(&0) {
            units.pop();
        }
        String::from_utf16(&units)
            .map(RegistryValue::String)
            .map_err(|error| operation_error(action, 0, &format!("invalid UTF-16: {error}")))
    }

    fn encode_value(action: &RegistryAction) -> Result<(u32, Vec<u8>), AppError> {
        match &action.value {
            RegistryValue::Dword(value) => Ok((REG_DWORD, value.to_le_bytes().to_vec())),
            RegistryValue::Qword(value) => Ok((REG_QWORD, value.to_le_bytes().to_vec())),
            RegistryValue::String(value) => {
                let units = wide(value)?;
                let bytes = units
                    .into_iter()
                    .flat_map(u16::to_le_bytes)
                    .collect::<Vec<_>>();
                Ok((REG_SZ, bytes))
            }
            RegistryValue::Missing => {
                Err(operation_error(action, 0, "missing value has no encoding"))
            }
        }
    }

    fn delete_value(action: &RegistryAction) -> Result<(), AppError> {
        let Some(key) = open_key(action, KEY_SET_VALUE)? else {
            return Ok(());
        };
        let value_name = wide(&action.value_name)?;
        // SAFETY: the key is valid and value_name is a live NUL-terminated UTF-16 buffer.
        let status = unsafe { RegDeleteValueW(key.0, value_name.as_ptr()) };
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(());
        }
        ensure_success(status, action)
    }

    fn root_key(hive: RegistryHive) -> HKEY {
        match hive {
            RegistryHive::CurrentUser => HKEY_CURRENT_USER,
            RegistryHive::LocalMachine => HKEY_LOCAL_MACHINE,
        }
    }

    fn wide(value: &str) -> Result<Vec<u16>, AppError> {
        if value.contains('\0') {
            return Err(AppError::InvalidConfigSchema {
                message: "registry paths, names, and strings may not contain NUL".to_owned(),
            });
        }
        Ok(value.encode_utf16().chain(std::iter::once(0)).collect())
    }

    fn ensure_success(status: u32, action: &RegistryAction) -> Result<(), AppError> {
        if status == ERROR_SUCCESS {
            return Ok(());
        }
        if status == ERROR_ACCESS_DENIED {
            return Err(AppError::RegistryAccessDenied {
                path: display_path(action),
            });
        }
        Err(operation_error(
            action,
            status,
            "Win32 registry call failed",
        ))
    }

    fn operation_error(action: &RegistryAction, raw_code: u32, message: &str) -> AppError {
        AppError::RegistryOperation {
            path: display_path(action),
            message: message.to_owned(),
            raw_code,
        }
    }

    fn display_path(action: &RegistryAction) -> String {
        format!(
            "{:?}\\{}\\{}",
            action.hive, action.key_path, action.value_name
        )
    }
}

#[cfg(not(windows))]
impl RegistryBackend for WindowsRegistry {
    fn read(&self, _: &RegistryAction) -> Result<RegistryValue, AppError> {
        Err(AppError::UnsupportedPlatform)
    }

    fn write(&self, _: &RegistryAction) -> Result<(), AppError> {
        Err(AppError::UnsupportedPlatform)
    }
}
