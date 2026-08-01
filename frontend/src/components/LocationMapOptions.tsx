/**
 * LocationMapOptions (v5.77) — the Map view's options button, in the window
 * header's control cluster.
 *
 * Derek: "add an expanded options button in the header. one of the options is
 * to delete the background. another is to replace it."
 *
 * It lives in the CHROME (beside View / Filter / Sort / Search) rather than
 * on a toolbar inside the map, which is where v5.75 put Replace and Remove —
 * the body is for content, the header is for controls, and that is how every
 * other window here is arranged.
 *
 * The file input lives here too: the same button both replaces the map and
 * imports the first one, so the picking machinery belongs with the menu that
 * offers it. Choosing a NEW map clears the rotation lock — the fresh image
 * gets its own one-time rotation pass (see LocationMapTab).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FaEllipsisH } from 'react-icons/fa';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useAssetStore } from '../stores/assetStore';
import { api } from '../services/api';
import { showToast } from './Toast';
import { confirmDialog } from './ConfirmDialog';
import { CharacterImagePickerDialog } from './CharacterImageOverlays';

/** Read a chosen file into the store as the map, project-asset or data-URL —
 *  the two-path rule every image in this app follows. Shared with the Map
 *  tab's own "Add Map" button so there is one importer, not two. */
export async function importLocationMap(file: File): Promise<boolean> {
  if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return false; }
  const store = useEditorStore.getState();
  try {
    const currentProject = useProjectStore.getState().currentProject;
    if (currentProject) {
      const asset = await api.uploadAsset(currentProject.id, file, ['location-map']);
      store.setLocationMapImage({
        assetId: asset.id, projectId: currentProject.id,
        filename: asset.filename ?? file.name, rotation: 0, rotationLocked: false,
      });
    } else {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      store.setLocationMapImage({ src: dataUrl, filename: file.name, rotation: 0, rotationLocked: false });
    }
    return true;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not add the map', 'error');
    return false;
  }
}

export default function LocationMapOptions() {
  const mapImage = useEditorStore((s) => s.locationMapImage);
  const setMapImage = useEditorStore((s) => s.setLocationMapImage);
  const currentProject = useProjectStore((s) => s.currentProject);
  const { assets, setAssets } = useAssetStore();
  const imageAssets = useMemo(() => assets.filter((a) => a.mime_type.startsWith('image/')), [assets]);

  const btnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState('');

  const open = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 200) });
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await importLocationMap(file);
  }, []);

  const openAssetPicker = useCallback(async () => {
    if (!currentProject) return;
    setAssetFilter('');
    setPickerOpen(true);
    try { setAssets(await api.listAssets(currentProject.id)); } catch { /* stale list still renders */ }
  }, [currentProject, setAssets]);

  const deleteMap = useCallback(async () => {
    if (!(await confirmDialog(
      'Delete the map background? The pins and everything written on them are kept, and reappear if you add a map again.',
      { title: 'Delete Background', confirmLabel: 'Delete', danger: true },
    ))) return;
    setMapImage(null);
  }, [setMapImage]);

  const item = (label: string, onPick: () => void) => (
    <button className="char-upload-menu-item" onClick={() => { setPos(null); onPick(); }}>{label}</button>
  );

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <button
        ref={btnRef}
        className="tool-ctl locmap-options-btn"
        title="Map options"
        onClick={() => (pos ? setPos(null) : open())}
      ><FaEllipsisH /></button>
      {pos && createPortal(
        <>
          {/* A click anywhere else closes it — the menu is portalled to
              <body> because a panel clips absolutely-positioned children
              (the AddMenu lesson). */}
          <div className="locmap-menu-veil" onPointerDown={() => setPos(null)} />
          <div className="char-upload-menu" style={{ top: pos.top, left: pos.left }}>
            {item(mapImage ? 'Replace background…' : 'Add background…', () => fileRef.current?.click())}
            {currentProject && item('From Asset Manager…', () => { void openAssetPicker(); })}
            {mapImage && item('Delete background', () => { void deleteMap(); })}
          </div>
        </>,
        document.body,
      )}
      {pickerOpen && currentProject && (
        <CharacterImagePickerDialog
          forName="the Location Map"
          filter={assetFilter}
          setFilter={setAssetFilter}
          imageAssets={imageAssets}
          linkedImageIds={[]}
          projectId={currentProject.id}
          onAssociate={(assetId: string) => {
            const asset = imageAssets.find((a) => a.id === assetId);
            setMapImage({
              assetId, projectId: currentProject.id, filename: asset?.filename ?? null,
              rotation: 0, rotationLocked: false,
            });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
