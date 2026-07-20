# Source Ledger & Provenance

Date: 2026-07-20

All referenced open-source projects were consulted exclusively for architecture, data schema, and technical research on 2026-07-19 and 2026-07-20. No code or text was directly copied; all behaviors were independently re-implemented in typed Rust/TypeScript targeting official Microsoft Win32, WinRT, and COM APIs.

---

| Repository | Commit SHA | License | Consulted Files / Docs | Treatment & Notes |
|---|---|---|---|---|
| `Raphire/Win11Debloat` | `a7292e4` | MIT | `Config/Features.json`, `Config/DefaultSettings.json`, `Scripts/Features/GetCurrentTweakState.ps1` | Reference for per-user Explorer & Taskbar registry keys. Verified against Microsoft Learn documentation. |
| `farag2/Sophia-Script-for-Windows` | `14a1753` | MIT | `src/Sophia_Script_for_Windows_11/Module/Sophia.psm1`, `README.md` | Reference for Windows privacy and telemetry registry policies. Re-implemented using typed `RegistryAction` DTOs with pre-state snapshot restoration. |
| `ChrisTitusTech/winutil` | `5c104d0` | MIT | `config/applications.json`, `config/appx.json`, `docs/content/dev/architecture.md` | Package manager ID conventions for Winget & Chocolatey. Re-implemented as closed process allow-list in Rust. |
| `jonax1337/Reclaim` | `a7092da` | MIT | `docs/ARCHITECTURE.md`, `src-tauri/src/tweaks.rs`, `src-tauri/src/sysinfo.rs` | Tauri 2 backend architecture patterns and read-only system info providers. |
| `Noktomezo/Winsentials` | `aa7debe` | MIT | `src-tauri/src/registry/mod.rs`, `src-tauri/src/system_info/static_info.rs` | Windows system info API structure (CPU, RAM, GPU, Disks). |

---

## Normative Microsoft References

- **System Information & Hardware**:
  - `GetSystemInfo` / `GetNativeSystemInfo` Win32 API
  - `GlobalMemoryStatusEx` Win32 API
  - `GetLogicalDriveStringsW` & `GetDiskFreeSpaceExW` Win32 API
  - `GetSystemTimes` / `GetTickCount64` Win32 API
- **Windows Update & Drivers**:
  - `Microsoft.Update.Session` COM API (`IUpdateSearcher`, `IUpdateDownloader`, `IUpdateInstaller`)
  - `Win32_PnPSignedDriver` WMI / CIM Class
- **Installed Applications & Appx**:
  - Registry Uninstall keys: `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`, `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` (and 32-bit `WOW6432Node`)
  - `Windows.Management.Deployment.PackageManager` WinRT API for Appx enumeration
