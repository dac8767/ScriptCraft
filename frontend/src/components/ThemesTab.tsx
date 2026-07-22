/**
 * Customize → Themes (v0.78).
 *
 * Lists every theme in menu order — drag to reorder, Show/Hide, and for custom
 * themes Edit and Delete. Built-ins can be reordered and hidden but never
 * edited or deleted, so their buttons are disabled rather than absent (the row
 * stays legible instead of looking broken).
 */
import React from 'react';
import AddMenu from './AddMenu';
import ColorPicker from './ColorPicker';
import { DndColumns } from './CustomizePanelsDialog';
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
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [pickerKey, setPickerKey] = React.useState<string | null>(null);
  const [importNote, setImportNote] = React.useState('');

  // v3.79, Derek: if the user builds a theme then clicks the Customize dialog's
  // Save (instead of the tab's "Save Theme"), commit it anyway so it lands in
  // the list. The dialog dispatches this right before it closes.
  React.useEffect(() => {
    const commit = () => {
      if (!editing) return;
      saveCustomTheme({ ...editing, label: editing.label.trim() || 'My Theme' });
      // v4.22, Derek: if the edited theme is the one currently applied, re-apply
      // it so the changes land immediately. Without this the DOM keeps the
      // pre-edit colors until you reselect the theme. setTheme re-reads the
      // freshly-saved custom themes, so it picks up the new colors.
      if (theme === editing.id) setTheme(editing.id);
      setEditing(null);
    };
    window.addEventListener('scriptcraft:customize-save', commit);
    return () => window.removeEventListener('scriptcraft:customize-save', commit);
  }, [editing, saveCustomTheme, theme, setTheme]);

  const ids = allThemeIds();
  const labelOf = (id: string) =>
    BUILTIN_THEMES.find((b) => b.id === id)?.label
    ?? customThemes.find((c) => c.id === id)?.label
    ?? id;

  /** v1.3: Themes now behaves like every other tab — a hidden theme LEAVES the
   *  list and lives in + Add Item until you put it back. */
  const visibleIds = ids.filter((id) => !hiddenThemes.includes(id));
  const hiddenIds = ids.filter((id) => hiddenThemes.includes(id));

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
        Drag themes between Shown and Hidden — where you drop one is its place
        in the View → Theme menu. Built-in themes can be reordered and hidden,
        but not edited or deleted; the theme you're using can't be hidden.
      </p>

      {/* v1.81: Outlook-style — Shown | Hidden, drag between them. */}
      <DndColumns
        columns={[
          {
            id: 'shown', title: 'Shown',
            sections: [{
              rows: visibleIds.map((id) => {
                const custom = isCustomTheme(id);
                return {
                  key: id,
                  content: (
                    <span className="fs-customize-tool">
                      {labelOf(id)}
                      {theme === id && <span className="fs-theme-active-dot" title="Current theme"> ●</span>}
                      {custom && <span className="fs-theme-badge">Custom</span>}
                      <span className="fs-dnd-rowactions">
                        {custom && (
                          <button
                            className="fs-shortcut-clear"
                            title="Edit this theme"
                            onClick={() => {
                              const t = customThemes.find((c) => c.id === id);
                              if (t) setEditing({ ...t, vars: { ...t.vars } });
                            }}
                          >Edit</button>
                        )}
                        {custom && (
                          <button
                            className="fs-shortcut-clear"
                            title="Delete this theme"
                            onClick={() => setConfirmDelete(id)}
                          >Delete</button>
                        )}
                        {theme !== id && (
                          <button
                            className="fs-dnd-rowbtn"
                            title="Hide this theme"
                            onClick={() => setThemeHidden(id, true)}
                          >×</button>
                        )}
                      </span>
                    </span>
                  ),
                };
              }),
            }],
          },
          {
            id: 'hidden', title: 'Hidden', isHidden: true,
            sections: [{
              label: 'Themes',
              rows: hiddenIds.map((id) => ({
                key: id,
                content: (
                  <span className="fs-customize-tool">
                    {labelOf(id)}
                    {isCustomTheme(id) && <span className="fs-theme-badge">Custom</span>}
                    <button className="fs-dnd-rowbtn" title="Show this theme" onClick={() => setThemeHidden(id, false)}>+</button>
                  </span>
                ),
              })),
            }],
          },
        ]}
        onDrop={(src2, dst) => {
          const id = src2.key;
          if (dst.col === 'hidden') {
            if (theme !== id) setThemeHidden(id, true);   // never hide the active theme
            return;
          }
          const next = visibleIds.filter((x) => x !== id);
          next.splice(Math.min(dst.idx, next.length), 0, id);
          setThemeOrder([...next, ...hiddenIds.filter((x) => x !== id)]);
          if (hiddenThemes.includes(id)) setThemeHidden(id, false);
        }}
      />

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
        {/* v1.4.1: Export is a menu now, matching Import — a panel that opened
            over the button to ask "which themes?" was a whole extra screen for a
            question with two real answers: all of them, or that one. */}
        <AddMenu
          label="Export Themes..."
          center
          title="Save your custom themes to a file"
          onPick={(v) => {
            setImportNote('');
            void exportThemes(v === 'all' ? customThemes.map((c) => c.id) : [v]);
          }}
          groups={[{
            label: '',
            options: customThemes.length === 0
              ? []
              : [
                  ...(customThemes.length > 1
                    ? [{ value: 'all', label: `Export All Themes (${customThemes.length})` }]
                    : []),
                  ...customThemes.map((t) => ({ value: t.id, label: `Export “${t.label}”` })),
                ],
          }]}
        />
        {/* v1.1: one Import button. Two buttons sitting side by side, differing
            only in where the themes come FROM, made the choice look bigger than
            it is — it's one action with two sources. */}
        <AddMenu
          label="Import Themes..."
          center
          title="Load themes from a theme file, or copy them out of another project"
          onPick={(v) => {
            if (v === 'file') void importThemes();
            else void importFromProject();
          }}
          groups={[{
            // No heading: two items that are plainly both imports don't need a
            // category telling you so.
            label: '',
            options: [
              { value: 'file', label: 'Import from File' },
              { value: 'project', label: 'Import from Project' },
            ],
          }]}
        />
      </div>
    </section>
  );

  // ── Export / Import ──────────────────────────────────────────────────────
  // A theme file is plain-text JSON: readable, diffable, and easy to hand to
  // someone else. It carries a `kind` marker and a version so an import can
  // tell a real theme file from any other JSON that happens to be lying around.
  async function exportThemes(ids: string[]) {
    const chosen = customThemes.filter((t) => ids.includes(t.id));
    if (chosen.length === 0) return;
    const payload = { kind: 'scriptcraft-themes', version: 1, themes: chosen };
    const name = chosen.length === 1
      ? `${safeName(chosen[0].label)}.scriptcraft-theme.json`
      : 'scriptcraft-themes.json';
    // saveFile opens the real save dialog on desktop, so the user picks WHERE
    // it goes rather than it landing silently in Downloads.
    const { saveFile } = await import('../utils/fileOps');
    const ok = await saveFile(JSON.stringify(payload, null, 2), name, [
      { name: 'ScriptCraft Themes', extensions: ['json'] },
    ]);
    if (ok) setImportNote(`Exported ${chosen.length} theme${chosen.length === 1 ? '' : 's'}.`);
  }

  /** Import from another ScriptCraft PROJECT (.odraft) — themes now travel inside
   *  project files, so this copies the look across. Projects exported before
   *  v0.82 carry no themes, and we say so plainly rather than failing silently. */
  async function importFromProject() {
    const { openTextFile } = await import('../utils/fileOps');
    const result = await openTextFile([
      { name: 'ScriptCraft Project', extensions: ['odraft', 'json'] },
    ]);
    if (!result) return;
    try {
      const found = extractThemes(JSON.parse(result.content));
      if (found.length === 0) {
        setImportNote('That project has no custom themes. (Projects exported before v0.82 don’t carry themes — re-export it from the newer version.)');
        return;
      }
      addThemes(found);
    } catch {
      setImportNote('That file couldn’t be read as a ScriptCraft project.');
    }
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
        addThemes(found);
      } catch {
        setImportNote('That file couldn’t be read as a theme file.');
      }
    };
    input.click();
  }

  /** Never overwrite an existing theme: imported themes get a fresh id, and a
   *  duplicate name is suffixed. Re-importing the same file twice is harmless
   *  rather than destructive. */
  function addThemes(found: CustomTheme[]) {
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
