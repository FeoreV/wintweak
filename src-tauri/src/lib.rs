//! Native Windows Optimizer backend library and Tauri composition root.

#![deny(unsafe_op_in_unsafe_fn)]

pub mod api_bridge;
pub mod cli;
pub mod core;
pub mod errors;
pub mod logging;
pub mod types;
pub mod winapi_safe;

use errors::AppError;
use tauri::Manager;

/// Builds and runs the GUI application.
///
/// # Errors
/// Returns [`AppError::Tauri`] when Tauri cannot initialize or run.
pub fn run_gui() -> Result<(), AppError> {
    let builder = api_bridge::specta_builder();

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.close_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|error| AppError::Tauri {
            message: error.to_string(),
        })
}
