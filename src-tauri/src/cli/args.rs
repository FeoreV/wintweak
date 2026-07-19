//! Clap definitions kept separate from headless business orchestration.

use std::path::PathBuf;

use clap::{Parser, ValueEnum};
use uuid::Uuid;

use crate::logging::LogFormat;

#[derive(Debug, Parser)]
#[command(name = "optimizer", version, about = "Native Windows Optimizer")]
#[command(group(clap::ArgGroup::new("profile_or_input").args(["config", "profile", "import_profile"])))]
#[allow(clippy::struct_excessive_bools)]
pub struct Arguments {
    /// Apply a validated tweak batch without initializing `WebView2`.
    #[arg(
        long,
        value_name = "FILE",
        conflicts_with_all = ["restore", "list_tweaks", "status", "list_recovery", "profile", "import_profile"]
    )]
    pub config: Option<PathBuf>,

    /// Plan and read current values without modifying Windows.
    #[arg(long, requires = "profile_or_input", conflicts_with = "apply")]
    pub dry_run: bool,

    /// Apply a selected built-in or imported profile.
    #[arg(long, requires = "profile_or_input")]
    pub apply: bool,

    /// Select a built-in declarative profile.
    #[arg(long, value_enum, conflicts_with_all = ["config", "import_profile"])]
    pub profile: Option<CliProfile>,

    /// Export the selected built-in profile as strict JSON.
    #[arg(long, value_name = "FILE", requires = "profile", conflicts_with_all = ["dry_run", "apply"])]
    pub export_profile: Option<PathBuf>,

    /// Import a strict declarative profile JSON document.
    #[arg(long, value_name = "FILE", conflicts_with_all = ["config", "profile"])]
    pub import_profile: Option<PathBuf>,

    /// Restore a prior recovery session in reverse order.
    #[arg(long, value_name = "SESSION_ID")]
    pub restore: Option<Uuid>,

    /// Print the built-in tweak catalog and exit.
    #[arg(long, conflicts_with_all = ["status", "list_recovery", "restore"])]
    pub list_tweaks: bool,

    /// Read and print the effective state of every built-in tweak.
    #[arg(long, conflicts_with_all = ["list_recovery", "restore"])]
    pub status: bool,

    /// List available recovery sessions, newest first.
    #[arg(long, conflicts_with = "restore")]
    pub list_recovery: bool,

    /// Select human-readable or JSON structured logs.
    #[arg(long, value_enum, default_value = "human")]
    pub log_format: LogFormat,
}

#[derive(Debug)]
pub enum Mode {
    Gui,
    Headless(HeadlessMode),
}

#[derive(Debug)]
pub enum HeadlessMode {
    Apply {
        config: PathBuf,
        dry_run: bool,
    },
    Restore(Uuid),
    ListTweaks,
    Status,
    ListRecovery,
    Profile {
        profile: CliProfile,
        dry_run: bool,
        apply: bool,
    },
    ExportProfile {
        profile: CliProfile,
        path: PathBuf,
    },
    ImportProfile {
        path: PathBuf,
        dry_run: bool,
        apply: bool,
    },
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum CliProfile {
    Privacy,
    Balanced,
    Performance,
    Developer,
    Minimal,
}

impl From<CliProfile> for crate::types::ProfileName {
    fn from(value: CliProfile) -> Self {
        match value {
            CliProfile::Privacy => Self::Privacy,
            CliProfile::Balanced => Self::Balanced,
            CliProfile::Performance => Self::Performance,
            CliProfile::Developer => Self::Developer,
            CliProfile::Minimal => Self::Minimal,
        }
    }
}

impl Arguments {
    pub fn parse_process() -> Self {
        Self::parse()
    }

    pub fn mode(&self) -> Mode {
        if let (Some(profile), Some(path)) = (self.profile, &self.export_profile) {
            return Mode::Headless(HeadlessMode::ExportProfile {
                profile,
                path: path.clone(),
            });
        }
        if let Some(path) = &self.import_profile {
            return Mode::Headless(HeadlessMode::ImportProfile {
                path: path.clone(),
                dry_run: self.dry_run,
                apply: self.apply,
            });
        }
        if let Some(profile) = self.profile {
            return Mode::Headless(HeadlessMode::Profile {
                profile,
                dry_run: self.dry_run,
                apply: self.apply,
            });
        }
        if let Some(config) = &self.config {
            return Mode::Headless(HeadlessMode::Apply {
                config: config.clone(),
                dry_run: self.dry_run,
            });
        }
        if let Some(session_id) = self.restore {
            return Mode::Headless(HeadlessMode::Restore(session_id));
        }
        if self.list_tweaks {
            return Mode::Headless(HeadlessMode::ListTweaks);
        }
        if self.status {
            return Mode::Headless(HeadlessMode::Status);
        }
        if self.list_recovery {
            return Mode::Headless(HeadlessMode::ListRecovery);
        }
        Mode::Gui
    }
}
