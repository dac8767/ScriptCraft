# ScriptCraft — final-pass checklist

Going through **every tool and every menu** one by one to make the final updates
to each. Process:

1. We work one item at a time (starting with the Scrapbook).
2. Derek says when an item is done.
3. Claude marks it `[x]` here and commits, then we move to the next.

> `[ ]` = not started · `[~]` = in progress (current) · `[x]` = done

---

## Tools

- [~] **Scrapbook** (`notebook`) — *current*
- [ ] Navigator (`navigator`)
- [ ] Scenes (`scenes`)
- [ ] Pages (`pages`)
- [ ] Locations (`locations`)
- [ ] Characters (`characters`)
- [ ] Index Cards (`indexcards`)
- [ ] Outline / Beat Board (`beatboard`)
- [ ] Notes (`sticky`)
- [ ] Snippets (`fragments`)
- [ ] To-Do (`todo`)
- [ ] Highlights (`highlights`)
- [ ] Production Tags (`tags`)
- [ ] Analytics (`analytics`)
- [ ] Goals (`goals`)
- [ ] Typewriter (`typewriter`)
- [ ] AI Writer (`aiwriter`)
- [ ] Title Page (`titlepage`)
- [ ] Asset Manager (`assets`)
- [ ] Spell Check (`spelling`)
- [ ] Script History (`history`)

## Menus

- [ ] File
- [ ] Edit
- [ ] View
- [ ] Insert
- [ ] Format
- [ ] Project
- [ ] Tools
- [ ] Help

## Audits

- [ ] Stability audit — crash paths, silent no-ops, error handling, state that can desync
- [ ] Security — secrets/PAT exposure, external fetches, storage, injection surfaces
- [ ] Cleanup — dead code, unused exports, stale files, TODO/FIXME debt
- [ ] Recommendations — prioritized list of what to fix next and release blockers

---

### Notes / open threads per item

- **Scrapbook** — shipped in this pass so far: split stylesheet (v3.55), header/count,
  Insert Picture, Return-to-Editor button, pop-out enabled (v3.81), table bar auto-hide,
  unified text-box border. **Open:** item 2 "restore image/table options in the toolbar"
  awaiting clarification on which options.
