# Archived checks

These drove UI that has since been rebuilt — the annotation editor's popover,
the Pages body controls before they moved to the header, the Sticky Notes tab
strip. They are kept because they record how a feature behaved and how it was
driven, which is useful when one of them comes back up for change.

They are NOT run: `check-all.mjs` globs `devtools/check-*.mjs` and does not
descend into this folder.

Reviving one means repairing its selectors against today's DOM — expect that
to be most of the work, and only worth doing if the area is being changed.

| file | what superseded it |
|---|---|
| check-pages-controls.mjs | Go-to moved from the body to the window header (v5.47) |
| check-v524.mjs | the Sticky Notes tab strip was rebuilt (v5.22 → v5.36) |
| check-v525.mjs | the annotation popover's highlight row was rebuilt (v5.46) |
| check-v527.mjs | the annotation/ribbon visibility controls moved into the View menu (v5.27) |
| check-v529.mjs | same visibility rework |
| check-tools-v521.mjs | the tool-window chrome was rebuilt across v5.21–v5.36 |
| check-v526.mjs | the Annotations panel's add button was reworked (v5.32+) |
| check-v532.mjs | tool action rows moved into the body's first row (v5.01 rule, applied later) |
| check-v539.mjs | Title Page became a fullscreen-only tool, off the dock |
| check-v542.mjs | the header cluster was re-laid-out (v5.80's order rule) |
| check-v544.mjs | the Pages action row was renamed and reordered (v5.45+) |
| check-v557.mjs | superseded by the v5.6x design-window work |

| check-v528.mjs | annotation visibility moved into the View menu (v5.27) |
| check-v530.mjs | the panel gained its own empty state |
| check-v531.mjs | the tag combos moved into the tag manager |
| check-v533.mjs | the per-window ⋮ became the shared window chrome |
| check-v537.mjs | Design became a single-window tool |

A note on why these five are here rather than repaired: their stale
assertions could be removed cleanly, but the SETUP that drove the retired
feature — the clicks that opened a popover that no longer exists — remained,
and crashed. Untangling that is most of the work of rewriting the check, and
the areas have been rebuilt since. Better parked than half-repaired.

**Rule used:** where MOST of a file's assertions failed, the feature it drove
had been rebuilt and the file was archived. Where a few failed among many,
the stale assertions were removed and the file kept — those files still
describe today's app and go on guarding it.
