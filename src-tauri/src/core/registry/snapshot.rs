//! Durable per-session recovery snapshots written before registry mutation.

use std::{
    env, fs,
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::AppError,
    types::{RecoverySessionSummary, RegistryAction, RegistryValue},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct SnapshotEntry {
    pub action: RegistryAction,
    pub previous: RegistryValue,
    #[serde(default = "completed_state")]
    state: SnapshotEntryState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum SnapshotEntryState {
    Pending,
    Completed,
}

const fn completed_state() -> SnapshotEntryState {
    SnapshotEntryState::Completed
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SnapshotDocument {
    session_id: Uuid,
    created_unix_seconds: u64,
    entries: Vec<SnapshotEntry>,
}

pub struct RecoveryStore {
    path: PathBuf,
    document: SnapshotDocument,
}

impl RecoveryStore {
    /// Creates a new recovery store below the current user's application data directory.
    ///
    /// # Errors
    /// Returns an error if `APPDATA`, the clock, or the directory is unavailable.
    pub fn for_current_user() -> Result<Self, AppError> {
        Self::at(Self::current_user_directory()?)
    }

    /// Lists valid recovery sessions, newest first.
    ///
    /// # Errors
    /// Returns an error if a snapshot cannot be read or is malformed.
    pub fn list_current_user() -> Result<Vec<RecoverySessionSummary>, AppError> {
        let directory = Self::current_user_directory()?;
        fs::create_dir_all(&directory)
            .map_err(|error| AppError::io(directory.display().to_string(), &error))?;
        let mut sessions = Vec::new();
        for entry in fs::read_dir(&directory)
            .map_err(|error| AppError::io(directory.display().to_string(), &error))?
        {
            let path = entry
                .map_err(|error| AppError::io(directory.display().to_string(), &error))?
                .path();
            if path
                .extension()
                .is_some_and(|extension| extension == "json")
            {
                sessions.push(Self::read_document(&path)?.summary()?);
            }
        }
        sessions.sort_by_key(|session| std::cmp::Reverse(session.created_unix_seconds));
        Ok(sessions)
    }

    pub(crate) fn at(directory: impl AsRef<Path>) -> Result<Self, AppError> {
        let directory = directory.as_ref();
        fs::create_dir_all(directory)
            .map_err(|error| AppError::io(directory.display().to_string(), &error))?;
        let session_id = Uuid::new_v4();
        let created_unix_seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| AppError::RecoverySnapshot {
                message: format!("system clock precedes Unix epoch: {error}"),
            })?
            .as_secs();
        Ok(Self {
            path: directory.join(format!("{session_id}.json")),
            document: SnapshotDocument {
                session_id,
                created_unix_seconds,
                entries: Vec::new(),
            },
        })
    }

    pub(crate) fn open_at(directory: &Path, session_id: Uuid) -> Result<Self, AppError> {
        let path = directory.join(format!("{session_id}.json"));
        if !path.is_file() {
            return Err(AppError::RecoverySessionNotFound {
                session_id: session_id.to_string(),
            });
        }
        let document = Self::read_document(&path)?;
        Ok(Self { path, document })
    }

    pub(crate) fn session_id(&self) -> Uuid {
        self.document.session_id
    }

    pub(crate) fn directory(&self) -> &Path {
        self.path
            .parent()
            .expect("recovery paths are always created below a directory")
    }

    pub(crate) fn entries(&self) -> &[SnapshotEntry] {
        &self.document.entries
    }

    pub(crate) fn begin_entry(
        &mut self,
        action: &RegistryAction,
        previous: RegistryValue,
    ) -> Result<usize, AppError> {
        self.document.entries.push(SnapshotEntry {
            action: action.clone(),
            previous,
            state: SnapshotEntryState::Pending,
        });
        self.persist()?;
        Ok(self.document.entries.len() - 1)
    }

    pub(crate) fn complete_entry(&mut self, index: usize) -> Result<(), AppError> {
        let entry =
            self.document
                .entries
                .get_mut(index)
                .ok_or_else(|| AppError::RecoverySnapshot {
                    message: format!("recovery entry index {index} does not exist"),
                })?;
        entry.state = SnapshotEntryState::Completed;
        self.persist()
    }

    pub(crate) fn current_user_directory() -> Result<PathBuf, AppError> {
        let app_data = env::var_os("APPDATA").ok_or_else(|| AppError::RecoverySnapshot {
            message: "APPDATA environment variable is unavailable".to_owned(),
        })?;
        Ok(PathBuf::from(app_data)
            .join("NativeOptimizer")
            .join("recovery"))
    }

    fn read_document(path: &Path) -> Result<SnapshotDocument, AppError> {
        let bytes =
            fs::read(path).map_err(|error| AppError::io(path.display().to_string(), &error))?;
        serde_json::from_slice(&bytes).map_err(|error| AppError::RecoverySnapshot {
            message: format!("{}: {error}", path.display()),
        })
    }

    fn persist(&self) -> Result<(), AppError> {
        let temporary = self.path.with_extension("json.tmp");
        let bytes = serde_json::to_vec_pretty(&self.document).map_err(|error| {
            AppError::RecoverySnapshot {
                message: error.to_string(),
            }
        })?;
        let mut file = fs::File::create(&temporary)
            .map_err(|error| AppError::io(temporary.display().to_string(), &error))?;
        file.write_all(&bytes)
            .and_then(|()| file.sync_all())
            .map_err(|error| AppError::io(temporary.display().to_string(), &error))?;
        fs::rename(&temporary, &self.path)
            .map_err(|error| AppError::io(self.path.display().to_string(), &error))
    }
}

impl SnapshotEntry {
    pub(crate) fn is_completed(&self) -> bool {
        self.state == SnapshotEntryState::Completed
    }
}

impl SnapshotDocument {
    fn summary(&self) -> Result<RecoverySessionSummary, AppError> {
        let entry_count =
            u32::try_from(self.entries.len()).map_err(|_| AppError::RecoverySnapshot {
                message: "snapshot entry count exceeds supported range".to_owned(),
            })?;
        Ok(RecoverySessionSummary {
            session_id: self.session_id.to_string(),
            created_unix_seconds: self.created_unix_seconds,
            entry_count,
        })
    }
}
