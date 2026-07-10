/**
 * ScriptNotes — ScriptNotesContent: FreeScript's notes anchored to script text
 * (filters, click-to-navigate, color sync), rendered as the Notes → Script
 * sub-view of the unified Sticky Notes pane (StickyNotes.tsx).
 * The standalone Notes panel this file used to render was merged into the
 * Sticky Notes pane; there is no default export anymore.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  useEditorStore,
  ELEMENT_LABELS,
  NOTE_COLORS,
  type NoteColor,
  type ElementType,
} from '../stores/editorStore';
import { useAssetStore, type Asset } from '../stores/assetStore';
import { useProjectStore } from '../stores/projectStore';
import { api } from '../services/api';
import { isTauri } from '../services/platform';

/** Open a URL in the default browser. Uses Tauri invoke on desktop, window.open on web. */
const openInBrowser = (url: string) => {
  if (isTauri()) {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('open_url', { url }).catch((err: unknown) => console.error('Failed to open URL:', err));
    });
  } else {
    window.open(url, '_blank');
  }
};

interface ScriptNotesContentProps {
  editor: Editor | null;
}

/** Shared date formatter for card/note headers (also used by StickyNotes). */
export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Resolve a NoteColor name to its hex value. */
const getNoteColorHex = (colorName: NoteColor): string => {
  const c = NOTE_COLORS.find((nc) => nc.name === colorName);
  return c ? c.hex : NOTE_COLORS[0].hex;
};

/** Sticky-card pastel backgrounds per note color (matches SHELF_COLORS). */
export const NOTE_STICKY_BG: Record<NoteColor, string> = {
  Yellow: '#fff9c4', Red: '#ffd9e7', Blue: '#d6ecff',
  Green: '#dcf5dc', Orange: '#ffe4c4', Purple: '#e9defa',
};

/** Check if a string looks like an image URL */
const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(url);

/** Check if a string looks like a video URL */
const isVideoUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) ||
  /youtube\.com\/watch|youtu\.be\/|vimeo\.com\//i.test(url);

/** Convert YouTube/Vimeo URL to embeddable URL */
const toEmbedUrl = (url: string): string | null => {
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  // Vimeo
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
};


/**
 * Render note content with media embeds and @asset references.
 * - URLs on their own line that look like images render as <img>
 * - URLs that look like videos render as <video> or iframe embed
 * - @AssetName references render as clickable asset links
 */
const NoteContentDisplay: React.FC<{
  content: string;
  assets: Asset[];
  projectId: string | null;
}> = ({ content, assets, projectId }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Image URL on its own line
    if (isImageUrl(line) && /^https?:\/\//.test(line)) {
      elements.push(
        <div key={i} className="note-media-embed">
          <img src={line} alt="" loading="lazy" />
        </div>,
      );
      continue;
    }

    // Video URL on its own line
    if (isVideoUrl(line) && /^https?:\/\//.test(line)) {
      const embedUrl = toEmbedUrl(line);
      if (embedUrl) {
        if (isTauri()) {
          // In Tauri, YouTube/Vimeo iframes don't work (origin restriction).
          // Show as a clickable link that opens in the default browser.
          elements.push(
            <div key={i} className="note-media-embed note-media-video">
              <a
                href={line}
                target="_blank"
                rel="noreferrer"
                className="note-video-link"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInBrowser(line); }}
              >
                {line}
              </a>
            </div>,
          );
        } else {
          elements.push(
            <div key={i} className="note-media-embed note-media-video">
              <iframe src={embedUrl} allowFullScreen title="video" />
            </div>,
          );
        }
      } else {
        elements.push(
          <div key={i} className="note-media-embed">
            <video src={line} controls preload="metadata" />
          </div>,
        );
      }
      continue;
    }

    // Parse @asset references inline
    const parts = line.split(/(@\S+)/g);
    const lineElements: React.ReactNode[] = [];
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j];
      if (part.startsWith('@')) {
        const assetName = part.slice(1);
        const asset = assets.find(
          (a) => a.original_name.toLowerCase() === assetName.toLowerCase() ||
                 a.original_name.replace(/\s+/g, '_').toLowerCase() === assetName.toLowerCase(),
        );
        if (asset) {
          const isImg = asset.mime_type.startsWith('image/');
          const url = projectId
            ? api.getAssetUrl(projectId, asset.id)
            : '#';
          if (isImg) {
            lineElements.push(
              <span key={j} className="note-asset-ref">
                <img src={url} alt={asset.original_name} className="note-asset-thumb" loading="lazy" />
                <span className="note-asset-name">{part}</span>
              </span>,
            );
          } else {
            lineElements.push(
              <a key={j} className="note-asset-ref note-asset-link" href={url} target="_blank" rel="noreferrer">
                {part}
              </a>,
            );
          }
        } else {
          lineElements.push(
            <span key={j} className="note-asset-ref note-asset-unresolved">{part}</span>,
          );
        }
      } else {
        // Detect URLs in plain text and render as clickable links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const textParts = part.split(urlRegex);
        for (let k = 0; k < textParts.length; k++) {
          const tp = textParts[k];
          if (urlRegex.test(tp)) {
            const handleClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              openInBrowser(tp);
            };
            lineElements.push(
              <a key={`${j}-${k}`} href={tp} target="_blank" rel="noreferrer" className="note-inline-link" onClick={handleClick}>
                {tp}
              </a>,
            );
          } else if (tp) {
            lineElements.push(<span key={`${j}-${k}`}>{tp}</span>);
          }
          // Reset regex lastIndex since we reuse it
          urlRegex.lastIndex = 0;
        }
      }
    }

    elements.push(
      <div key={i} className="note-content-line">
        {lineElements}
      </div>,
    );
  }

  return <div className="note-content-rendered">{elements}</div>;
};

/**
 * Script (anchored) notes — filter bar + note list + delete dialog.
 * Rendered as the "Script" tab inside the unified Sticky Notes pane.
 */
export const ScriptNotesContent: React.FC<ScriptNotesContentProps> = ({ editor }) => {
  const {
    notes,
    scenes,
    updateNote,
    deleteNote,
    noteFilter,
    setNoteFilter,
  } = useEditorStore();

  const { assets } = useAssetStore();
  const { currentProject } = useProjectStore();
  const projectId = currentProject?.id ?? null;

  // Track which note is being edited (shows textarea), null = preview mode for all
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // @asset autocomplete state
  const [assetQuery, setAssetQuery] = useState<string | null>(null);
  const [assetSuggestions, setAssetSuggestions] = useState<Asset[]>([]);
  const [assetSugIdx, setAssetSugIdx] = useState(0);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // When an external flow (⌥-click on a highlight, toolbar, context menu,
  // Navigator) targets a note, scroll its card into view and flash it —
  // the old filter bar that hid every other note is gone.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [flashNoteId, setFlashNoteId] = useState<string | null>(null);
  useEffect(() => {
    if (!noteFilter.noteId) return;
    const id = noteFilter.noteId;
    // Wait a frame so the pane/tab is mounted before scrolling
    requestAnimationFrame(() => {
      const el = cardRefs.current.get(id);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setFlashNoteId(id);
      setTimeout(() => setFlashNoteId((cur) => (cur === id ? null : cur)), 1600);
    });
    // consume the focus request so it can re-fire for the same note later
    setNoteFilter({ elementType: null, contextLabel: null, color: null, noteId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteFilter.noteId]);

  const filteredNotes = notes;

  const getSceneName = useCallback(
    (sceneId: string | null) => {
      if (!sceneId) return null;
      const scene = scenes.find((s) => s.id === sceneId);
      return scene ? scene.heading : null;
    },
    [scenes],
  );

  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(null);

  const handleDeleteRequest = useCallback((id: string) => {
    setPendingDeleteNoteId(id);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    const id = pendingDeleteNoteId;
    if (!id) return;
    setPendingDeleteNoteId(null);
    if (editor) {
      const { doc, schema } = editor.state;
      const markType = schema.marks.scriptNote;
      if (markType) {
        editor.chain().focus().command(({ tr }) => {
          doc.descendants((node, pos) => {
            if (!node.isText) return;
            const mark = node.marks.find(
              (m) => m.type === markType && m.attrs.noteId === id,
            );
            if (mark) {
              tr.removeMark(pos, pos + node.nodeSize, mark);
            }
          });
          return true;
        }).run();
      }
    }
    deleteNote(id);
  }, [editor, deleteNote, pendingDeleteNoteId]);

  const handleColorChange = useCallback(
    (id: string, color: NoteColor) => {
      updateNote(id, { color });
      if (editor) {
        const hex = getNoteColorHex(color);
        const { doc, schema } = editor.state;
        const markType = schema.marks.scriptNote;
        if (markType) {
          editor.chain().command(({ tr }) => {
            doc.descendants((node, pos) => {
              if (!node.isText) return;
              const mark = node.marks.find(
                (m) => m.type === markType && m.attrs.noteId === id,
              );
              if (mark) {
                tr.removeMark(pos, pos + node.nodeSize, mark);
                tr.addMark(pos, pos + node.nodeSize, markType.create({ noteId: id, color: hex }));
              }
            });
            return true;
          }).run();
        }
      }
    },
    [editor, updateNote],
  );

  const handleNavigateToNote = useCallback(
    (noteId: string) => {
      if (!editor) return;
      const { doc, schema } = editor.state;
      const markType = schema.marks.scriptNote;
      if (!markType) return;

      let targetPos: number | null = null;
      doc.descendants((node, pos) => {
        if (targetPos !== null) return false;
        if (!node.isText) return;
        const mark = node.marks.find(
          (m) => m.type === markType && m.attrs.noteId === noteId,
        );
        if (mark) {
          targetPos = pos;
          return false;
        }
      });

      if (targetPos !== null) {
        editor.chain().focus().setTextSelection(targetPos).run();
        const coords = editor.view.coordsAtPos(targetPos);
        const editorMain = document.querySelector('.editor-main');
        if (editorMain && coords) {
          const rect = editorMain.getBoundingClientRect();
          const scrollTo = editorMain.scrollTop + (coords.top - rect.top) - rect.height / 3;
          editorMain.scrollTo({ top: scrollTo, behavior: 'auto' });
        }
      }
    },
    [editor],
  );

  /** Handle @asset autocomplete inside textarea */
  const handleTextareaChange = useCallback(
    (noteId: string, value: string) => {
      updateNote(noteId, { content: value });

      // Check for @mention trigger
      const textarea = textareaRefs.current.get(noteId);
      if (!textarea) return;
      const cursor = textarea.selectionStart;
      const before = value.slice(0, cursor);
      const atMatch = before.match(/@(\S*)$/);
      if (atMatch) {
        const query = atMatch[1].toLowerCase();
        setAssetQuery(query);
        const matches = assets.filter(
          (a) =>
            a.original_name.toLowerCase().includes(query) ||
            a.original_name.replace(/\s+/g, '_').toLowerCase().includes(query),
        ).slice(0, 8);
        setAssetSuggestions(matches);
        setAssetSugIdx(0);
      } else {
        setAssetQuery(null);
        setAssetSuggestions([]);
      }
    },
    [updateNote, assets],
  );

  const insertAssetRef = useCallback(
    (noteId: string, asset: Asset) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      const textarea = textareaRefs.current.get(noteId);
      if (!textarea) return;

      const cursor = textarea.selectionStart;
      const before = note.content.slice(0, cursor);
      const after = note.content.slice(cursor);
      const atMatch = before.match(/@(\S*)$/);
      if (!atMatch) return;

      const prefix = before.slice(0, before.length - atMatch[0].length);
      const ref = `@${asset.original_name.replace(/\s+/g, '_')}`;
      const newContent = prefix + ref + ' ' + after;
      updateNote(noteId, { content: newContent });

      setAssetQuery(null);
      setAssetSuggestions([]);

      // Restore cursor position after insert
      requestAnimationFrame(() => {
        const pos = prefix.length + ref.length + 1;
        textarea.setSelectionRange(pos, pos);
        textarea.focus();
      });
    },
    [notes, updateNote],
  );

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, noteId: string) => {
      if (assetSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setAssetSugIdx((i) => Math.min(i + 1, assetSuggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setAssetSugIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertAssetRef(noteId, assetSuggestions[assetSugIdx]);
        } else if (e.key === 'Escape') {
          setAssetQuery(null);
          setAssetSuggestions([]);
        }
      }
    },
    [assetSuggestions, assetSugIdx, insertAssetRef],
  );

  return (
    <>
      {/* ── Notes list ── */}
      <div className="script-notes-list">
        {filteredNotes.length === 0 ? (
          <div className="script-notes-empty">
            No notes yet. Select text in the editor, right-click, and choose "Add Script Note".
          </div>
        ) : (
          filteredNotes.map((note) => {
            const hex = getNoteColorHex(note.color);
            const sceneName = getSceneName(note.sceneId);
            const elemLabel = ELEMENT_LABELS[note.elementType as ElementType] || note.elementType;
            const isEditing = editingNoteId === note.id;

            return (
              <div
                key={note.id}
                ref={(el) => { if (el) cardRefs.current.set(note.id, el); else cardRefs.current.delete(note.id); }}
                className={`note-item${flashNoteId === note.id ? ' note-item-flash' : ''}`}
                style={{ background: NOTE_STICKY_BG[note.color] || NOTE_STICKY_BG.Yellow, borderTopColor: hex }}
              >
                <div className="note-item-header">
                  <div className="note-item-context">
                    <span className="note-item-element">{elemLabel}</span>
                    {note.contextLabel && (
                      <span className="note-item-ctx-label">{note.contextLabel}</span>
                    )}
                    {sceneName && (
                      <span className="note-item-scene">{sceneName}</span>
                    )}
                  </div>
                  <span className="note-item-date">{formatDate(note.createdAt)}</span>
                </div>

                {note.anchorText && (
                  <div
                    className="note-item-anchor"
                    onClick={() => handleNavigateToNote(note.id)}
                    title="Click to navigate to this text"
                  >
                    &ldquo;{note.anchorText}&rdquo;
                  </div>
                )}

                {/* Note content: edit mode or rendered preview */}
                {isEditing ? (
                  <div className="note-edit-area">
                    <textarea
                      ref={(el) => {
                        if (el) textareaRefs.current.set(note.id, el);
                      }}
                      className="note-item-content"
                      value={note.content}
                      onChange={(e) => handleTextareaChange(note.id, e.target.value)}
                      onKeyDown={(e) => handleTextareaKeyDown(e, note.id)}
                      onBlur={() => {
                        // Delay to allow suggestion click
                        setTimeout(() => {
                          setEditingNoteId(null);
                          setAssetQuery(null);
                          setAssetSuggestions([]);
                        }, 200);
                      }}
                      placeholder="Write your note... (use @filename to reference assets, paste media URLs on their own line)"
                      rows={3}
                      autoFocus
                    />
                    {assetSuggestions.length > 0 && assetQuery !== null && (
                      <div className="note-asset-dropdown">
                        {assetSuggestions.map((a, idx) => (
                          <div
                            key={a.id}
                            className={`note-asset-option${idx === assetSugIdx ? ' selected' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              insertAssetRef(note.id, a);
                            }}
                          >
                            <span className="note-asset-option-icon">
                              {a.mime_type.startsWith('image/') ? '🖼' : a.mime_type.startsWith('video/') ? '🎬' : '📎'}
                            </span>
                            <span className="note-asset-option-name">{a.original_name}</span>
                            <span className="note-asset-option-tags">
                              {a.tags.slice(0, 2).join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="note-item-preview"
                    onClick={() => setEditingNoteId(note.id)}
                    title="Click to edit"
                  >
                    {note.content ? (
                      <NoteContentDisplay
                        content={note.content}
                        assets={assets}
                        projectId={projectId}
                      />
                    ) : (
                      <span className="note-item-placeholder">Click to add note...</span>
                    )}
                  </div>
                )}

                <div className="note-item-actions">
                  <div className="note-item-colors">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`note-color-dot${note.color === c.name ? ' active' : ''}`}
                        style={{ background: c.hex }}
                        onClick={() => handleColorChange(note.id, c.name)}
                        title={c.name}
                      />
                    ))}
                  </div>
                  <button
                    className="note-item-delete"
                    onClick={() => handleDeleteRequest(note.id)}
                    title="Delete note"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {pendingDeleteNoteId && (
        <div className="dialog-overlay" onClick={() => setPendingDeleteNoteId(null)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Delete Note</div>
            <div className="dialog-body">
              <p style={{ margin: 0 }}>Delete this note? The highlight will also be removed from the script.</p>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setPendingDeleteNoteId(null)}>Cancel</button>
              <button className="dialog-primary" style={{ background: '#c0392b' }} onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
