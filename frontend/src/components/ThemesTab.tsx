/**
 * Customize → Themes (v0.78).
 *
 * Lists every theme in menu order — drag to reorder, Show/Hide, and for custom
 * themes Edit and Delete. Built-ins can be reordered and hidden but never
 * edited or deleted, so their buttons are disabled rather than absent (the row
 * stays legible instead of looking broken).
 */
import React from 'react';
import ColorPicker from './ColorPicker';
import { useEditorStore } from '../stores/editorStore';
import { useThemeStore } from '../stores/themeStore';
import {
  BUILTIN_THEMES, THEME_VARS, isCustomTheme, seedVarsFromBase,
  applyThemeToDom, type CustomTheme,
} from './themes';

export default function ThemesTab() {
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);

  const customThemes = useThemeStore((s) => s.customThemes);
  const hiddenThemes = useThemeStore((s) => s.hiddenThemes);
  const allThemeIds = useThemeStore((s) => s.allThemeIds);
  const setThemeOrder = useThemeStore((s) => s.setThemeOrder);
  const setThemeHidden = useThemeStore((s) => s.setThemeHidden);
  const saveCustomTheme = useThemeStore((s) => s.saveCustomTheme);
  const deleteCustomTheme = useThemeStore((s) => s.deleteCustomTheme);

  const [editing, setEditing] = React.useState<CustomTheme | null>(null);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [pickerKey, setPickerKey] = React.useState<string | null>(null);
  const [importNote, setImportNote] = React.useState('');

  const ids = allThemeIds();
  const labelOf = (id: string) =>
    BUILTIN_THEMES.find((b) => b.id === id)?.label
    ?? customThemes.find((c) => c.id === id)?.label
    ?? id;

  const move = (from: number, to: number) => {
    const next = [...ids];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setThemeOrder(next);
  };

  const newTheme = () => setEditing({
    id: `custom:${Date.now()}`,
    label: 'My Theme',
    base: 'dark',
    vars: seedVarsFromBase('dark'),
  });

  // ── Editor ──
  if (editing) {
    const groups = [...new Set(THEME_VARS.map((v) => v.group))];
    const isNew = !customThemes.some((c) => c.id === editing.id);
    return (
      <section>
        <h3>{isNew ? 'New Theme' : `Edit ${editing.label}`}</h3>
        <p className="fs-customize-hint">
          Pick a light or dark base, then set the colors you want. Anything you
          don’t set follows the base, so the theme stays complete.
        </p>

        <div className="fs-customize-row">
          <span className="fs-customize-tool">Name</span>
          <input
            className="fs-theme-name-input"
            value={editing.label}
            maxLength={40}
            onChange={(e) => setEditing({ ...editing, label: e.target.value })}
          />
        </div>

        <div className="fs-customize-row">
          <span className="fs-customize-tool">Base</span>
          <span className="fs-customize-seg">
            {(['dark', 'light'] as const).map((b) => (
              <button
                key={b}
                className={editing.base === b ? 'active' : ''}
                title="Re-seeds the colors below from this base"
                onClick={() => setEditing({ ...editing, base: b, vars: seedVarsFromBase(b) })}
              >{b[0].toUpperCase() + b.slice(1)}</button>
            ))}
          </span>
        </div>

        {groups.map((g) => (
          <div key={g} className="fs-shortcut-group">
            <div className="fs-shortcut-group-title">{g}</div>
            {THEME_VARS.filter((v) => v.group === g).map((v) => (
              <div className="fs-customize-row" key={v.key}>
                <span className="fs-customize-tool">{v.label}</span>
                <span className="fs-theme-color-controls">
                  {/* The swatch opens our OWN picker, anchored here. A native
                      <input type="color"> would summon the OS color panel,
                      which the app can't position — that's how it ended up on
                      another monitor. */}
                  <button
                    className="fs-theme-color"
                    style={{ background: toHex(editing.vars[v.key]) }}
                    title="Choose a color"
                    onClick={() => setPickerKey(pickerKey === v.key ? null : v.key)}
                  />
                  <input
                    className="fs-theme-hex"
                    value={editing.vars[v.key] ?? ''}
                    onChange={(e) => setEditing({
                      ...editing,
                      vars: { ...editing.vars, [v.key]: e.target.value },
                    })}
                  />
                  {pickerKey === v.key && (
                    <span className="fs-theme-picker-anchor">
                      <ColorPicker
                        value={toHex(editing.vars[v.key])}
                        onChange={(color) => {
                          if (!color) return;      // 'Reset to Default' -> ignore
                          setEditing({ ...editing, vars: { ...editing.vars, [v.key]: color } });
                        }}
                        onClose={() => setPickerKey(null)}
                      />
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}

        <div className="fs-tbzone-adders fs-adders-equal">
          <button
            className="swn-add-btn"
            onClick={() => {
              const label = editing.label.trim() || 'My Theme';
              saveCustomTheme({ ...editing, label });
              setTheme(editing.id);          // saving applies it, so you can see it
              setEditing(null);
            }}
          >Save Theme</button>
          <button
            className="swn-add-btn"
            title="Preview without saving"
            onClick={() => applyThemeToDom(editing.id, [...customThemes, editing])}
          >Preview</button>
          <button
            className="swn-add-btn"
            onClick={() => {
              setEditing(null);
              applyThemeToDom(theme, customThemes);   // discard any preview
            }}
          >Cancel</button>
        </div>
      </section>
    );
  }

  // ── List ──
  return (
    <section>
      <h3>Themes</h3>
      <p className="fs-customize-hint">
        Drag to reorder the View → Theme menu. Hide themes you never use.
        Built-in themes can be reordered and hidden, but not edited or deleted.
      </p>

      <div className="fs-customize-grid">
        {ids.map((id, idx) => {
          const custom = isCustomTheme(id);
          const hidden = hiddenThemes.includes(id);
          return (
            <div
              key={id}
              className={`fs-customize-row${dragIdx === idx ? ' dragging' : ''}`}
              draggable
              onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { if (dragIdx !== null) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) move(dragIdx, idx);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
            >
              <span className="fs-customize-tool">
                <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
                {labelOf(id)}
                {theme === id && <span className="fs-theme-active-dot" title="Current theme"> ●</span>}
                {custom && <span className="fs-theme-badge">Custom</span>}
              </span>
              <span className="fs-theme-row-controls">
                <span className="fs-customize-seg">
                  <button
                    className={!hidden ? 'active' : ''}
                    onClick={() => setThemeHidden(id, false)}
                  >Show</button>
                  <button
                    className={hidden ? 'active' : ''}
                    onClick={() => setThemeHidden(id, true)}
                  >Hide</button>
                </span>
                <button
                  className="fs-shortcut-clear"
                  disabled={!custom}
                  title={custom ? 'Edit this theme' : 'Built-in themes can’t be edited'}
                  onClick={() => {
                    const t = customThemes.find((c) => c.id === id);
                    if (t) setEditing({ ...t, vars: { ...t.vars } });
                  }}
                >Edit</button>
                <button
                  className="fs-shortcut-clear"
                  disabled={!custom}
                  title={custom ? 'Delete this theme' : 'Built-in themes can’t be deleted'}
                  onClick={() => setConfirmDelete(id)}
                >Delete</button>
              </span>
            </div>
          );
        })}
      </div>

      {confirmDelete && (
        <p className="fs-shortcut-note">
          Delete “{labelOf(confirmDelete)}”?{' '}
          <button
            className="fs-shortcut-clear"
            onClick={() => {
              // If the theme being deleted is active, fall back to Dark first,
              // or the app would keep rendering a theme that no longer exists.
              if (theme === confirmDelete) setTheme('dark');
              deleteCustomTheme(confirmDelete);
              setConfirmDelete(null);
            }}
          >Delete</button>
          <button className="fs-shortcut-clear" onClick={() => setConfirmDelete(null)}>Cancel</button>
        </p>
      )}

      {importNote && <p className="fs-shortcut-note">{importNote}</p>}

      <div className="fs-tbzone-adders fs-adders-equal">
        <button className="swn-add-btn" onClick={newTheme}>+ New Theme</button>
        <button
          className="swn-add-btn"
          title="Save your custom themes to a file you can share or move to another project"
          onClick={exportThemes}
        >Export Themes…</button>
        <button
          className="swn-add-btn"
          title="Load themes from an exported theme file, or from another FreeDraft project"
          onClick={importThemes}
        >Import Themes…</button>
      </div>
    </section>
  );

  // ── Export / Import ──────────────────────────────────────────────────────
  // A theme file is plain-text JSON: readable, diffable, and easy to hand to
  // someone else. It carries a `kind` marker and a version so an import can
  // tell a real theme file from any other JSON that happens to be lying around.
  function exportThemes() {
    if (customThemes.length === 0) {
      setImportNote('You have no custom themes to export yet. Create one first.');
      return;
    }
    const payload = {
      kind: 'freedraft-themes',
      version: 1,
      themes: customThemes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = customThemes.length === 1
      ? `${safeName(customThemes[0].label)}.freedraft-theme.json`
      : 'freedraft-themes.json';
    a.click();
    URL.revokeObjectURL(url);
    setImportNote(`Exported ${customThemes.length} theme${customThemes.length === 1 ? '' : 's'}.`);
  }

  function importThemes() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt,.odraft,application/json,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const found = extractThemes(JSON.parse(await file.text()));
        if (found.length === 0) {
          setImportNote('No themes found in that file.');
          return;
        }
        // Never overwrite an existing theme: imported themes get a fresh id, and
        // a duplicate name is suffixed. Re-importing the same file twice is
        // harmless rather than destructive.
        const existing = new Set(customThemes.map((c) => c.label));
        let added = 0;
        for (const t of found) {
          let label = t.label || 'Imported Theme';
          let n = 2;
          while (existing.has(label)) label = `${t.label} (${n++})`;
          existing.add(label);
          saveCustomTheme({
            id: `custom:${Date.now()}-${added}`,
            label,
            base: t.base === 'light' ? 'light' : 'dark',
            vars: t.vars && typeof t.vars === 'object' ? t.vars : {},
          });
          added++;
        }
        setImportNote(`Imported ${added} theme${added === 1 ? '' : 's'}.`);
      } catch {
        setImportNote('That file couldn’t be read as a theme file.');
      }
    };
    input.click();
  }
}

const safeName = (s: string) => s.replace(/[^\w-]+/g, '_').slice(0, 40) || 'theme';

/**
 * Pull custom themes out of a parsed file. Accepts an exported theme file, a
 * single bare theme object, or another project's export that happens to carry a
 * themes array — so "import from another project" and "import a theme file" are
 * the same action for the user.
 */
function extractThemes(data: unknown): CustomTheme[] {
  const looksLikeTheme = (v: unknown): v is CustomTheme =>
    !!v && typeof v === 'object'
    && typeof (v as CustomTheme).label === 'string'
    && typeof (v as CustomTheme).vars === 'object';

  if (Array.isArray(data)) return data.filter(looksLikeTheme);
  if (!data || typeof data !== 'object') return [];

  const o = data as Record<string, unknown>;
  for (const key of ['themes', 'customThemes', '_themes']) {
    const v = o[key];
    if (Array.isArray(v)) return v.filter(looksLikeTheme);
  }
  return looksLikeTheme(o) ? [o] : [];
}

/** <input type="color"> only accepts #rrggbb — coerce anything else. */
function toHex(v: string | undefined): string {
  if (!v) return '#000000';
  const s = v.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return '#' + s.slice(1).split('').map((c) => c + c).join('');
  }
  const m = s.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  if (m) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
  }
  return '#000000';
}
