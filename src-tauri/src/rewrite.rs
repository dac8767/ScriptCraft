//! Action-line rewrite command (v5.54 — integrated from Derek's design
//! handoff; see docs/ACTION-REWRITE.md for the rationale behind every
//! decision here).
//!
//! The API key never reaches the webview: it lives in the OS keychain and is
//! read here, on the Rust side, immediately before the request.
//!
//! The system prompt is compiled in via `include_str!` so that the cached
//! prefix is byte-identical on every call. Do not build it dynamically —
//! any per-call variation kills the prompt cache.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

const SYSTEM_PROMPT: &str = include_str!("../prompts/action_line_rewrite.md");

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";

/// Sonnet 5 balances quality against the latency budget of an inline editor
/// action. Swap to "claude-opus-5" if you'd rather wait for the best pass.
const MODEL: &str = "claude-sonnet-5";
const MAX_TOKENS: u32 = 2048;

/// Ceiling on the writer's note. Enforced here as well as in the UI, since the
/// command is callable independently of the panel.
const MAX_NOTE_CHARS: usize = 300;

/// Keychain coordinates. SERVICE is the app's bundle identifier — the
/// com.freedraft.app id is a persisted identifier (CLAUDE.md naming rule),
/// so the keychain entry survives app renames.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const KEYCHAIN_SERVICE: &str = "com.freedraft.app";
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const KEYCHAIN_USER: &str = "anthropic_api_key";

// ---------------------------------------------------------------------------
// Public types (mirrored in frontend/src/utils/actionRewrite.ts)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriteRequest {
    /// The resolved target text — whole action paragraphs, blank-line joined.
    pub selection: String,
    /// Nearest preceding scene heading, e.g. "INT. PRISON CELL - NIGHT".
    #[serde(default)]
    pub scene_heading: Option<String>,
    /// Action paragraphs immediately before the target, in script order.
    #[serde(default)]
    pub preceding: Vec<String>,
    /// Action paragraphs immediately after the target, in script order.
    #[serde(default)]
    pub following: Vec<String>,
    /// Characters established as present in this scene.
    #[serde(default)]
    pub characters: Vec<String>,
    /// Most recent dialogue beat before the target, pre-formatted "NAME: line".
    #[serde(default)]
    pub preceding_dialogue: Option<String>,
    /// True when this location already appeared in an earlier scene heading.
    #[serde(default)]
    pub location_established: bool,
    /// Names in the target making their first appearance in the script.
    #[serde(default)]
    pub first_appearances: Vec<String>,
    /// Optional free-text direction from the writer: what they're going for in
    /// this moment, or what must survive the rewrite. Replaced an earlier enum
    /// of preset steers. Named `writer_note` rather than `note` to avoid
    /// colliding with RewriteVariant::note, which is the model's craft
    /// explanation and travels in the opposite direction.
    #[serde(default)]
    pub writer_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriteVariant {
    /// "faithful" | "compressed" | "reimagined"
    pub strategy: String,
    pub text: String,
    /// The model's one-line explanation of what it changed and why.
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriteResponse {
    /// "improvable" | "already_strong"
    pub assessment: String,
    pub variants: Vec<RewriteVariant>,
}

// ---------------------------------------------------------------------------
// Anthropic response shape (only the fields we need)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct ApiResponse {
    #[serde(default)]
    content: Vec<ContentBlock>,
    #[serde(default)]
    error: Option<ApiError>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    #[serde(default)]
    message: String,
}

// ---------------------------------------------------------------------------
// Key management. Desktop targets keep the key in the OS keychain via the
// `keyring` crate; Android/iOS builds compile stubs that report the feature
// as desktop-only (the crate has no store there, and this app's mobile
// builds must keep compiling — the wry-pin comments in Cargo.toml exist
// because they do get built).
// ---------------------------------------------------------------------------

#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod keys {
    use super::{KEYCHAIN_SERVICE, KEYCHAIN_USER};
    use keyring::Entry;

    fn keychain() -> Result<Entry, String> {
        Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER)
            .map_err(|e| format!("Could not open keychain: {e}"))
    }

    pub fn save(key: &str) -> Result<(), String> {
        keychain()?
            .set_password(key)
            .map_err(|e| format!("Could not save API key: {e}"))
    }

    pub fn has() -> bool {
        keychain()
            .and_then(|e| e.get_password().map_err(|e| e.to_string()))
            .map(|k| !k.trim().is_empty())
            .unwrap_or(false)
    }

    pub fn clear() -> Result<(), String> {
        match keychain()?.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Could not clear API key: {e}")),
        }
    }

    pub fn read() -> Result<String, String> {
        match keychain()?.get_password() {
            Ok(k) if !k.trim().is_empty() => Ok(k),
            Ok(_) | Err(keyring::Error::NoEntry) => {
                Err("No API key saved. Add one in the Action Rewrite panel.".into())
            }
            Err(e) => Err(format!("Could not read API key: {e}")),
        }
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
mod keys {
    const MOBILE_MSG: &str = "API key storage is desktop-only for now.";

    pub fn save(_key: &str) -> Result<(), String> {
        Err(MOBILE_MSG.into())
    }
    pub fn has() -> bool {
        false
    }
    pub fn clear() -> Result<(), String> {
        Ok(())
    }
    pub fn read() -> Result<String, String> {
        Err(MOBILE_MSG.into())
    }
}

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("API key is empty.".into());
    }
    keys::save(key)
}

#[tauri::command]
pub fn has_api_key() -> bool {
    keys::has()
}

#[tauri::command]
pub fn clear_api_key() -> Result<(), String> {
    keys::clear()
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

/// Flattens and caps the writer's note.
///
/// Newlines are collapsed to spaces so a multi-line note cannot introduce what
/// looks like another labelled section. `chars().take` rather than byte slicing,
/// so a note ending in a multi-byte character can't panic.
fn clean_note(note: &Option<String>) -> Option<String> {
    let raw = note.as_deref()?.trim();
    if raw.is_empty() {
        return None;
    }
    let flattened = raw
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    Some(flattened.chars().take(MAX_NOTE_CHARS).collect())
}

fn push_section(out: &mut String, label: &str, body: &str) {
    out.push_str(label);
    out.push_str(":\n");
    out.push_str(body);
    out.push_str("\n\n");
}

/// Everything that varies per call goes in the user turn, keeping the cached
/// system prefix stable. Absent context is omitted rather than sent empty —
/// an empty CONTEXT BEFORE is itself meaningful (top of scene).
fn build_user_message(req: &RewriteRequest) -> String {
    let mut out = String::new();

    if let Some(heading) = req.scene_heading.as_deref().map(str::trim) {
        if !heading.is_empty() {
            push_section(&mut out, "SCENE HEADING", heading);
        }
    }

    if req.location_established {
        out.push_str("LOCATION PREVIOUSLY ESTABLISHED: yes\n\n");
    }

    if !req.characters.is_empty() {
        push_section(&mut out, "CHARACTERS PRESENT", &req.characters.join(", "));
    }

    if !req.first_appearances.is_empty() {
        push_section(
            &mut out,
            "FIRST APPEARANCE IN SCRIPT",
            &req.first_appearances.join(", "),
        );
    }

    if req.preceding.is_empty() {
        out.push_str("POSITION: opens the scene\n\n");
    } else {
        push_section(
            &mut out,
            "CONTEXT BEFORE (do not rewrite)",
            &req.preceding.join("\n\n"),
        );
    }

    if let Some(line) = req.preceding_dialogue.as_deref().map(str::trim) {
        if !line.is_empty() {
            push_section(&mut out, "DIALOGUE JUST BEFORE (do not rewrite)", line);
        }
    }

    push_section(&mut out, "PASSAGE TO REWRITE", req.selection.trim());

    if !req.following.is_empty() {
        push_section(
            &mut out,
            "CONTEXT AFTER (do not rewrite)",
            &req.following.join("\n\n"),
        );
    }

    // Last, so it's the freshest thing before the instruction to answer.
    if let Some(note) = clean_note(&req.writer_note) {
        push_section(&mut out, "WRITER'S NOTE", &note);
    }

    out.push_str("Return the JSON object only.");
    out
}

/// Models occasionally wrap JSON in prose or fences despite instructions.
/// Take the outermost brace pair.
fn extract_json(raw: &str) -> Result<&str, String> {
    let start = raw
        .find('{')
        .ok_or_else(|| format!("No JSON in model response: {raw}"))?;
    let end = raw
        .rfind('}')
        .ok_or_else(|| format!("Unterminated JSON in model response: {raw}"))?;
    if end <= start {
        return Err(format!("Malformed JSON in model response: {raw}"));
    }
    Ok(&raw[start..=end])
}

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn rewrite_action_lines(req: RewriteRequest) -> Result<RewriteResponse, String> {
    if req.selection.trim().is_empty() {
        return Err("Nothing selected.".into());
    }

    let api_key = keys::read()?;

    let body = json!({
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        // High temperature on purpose: the three variants should diverge in
        // interpretation. Lowering this collapses them toward each other.
        "temperature": 1.0,
        "system": [{
            "type": "text",
            "text": SYSTEM_PROMPT,
            // Caches the craft rules and calibration examples across calls.
            // 5-minute TTL (the default), refreshed on every hit. Break-even is
            // well under one read, so clustered rewrites are a clear win; an
            // isolated rewrite costs 1.25x. Do not switch to ttl "1h" without
            // evidence of 2+ reads per hour. See docs/ACTION-REWRITE.md.
            "cache_control": { "type": "ephemeral" }
        }],
        "messages": [{
            "role": "user",
            "content": build_user_message(&req)
        }]
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    // Serialized by hand (`.body`, not `.json`) — this app's reqwest is built
    // without the `json` feature and there's no reason to widen it for this.
    let http = client
        .post(API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", API_VERSION)
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let status = http.status();
    let payload = http
        .text()
        .await
        .map_err(|e| format!("Could not read response: {e}"))?;

    let parsed: ApiResponse = serde_json::from_str(&payload)
        .map_err(|e| format!("Unexpected response ({status}): {e} — {payload}"))?;

    if let Some(err) = parsed.error {
        return Err(match status.as_u16() {
            401 => "API key rejected. Check it in the Action Rewrite panel.".to_string(),
            429 => "Rate limited. Try again in a moment.".to_string(),
            _ => format!("API error: {}", err.message),
        });
    }

    let text = parsed
        .content
        .iter()
        .filter(|b| b.kind == "text")
        .filter_map(|b| b.text.as_deref())
        .collect::<Vec<_>>()
        .join("\n");

    if text.trim().is_empty() {
        return Err("Model returned no text.".into());
    }

    let mut result: RewriteResponse = serde_json::from_str(extract_json(&text)?)
        .map_err(|e| format!("Could not parse suggestions: {e} — {text}"))?;

    // Stable UI order regardless of what the model emits: least license first,
    // most license last.
    let rank = |s: &str| match s {
        "faithful" => 0,
        "compressed" => 1,
        "reimagined" => 2,
        _ => 3,
    };
    result.variants.sort_by_key(|v| rank(&v.strategy));

    if result.variants.is_empty() {
        return Err("Model returned no variants.".into());
    }

    Ok(result)
}
