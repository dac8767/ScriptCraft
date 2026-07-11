/**
 * Marker placed on the dataTransfer of drags that originate INSIDE the app
 * (e.g. reordering rows in Customize).
 *
 * The editor listens for file drops to open screenplays. In a browser those
 * are distinguished by `dataTransfer.types.includes('Files')`, but the Tauri
 * webview does not report internal drags the same way, so an internal reorder
 * was raising the "Drop screenplay file to open" overlay. Any drag carrying
 * this type is an internal one and must be ignored by file-drop handlers.
 */
export const INTERNAL_DRAG_TYPE = 'application/x-freedraft-internal';
