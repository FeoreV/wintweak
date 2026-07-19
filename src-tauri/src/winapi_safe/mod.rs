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
