import React, { useState, useCallback } from 'react';
import { useEditorStore, DEFAULT_PAGE_LAYOUT, DEFAULT_HEADER_CONTENT, DEFAULT_FOOTER_CONTENT } from '../stores/editorStore';
import type { PageLayout, HeaderFooterContent } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Modal } from './Modal';

interface PageSetupCommonProps {
  /* v7.10, Derek: "'page setup' used to have a full page of fields for the
     various measurement options. This is what you should see when clicking
     view on an item in the current Page Setup tab. make equivalents for the
     other templates."

     THIS is that page of fields, and there is only one of it. Given `value`
     + `onSave` it edits whatever the caller owns — a TEMPLATE's page layout
     — instead of the open document's. Left out (File ▸ Page Setup, Settings
     ▸ Page Setup) it behaves exactly as before and writes the document. Do
     not fork it: two copies of these twenty fields WILL drift. */
  value?: PageLayout;
  onSave?: (next: PageLayout) => void;
  /** Reset returns to this instead of the app defaults (a template's own). */
  resetTo?: PageLayout;
}

/* v7.49, Derek: "this window needs a cancel button" — of the Page Setup window
   Settings ▸ Page Setup ▸ View opens.

   It had one. `embedded` was hiding it, and the reason is worth keeping,
   because it is one prop doing two jobs:

     · "don't draw your own overlay and box, the caller draws them" — which is
       true of BOTH embedded callers, and
     · "there is nowhere to cancel to" — which is true of only one.

   Those coincided until the template Page Setup window arrived: it embeds the
   fields inside its OWN window, with its own header and its own dismiss, so
   Cancel is entirely meaningful there — and was gated off by a flag that was
   never about that. The Guided Setup wizard is the genuine no-Cancel case; its
   step IS this page, so it passed `onClose={() => {}}`, a handler that goes
   nowhere.

   So the two questions are asked separately now, and the second one is not a
   boolean that can drift from the truth: CANCEL EXISTS IF AND ONLY IF THERE IS
   SOMETHING FOR IT TO CALL. A caller with nowhere to dismiss to passes no
   onClose and gets no button, rather than a button that does nothing — and the
   union below makes that unrepresentable for the modal path, where a window
   with no way out is a trap. */
export type PageSetupDialogProps =
  /* Its own modal. A dismiss is structural, not optional. */
  | (PageSetupCommonProps & { embedded?: false; onClose: () => void })
  /* Fields only. onClose is what Cancel calls and what Apply calls after
     saving; omit it and neither happens, which is right for a wizard step. */
  | (PageSetupCommonProps & { embedded: true; onClose?: () => void });

// name is the stable option value; the visible label is built per the units setting.
const PAGE_SIZES: Array<{ name: string; width: number; height: number }> = [
  { name: 'US Letter', width: 8.5, height: 11 },
  { name: 'A4', width: 8.27, height: 11.69 },
  { name: 'US Legal', width: 8.5, height: 14 },
];

function ptToIn(pt: number): number {
  return +(pt / 72).toFixed(3);
}

function inToPt(inches: number): number {
  return Math.round(inches * 72);
}

const CM_PER_IN = 2.54;

const PageSetupDialog: React.FC<PageSetupDialogProps> = (props) => {
  /* Destructured for the body, but the modal tail below narrows on `props`
     itself — destructuring severs a discriminated union from its discriminant,
     and the union is the whole point: it is what makes "a modal with no way
     out" fail to compile rather than fail in front of a writer. */
  const { onClose, embedded = false, value, onSave, resetTo } = props;
  const { pageLayout: docLayout, setPageLayout } = useEditorStore();
  const pageLayout = value ?? docLayout;

  // v1.61: Settings > General > Measurements. The layout is STORED in inches
  // (and points for the pt-based margins) regardless — only the display converts,
  // so switching units never drifts the saved values.
  const units = useSettingsStore((s) => s.units);
  const cm = units === 'cm';
  const u = cm ? 'cm' : 'in';
  const dispIn = (inches: number) => (cm ? +(inches * CM_PER_IN).toFixed(2) : inches);
  const parseIn = (raw: string, fallbackIn: number) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return fallbackIn;
    return cm ? +(n / CM_PER_IN).toFixed(4) : n;
  };
  const sizeStep = cm ? '0.05' : '0.01';
  const marginStep = cm ? '0.1' : '0.05';
  const sizeLabel = (s: { name: string; width: number; height: number }) =>
    cm
      ? `${s.name} (${+(s.width * CM_PER_IN).toFixed(2)} x ${+(s.height * CM_PER_IN).toFixed(2)} cm)`
      : `${s.name} (${s.width}" x ${s.height}")`;

  // Backwards-compatible: fill in missing headerContent/footerContent for old layouts
  const [layout, setLayout] = useState<PageLayout>({
    ...pageLayout,
    headerContent: pageLayout.headerContent || { ...DEFAULT_HEADER_CONTENT },
    footerContent: pageLayout.footerContent || { ...DEFAULT_FOOTER_CONTENT },
    headerStartPage: pageLayout.headerStartPage ?? 2,
    footerStartPage: pageLayout.footerStartPage ?? 1,
  });

  const setField = useCallback(
    <K extends keyof PageLayout>(key: K, value: PageLayout[K]) => {
      setLayout((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setHeaderField = useCallback(
    (pos: keyof HeaderFooterContent, value: string) => {
      setLayout((prev) => ({
        ...prev,
        headerContent: { ...prev.headerContent, [pos]: value },
      }));
    },
    [],
  );

  const setFooterField = useCallback(
    (pos: keyof HeaderFooterContent, value: string) => {
      setLayout((prev) => ({
        ...prev,
        footerContent: { ...prev.footerContent, [pos]: value },
      }));
    },
    [],
  );

  // Detect current page size
  const currentSizeName = PAGE_SIZES.find(
    (s) =>
      Math.abs(s.width - layout.pageWidth) < 0.05 &&
      Math.abs(s.height - layout.pageHeight) < 0.05,
  )?.name || 'Custom';

  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const size = PAGE_SIZES.find((s) => s.name === e.target.value);
      if (size) {
        setLayout((prev) => ({
          ...prev,
          pageWidth: size.width,
          pageHeight: size.height,
        }));
      }
    },
    [],
  );

  const handleApply = useCallback(() => {
    if (onSave) onSave(layout);
    else setPageLayout(layout);
    onClose?.();
  }, [layout, onSave, setPageLayout, onClose]);

  const handleReset = useCallback(() => {
    setLayout({ ...(resetTo ?? DEFAULT_PAGE_LAYOUT) });
  }, [resetTo]);

  const body = (
    <>
        <div className="dialog-body" style={embedded ? { padding: '4px 0 0' } : undefined}>
          {/* Page Size */}
          <div className="page-setup-section">
            <div className="page-setup-section-title">Page Size</div>
            <div className="page-setup-row">
              <label>Size</label>
              <select
                value={currentSizeName}
                onChange={handlePageSizeChange}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s.name} value={s.name}>
                    {sizeLabel(s)}
                  </option>
                ))}
                {currentSizeName === 'Custom' && (
                  <option value="Custom">Custom</option>
                )}
              </select>
            </div>
            <div className="page-setup-row-pair">
              <div className="page-setup-row">
                <label>Width ({u})</label>
                <input
                  type="number"
                  step={sizeStep}
                  min={dispIn(4)}
                  max={dispIn(20)}
                  value={dispIn(layout.pageWidth)}
                  onChange={(e) =>
                    setField('pageWidth', parseIn(e.target.value, 8.5))
                  }
                />
              </div>
              <div className="page-setup-row">
                <label>Height ({u})</label>
                <input
                  type="number"
                  step={sizeStep}
                  min={dispIn(4)}
                  max={dispIn(30)}
                  value={dispIn(layout.pageHeight)}
                  onChange={(e) =>
                    setField('pageHeight', parseIn(e.target.value, 11))
                  }
                />
              </div>
            </div>
          </div>

          {/* Margins */}
          <div className="page-setup-section">
            <div className="page-setup-section-title">Margins</div>
            <div className="page-setup-row-pair">
              <div className="page-setup-row">
                <label>Top ({u})</label>
                <input
                  type="number"
                  step={marginStep}
                  min="0"
                  max={dispIn(4)}
                  value={dispIn(ptToIn(layout.topMargin))}
                  onChange={(e) =>
                    setField(
                      'topMargin',
                      inToPt(parseIn(e.target.value, 0)),
                    )
                  }
                />
              </div>
              <div className="page-setup-row">
                <label>Bottom ({u})</label>
                <input
                  type="number"
                  step={marginStep}
                  min="0"
                  max={dispIn(4)}
                  value={dispIn(ptToIn(layout.bottomMargin))}
                  onChange={(e) =>
                    setField(
                      'bottomMargin',
                      inToPt(parseIn(e.target.value, 0)),
                    )
                  }
                />
              </div>
            </div>
            <div className="page-setup-row-pair">
              <div className="page-setup-row">
                <label>Left ({u})</label>
                <input
                  type="number"
                  step={marginStep}
                  min="0"
                  max={dispIn(4)}
                  value={dispIn(layout.leftMargin)}
                  onChange={(e) =>
                    setField(
                      'leftMargin',
                      parseIn(e.target.value, 0),
                    )
                  }
                />
              </div>
              <div className="page-setup-row">
                <label>Right ({u})</label>
                <input
                  type="number"
                  step={marginStep}
                  min="0"
                  max={dispIn(4)}
                  value={dispIn(layout.rightMargin)}
                  onChange={(e) =>
                    setField(
                      'rightMargin',
                      parseIn(e.target.value, 0),
                    )
                  }
                />
              </div>
            </div>
          </div>

          {/* Header / Footer */}
          <div className="page-setup-section">
            <div className="page-setup-section-title">Header &amp; Footer</div>
            <div className="page-setup-row-pair">
              <div className="page-setup-row">
                <label>Header margin ({u})</label>
                <input
                  type="number"
                  step={marginStep}
                  min="0"
                  max={dispIn(2)}
                  value={dispIn(ptToIn(layout.headerMargin))}
                  onChange={(e) =>
                    setField(
                      'headerMargin',
                      inToPt(parseIn(e.target.value, 0)),
                    )
                  }
                />
              </div>
              <div className="page-setup-row">
                <label>Footer margin ({u})</label>
                <input
                  type="number"
                  step={marginStep}
                  min="0"
                  max={dispIn(2)}
                  value={dispIn(ptToIn(layout.footerMargin))}
                  onChange={(e) =>
                    setField(
                      'footerMargin',
                      inToPt(parseIn(e.target.value, 0)),
                    )
                  }
                />
              </div>
            </div>

            <div className="page-setup-hf-label">Header Content</div>
            <div className="page-setup-hf-hint">
              Fields: {'{page}'} {'{pages}'} {'{title}'} {'{date}'} {'{revision}'}
            </div>
            <div className="page-setup-hf-row">
              <input
                placeholder="Left"
                value={layout.headerContent.left}
                onChange={(e) => setHeaderField('left', e.target.value)}
              />
              <input
                placeholder="Center"
                value={layout.headerContent.center}
                onChange={(e) => setHeaderField('center', e.target.value)}
              />
              <input
                placeholder="Right"
                value={layout.headerContent.right}
                onChange={(e) => setHeaderField('right', e.target.value)}
              />
            </div>
            <div className="page-setup-row">
              <label>Start on page</label>
              <input
                type="number"
                step="1"
                min="1"
                max="999"
                value={layout.headerStartPage}
                onChange={(e) =>
                  setField('headerStartPage', parseInt(e.target.value, 10) || 1)
                }
                style={{ width: 60 }}
              />
            </div>

            <div className="page-setup-hf-label" style={{ marginTop: 12 }}>Footer Content</div>
            <div className="page-setup-hf-row">
              <input
                placeholder="Left"
                value={layout.footerContent.left}
                onChange={(e) => setFooterField('left', e.target.value)}
              />
              <input
                placeholder="Center"
                value={layout.footerContent.center}
                onChange={(e) => setFooterField('center', e.target.value)}
              />
              <input
                placeholder="Right"
                value={layout.footerContent.right}
                onChange={(e) => setFooterField('right', e.target.value)}
              />
            </div>
            <div className="page-setup-row">
              <label>Start on page</label>
              <input
                type="number"
                step="1"
                min="1"
                max="999"
                value={layout.footerStartPage}
                onChange={(e) =>
                  setField('footerStartPage', parseInt(e.target.value, 10) || 1)
                }
                style={{ width: 60 }}
              />
            </div>
          </div>
        </div>

        <div className="dialog-actions" style={embedded ? { border: 'none', padding: '14px 0 0' } : undefined}>
          <button className="page-setup-reset" onClick={handleReset}>
            Reset Default
          </button>
          <div className="page-setup-spacer" />
          {onClose && <button className="dialog-btn" onClick={onClose}>Cancel</button>}
          <button className="dialog-btn dialog-btn-primary" onClick={handleApply}>
            Apply
          </button>
        </div>
    </>
  );

  if (props.embedded) return body;

  return (
    <Modal onClose={props.onClose} boxClassName="page-setup-dialog">
        <div className="dialog-header">Page Setup</div>
        {body}
    </Modal>
  );
};

export default PageSetupDialog;
