import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FaChevronRight, FaChevronDown, FaExpandAlt } from 'react-icons/fa';
import type { Editor } from '@tiptap/react';
import DOMPurify from 'dompurify';
import { useDelayedUnmount, useSwipeDismiss } from '../hooks/useTouch';
import { useEditorStore, type CharacterProfile } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useAssetStore } from '../stores/assetStore';
import { api } from '../services/api';
import { showToast } from './Toast';
import MiniRichText from './MiniRichText';
import { RelationshipMap } from './RelationshipMap';
import { toTitleCaseName, lastNameOf, joinName, escapeRegExp } from '../utils/characterNames';
import { buildScanList, type ScannedCharacter } from '../utils/characterScan';
import { InlineRelForm, REL_TYPES, REL_DYNAMICS } from './InlineRelForm';
import { AssetImage, AssetAudio, UploadImageButton } from './CharacterAssetMedia';

// Default colors for auto-assignment (VIBGYOR palette)
const DEFAULT_HIGHLIGHT_COLORS = [
  '#8b5cf6', '#4f46e5', '#2563eb', '#059669', '#eab308',
  '#f97316', '#ef4444', '#000000',
];

/** Strip HTML tags to get plain text (for collapsed preview and FDX export) */
function stripHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).replace(/\s+/g, ' ').trim();
}

interface CharacterProfilesProps {
  /** Render inside a tool window: always visible, no close button/swipe */
  embedded?: boolean;
  /** v4.16: rendered as the full editor-area takeover (Scrapbook-style). */
  fullscreen?: boolean;
  editor: Editor | null;
  projectId: string;
  style?: React.CSSProperties;
}

const CharacterProfiles: React.FC<CharacterProfilesProps> = ({ editor, projectId, style, embedded = false, fullscreen = false }) => {
  const {
    characters,
    characterProfiles,
    upsertCharacterProfile,
    deleteCharacterProfile,
    characterRelationships,
    upsertCharacterRelationship,
    deleteCharacterRelationship,
    characterCustomFields,
    addCharacterCustomField,
    renameCharacterCustomField,
    removeCharacterCustomField,
    characterProfilesOpen,
    toggleCharacterProfiles,
    selectedCharacter,
    setSelectedCharacter,
    referredTags,
    setReferredTag,
  } = useEditorStore();

  const currentScriptId = useProjectStore((s) => s.currentScriptId);
  const { assets, setAssets } = useAssetStore();

  const [activeTab, setActiveTab] = useState<'profiles' | 'relationships' | 'setup'>('profiles');
  // v4.23, Derek: the relationship map is no longer its own tab — it's a
  // List/Map view toggle inside Relationships, mirroring Profiles' Cards/List.
  const [relViewMode, setRelViewMode] = useState<'list' | 'map'>('list');
  const [addRelFor, setAddRelFor] = useState<string | null>(null); // character name to add rel for
  const [expandedChar, setExpandedChar] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const sortBy = useEditorStore((s) => s.characterSortBy);
  const setSortBy = useEditorStore((s) => s.setCharacterSortBy);
  const [pendingRemoveChar, setPendingRemoveChar] = useState<string | null>(null);
  // v4.23, Derek: "From Script" tab — "Scan Script" is now a discovery step. It
  // fills this list with every character found in the script (speaking cues +
  // referred names), each carrying a description/age pulled from the action line
  // that introduces them. Nothing is created until the writer clicks Add on a
  // row. null = not scanned yet this session.
  const [scanResults, setScanResults] = useState<ScannedCharacter[] | null>(null);
  const isFullscreen = fullscreen;
  // v4.16: fullscreen is the Scrapbook-style editor takeover (a store flag),
  // not a fixed overlay that covered the toolbar with no way out. Entering
  // clears the docked/floating instance so only the takeover renders; the
  // ribbon's "Return to Editor" button (and this header button) exits.
  const enterCharFullscreen = () => {
    const s = useEditorStore.getState();
    if (s.activeTool === 'characters') s.setActiveTool(null);
    if (s.activeToolRight === 'characters') s.setActiveToolRight(null);
    if (s.tempTool === 'characters') s.setTempTool(null);
    s.setCharFullscreen(true);
  };
  const exitCharFullscreen = () => useEditorStore.getState().setCharFullscreen(false);
  const [fsViewMode, setFsViewMode] = useState<'cards' | 'list'>('cards');
  // v4.18: portal target in the header for the Relationship Map's toolbar.
  const [mapHeaderSlot, setMapHeaderSlot] = useState<HTMLElement | null>(null);
  const [modalChar, setModalChar] = useState<string | null>(null);

  // Image picker state
  const [imagePickerFor, setImagePickerFor] = useState<string | null>(null);
  const [imagePickerFilter, setImagePickerFilter] = useState('');
  const [lightboxImage, setLightboxImage] = useState<{ assetId: string; name: string } | null>(null);
  // v4.22, Derek: per-character slideshow position.
  const [imgIdx, setImgIdx] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // v4.23, Derek: Voice Profile — an uploaded audio reference clip per character.
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const voiceTargetRef = useRef<string | null>(null);
  const [voiceUploading, setVoiceUploading] = useState(false);

  // Fetch project assets when image picker opens
  const fetchAssets = useCallback(async () => {
    if (!projectId) return;
    try {
      const list = await api.listAssets(projectId);
      setAssets(list);
    } catch (err) {
      console.warn('Failed to fetch assets:', err);
    }
  }, [projectId, setAssets]);

  useEffect(() => {
    if (imagePickerFor && projectId) fetchAssets();
  }, [imagePickerFor, projectId, fetchAssets]);

  // When a character is clicked in the editor, expand it in the panel
  useEffect(() => {
    if (selectedCharacter) {
      setExpandedChar(selectedCharacter);
      setSelectedCharacter(null);
      setTimeout(() => {
        const card = document.querySelector(`[data-char-name="${selectedCharacter}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [selectedCharacter, setSelectedCharacter]);

  // Character cues present in the script RIGHT NOW. Scanned straight from the
  // doc so we never depend on the store's `characters` timing (updateCharacters
  // only fires when the cursor leaves a character node, so that list goes stale
  // the moment a cue is deleted — which is exactly when Remove needs the truth).
  // This is the single source of "who is in the script" for this panel.
  const scriptCharacterNames = useMemo(() => {
    const names = new Set<string>();
    if (!editor) return names;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'character') {
        const base = node.textContent.trim().replace(/\s*\([^)]*\)\s*/g, '').toUpperCase();
        if (base) names.add(base);
      }
      return true;
    });
    return names;
  }, [editor, editor?.state.doc]);

  // Auto-sync: ensure every character CURRENTLY in the script has a profile
  // entry. Driven by scriptCharacterNames (not the stale `characters` store) so
  // a name the writer just removed can't resurrect its profile after Remove.
  useEffect(() => {
    for (const name of scriptCharacterNames) {
      if (!characterProfiles.find((p) => p.name === name)) {
        const colorIdx = characterProfiles.length % DEFAULT_HIGHLIGHT_COLORS.length;
        upsertCharacterProfile(name, { color: DEFAULT_HIGHLIGHT_COLORS[colorIdx] });
      }
    }
  }, [scriptCharacterNames, characterProfiles, upsertCharacterProfile]);

  // "Scan Script" (handleScanScript) and applyScanResult live further down, next
  // to the "referred in script" detection they now fold into one list.

  // Compute stats per character: dialogue count, scene appearances, order of appearance
  interface CharStats { dialogueCount: number; sceneCount: number; scenes: string[]; appearanceOrder: number }
  const charStats = useMemo((): Map<string, CharStats> => {
    if (!editor) return new Map();
    const stats = new Map<string, { dialogueCount: number; scenes: Set<string>; appearanceOrder: number }>();

    let currentScene = '';
    let currentChar = '';
    let orderCounter = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'sceneHeading') {
        currentScene = node.textContent.trim();
      }
      if (node.type.name === 'character') {
        currentChar = node.textContent.trim().replace(/\s*\([^)]*\)\s*/g, '').toUpperCase();
        if (!stats.has(currentChar)) {
          stats.set(currentChar, { dialogueCount: 0, scenes: new Set(), appearanceOrder: orderCounter++ });
        }
        const s = stats.get(currentChar)!;
        if (currentScene) s.scenes.add(currentScene);
      }
      if (node.type.name === 'dialogue' && currentChar) {
        const s = stats.get(currentChar);
        if (s) s.dialogueCount++;
      }
      return true;
    });

    const result = new Map<string, CharStats>();
    for (const [name, s] of stats) {
      result.set(name, { dialogueCount: s.dialogueCount, sceneCount: s.scenes.size, scenes: Array.from(s.scenes), appearanceOrder: s.appearanceOrder });
    }
    return result;
  }, [editor, editor?.state.doc]);

  /** Navigate to first appearance of a character in the script */
  const handleNavigateToCharacter = useCallback(
    (name: string) => {
      if (!editor) return;
      const upper = name.toUpperCase();
      let targetPos: number | null = null;

      editor.state.doc.descendants((node, pos) => {
        if (targetPos !== null) return false;
        if (node.type.name === 'character') {
          const base = node.textContent.trim().replace(/\s*\([^)]*\)\s*/g, '').toUpperCase();
          if (base === upper) {
            targetPos = pos + 1; // inside the node
            return false;
          }
        }
        return true;
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

  /** Navigate to a scene heading in the script */
  const handleNavigateToScene = useCallback(
    (sceneText: string) => {
      if (!editor) return;
      let targetPos: number | null = null;

      editor.state.doc.descendants((node, pos) => {
        if (targetPos !== null) return false;
        if (node.type.name === 'sceneHeading') {
          if (node.textContent.trim() === sceneText) {
            targetPos = pos + 1;
            return false;
          }
        }
        return true;
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

  // Detect potential characters mentioned in action lines (ALL-CAPS words 2+ chars)
  // that are not yet in the character list — these may be non-speaking characters
  const unmatchedNames = useMemo(() => {
    if (!editor) return [];
    const known = new Set<string>();
    for (const c of characters) known.add(c.toUpperCase());
    for (const p of characterProfiles) known.add(p.name);

    // Common ALL-CAPS words to exclude (not character names)
    const EXCLUDE = new Set([
      'INT', 'EXT', 'DAY', 'NIGHT', 'CONTINUOUS', 'LATER', 'MORNING',
      'EVENING', 'DAWN', 'DUSK', 'NOON', 'AFTERNOON', 'FADE', 'CUT',
      'DISSOLVE', 'SMASH', 'TO', 'IN', 'OUT', 'THE', 'AND', 'BUT',
      'FOR', 'NOT', 'ALL', 'HER', 'HIS', 'SHE', 'HIM', 'THEY', 'ARE',
      'WAS', 'HAS', 'WITH', 'FROM', 'THAT', 'THIS', 'THEN', 'THAN',
      'BACK', 'OVER', 'CONT', "CONT'D", 'MORE', 'END', 'ACT', 'ANGLE',
      'CLOSE', 'WIDE', 'POV', 'FLASHBACK', 'INTERCUT', 'SUPER', 'TITLE',
      'SERIES', 'SHOTS', 'MONTAGE', 'BEGIN', 'RESUME', 'SAME', 'TIME',
      'MATCH', 'JUMP', 'FREEZE', 'FRAME', 'STOCK', 'SHOT', 'INSERT',
    ]);

    const found = new Set<string>();
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'action') return true;
      const text = node.textContent;
      // Match sequences of 2+ uppercase words (character names are often multi-word)
      const regex = /\b([A-Z][A-Z.'\- ]{1,30}[A-Z])\b/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const candidate = match[1].trim();
        // Must be 2+ chars and not be an excluded common word
        if (candidate.length < 2) continue;
        const words = candidate.split(/\s+/);
        if (words.every((w) => EXCLUDE.has(w.replace(/[.']/g, '')))) continue;
        // Must not already be known
        if (known.has(candidate)) continue;
        // v4.19: skip names the writer has classified (location / other /
        // connected to an existing character) — they drop off this list.
        if (referredTags[candidate]) continue;
        found.add(candidate);
      }
      return true;
    });

    return Array.from(found).sort();
  }, [editor, editor?.state.doc, characters, characterProfiles, referredTags]);

  // v4.19: existing character names to offer under "Connect to character".
  const existingCharNames = useMemo(() => {
    const set = new Set<string>();
    for (const p of characterProfiles) if (p.name) set.add(p.name);
    for (const c of characters) set.add(c.toUpperCase());
    return Array.from(set).sort();
  }, [characterProfiles, characters]);

  // v4.19: classify a referred name so it drops off the list — as a location,
  // as "other", or connected to an existing character.
  const handleClassifyReferred = useCallback((name: string, val: string) => {
    if (!val) return;
    if (val === '__location') setReferredTag(name, { kind: 'location' });
    else if (val === '__other') setReferredTag(name, { kind: 'other' });
    else if (val.startsWith('__char:')) {
      const target = val.slice('__char:'.length);
      setReferredTag(name, { kind: 'character', character: target });
      // v4.21: the referred name is almost always the full name (SAM VEDU → SAM),
      // so fill it into the linked character's Full Name (unless one is set).
      const existing = characterProfiles.find((pr) => pr.name === target);
      if (!existing?.fullName) upsertCharacterProfile(target, { fullName: name });
    }
  }, [setReferredTag, characterProfiles, upsertCharacterProfile]);

  /**
   * "Scan Script" — the "From Script" tab's discovery step (replaces the old
   * "Build from Script", which silently created and deleted profiles). Scans the
   * script for every character — speaking cues plus the referred ALL-CAPS names
   * that used to sit in their own "Referred in Script" section — and pulls a
   * description + age from the action line that introduces each. It only builds a
   * reviewable list (scanResults); nothing is created until the writer clicks Add.
   */
  const handleScanScript = useCallback(() => {
    if (!editor) return;
    const actionTexts: string[] = [];
    const cueNames: string[] = [];
    const seenCue = new Set<string>();
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'action') {
        actionTexts.push(node.textContent);
      } else if (node.type.name === 'character') {
        const base = node.textContent.trim().replace(/\s*\([^)]*\)\s*/g, '').toUpperCase();
        if (base && !seenCue.has(base)) { seenCue.add(base); cueNames.push(base); }
      }
      return true;
    });
    setScanResults(buildScanList(actionTexts, cueNames, unmatchedNames));
  }, [editor, unmatchedNames]);

  // Add one scanned character: create its profile if needed and fill in the
  // detected description/age — but only into fields the writer hasn't set, so
  // re-adding never clobbers an edit. New names get a color like any other.
  const applyScanResult = useCallback((r: ScannedCharacter) => {
    const existing = characterProfiles.find((p) => p.name === r.name);
    const updates: Partial<Omit<CharacterProfile, 'name'>> = {};
    if (!existing) {
      const colorIdx = characterProfiles.length % DEFAULT_HIGHLIGHT_COLORS.length;
      updates.color = DEFAULT_HIGHLIGHT_COLORS[colorIdx];
    }
    if (r.description && !existing?.description) updates.description = r.description;
    if (r.age && !existing?.age) updates.age = r.age;
    upsertCharacterProfile(r.name, updates);
  }, [characterProfiles, upsertCharacterProfile]);

  // The scan is a snapshot, but a referred name the writer classifies afterwards
  // (location / other / connected) should still drop off — mirror the old list's
  // live behavior by filtering the snapshot against referredTags at render time.
  const visibleScanResults = useMemo(() => {
    if (!scanResults) return [];
    return scanResults.filter((r) => !(r.source === 'referred' && referredTags[r.name]));
  }, [scanResults, referredTags]);

  // v4.20: the Relationships tab — add a blank relationship to edit inline.
  const handleAddRelationship = useCallback(() => {
    const id = `rel-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    upsertCharacterRelationship({ id, characterA: '', characterB: '', type: REL_TYPES[0], description: '', dynamic: REL_DYNAMICS[0] });
  }, [upsertCharacterRelationship]);

  // Characters that have a profile but are no longer detected in the script.
  const orphanedNames = useMemo(() => {
    return new Set(
      characterProfiles
        .filter((p) => !scriptCharacterNames.has(p.name))
        .map((p) => p.name),
    );
  }, [characterProfiles, scriptCharacterNames]);

  // All characters (from profiles + auto-detected), sorted by selected criteria
  const allCharacters = useMemo(() => {
    // Union of profiles (which may be orphaned) and the cues present in the
    // script right now. The stale `characters` store is deliberately NOT a
    // source here — including it re-added names the writer had just removed,
    // so Remove appeared to do nothing.
    const nameSet = new Set<string>();
    for (const p of characterProfiles) nameSet.add(p.name);
    for (const name of scriptCharacterNames) nameSet.add(name);
    let list = Array.from(nameSet);

    if (searchQuery) {
      const q = searchQuery.toUpperCase();
      list = list.filter((n) => n.includes(q));
    }

    list.sort((a, b) => {
      const sa = charStats.get(a);
      const sb = charStats.get(b);
      switch (sortBy) {
        case 'name':
          return a.localeCompare(b);
        case 'importance':
          // scenes + dialogues descending
          return ((sb?.sceneCount ?? 0) + (sb?.dialogueCount ?? 0))
               - ((sa?.sceneCount ?? 0) + (sa?.dialogueCount ?? 0));
        case 'scenes':
          return (sb?.sceneCount ?? 0) - (sa?.sceneCount ?? 0);
        case 'dialogues':
          return (sb?.dialogueCount ?? 0) - (sa?.dialogueCount ?? 0);
        case 'appearance':
          return (sa?.appearanceOrder ?? 999) - (sb?.appearanceOrder ?? 999);
        default:
          return 0;
      }
    });

    return list;
  }, [characterProfiles, scriptCharacterNames, searchQuery, sortBy, charStats]);

  const getProfile = useCallback(
    (name: string): CharacterProfile => {
      const existing = characterProfiles.find((p) => p.name === name);
      if (existing) return existing;
      return { name, description: '', color: '', highlighted: false, gender: '', age: '', role: '', backstory: '', arc: '', speechPattern: '', vocabulary: '', verbalTics: '', sampleDialogue: '', images: [] };
    },
    [characterProfiles],
  );

  // ── Names: First / Last, and pushing edits back into the script (v4.22) ──
  // Screenplay names are ALL CAPS; the tool shows Title Case. A first-name edit
  // rewrites the bare name everywhere (cue + full name); a last-name edit
  // rewrites only the full-name phrase, leaving the cue.

  /** Replace every whole-word, case-sensitive occurrence of `phrase` with
   *  `replacement` across the script. Returns how many were changed. */
  const replaceInScript = useCallback((phrase: string, replacement: string): number => {
    if (!editor || !phrase || phrase === replacement) return 0;
    const re = new RegExp('\\b' + escapeRegExp(phrase) + '\\b', 'g'); // case-sensitive: only the CAPS forms
    const edits: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return true;
      const text = node.textContent;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const from = pos + 1 + m.index;
        edits.push({ from, to: from + m[0].length });
        if (m[0].length === 0) re.lastIndex++;
      }
      return false; // handled this block's text; don't descend into inline nodes
    });
    if (!edits.length) return 0;
    edits.sort((a, b) => b.from - a.from); // apply back-to-front so positions stay valid
    let tr = editor.state.tr;
    for (const e of edits) tr = tr.insertText(replacement, e.from, e.to);
    editor.view.dispatch(tr);
    return edits.length;
  }, [editor]);

  /** Whether the First / Last name fields differ from the script (drives the
   *  "Update name in script" button). */
  const nameChanged = useCallback((prof: CharacterProfile) => {
    const oldName = prof.name;
    const oldLastCaps = lastNameOf(prof.fullName || '');
    const newFirstCaps = (prof.firstName ?? toTitleCaseName(oldName)).trim().toUpperCase();
    const newLastCaps = (prof.lastName ?? toTitleCaseName(oldLastCaps)).trim().toUpperCase();
    return { firstChanged: !!newFirstCaps && newFirstCaps !== oldName, lastChanged: newLastCaps !== oldLastCaps };
  }, []);

  /** Push First / Last name edits back into the script. Last name rewrites the
   *  full-name phrase ("SAM VEDU" → "SAM PRUSA"); first name rewrites the bare
   *  name everywhere ("SAM" → "SAMUEL"), including cues and inside the full name.
   *  Doing last-then-first keeps both correct when they change together. */
  const applyNameToScript = useCallback((charName: string) => {
    const prof = getProfile(charName);
    const oldName = prof.name;                                   // SAM
    const oldLastCaps = lastNameOf(prof.fullName || '');         // VEDU
    const newFirstCaps = (prof.firstName ?? toTitleCaseName(oldName)).trim().toUpperCase();  // SAMUEL / SAM
    const newLastCaps = (prof.lastName ?? toTitleCaseName(oldLastCaps)).trim().toUpperCase(); // PRUSA / VEDU
    const firstChanged = !!newFirstCaps && newFirstCaps !== oldName;
    const lastChanged = newLastCaps !== oldLastCaps;
    if (!firstChanged && !lastChanged) return;

    let n = 0;
    // 1) Last name: rewrite the full-name phrase, still under the OLD first name.
    if (lastChanged && oldLastCaps) {
      n += replaceInScript(joinName(oldName, oldLastCaps), joinName(oldName, newLastCaps));
    }
    // 2) First name: rewrite the bare name everywhere (also fixes the phrase's
    //    first token that step 1 left under the old first name).
    if (firstChanged) n += replaceInScript(oldName, newFirstCaps);

    const newFull = newLastCaps ? joinName(newFirstCaps, newLastCaps) : undefined;
    if (firstChanged) {
      const { name: _drop, ...rest } = prof;
      void _drop;
      deleteCharacterProfile(oldName);
      upsertCharacterProfile(newFirstCaps, {
        ...rest, fullName: newFull,
        firstName: toTitleCaseName(newFirstCaps), lastName: toTitleCaseName(newLastCaps),
      });
      if (expandedChar === oldName) setExpandedChar(newFirstCaps);
      if (modalChar === oldName) setModalChar(newFirstCaps);
    } else {
      upsertCharacterProfile(oldName, { fullName: newFull, lastName: toTitleCaseName(newLastCaps) });
    }
    showToast(n ? `Updated ${n} name${n > 1 ? 's' : ''} in the script.` : 'Name saved.', 'success');
  }, [getProfile, replaceInScript, upsertCharacterProfile, deleteCharacterProfile, expandedChar, modalChar]);

  // Auto-detect a character's full name: the intro "SAM VEDU" in an action line
  // (cue name followed by another all-caps word). Fills the Last Name field.
  const detectedFullNames = useMemo(() => {
    const map = new Map<string, string>();
    if (!editor) return map;
    const parts: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'action' || node.type.name === 'general') parts.push(node.textContent);
      return true;
    });
    const blob = parts.join('\n');
    for (const cue of scriptCharacterNames) {
      const m = blob.match(new RegExp('\\b' + escapeRegExp(cue) + "\\s+([A-Z][A-Z'’-]+)\\b"));
      if (m) map.set(cue, `${cue} ${m[1]}`);
    }
    return map;
  }, [editor, editor?.state.doc, scriptCharacterNames]);

  useEffect(() => {
    for (const [cue, full] of detectedFullNames) {
      const prof = characterProfiles.find((p) => p.name === cue);
      // Only auto-fill when the user hasn't set a full/last name themselves.
      if (prof && !prof.fullName && !prof.lastName) upsertCharacterProfile(cue, { fullName: full });
    }
  }, [detectedFullNames, characterProfiles, upsertCharacterProfile]);

  // v4.22, Derek: characters that share a last name are auto-linked as family.
  // Each pair is handled once per session (the ref), so deleting an auto link
  // during the session doesn't make it spring back.
  const autoFamilyRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const byLast = new Map<string, string[]>();
    for (const p of characterProfiles) {
      const last = (p.lastName ?? toTitleCaseName(lastNameOf(p.fullName || ''))).trim().toUpperCase();
      if (!last) continue;
      (byLast.get(last) ?? byLast.set(last, []).get(last)!).push(p.name);
    }
    for (const names of byLast.values()) {
      if (names.length < 2) continue;
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const key = [names[i], names[j]].sort().join('|');
          if (autoFamilyRef.current.has(key)) continue;
          autoFamilyRef.current.add(key);
          const a = names[i], b = names[j];
          const exists = characterRelationships.some(
            (r) => (r.characterA === a && r.characterB === b) || (r.characterA === b && r.characterB === a),
          );
          if (!exists) {
            upsertCharacterRelationship({
              id: `rel-fam-${key}-${Date.now()}`,
              characterA: a, characterB: b,
              type: 'family', description: 'Shares a last name', dynamic: REL_DYNAMICS[0],
            });
          }
        }
      }
    }
  }, [characterProfiles, characterRelationships, upsertCharacterRelationship]);

  /** Calculate profile completeness as percentage + field breakdown */
  const getProfileCompleteness = useCallback((profile: CharacterProfile) => {
    const fields: { label: string; filled: boolean }[] = [
      { label: 'Description', filled: !!stripHtml(profile.description || '').trim() },
      { label: 'Gender', filled: !!profile.gender },
      { label: 'Age', filled: !!profile.age },
      { label: 'Role', filled: !!profile.role },
      { label: 'Backstory', filled: !!stripHtml(profile.backstory || '').trim() },
      { label: 'Character Arc', filled: !!stripHtml(profile.arc || '').trim() },
      { label: 'Speech Pattern', filled: !!stripHtml(profile.speechPattern || '').trim() },
      { label: 'Vocabulary', filled: !!stripHtml(profile.vocabulary || '').trim() },
      { label: 'Verbal Tics', filled: !!stripHtml(profile.verbalTics || '').trim() },
      { label: 'Image', filled: (profile.images?.length || 0) > 0 },
    ];
    const filled = fields.filter((f) => f.filled).length;
    const pct = Math.round((filled / fields.length) * 100);
    return { pct, filled, total: fields.length, fields };
  }, []);

  // Image helpers

  const imageAssets = useMemo(() => {
    return assets.filter((a) => a.mime_type.startsWith('image/'));
  }, [assets]);

  const handleUploadImage = useCallback(async (charName: string, file: File) => {
    if (!projectId) return;
    setUploading(true);
    try {
      const data = await api.uploadAsset(projectId, file, [`character:${charName}`]);
      const assetId = data.id || data.asset?.id;
      if (assetId) {
        const profile = characterProfiles.find((p) => p.name === charName);
        const currentImages = profile?.images || [];
        upsertCharacterProfile(charName, { images: [...currentImages, assetId] });
      }
      await fetchAssets();
      showToast('Image uploaded', 'success');
    } catch (err) {
      showToast(`Image upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setUploading(false);
    }
  }, [projectId, characterProfiles, upsertCharacterProfile, fetchAssets]);

  const handleAssociateAsset = useCallback((charName: string, assetId: string) => {
    const profile = characterProfiles.find((p) => p.name === charName);
    const currentImages = profile?.images || [];
    if (!currentImages.includes(assetId)) {
      upsertCharacterProfile(charName, { images: [...currentImages, assetId] });
    }
    setImagePickerFor(null);
    setImagePickerFilter('');
  }, [characterProfiles, upsertCharacterProfile]);

  const handleRemoveImage = useCallback((charName: string, assetId: string) => {
    const profile = characterProfiles.find((p) => p.name === charName);
    const currentImages = profile?.images || [];
    upsertCharacterProfile(charName, { images: currentImages.filter((id) => id !== assetId) });
  }, [characterProfiles, upsertCharacterProfile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const charName = uploadTargetRef.current;
    if (file && charName) {
      handleUploadImage(charName, file);
    }
    e.target.value = '';
  }, [handleUploadImage]);

  const triggerUpload = useCallback((charName: string) => {
    uploadTargetRef.current = charName;
    fileInputRef.current?.click();
  }, []);

  // ── Voice Profile: upload / replace / remove an audio reference clip ──
  const handleUploadVoice = useCallback(async (charName: string, file: File) => {
    if (!projectId) return;
    setVoiceUploading(true);
    try {
      const data = await api.uploadAsset(projectId, file, [`voice:${charName}`]);
      const assetId = data.id || data.asset?.id;
      if (assetId) upsertCharacterProfile(charName, { voiceProfile: assetId });
      showToast('Voice profile uploaded', 'success');
    } catch (err) {
      showToast(`Voice upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setVoiceUploading(false);
    }
  }, [projectId, upsertCharacterProfile]);

  const handleVoiceSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const charName = voiceTargetRef.current;
    if (file && charName) handleUploadVoice(charName, file);
    e.target.value = '';
  }, [handleUploadVoice]);

  const triggerVoiceUpload = useCallback((charName: string) => {
    voiceTargetRef.current = charName;
    voiceInputRef.current?.click();
  }, []);

  /** v4.22, Derek: First / Last name fields. Shown Title Case (the script is all
   *  caps); editing either surfaces an "Update name in script" button that pushes
   *  the change back. ONE renderer, used by both the card expansion and the modal
   *  so the two never drift. */
  const renderNameFields = (charName: string) => {
    const prof = getProfile(charName);
    const scriptLastCaps = lastNameOf(prof.fullName || '');
    const dispFirst = prof.firstName ?? toTitleCaseName(prof.name);
    const dispLast = prof.lastName ?? toTitleCaseName(scriptLastCaps);
    const { firstChanged, lastChanged } = nameChanged(prof);
    const changed = firstChanged || lastChanged;
    // v4.22, Derek: fields + button fill the whole row; the button is always
    // shown, greyed out until a name actually changes.
    return (
      <div className="char-profile-name-row">
        <div className="char-profile-meta-field char-profile-name-cell">
          <label className="char-profile-label">First Name</label>
          <input
            className="char-profile-input char-profile-name-input"
            value={dispFirst}
            onChange={(e) => upsertCharacterProfile(charName, { firstName: e.target.value })}
          />
        </div>
        <div className="char-profile-meta-field char-profile-name-cell">
          <label className="char-profile-label">Last Name</label>
          <input
            className="char-profile-input char-profile-name-input"
            value={dispLast}
            onChange={(e) => upsertCharacterProfile(charName, { lastName: e.target.value })}
          />
        </div>
        <button
          className="char-profile-name-update"
          disabled={!changed}
          title={changed ? "Rewrite this character's name throughout the script" : 'Edit a name to enable'}
          onClick={() => applyNameToScript(charName)}
        >Update in Script</button>
      </div>
    );
  };

  /** Gender / Age / Sexuality — one row, shared by card + modal (v4.22, Derek:
   *  Role removed; Sexuality added; no placeholder hints). */
  const renderMetaRow = (charName: string) => {
    const prof = getProfile(charName);
    return (
      <div className="char-profile-meta-row char-profile-meta-row-3">
        <div className="char-profile-meta-field">
          <label className="char-profile-label">Gender</label>
          <input
            type="text"
            className="char-profile-input"
            value={prof.gender}
            onChange={(e) => upsertCharacterProfile(charName, { gender: e.target.value })}
          />
        </div>
        <div className="char-profile-meta-field">
          <label className="char-profile-label">Age</label>
          <input
            type="text"
            className="char-profile-input"
            value={prof.age}
            onChange={(e) => upsertCharacterProfile(charName, { age: e.target.value })}
          />
        </div>
        <div className="char-profile-meta-field">
          <label className="char-profile-label">Sexuality</label>
          <input
            type="text"
            className="char-profile-input"
            value={prof.sexuality ?? ''}
            onChange={(e) => upsertCharacterProfile(charName, { sexuality: e.target.value })}
          />
        </div>
      </div>
    );
  };

  /** Character photo row + a single "Upload Image" button with a menu. Shared. */
  /** The upload button alone (goes on the section row). */
  const renderUploadButton = (charName: string) => (
    projectId ? (
      <UploadImageButton
        uploading={uploading}
        onLocal={() => triggerUpload(charName)}
        onAssets={() => { setImagePickerFor(charName); setImagePickerFilter(''); }}
      />
    ) : null
  );

  /** Full-width character image with slideshow arrows and a delete button that
   *  works even for the only image. (v4.22, Derek.) */
  const renderImageDisplay = (charName: string) => {
    const prof = getProfile(charName);
    const imgs = prof.images ?? [];
    const n = imgs.length;
    if (!n || !projectId) return null;
    const idx = Math.min(imgIdx[charName] ?? 0, n - 1);
    const step = (d: number) => setImgIdx((m) => ({ ...m, [charName]: ((idx + d) % n + n) % n }));
    return (
      <div className="char-profile-image-display">
        <AssetImage
          projectId={projectId}
          assetId={imgs[idx]}
          className="char-profile-image-main"
          alt={charName}
          onClick={() => setLightboxImage({ assetId: imgs[idx], name: charName })}
        />
        <button
          className="char-profile-image-del"
          title="Remove this image"
          onClick={() => { handleRemoveImage(charName, imgs[idx]); setImgIdx((m) => ({ ...m, [charName]: 0 })); }}
        >&times;</button>
        {n > 1 && (
          <>
            <button className="char-profile-image-nav prev" title="Previous image" onClick={() => step(-1)}>&#8249;</button>
            <button className="char-profile-image-nav next" title="Next image" onClick={() => step(1)}>&#8250;</button>
            <span className="char-profile-image-count">{idx + 1} / {n}</span>
          </>
        )}
      </div>
    );
  };

  /** Voice Profile: either an upload button or the loaded player + remove. */
  const renderVoiceButton = (charName: string) => {
    if (!projectId) return null;
    const prof = getProfile(charName);
    const voiceId = prof.voiceProfile;
    if (voiceId) {
      return (
        <div className="char-profile-voice">
          <AssetAudio projectId={projectId} assetId={voiceId} />
          <button
            className="char-profile-voice-replace"
            title="Replace voice clip"
            onClick={() => triggerVoiceUpload(charName)}
          >Replace</button>
          <button
            className="char-profile-voice-remove"
            title="Remove voice profile"
            onClick={() => upsertCharacterProfile(charName, { voiceProfile: undefined })}
          >&times;</button>
        </div>
      );
    }
    return (
      <button
        className="char-profile-voice-btn"
        disabled={voiceUploading}
        title="Upload a voice-reference audio clip for this character"
        onClick={() => triggerVoiceUpload(charName)}
      >
        {voiceUploading ? 'Uploading…' : 'Voice Profile'}
      </button>
    );
  };

  /** Image display + Upload / Voice Profile row (used where both belong
   *  together). A divider sets this media block off from the fields above. */
  const renderImageSection = (charName: string) => (
    <>
      <div className="char-profile-section-divider" aria-hidden />
      <div className="char-profile-photo-row">
        {renderImageDisplay(charName)}
        <div className="char-profile-image-actions">
          {renderUploadButton(charName)}
          {renderVoiceButton(charName)}
        </div>
      </div>
    </>
  );

  /** User-defined custom fields (shared definitions, per-character values) plus
   *  an "+ Add field" control. Shown on every character. (v4.22, Derek.) */
  const renderCustomFields = (charName: string) => {
    const prof = getProfile(charName);
    return (
      <div className="char-profile-custom-fields">
        {characterCustomFields.map((f) => (
          <div className="char-profile-custom-field" key={f.id}>
            <div className="char-profile-custom-label-row">
              <input
                className="char-profile-label char-profile-custom-label"
                value={f.label}
                title="Rename this field (applies to every character)"
                onChange={(e) => renameCharacterCustomField(f.id, e.target.value)}
              />
              <button
                className="char-profile-custom-remove"
                title="Remove this field from every character"
                onClick={() => removeCharacterCustomField(f.id)}
              >&times;</button>
            </div>
            <input
              className="char-profile-input"
              value={prof.customFields?.[f.id] ?? ''}
              onChange={(e) => upsertCharacterProfile(charName, {
                customFields: { ...(prof.customFields ?? {}), [f.id]: e.target.value },
              })}
            />
          </div>
        ))}
        <button
          className="char-profile-add-field"
          onClick={() => {
            const label = window.prompt('New field name (added to every character):');
            if (label && label.trim()) addCharacterCustomField(label.trim());
          }}
        >+ Custom Field</button>
      </div>
    );
  };

  /** Render character detail fields — used in both card expansion and modal */
  const renderCharacterFields = (charName: string, isModal: boolean) => {
    const prof = getProfile(charName);
    const st = charStats.get(charName);
    return (
      <>
        {renderNameFields(charName)}

        {/* Photo row */}
        {renderImageSection(charName)}

        {/* Description — full width */}
        <label className="char-profile-label">Description</label>
        <MiniRichText
          value={prof.description}
          onChange={(html) => upsertCharacterProfile(charName, { description: html })}
          placeholder="A weary detective in his 50s, haunted by a cold case..."
          minHeight={isModal ? 80 : 50}
        />

        {/* Gender / Age / Sexuality */}
        {renderMetaRow(charName)}

        {/* User-defined fields */}
        {renderCustomFields(charName)}

        {/* Backstory */}
        <label className="char-profile-label">Backstory</label>
        <MiniRichText
          value={prof.backstory}
          onChange={(html) => upsertCharacterProfile(charName, { backstory: html })}
          placeholder="Character history, motivations, secrets..."
          minHeight={isModal ? 100 : 60}
        />

        {/* Character Arc */}
        <label className="char-profile-label">Character Arc</label>
        <MiniRichText
          value={prof.arc || ''}
          onChange={(html) => upsertCharacterProfile(charName, { arc: html })}
          placeholder="How does this character change through the story..."
          minHeight={isModal ? 80 : 50}
        />

        {/* Voice Profile (collapsible) */}
        <details className="char-profile-voice-section">
          <summary className="char-profile-label char-profile-voice-toggle">Voice Profile</summary>
          <div className="char-profile-voice-fields">
            <label className="char-profile-label">Speech Pattern</label>
            <MiniRichText
              value={prof.speechPattern || ''}
              onChange={(html) => upsertCharacterProfile(charName, { speechPattern: html })}
              placeholder="Short sentences, formal tone, uses contractions..."
              minHeight={40}
            />
            <label className="char-profile-label">Vocabulary</label>
            <MiniRichText
              value={prof.vocabulary || ''}
              onChange={(html) => upsertCharacterProfile(charName, { vocabulary: html })}
              placeholder="Educated, uses legal terms, street slang..."
              minHeight={40}
            />
            <label className="char-profile-label">Verbal Tics</label>
            <MiniRichText
              value={prof.verbalTics || ''}
              onChange={(html) => upsertCharacterProfile(charName, { verbalTics: html })}
              placeholder="Says 'you see' often, clears throat before lying..."
              minHeight={40}
            />
            <label className="char-profile-label">Sample Dialogue</label>
            <MiniRichText
              value={prof.sampleDialogue || ''}
              onChange={(html) => upsertCharacterProfile(charName, { sampleDialogue: html })}
              placeholder="3-5 representative lines from the script..."
              minHeight={40}
            />
          </div>
        </details>

        {/* Color + Highlight */}
        <div className="char-profile-color-highlight">
          <label className="char-profile-label">Color</label>
          <div className="char-color-swatches">
            {['#8b5cf6','#4f46e5','#2563eb','#059669','#eab308','#f97316','#ef4444','#000000','#ffffff'].map(c => (
              <button key={c} className={`synopsis-color-swatch${(prof.color || '') === c ? ' active' : ''}`} style={{ background: c }} onClick={() => upsertCharacterProfile(charName, { color: c })} />
            ))}
            <label className="synopsis-color-custom" title="Custom color">
              <input type="color" value={prof.color || '#999999'} onChange={(e) => upsertCharacterProfile(charName, { color: e.target.value })} />
              <span>+</span>
            </label>
          </div>
          <div className="char-profile-highlight-inline">
            <label className="char-profile-label" style={{ marginBottom: 0 }}>Highlight</label>
            <button
              className={`char-profile-highlight-btn${prof.highlighted ? ' active' : ''}`}
              onClick={() => upsertCharacterProfile(charName, { highlighted: !prof.highlighted })}
              style={prof.highlighted ? { background: prof.color || '#999', borderColor: prof.color || '#999' } : undefined}
            >
              {prof.highlighted ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Relationships (before scenes) */}
        {(() => {
          const nameUpper = charName.toUpperCase();
          const rels = characterRelationships.filter(
            (r) => r.characterA === nameUpper || r.characterB === nameUpper
          );
          const isAdding = addRelFor === nameUpper;
          return (
            <div className="char-profile-relationships">
              <div className="char-profile-rel-header-row">
                <label className="char-profile-label" style={{ marginBottom: 0 }}>Relationships</label>
                {!isAdding && (
                  <button className="char-profile-rel-add-btn" onClick={() => setAddRelFor(nameUpper)}>+ Add</button>
                )}
              </div>
              {rels.map((r) => {
                const other = r.characterA === nameUpper ? r.characterB : r.characterA;
                return (
                  <div key={r.id} className="char-profile-rel-item">
                    <div className="char-profile-rel-header">
                      <span className="char-profile-rel-other">{other}</span>
                      <span className="char-profile-rel-type">{r.type}</span>
                      {r.dynamic && <span className="char-profile-rel-dynamic">{r.dynamic}</span>}
                      <button
                        className="char-profile-rel-remove"
                        onClick={() => deleteCharacterRelationship(r.id)}
                        title="Remove relationship"
                      >&times;</button>
                    </div>
                    {r.description && <div className="char-profile-rel-desc">{r.description}</div>}
                  </div>
                );
              })}
              {rels.length === 0 && !isAdding && (
                <div className="char-profile-rel-empty">No relationships defined yet</div>
              )}
              {isAdding && (
                <InlineRelForm
                  characterName={nameUpper}
                  allCharacters={allCharacters}
                  onSave={(rel) => {
                    upsertCharacterRelationship(rel);
                    setAddRelFor(null);
                  }}
                  onCancel={() => setAddRelFor(null)}
                />
              )}
            </div>
          );
        })()}

        {/* Scene appearances (collapsed by default) */}
        {st && st.scenes.length > 0 && (
          <details className="char-profile-scenes-collapsible">
            <summary className="char-profile-label char-profile-scenes-toggle">
              Appears in ({st.scenes.length} scenes)
            </summary>
            <div className="char-profile-scene-chips">
              {st.scenes.map((s, i) => (
                <span key={i} className="char-profile-scene-chip" onClick={() => handleNavigateToScene(s)} title={`Go to: ${s}`}>{s}</span>
              ))}
            </div>
          </details>
        )}
      </>
    );
  };

  const { shouldRender: gateRender, animationState } = useDelayedUnmount(characterProfilesOpen, 250);
  const shouldRender = embedded || fullscreen || gateRender;
  const panelRef = useRef<HTMLDivElement>(null);
  useSwipeDismiss(panelRef, { direction: 'right', onDismiss: toggleCharacterProfiles, enabled: !embedded && shouldRender && !isFullscreen });

  if (!shouldRender) return null;

  const panelClass = embedded
    ? 'panel-open'
    : (!isFullscreen && animationState === 'entered'
      ? 'panel-open' : animationState === 'exiting' ? 'panel-closing' : '');

  return (
    <div ref={panelRef} className={`char-profiles-panel${embedded ? ' char-profiles-embedded' : ''}${isFullscreen ? ' char-profiles-fullscreen' : ''}${isFullscreen && activeTab === 'profiles' && fsViewMode === 'list' ? ' char-fs-list-mode' : ''} ${panelClass}`} style={isFullscreen ? undefined : style}>
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {/* Hidden file input for voice-profile audio uploads (v4.23) */}
      <input
        ref={voiceInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleVoiceSelect}
      />

      <div className={`char-profiles-header${isFullscreen ? ' char-fs-header' : ''}`}>
        <span className="char-profiles-title">Characters</span>
        <span className="char-profiles-count">{allCharacters.length}</span>
        {/* v4.18: in fullscreen the Profiles/Map tabs sit on the header row,
            50px past the title; the right side carries the tab's actions and
            the close X. */}
        {isFullscreen && (
          <div className="char-fs-header-tabs">
            <button className={`char-profiles-tab${activeTab === 'profiles' ? ' active' : ''}`} onClick={() => setActiveTab('profiles')}>Profiles</button>
            <button className={`char-profiles-tab${activeTab === 'relationships' ? ' active' : ''}`} onClick={() => setActiveTab('relationships')}>Relationships</button>
            <button className={`char-profiles-tab${activeTab === 'setup' ? ' active' : ''}`} onClick={() => setActiveTab('setup')}>From Script</button>
          </div>
        )}
        {isFullscreen && (
          <div className="char-fs-header-actions">
            {activeTab === 'profiles' && (
              <div className="char-fs-view-toggle">
                <button className={`char-fs-view-btn${fsViewMode === 'cards' ? ' active' : ''}`} onClick={() => setFsViewMode('cards')}>Cards</button>
                <button className={`char-fs-view-btn${fsViewMode === 'list' ? ' active' : ''}`} onClick={() => setFsViewMode('list')}>List</button>
              </div>
            )}
            {activeTab === 'relationships' && (
              <div className="char-fs-view-toggle">
                <button className={`char-fs-view-btn${relViewMode === 'list' ? ' active' : ''}`} onClick={() => setRelViewMode('list')}>List</button>
                <button className={`char-fs-view-btn${relViewMode === 'map' ? ' active' : ''}`} onClick={() => setRelViewMode('map')}>Map</button>
              </div>
            )}
            <button className="char-profiles-close" onClick={() => exitCharFullscreen()} title="Return to editor">&times;</button>
          </div>
        )}
        {!isFullscreen && (
          <button
            className="char-profiles-fullscreen-btn"
            onClick={() => enterCharFullscreen()}
            title="Fullscreen"
          >
            {'\u26F6'}
          </button>
        )}
        {!embedded && !isFullscreen && <button className="char-profiles-close" onClick={() => { toggleCharacterProfiles(); }} title="Close">
          &times;
        </button>}
      </div>

      {/* Tabs row \u2014 only when NOT fullscreen (in fullscreen they live in the header) */}
      {!isFullscreen && (
        <div className="char-profiles-tabs">
          <button
            className={`char-profiles-tab${activeTab === 'profiles' ? ' active' : ''}`}
            onClick={() => setActiveTab('profiles')}
          >
            Profiles
          </button>
          <button
            className={`char-profiles-tab${activeTab === 'relationships' ? ' active' : ''}`}
            onClick={() => setActiveTab('relationships')}
          >
            Relationships
          </button>
          <button
            className={`char-profiles-tab${activeTab === 'setup' ? ' active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            From Script
          </button>
        </div>
      )}

      {/* v4.20: Relationships tab — an editable list of every relationship.
          v4.23: List/Map toggle folds the old "Relationship Map" tab in here. */}
      {activeTab === 'relationships' && (
        <div className="char-rels-tab">
          {/* Non-fullscreen carries the List/Map toggle here (fullscreen puts it
              in the header, next to the close X, like Profiles' Cards/List). */}
          {!isFullscreen && (
            <div className="char-rels-view-toggle">
              <button className={`char-fs-view-btn${relViewMode === 'list' ? ' active' : ''}`} onClick={() => setRelViewMode('list')}>List</button>
              <button className={`char-fs-view-btn${relViewMode === 'map' ? ' active' : ''}`} onClick={() => setRelViewMode('map')}>Map</button>
            </div>
          )}
          {relViewMode === 'map' ? (
            <>
              {/* The map's Fit / + Add Relationship buttons portal into this
                  toolbar — the SAME .char-rels-toolbar the list uses, so the
                  controls sit in the same place in both views (v4.23). */}
              <div className="char-rels-toolbar" ref={setMapHeaderSlot} />
              <RelationshipMap
                key={currentScriptId || 'no-script'}
                scriptId={currentScriptId || undefined}
                headerSlot={mapHeaderSlot}
                onSelectCharacter={(name) => {
                  setActiveTab('profiles');
                  setSelectedCharacter(name);
                  setExpandedChar(name);
                  setModalChar(name);
                }}
              />
            </>
          ) : (
          <>
          <div className="char-rels-toolbar">
            <button className="char-rels-add" onClick={handleAddRelationship}>+ Add Relationship</button>
          </div>
          <div className="char-rels-list">
            {characterRelationships.length === 0 ? (
              <div className="char-profiles-empty">No relationships yet. Add one to get started.</div>
            ) : (
              characterRelationships.map((rel) => (
                <div key={rel.id} className="char-rel-item">
                  <select className="char-rel-field char-rel-char" value={rel.characterA}
                    onChange={(e) => upsertCharacterRelationship({ ...rel, characterA: e.target.value })}>
                    <option value="">Character A…</option>
                    {existingCharNames.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="char-rel-field char-rel-type" value={rel.type}
                    onChange={(e) => upsertCharacterRelationship({ ...rel, type: e.target.value })}>
                    {REL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select className="char-rel-field char-rel-char" value={rel.characterB}
                    onChange={(e) => upsertCharacterRelationship({ ...rel, characterB: e.target.value })}>
                    <option value="">Character B…</option>
                    {existingCharNames.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="char-rel-field char-rel-dynamic" value={rel.dynamic}
                    onChange={(e) => upsertCharacterRelationship({ ...rel, dynamic: e.target.value })}>
                    {REL_DYNAMICS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input className="char-rel-field char-rel-desc" value={rel.description}
                    placeholder="Description…"
                    onChange={(e) => upsertCharacterRelationship({ ...rel, description: e.target.value })} />
                  <button className="char-rel-delete" title="Delete relationship"
                    onClick={() => deleteCharacterRelationship(rel.id)}>&times;</button>
                </div>
              ))
            )}
          </div>
          </>
          )}
        </div>
      )}

      {/* Profiles tab content */}
      {activeTab === 'profiles' && <>

      {/* Toolbar: Search + Sort + Build (v4.18: Sort moved onto this row). */}
      <div className="char-profiles-toolbar">
        <input
          type="text"
          placeholder="Search characters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="char-profiles-search-input"
        />
        <div className="char-profiles-sort">
          <span className="char-sort-label">Sort</span>
          <select
            className="char-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="name">Name</option>
            <option value="importance">Importance</option>
            <option value="scenes">Scenes</option>
            <option value="dialogues">Dialogues</option>
            <option value="appearance">Appearance</option>
          </select>
        </div>
      </div>

      {/* Character list */}
      <div className="char-profiles-list">
        {allCharacters.length === 0 ? (
          <div className="char-profiles-empty">
            {searchQuery
              ? 'No characters match your search.'
              : 'No characters detected. Add character elements to your script.'}
          </div>
        ) : (
          allCharacters.map((name) => {
            const profile = getProfile(name);
            const stats = charStats.get(name);
            // v4.18: in fullscreen LIST view, cards start minimized (a bar with
            // name + key stats) and expand on click; Cards view stays expanded.
            const isExpanded = (isFullscreen && fsViewMode === 'cards') || expandedChar === name;
            const isOrphaned = orphanedNames.has(name);
            const primaryImageId = profile.images?.[0];

            return (
              <div key={name} data-char-name={name} className={`char-profile-card${isOrphaned ? ' char-orphaned' : ''}${isExpanded ? ' char-profile-expanded' : ''}`}>
                {/* Orphaned banner */}
                {isOrphaned && (
                  <div className="char-orphaned-banner">
                    <span>Not in script</span>
                    <button
                      className="char-orphaned-remove"
                      onClick={() => setPendingRemoveChar(name)}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {/* Header row */}
                <div
                  className="char-profile-row"
                  onClick={() => setExpandedChar(isExpanded ? null : name)}
                >
                  {/* v4.20: left caret makes it clear the row toggles open (not
                      in Cards mode, where cards are always expanded). */}
                  {!(isFullscreen && fsViewMode === 'cards') && (
                    <span className="char-profile-caret" aria-hidden>{isExpanded ? <FaChevronDown /> : <FaChevronRight />}</span>
                  )}
                  {/* Avatar: show primary image or color swatch */}
                  {primaryImageId && projectId ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <AssetImage projectId={projectId} assetId={primaryImageId} alt={name} className="char-profile-avatar" />
                    </span>
                  ) : (
                    <input
                      type="color"
                      className="char-profile-color"
                      value={profile.color || '#999999'}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => upsertCharacterProfile(name, { color: e.target.value })}
                      title="Highlight color"
                    />
                  )}
                  <div className="char-profile-name-col">
                    <span
                      className="char-profile-name"
                      onClick={(e) => { e.stopPropagation(); handleNavigateToCharacter(name); }}
                      title="Click to navigate to first appearance"
                    >
                      {name}
                    </span>
                    {/* v4.23, Derek: scene appearances live next to the name now,
                        not only in the right-hand stats cluster. */}
                    {stats && stats.sceneCount > 0 && (
                      <span className="char-profile-appears" title={`Appears in ${stats.sceneCount} scenes`}>
                        Appears in {stats.sceneCount} scene{stats.sceneCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {profile.description && !isExpanded && (() => {
                      const plain = stripHtml(profile.description);
                      return plain ? (
                        <span className="char-profile-desc-preview">
                          {plain.slice(0, 50)}{plain.length > 50 ? '...' : ''}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  {/* v4.22, Derek: the header's right-side cluster — its inner
                      spacing is a Design-window knob (--dz-char-header-gap). */}
                  <div className="char-profile-header-right">
                  <div className="char-profile-stats">
                    {stats && (
                      <span title={`${stats.dialogueCount} dialogue lines`}>{stats.dialogueCount} lines</span>
                    )}
                  </div>
                  {/* Profile completeness indicator */}
                  {(() => {
                    const comp = getProfileCompleteness(profile);
                    const color = comp.pct === 0 ? 'var(--fd-text-muted, #666)'
                      : comp.pct < 40 ? '#f44336'
                      : comp.pct < 70 ? '#ff9800'
                      : comp.pct < 100 ? '#4caf50'
                      : '#2e7d32';
                    return (
                      <div className="char-profile-completeness">
                        <svg width="22" height="22" viewBox="0 0 22 22">
                          <circle cx="11" cy="11" r="9" fill="none" stroke="var(--fd-border, #333)" strokeWidth="2" />
                          <circle
                            cx="11" cy="11" r="9" fill="none"
                            stroke={color} strokeWidth="2"
                            strokeDasharray={`${comp.pct * 0.5655} 56.55`}
                            strokeLinecap="round"
                            transform="rotate(-90 11 11)"
                          />
                        </svg>
                        <span className="char-profile-completeness-label" style={{ color }}>
                          {comp.pct}%
                        </span>
                        <div className="char-completeness-tooltip">
                          <div className="char-completeness-tooltip-title">Profile: {comp.filled}/{comp.total}</div>
                          {comp.fields.map((f) => (
                            <div key={f.label} className={`char-completeness-tooltip-row${f.filled ? ' filled' : ''}`}>
                              <span>{f.filled ? '\u2713' : '\u2717'}</span> {f.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <button
                    className="char-profile-enlarge-btn"
                    onClick={(e) => { e.stopPropagation(); setModalChar(name); }}
                    title="Expand this character into a larger window"
                  >
                    <FaExpandAlt />
                  </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className={`char-profile-detail${isFullscreen && fsViewMode === 'cards' ? ' char-profile-detail-fs' : ''}`}>
                    {/* Top section: Description + Role/Gender/Age and Images (side-by-side in fullscreen) */}
                    {/* v4.22, Derek: stacked rows — name, photo, description
                        (full width), gender/age/sexuality, custom fields — all
                        from the same shared renderers as the modal. */}
                    <div className="char-profile-detail-top char-profile-detail-stacked">
                      {renderNameFields(name)}
                      {renderImageSection(name)}
                      <label className="char-profile-label">Description</label>
                      <MiniRichText
                        value={profile.description}
                        onChange={(html) => upsertCharacterProfile(name, { description: html })}
                        placeholder="A weary detective in his 50s, haunted by a cold case..."
                        minHeight={50}
                      />
                      {renderMetaRow(name)}
                      {renderCustomFields(name)}
                    </div>

                    {/* Bottom section: Backstory, Arc, Color/Highlight, Scenes */}
                    <div className="char-profile-detail-bottom">
                      <label className="char-profile-label">Backstory</label>
                      <MiniRichText
                        value={profile.backstory}
                        onChange={(html) => upsertCharacterProfile(name, { backstory: html })}
                        placeholder="Character history, motivations, secrets..."
                        minHeight={60}
                      />

                      <label className="char-profile-label">Character Arc</label>
                      <MiniRichText
                        value={profile.arc || ''}
                        onChange={(html) => upsertCharacterProfile(name, { arc: html })}
                        placeholder="How does this character change through the story..."
                        minHeight={50}
                      />

                      {/* Voice Profile (collapsible) */}
                      <details className="char-profile-voice-section">
                        <summary className="char-profile-label char-profile-voice-toggle">Voice Profile</summary>
                        <div className="char-profile-voice-fields">
                          <label className="char-profile-label">Speech Pattern</label>
                          <MiniRichText
                            value={profile.speechPattern || ''}
                            onChange={(html) => upsertCharacterProfile(name, { speechPattern: html })}
                            placeholder="Short sentences, formal tone..."
                            minHeight={40}
                          />
                          <label className="char-profile-label">Vocabulary</label>
                          <MiniRichText
                            value={profile.vocabulary || ''}
                            onChange={(html) => upsertCharacterProfile(name, { vocabulary: html })}
                            placeholder="Educated, uses legal terms..."
                            minHeight={40}
                          />
                          <label className="char-profile-label">Verbal Tics</label>
                          <MiniRichText
                            value={profile.verbalTics || ''}
                            onChange={(html) => upsertCharacterProfile(name, { verbalTics: html })}
                            placeholder="Says 'you see' often..."
                            minHeight={40}
                          />
                          <label className="char-profile-label">Sample Dialogue</label>
                          <MiniRichText
                            value={profile.sampleDialogue || ''}
                            onChange={(html) => upsertCharacterProfile(name, { sampleDialogue: html })}
                            placeholder="3-5 representative lines..."
                            minHeight={40}
                          />
                        </div>
                      </details>

                      <div className="char-profile-color-highlight">
                        <label className="char-profile-label">Color</label>
                        <div className="char-color-swatches">
                          {['#8b5cf6','#4f46e5','#2563eb','#059669','#eab308','#f97316','#ef4444','#000000','#ffffff'].map(c => (
                            <button key={c} className={`synopsis-color-swatch${(profile.color || '') === c ? ' active' : ''}`} style={{ background: c }} onClick={() => upsertCharacterProfile(name, { color: c })} />
                          ))}
                          <label className="synopsis-color-custom" title="Custom color">
                            <input type="color" value={profile.color || '#999999'} onChange={(e) => upsertCharacterProfile(name, { color: e.target.value })} />
                            <span>+</span>
                          </label>
                        </div>
                        <div className="char-profile-highlight-inline">
                          <label className="char-profile-label" style={{ marginBottom: 0 }}>Highlight</label>
                          <button
                            className={`char-profile-highlight-btn${profile.highlighted ? ' active' : ''}`}
                            onClick={() => upsertCharacterProfile(name, { highlighted: !profile.highlighted })}
                            style={profile.highlighted ? { background: profile.color || '#999', borderColor: profile.color || '#999' } : undefined}
                          >
                            {profile.highlighted ? 'On' : 'Off'}
                          </button>
                        </div>
                      </div>

                      {/* Relationships (before scenes) */}
                      {(() => {
                        const rels = characterRelationships.filter(
                          (r) => r.characterA === name || r.characterB === name
                        );
                        const isAdding = addRelFor === name;
                        return (
                          <div className="char-profile-relationships">
                            <div className="char-profile-rel-header-row">
                              <label className="char-profile-label" style={{ marginBottom: 0 }}>Relationships</label>
                              {!isAdding && (
                                <button className="char-profile-rel-add-btn" onClick={() => setAddRelFor(name)}>+ Add</button>
                              )}
                            </div>
                            {rels.map((r) => {
                              const other = r.characterA === name ? r.characterB : r.characterA;
                              return (
                                <div key={r.id} className="char-profile-rel-item">
                                  <div className="char-profile-rel-header">
                                    <span className="char-profile-rel-other">{other}</span>
                                    <span className="char-profile-rel-type">{r.type}</span>
                                    {r.dynamic && <span className="char-profile-rel-dynamic">{r.dynamic}</span>}
                                    <button
                                      className="char-profile-rel-remove"
                                      onClick={() => deleteCharacterRelationship(r.id)}
                                      title="Remove relationship"
                                    >&times;</button>
                                  </div>
                                  {r.description && <div className="char-profile-rel-desc">{r.description}</div>}
                                </div>
                              );
                            })}
                            {rels.length === 0 && !isAdding && (
                              <div className="char-profile-rel-empty">No relationships defined yet</div>
                            )}
                            {isAdding && (
                              <InlineRelForm
                                characterName={name}
                                allCharacters={allCharacters}
                                onSave={(rel) => {
                                  upsertCharacterRelationship(rel);
                                  setAddRelFor(null);
                                }}
                                onCancel={() => setAddRelFor(null)}
                              />
                            )}
                          </div>
                        );
                      })()}

                      {/* Scene appearances (collapsed by default) */}
                      {stats && stats.scenes.length > 0 && (
                        <details className="char-profile-scenes-collapsible">
                          <summary className="char-profile-label char-profile-scenes-toggle">
                            Appears in ({stats.scenes.length} scenes)
                          </summary>
                          <div className="char-profile-scene-chips">
                            {stats.scenes.map((s, i) => (
                              <span key={i} className="char-profile-scene-chip" onClick={() => handleNavigateToScene(s)} title={`Go to: ${s}`}>{s}</span>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

      </div>

      </>}
      {/* End of profiles tab */}

      {/* v4.23, Derek: "From Script" tab — one "Scan Script" section. The scan
          lists every character it finds (speaking cues + the ALL-CAPS "referred"
          names that used to be a separate list) with a description/age pulled from
          the action line that introduces them; the writer adds the ones they want.
          It replaces the old auto-creating "Build from Script" and the separate
          "Referred in Script" section — both are folded in here. */}
      {activeTab === 'setup' && (
        <div className="char-setup-tab">
          <div className="char-setup-section">
            <div className="char-setup-title">Scan Script{scanResults ? ` (${visibleScanResults.length})` : ''}</div>
            <p className="char-setup-desc">
              Scan the script for characters and pull descriptions and ages from the action lines that introduce them. Review the list, then add the ones you want.
            </p>
            <button
              className="char-rels-add"
              onClick={handleScanScript}
              title="Scan the script for characters and pull descriptions and ages from the action lines that introduce them"
            >
              {scanResults ? 'Re-scan Script' : 'Scan Script'}
            </button>

            {scanResults && (
              visibleScanResults.length === 0 ? (
                <div className="char-profiles-empty">No characters found in the script.</div>
              ) : (
                <div className="char-scan-list">
                  {visibleScanResults.map((r) => {
                    const existing = characterProfiles.find((p) => p.name === r.name);
                    const canApply = !existing
                      || (!!r.description && !existing.description)
                      || (!!r.age && !existing.age);
                    return (
                      <div key={r.name} className="char-scan-row">
                        <div className="char-scan-main">
                          <span className="char-scan-name">{r.name}</span>
                          {r.age && <span className="char-scan-age">{r.age}</span>}
                          {r.source === 'referred' && <span className="char-scan-tag">referred</span>}
                          <span className="char-scan-spacer" />
                          {canApply ? (
                            <button
                              className="char-unmatched-add"
                              onClick={() => applyScanResult(r)}
                              title={existing
                                ? 'Add the detected description and age to this character'
                                : 'Add as a character with the detected description and age'}
                            >
                              + Add
                            </button>
                          ) : (
                            <span className="char-scan-added">Added</span>
                          )}
                          {/* v4.19: classify a referred name — location / other /
                              connect to a character — to file it away. */}
                          {r.source === 'referred' && (
                            <select
                              className="char-unmatched-classify"
                              value=""
                              title="File this away so it leaves the list"
                              onChange={(e) => { handleClassifyReferred(r.name, e.target.value); e.target.value = ''; }}
                            >
                              <option value="">Classify…</option>
                              <option value="__location">It&rsquo;s a location</option>
                              <option value="__other">Other — hide it</option>
                              {existingCharNames.length > 0 && (
                                <optgroup label="Connect to character">
                                  {existingCharNames.map((c) => (
                                    <option key={c} value={`__char:${c}`}>{c}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          )}
                        </div>
                        {r.description && <div className="char-scan-desc">{r.description}</div>}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Image Picker Overlay */}
      {imagePickerFor && (
        <div className="dialog-overlay" onClick={() => { setImagePickerFor(null); setImagePickerFilter(''); }}>
          <div className="dialog-box char-image-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              Select Image for {imagePickerFor}
              <button className="char-profiles-close" onClick={() => { setImagePickerFor(null); setImagePickerFilter(''); }}>&times;</button>
            </div>
            <div className="char-image-picker-search">
              <input
                type="text"
                placeholder="Filter by name..."
                value={imagePickerFilter}
                onChange={(e) => setImagePickerFilter(e.target.value)}
                className="char-profiles-search-input"
                autoFocus
              />
            </div>
            <div className="char-image-picker-grid">
              {imageAssets.length === 0 ? (
                <div className="char-profiles-empty">No image assets in this project. Upload images via the Asset Manager or the Upload button on a character.</div>
              ) : (
                imageAssets
                  .filter((a) => !imagePickerFilter || a.original_name.toLowerCase().includes(imagePickerFilter.toLowerCase()))
                  .map((asset) => {
                    const alreadyLinked = (characterProfiles.find((p) => p.name === imagePickerFor)?.images || []).includes(asset.id);
                    return (
                      <div
                        key={asset.id}
                        className={`char-image-picker-item${alreadyLinked ? ' linked' : ''}`}
                        onClick={() => !alreadyLinked && handleAssociateAsset(imagePickerFor, asset.id)}
                        title={alreadyLinked ? 'Already associated' : `Associate ${asset.original_name}`}
                      >
                        {projectId && <AssetImage projectId={projectId} assetId={asset.id} alt={asset.original_name} />}
                        <span className="char-image-picker-name">{asset.original_name}</span>
                        {alreadyLinked && <span className="char-image-picker-linked">Linked</span>}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className="dialog-overlay char-lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="char-lightbox" onClick={(e) => e.stopPropagation()}>
            {projectId && <AssetImage projectId={projectId} assetId={lightboxImage.assetId} alt={lightboxImage.name} />}
            <button className="char-lightbox-close" onClick={() => setLightboxImage(null)}>&times;</button>
          </div>
        </div>
      )}

      {/* Per-character enlarge modal */}
      {modalChar && (
        <div className="char-modal-overlay" onClick={() => setModalChar(null)}>
          <div className="char-modal-detail" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              {modalChar}
              <button className="char-profiles-close" onClick={() => setModalChar(null)}>&times;</button>
            </div>
            <div className="char-modal-body">
              {renderCharacterFields(modalChar, true)}
            </div>
          </div>
        </div>
      )}

      {pendingRemoveChar && (
        <div className="dialog-overlay" onClick={() => setPendingRemoveChar(null)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Remove Character</div>
            <div className="dialog-body">
              <p style={{ margin: 0 }}>Remove &ldquo;{pendingRemoveChar}&rdquo; from the character list?</p>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setPendingRemoveChar(null)}>Cancel</button>
              <button
                className="dialog-primary"
                style={{ background: '#c0392b' }}
                onClick={() => {
                  deleteCharacterProfile(pendingRemoveChar);
                  setPendingRemoveChar(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterProfiles;
