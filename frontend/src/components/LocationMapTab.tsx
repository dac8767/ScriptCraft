/**
 * LocationMapTab (v5.75/v5.76) — the Locations window's Map tab.
 *
 * Derek: "allow the user to upload a map, which acts as a background in the
 * tab, and then the user can pin locations from the list onto the map."
 *
 * Shape: a rail of the locations that aren't pinned yet (drag one onto the
 * map to place it) beside the map itself. The rail is fed by the SAME
 * filtered/sorted list the List tab shows — the window's Filter/Sort/Search
 * keep working here rather than becoming decorative on this tab.
 *
 * The map sits in a stage whose pixel size is MEASURED to the image's own
 * aspect ratio (see the sizing note below), so the stage box and the image
 * box are the same box and a pin at (0.5, 0.5) is on the middle of the map at
 * every window size. Pins carry fractions, never pixels (utils/locationPins).
 *
 * v5.76: the image itself loads through AssetImage — the app's ONE image
 * loader — not a private copy. See MapImage.
 *
 * WebKit: every drag handler here calls dataTransfer.setData() — without it
 * WebKit refuses to start the drag and the whole tab is dead in the app while
 * looking perfect in a browser (CLAUDE.md §4).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FaMapMarkerAlt, FaRegImage, FaRegTrashAlt } from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useAssetStore } from '../stores/assetStore';
import { api } from '../services/api';
import { resolveImageUrl } from '../utils/imageAsset';
import { AssetImage, ImageSourceMenu } from './CharacterAssetMedia';
import { CharacterImagePickerDialog } from './CharacterImageOverlays';
import { showToast } from './Toast';
import { confirmDialog } from './ConfirmDialog';
import { visiblePins, unpinnedLocations, dropFraction, type LocationMapImage } from '../utils/locationPins';

/** The MIME type the rail's drags carry. A named type means a drag from
 *  anywhere else in the app can't be mistaken for a location drop. */
const PIN_MIME = 'application/x-scriptcraft-location';

interface LocationLike {
  name: string;
  sceneIndices: number[];
}

interface Props {
  /** The window's already filtered/sorted locations — the List tab's list. */
  locations: LocationLike[];
  /** Jump the editor to a scene (clicking a pin goes to its first scene). */
  onGoToScene: (sceneIndex: number) => void;
}

/**
 * The map bitmap.
 *
 * v5.76, Derek ("the image is not displaying"): an ASSET-backed map goes
 * through AssetImage — THE app's image loader — not a third hand-rolled one.
 * It reads the bytes with api.getAssetBytes and hands the <img> a blob URL,
 * which is the only thing that works on every backend: on the desktop
 * getAssetUrl returns a convertFileSrc asset:// path that the webview will
 * not load here, which is exactly why AssetImage exists. v5.75 pointed an
 * <img src> straight at that URL and got a broken-image box.
 *
 * A local-only map (no project) has no asset — it carries a data: URL, which
 * every webview loads directly.
 */
const MapImage: React.FC<{
  img: LocationMapImage;
  onNaturalSize?: (ratio: number) => void;
  onFailed?: () => void;
}> = ({ img, onNaturalSize, onFailed }) => {
  const reportSize = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.naturalWidth && el.naturalHeight) onNaturalSize?.(el.naturalWidth / el.naturalHeight);
  }, [onNaturalSize]);

  if (img.assetId && img.projectId) {
    return (
      <AssetImage
        projectId={img.projectId}
        assetId={img.assetId}
        className="locmap-img"
        alt="Location map"
        onLoad={reportSize}
        onFailed={onFailed}
      />
    );
  }
  const direct = resolveImageUrl(img) || '';
  if (!direct) return <div className="locmap-img-loading" />;
  return (
    <img
      className="locmap-img"
      src={direct}
      alt="Location map"
      draggable={false}
      onLoad={reportSize}
      onError={onFailed}
    />
  );
};

const LocationMapTab: React.FC<Props> = ({ locations, onGoToScene }) => {
  const mapImage = useEditorStore((s) => s.locationMapImage);
  const setMapImage = useEditorStore((s) => s.setLocationMapImage);
  const pins = useEditorStore((s) => s.locationPins);
  const pinLocation = useEditorStore((s) => s.pinLocation);
  const unpinLocation = useEditorStore((s) => s.unpinLocation);

  const currentProject = useProjectStore((s) => s.currentProject);
  const { assets, setAssets } = useAssetStore();
  const imageAssets = useMemo(() => assets.filter((a) => a.mime_type.startsWith('image/')), [assets]);

  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [srcMenu, setSrcMenu] = useState<{ top: number; left: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState('');
  const [dragOver, setDragOver] = useState(false);

  /* ── sizing the map ───────────────────────────────────────────────────
     The stage must be EXACTLY the image's box: that is what makes a pin's
     fractions fractions OF THE MAP rather than of some surrounding padding.
     CSS alone won't do it. `max-width/max-height: 100%` leaves the image
     contributing its NATURAL width to layout, and a 4000px-wide map then
     sized the whole tab — pushing the map, the pins and the rail clean out
     of a narrowed window. So the fit is MEASURED: the canvas reports its box,
     the image reports its aspect ratio, and the stage gets an explicit pixel
     size that can't leak upward. */
  const [mapRatio, setMapRatio] = useState<number | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [canvasBox, setCanvasBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setCanvasBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapImage]);

  /** The image's box, letterboxed inside the canvas — `object-fit: contain`,
   *  computed rather than delegated, so the stage IS that box. */
  const stageSize = useMemo(() => {
    const pad = 32;                                  // breathing room for edge pins
    const availW = Math.max(40, canvasBox.w - pad);
    const availH = Math.max(40, canvasBox.h - pad);
    if (!canvasBox.w || !canvasBox.h) return undefined;
    // Before the image reports its shape (and when it can't load at all) the
    // stage still needs a box — otherwise the placeholder has nowhere to
    // render and the tab looks empty rather than busy or broken.
    const ratio = mapRatio || 4 / 3;
    const w = Math.min(availW, availH * ratio);
    return { width: Math.round(w), height: Math.round(w / ratio) };
  }, [mapRatio, canvasBox]);

  const names = useMemo(() => locations.map((l) => l.name), [locations]);
  const drawnPins = useMemo(() => visiblePins(pins, names), [pins, names]);
  const railLocations = useMemo(() => unpinnedLocations(locations, pins), [locations, pins]);
  const sceneOf = useCallback(
    (name: string) => locations.find((l) => l.name.toUpperCase() === name.toUpperCase())?.sceneIndices[0],
    [locations],
  );

  // ── the map image ────────────────────────────────────────────────────
  const chooseLocal = useCallback(() => fileRef.current?.click(), []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return; }
    try {
      // Same two-path rule every image in the app follows: a project stores
      // an ASSET (the file stays out of the script), local-only stores a
      // data URL so the map still travels with the .odraft file.
      if (currentProject) {
        const asset = await api.uploadAsset(currentProject.id, file, ['location-map']);
        setMapImage({ assetId: asset.id, projectId: currentProject.id, filename: asset.filename ?? file.name });
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
        setMapImage({ src: dataUrl, filename: file.name });
      }
      setMapRatio(null);            // a new map re-measures on load
      setMapFailed(false);
      showToast('Map added', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add the map', 'error');
    }
  }, [currentProject, setMapImage]);

  const openAssetPicker = useCallback(async () => {
    if (!currentProject) return;
    setAssetFilter('');
    setPickerOpen(true);
    try { setAssets(await api.listAssets(currentProject.id)); } catch { /* stale list still renders */ }
  }, [currentProject, setAssets]);

  const removeMap = useCallback(async () => {
    if (!(await confirmDialog('Remove the map? The pinned locations are kept, and reappear if you add a map again.', {
      title: 'Remove Map', confirmLabel: 'Remove', danger: true,
    }))) return;
    setMapImage(null);
  }, [setMapImage]);

  const openSourceMenu = useCallback((e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSrcMenu({ top: r.bottom + 4, left: r.left });
  }, []);

  // ── dropping a location on the map ───────────────────────────────────
  const dropAt = useCallback((name: string, clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage || !name) return;
    const { x, y } = dropFraction(stage.getBoundingClientRect(), clientX, clientY);
    pinLocation(name, x, y);
  }, [pinLocation]);

  const onStageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const name = e.dataTransfer.getData(PIN_MIME) || e.dataTransfer.getData('text/plain');
    dropAt(name, e.clientX, e.clientY);
  }, [dropAt]);

  const startDrag = useCallback((e: React.DragEvent, name: string) => {
    // WebKit starts NO drag without setData — see the header comment.
    e.dataTransfer.setData(PIN_MIME, name);
    e.dataTransfer.setData('text/plain', name);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const hasMap = !!mapImage;

  return (
    <div className="locmap">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

      {/* ── the rail: locations still to place ─────────────────────── */}
      <div className="locmap-rail">
        <div className="locmap-rail-head">
          {hasMap ? 'Drag onto the map' : 'Locations'}
          <span className="locmap-rail-count">{railLocations.length}</span>
        </div>
        <div className="locmap-rail-list">
          {locations.length === 0 ? (
            <div className="navigator-empty">
              No locations yet. Scene headings like &ldquo;INT. COFFEE SHOP - DAY&rdquo; will appear here.
            </div>
          ) : railLocations.length === 0 ? (
            <div className="navigator-empty">Every location is on the map.</div>
          ) : (
            railLocations.map((loc) => (
              <div
                key={loc.name}
                className={`locmap-rail-item${hasMap ? '' : ' locmap-rail-item-idle'}`}
                draggable={hasMap}
                onDragStart={(e) => startDrag(e, loc.name)}
                title={hasMap ? `Drag ${loc.name} onto the map` : 'Add a map to start pinning'}
              >
                <FaMapMarkerAlt className="locmap-rail-icon" />
                <span className="locmap-rail-name">{loc.name}</span>
                <span className="locmap-rail-scenes">{loc.sceneIndices.length}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── the map ────────────────────────────────────────────────── */}
      <div className="locmap-main">
        {!hasMap ? (
          <div className="locmap-empty">
            <FaRegImage className="locmap-empty-icon" />
            <div className="locmap-empty-title">No map yet</div>
            <p className="locmap-empty-text">
              Add a map — a world, a city, a floor plan — then drag locations from the
              list onto it.
            </p>
            <button className="locmap-add-btn" onClick={openSourceMenu}>Add Map</button>
          </div>
        ) : (
          <>
            <div className="locmap-toolbar">
              <button className="locmap-tool-btn" onClick={openSourceMenu} title="Replace this map">
                <FaRegImage /> Replace
              </button>
              <button className="locmap-tool-btn" onClick={removeMap} title="Remove this map">
                <FaRegTrashAlt /> Remove
              </button>
              <span className="locmap-pin-count">
                {drawnPins.length} of {locations.length} pinned
              </span>
            </div>
            {/* Two layers on purpose: the canvas takes its size from the
                window, and the scroll layer inside it is ABSOLUTE, so neither
                the map nor its pins contribute intrinsic width to any
                ancestor. Without that, a wide map sized the whole tab and
                shoved it out of a narrowed window — and measuring the canvas
                to fit the map then fed back on itself. */}
            <div className="locmap-canvas" ref={canvasRef}>
              <div
                className={`locmap-scroll${dragOver ? ' locmap-scroll-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onStageDrop}
              >
              {/* The stage is sized BY the image, so a pin's fractions are
                  fractions OF THE MAP — not of the surrounding box. */}
                <div className="locmap-stage" ref={stageRef} style={stageSize}>
                  {mapFailed ? (
                    <div className="locmap-broken">
                      <FaRegImage className="locmap-empty-icon" />
                      <div className="locmap-empty-title">This map couldn&rsquo;t be loaded</div>
                      <p className="locmap-empty-text">
                        The image file may have been moved or deleted. Replace it to
                        put the map back &mdash; the pins are kept.
                      </p>
                      <button className="locmap-add-btn" onClick={openSourceMenu}>Replace Map</button>
                    </div>
                  ) : (
                    <MapImage img={mapImage} onNaturalSize={setMapRatio} onFailed={() => setMapFailed(true)} />
                  )}
                {drawnPins.map((pin) => {
                  const scene = sceneOf(pin.name);
                  return (
                    <div
                      key={pin.name}
                      className="locmap-pin"
                      style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                      draggable
                      onDragStart={(e) => startDrag(e, pin.name)}
                      onClick={() => { if (scene !== undefined) onGoToScene(scene); }}
                      title={scene !== undefined ? `${pin.name} — go to scene ${scene + 1}` : pin.name}
                    >
                      <FaMapMarkerAlt className="locmap-pin-icon" />
                      <span className="locmap-pin-label">{pin.name}</span>
                      <button
                        className="locmap-pin-remove"
                        title="Take off the map"
                        onClick={(e) => { e.stopPropagation(); unpinLocation(pin.name); }}
                      >×</button>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {srcMenu && (
        <ImageSourceMenu
          pos={srcMenu}
          onLocal={chooseLocal}
          onAssets={currentProject ? () => { void openAssetPicker(); } : undefined}
          onRemove={hasMap ? () => { void removeMap(); } : undefined}
          onClose={() => setSrcMenu(null)}
        />
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
            setMapImage({ assetId, projectId: currentProject.id, filename: asset?.filename ?? null });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};

export default LocationMapTab;
