//! Append-only local log of rewrite suggestions and what the writer did with
//! them.
//!
//! Purpose: answer design questions with data instead of argument. Does
//! `compressed` win most of the time? Is `reimagined` dead weight? Are three
//! variants even the right number? Nothing currently observes any of this.
//!
//! Second purpose, and the more valuable one: when the writer accepts a variant
//! and then edits it, that edit is a before/after pair drawn from real use.
//! Those are the calibration examples the system prompt wants, and they are
//! better than anything written deliberately in a design session.
//!
//! Format is JSONL, two record kinds keyed by a shared `event_id`:
//!   - `kind: "suggestion"` written when the API returns
//!   - `kind: "outcome"`    written when the writer accepts, edits, or dismisses
//!
//! Append-only rather than mutate-in-place: no schema migration, no partial
//! write corrupting an existing record, and `tail -f` works while debugging.
//!
//! The log contains script text and lives only on this machine, under the app
//! data directory. `clear_rewrite_log` deletes it. Nothing is transmitted.

use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const LOG_FILE: &str = "rewrite-log.jsonl";

/// Disambiguates events written in the same millisecond. Avoids a uuid dep.
static COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn new_event_id() -> String {
    format!("{}-{}", now_ms(), COUNTER.fetch_add(1, Ordering::Relaxed))
}

fn log_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {dir:?}: {e}"))?;
    Ok(dir.join(LOG_FILE))
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggedVariant {
    pub strategy: String,
    pub text: String,
    pub note: String,
}

/// Written when suggestions come back. Context is recorded as flags rather than
/// full text: enough to segment the data later without storing the whole scene
/// three times over.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionRecord {
    pub kind: &'static str,
    pub event_id: String,
    pub ts_ms: u64,
    pub original: String,
    pub scene_heading: Option<String>,
    pub location_established: bool,
    pub opened_scene: bool,
    pub had_preceding_dialogue: bool,
    pub writer_note: Option<String>,
    pub assessment: String,
    pub variants: Vec<LoggedVariant>,
    pub latency_ms: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
}

/// Written when the writer resolves the panel.
///
/// `final_text` is the field that matters. If it differs from the accepted
/// variant, the difference is the writer correcting the model, which is the
/// single most useful signal this log collects.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutcomeInput {
    pub event_id: String,
    /// "accepted" | "dismissed"
    pub outcome: String,
    pub chosen_strategy: Option<String>,
    pub final_text: Option<String>,
    /// "none" | "punctuation" | "minor" | "substantive" | "composed", from the
    /// TS side. Classified there because that is where the offered text and the
    /// writer's draft sit side by side.
    pub edit_kind: Option<String>,
    /// For composed drafts: which model variants contributed beats. Empty means
    /// the writer typed it from scratch. This is how you find out whether the
    /// three slots are carving the space usefully.
    #[serde(default)]
    pub composed_from: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OutcomeRecord {
    kind: &'static str,
    event_id: String,
    ts_ms: u64,
    outcome: String,
    chosen_strategy: Option<String>,
    final_text: Option<String>,
    edit_kind: Option<String>,
    composed_from: Option<Vec<String>>,
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

fn append_line(app: &tauri::AppHandle, line: &str) -> Result<(), String> {
    let path = log_path(app)?;
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Could not open log: {e}"))?;
    writeln!(f, "{line}").map_err(|e| format!("Could not write log: {e}"))
}

/// Logging must never break the feature. A failure here is reported to the
/// caller but the rewrite command deliberately ignores it.
pub fn append_suggestion(
    app: &tauri::AppHandle,
    record: &SuggestionRecord,
) -> Result<(), String> {
    let line = serde_json::to_string(record).map_err(|e| format!("Serialize failed: {e}"))?;
    append_line(app, &line)
}

#[tauri::command]
pub fn record_rewrite_outcome(
    app: tauri::AppHandle,
    outcome: OutcomeInput,
) -> Result<(), String> {
    let record = OutcomeRecord {
        kind: "outcome",
        event_id: outcome.event_id,
        ts_ms: now_ms(),
        outcome: outcome.outcome,
        chosen_strategy: outcome.chosen_strategy,
        final_text: outcome.final_text,
        edit_kind: outcome.edit_kind,
        composed_from: outcome.composed_from,
    };
    let line = serde_json::to_string(&record).map_err(|e| format!("Serialize failed: {e}"))?;
    append_line(&app, &line)
}

// ---------------------------------------------------------------------------
// Reading and management
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogStats {
    pub suggestions: u64,
    pub accepted: u64,
    pub dismissed: u64,
    /// Accepts where the writer changed the text in any way.
    pub edited_after_accept: u64,
    /// Accepts with a substantive edit. These are the calibration candidates;
    /// a punctuation swap teaches nothing.
    pub edited_substantive: u64,
    /// Accepts taken from the custom slot. Entirely the writer's voice, so the
    /// best calibration material the log collects.
    pub composed: u64,
    /// How often each variant contributed a beat to a composed draft. A variant
    /// that never contributes is not earning its latency.
    pub contributed: Vec<(String, u64)>,
    pub by_strategy: Vec<(String, u64)>,
    pub path: String,
    pub bytes: u64,
}

#[tauri::command]
pub fn rewrite_log_stats(app: tauri::AppHandle) -> Result<LogStats, String> {
    let path = log_path(&app)?;
    let mut stats = LogStats {
        suggestions: 0,
        accepted: 0,
        dismissed: 0,
        edited_after_accept: 0,
        edited_substantive: 0,
        composed: 0,
        contributed: Vec::new(),
        by_strategy: Vec::new(),
        path: path.to_string_lossy().to_string(),
        bytes: 0,
    };

    let text = match fs::read_to_string(&path) {
        Ok(t) => t,
        Err(_) => return Ok(stats), // no log yet
    };
    stats.bytes = text.len() as u64;

    // event_id -> accepted variant text, for detecting post-accept edits.
    let mut accepted_text: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    let mut contrib: std::collections::HashMap<String, u64> = std::collections::HashMap::new();

    for line in text.lines().filter(|l| !l.trim().is_empty()) {
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue, // tolerate a torn final line
        };
        match v.get("kind").and_then(|k| k.as_str()) {
            Some("suggestion") => {
                stats.suggestions += 1;
                if let (Some(id), Some(vars)) = (
                    v.get("eventId").and_then(|x| x.as_str()),
                    v.get("variants").and_then(|x| x.as_array()),
                ) {
                    for var in vars {
                        if let (Some(s), Some(t)) = (
                            var.get("strategy").and_then(|x| x.as_str()),
                            var.get("text").and_then(|x| x.as_str()),
                        ) {
                            accepted_text.insert(format!("{id}::{s}"), t.to_string());
                        }
                    }
                }
            }
            Some("outcome") => {
                let outcome = v.get("outcome").and_then(|x| x.as_str()).unwrap_or("");
                if outcome == "accepted" {
                    stats.accepted += 1;
                    if let Some(s) = v.get("chosenStrategy").and_then(|x| x.as_str()) {
                        *counts.entry(s.to_string()).or_insert(0) += 1;
                        // Prefer the recorded classification. Fall back to a
                        // text comparison for records written before edit_kind
                        // existed.
                        if let Some(list) = v.get("composedFrom").and_then(|x| x.as_array()) {
                            for from in list.iter().filter_map(|x| x.as_str()) {
                                *contrib.entry(from.to_string()).or_insert(0) += 1;
                            }
                        }
                        match v.get("editKind").and_then(|x| x.as_str()) {
                            Some("composed") => {
                                stats.composed += 1;
                            }
                            Some("substantive") => {
                                stats.edited_after_accept += 1;
                                stats.edited_substantive += 1;
                            }
                            Some("minor") | Some("punctuation") => {
                                stats.edited_after_accept += 1;
                            }
                            Some("none") => {}
                            _ => {
                                let id =
                                    v.get("eventId").and_then(|x| x.as_str()).unwrap_or("");
                                let offered = accepted_text.get(&format!("{id}::{s}"));
                                let final_text = v.get("finalText").and_then(|x| x.as_str());
                                if let (Some(o), Some(f)) = (offered, final_text) {
                                    if o.trim() != f.trim() {
                                        stats.edited_after_accept += 1;
                                    }
                                }
                            }
                        }
                    }
                } else if outcome == "dismissed" {
                    stats.dismissed += 1;
                }
            }
            _ => {}
        }
    }

    let mut by: Vec<(String, u64)> = counts.into_iter().collect();
    by.sort_by(|a, b| b.1.cmp(&a.1));
    stats.by_strategy = by;

    let mut con: Vec<(String, u64)> = contrib.into_iter().collect();
    con.sort_by(|a, b| b.1.cmp(&a.1));
    stats.contributed = con;

    Ok(stats)
}

#[tauri::command]
pub fn rewrite_log_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(log_path(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn clear_rewrite_log(app: tauri::AppHandle) -> Result<(), String> {
    let path = log_path(&app)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Could not delete log: {e}")),
    }
}
