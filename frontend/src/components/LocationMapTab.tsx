/**
 * LocationMapTab (v5.75, remodelled v5.77) — the Locations window's Map view.
 *
 * Derek's v5.77 brief:
 *  - rotate the background ON IMPORT only, then the rotation is fixed;
 *  - map actions behind one options button in the HEADER (LocationMapOptions);
 *  - click the map to drop a pin, then a dropdown picks (or creates) the
 *    location it stands for (LocationPinMenu);
 *  - the sidebar lists EVERY location; clicking one opens display name,
 *    description and "+ Add custom field", the Characters window's affordance.
 *
 * Why rotation locks: a pin's position is a fraction of the image AS SHOWN.
 * Rotating afterwards would move every pin off its landmark, so the turn is
 * offered once — during import — and then closed.
 *
 * The map sits in a stage whose pixel size is MEASURED (see the sizing note
 * below) to the image's rotated aspect ratio, so the stage box and the image
 * box are the same box, and a pin at (0.5, 0.5) is on the middle of the map
 * at every window size.
 *
 * The image loads through AssetImage — the app's ONE image loader. On the
 * desktop, getAssetUrl returns a convertFileSrc asset:// path an <img src>
 * will not load; that is what v5.76 fixed and what this must keep doing.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FaMapMarkerAlt, FaRegImage, FaChevronRight, FaChevronDown, FaRegTrashAlt, FaUndo } from 'react-icons/fa';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { resolveImageUrl } from '../utils/imageAsset';
import { AssetImage } from './CharacterAssetMedia';
import { promptDialog } from './ConfirmDialog';
import { showToast } from './Toast';
import LocationPinMenu from './LocationPinMenu';
import { importLocationMap } from './LocationMapOptions';
import { renameLocationInScript } from '../utils/renameLocationInScript';
import {
  pinnedPlaces, unplacedLocations, placeForLocation, placeLabel, dropFraction, rotatedRatio,
  type LocationMapImage, type LocationPlace,
} from '../utils/locationPlaces';

interface LocationLike {
  name: string;
  sceneIndices: number[];
}

interface Props {
  /** The window's already filtered/sorted locations — the List view's list. */
  locations: LocationLike[];
  onGoToScene: (sceneIndex: number) => void;
  editor: Editor | null;
}

/** The map bitmap. Asset-backed maps go through AssetImage (bytes → blob URL,
 *  the only path that works on every backend); a local-only map carries a
 *  data: URL that every webview loads directly. */
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
        projectId={img.projectId} assetId={img.assetId}
        className="locmap-img" alt="Location map"
        onLoad={reportSize} onFailed={onFailed}
      />
    );
  }
  const direct = resolveImageUrl(img) || '';
  if (!direct) return <div className="locmap-img-loading" />;
  return (
    <img className="locmap-img" src={direct} alt="Location map" draggable={false}
      onLoad={reportSize} onError={onFailed} />
  );
};

const LocationMapTab: React.FC<Props> = ({ locations, onGoToScene, editor }) => {
  const mapImage = useEditorStore((s) => s.locationMapImage);
  const rotateMap = useEditorStore((s) => s.rotateLocationMap);
  const lockRotation = useEditorStore((s) => s.lockLocationMapRotation);
  const places = useEditorStore((s) => s.locationPlaces);
  const addPin = useEditorStore((s) => s.addLocationPin);
  const movePin = useEditorStore((s) => s.moveLocationPin);
  const unpinPlace = useEditorStore((s) => s.unpinLocationPlace);
  const updatePlaceIn = useEditorStore((s) => s.updateLocationPlace);
  const attachLocation = useEditorStore((s) => s.attachLocationToPlace);
  const detachLocation = useEditorStore((s) => s.detachLocationFromPlace);
  const addField = useEditorStore((s) => s.addLocationPlaceField);
  const setField = useEditorStore((s) => s.setLocationPlaceField);
  const removeField = useEditorStore((s) => s.removeLocationPlaceField);
  const mergePlaces = useEditorStore((s) => s.mergeLocationPlaces);

  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [menuFor, setMenuFor] = useState<{ id: string; top: number; left: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const draggingRef = useRef<{ id: string; moved: boolean } | null>(null);

  /* ── sizing the map ───────────────────────────────────────────────────
     The stage must be EXACTLY the image's box: that is what makes a pin's
     fractions fractions OF THE MAP. CSS alone won't do it — `max-width/
     max-height: 100%` leaves the image contributing its NATURAL width to
     layout, and a wide map then sized the whole tab and pushed it out of a
     narrowed window. So the fit is MEASURED, against the ROTATED ratio. */
  const [mapRatio, setMapRatio] = useState<number | null>(null);
  const [canvasBox, setCanvasBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setCanvasBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapImage]);
  const imgKey = `${mapImage?.assetId ?? ''}|${mapImage?.src ? mapImage.src.slice(0, 64) : ''}`;
  React.useEffect(() => { setMapRatio(null); setMapFailed(false); }, [imgKey]);

  const rotation = mapImage?.rotation || 0;
  const shownRatio = mapRatio ? rotatedRatio(mapRatio, rotation) : null;
  const stageSize = useMemo(() => {
    if (!canvasBox.w || !canvasBox.h) return undefined;
    const availW = Math.max(40, canvasBox.w - 32);
    const availH = Math.max(40, canvasBox.h - 32);
    // Before the image reports its shape (and if it can't load at all) the
    // stage still needs a box, so the placeholder has somewhere to render.
    const ratio = shownRatio || 4 / 3;
    const w = Math.min(availW, availH * ratio);
    return { width: Math.round(w), height: Math.round(w / ratio) };
  }, [shownRatio, canvasBox]);

  /** A quarter turn is drawn by rotating the image inside the stage and
   *  swapping its box — the stage itself already carries the rotated ratio. */
  const imgStyle = useMemo((): React.CSSProperties | undefined => {
    if (!rotation) return undefined;
    const quarter = (rotation / 90) % 2 === 1;
    return quarter && stageSize
      ? {
        position: 'absolute', top: '50%', left: '50%',
        width: stageSize.height, height: stageSize.width, maxWidth: 'none',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }
      : { width: '100%', height: '100%', transform: `rotate(${rotation}deg)` };
  }, [rotation, stageSize]);

  const hasMap = !!mapImage;
  const importing = hasMap && !mapImage?.rotationLocked;
  const drawnPins = useMemo(() => pinnedPlaces(places, locations.map((l) => l.name)), [places, locations]);
  const available = useMemo(() => unplacedLocations(locations, places), [locations, places]);

  // ── placing and moving pins ──────────────────────────────────────────
  const openMenuAt = (id: string, clientX: number, clientY: number) =>
    setMenuFor({
      id,
      top: Math.min(clientY + 10, Math.max(60, window.innerHeight - 340)),
      left: Math.min(clientX, Math.max(8, window.innerWidth - 250)),
    });

  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    if (importing || !stageRef.current) return;
    // Only a click on the MAP itself places a pin — not one on a pin, or on
    // the empty canvas around the image.
    const target = e.target as HTMLElement;
    if (!target.closest('.locmap-stage') || target.closest('.locmap-pin')) return;
    const { x, y } = dropFraction(stageRef.current.getBoundingClientRect(), e.clientX, e.clientY);
    const id = addPin(x, y);
    openMenuAt(id, e.clientX, e.clientY);
  }, [addPin, importing]);

  /** Pins move by POINTER drag, not HTML5 drag: a pin is also a click target
   *  (it opens its menu), and a pointer drag tells the two apart by whether
   *  it actually moved. */
  const startPinDrag = useCallback((e: React.PointerEvent, place: LocationPlace) => {
    if (importing) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = { id: place.id, moved: false };
  }, [importing]);

  const onPinMove = useCallback((e: React.PointerEvent) => {
    const drag = draggingRef.current;
    if (!drag || !stageRef.current) return;
    drag.moved = true;
    const { x, y } = dropFraction(stageRef.current.getBoundingClientRect(), e.clientX, e.clientY);
    movePin(drag.id, x, y);
  }, [movePin]);

  const endPinDrag = useCallback((e: React.PointerEvent, place: LocationPlace) => {
    const drag = draggingRef.current;
    draggingRef.current = null;
    if (drag && !drag.moved) openMenuAt(place.id, e.clientX, e.clientY);
  }, []);

  // ── the pin menu's actions ───────────────────────────────────────────
  const menuPlace = menuFor ? places.find((p) => p.id === menuFor.id) : undefined;

  const mergeInto = useCallback((placeId: string, targetId: string) => {
    // ONE call, not a loop of attaches: the two pins become one place, and
    // anything written on this one is carried over (utils/locationPlaces).
    mergePlaces(placeId, targetId);
    showToast('The two pins are now one place', 'success');
  }, [mergePlaces]);

  const renameInScript = useCallback((from: string, to: string) => {
    const n = renameLocationInScript(editor, from, to);
    showToast(
      n > 0 ? `Renamed ${n} scene heading${n === 1 ? '' : 's'}` : 'No scene headings matched',
      n > 0 ? 'success' : 'error',
    );
  }, [editor]);

  // ── the sidebar ──────────────────────────────────────────────────────
  /** Every script location, plus any place the writer made that the script
   *  has no name for ("create a new location" in the pin menu). */
  const sidebarRows = useMemo(() => {
    const rows = locations.map((loc) => ({
      key: loc.name,
      scriptName: loc.name as string | null,
      place: placeForLocation(places, loc.name),
      scenes: loc.sceneIndices.length,
    }));
    for (const p of places) {
      if (p.scriptNames.length === 0 && (p.displayName.trim() || p.description.trim())) {
        rows.push({ key: p.id, scriptName: null, place: p, scenes: 0 });
      }
    }
    return rows;
  }, [locations, places]);

  /** A sidebar row needs a place before it can hold a display name. One is
   *  made on demand — an untouched location costs nothing in the file. */
  const placeFor = useCallback((scriptName: string | null, existing?: LocationPlace): string | null => {
    if (existing) return existing.id;
    if (!scriptName) return null;
    const id = addPin(0, 0);
    updatePlaceIn(id, { x: null, y: null });   // it exists, but it isn't on the map
    attachLocation(id, scriptName);
    return id;
  }, [addPin, updatePlaceIn, attachLocation]);

  const addCustomField = useCallback(async (placeId: string) => {
    const label = await promptDialog('New field name:', '', { title: 'New Custom Field', confirmLabel: 'Add' });
    if (label && label.trim()) addField(placeId, label.trim());
  }, [addField]);

  return (
    <div className="locmap">
      <input
        ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) await importLocationMap(file);
        }}
      />

      {/* ── the sidebar: every location, expandable ─────────────────── */}
      <div className="locmap-rail">
        <div className="locmap-rail-head">
          Locations
          <span className="locmap-rail-count">{sidebarRows.length}</span>
        </div>
        <div className="locmap-rail-list">
          {sidebarRows.length === 0 ? (
            <div className="navigator-empty">
              No locations yet. Scene headings like &ldquo;INT. COFFEE SHOP - DAY&rdquo; will appear here.
            </div>
          ) : sidebarRows.map((row) => {
            const isOpen = expanded === row.key;
            const place = row.place;
            // THIS row's label: the display name when there is one, else this
            // row's OWN script name. (placeLabel would give the place's FIRST
            // script name, so two locations sharing a pin both read as the
            // first one — which is what the sidebar did before this line.)
            const display = place?.displayName.trim() || '';
            const label = display || row.scriptName || placeLabel(place, '');
            // When a display name is standing in for several script
            // locations, each row still says which one IT is.
            const sub = display && row.scriptName && (place?.scriptNames.length ?? 0) > 1 ? row.scriptName : '';
            const pinned = !!place && place.x !== null;
            return (
              <div key={row.key} className={`locmap-rail-item${isOpen ? ' locmap-rail-item-open' : ''}`}>
                <div className="locmap-rail-row" onClick={() => setExpanded(isOpen ? null : row.key)}>
                  <span className="locmap-rail-chevron">{isOpen ? <FaChevronDown /> : <FaChevronRight />}</span>
                  <FaMapMarkerAlt className={`locmap-rail-icon${pinned ? ' locmap-rail-icon-pinned' : ''}`} />
                  <span className="locmap-rail-name" title={row.scriptName || label}>
                    {label}
                    {sub && <span className="locmap-rail-sub"> · {sub}</span>}
                  </span>
                  {row.scenes > 0 && <span className="locmap-rail-scenes">{row.scenes}</span>}
                </div>
                {isOpen && (
                  <div className="locmap-rail-detail">
                    {/* Derek: the display name "overrides what the location
                        name looks like in the location window. it does not
                        change anything in the script" — so the script's own
                        name is shown underneath, and the two never blur. */}
                    <label className="locmap-field-label">Display Name</label>
                    <input
                      className="locmap-field-input"
                      placeholder={row.scriptName || 'Name in the Locations window'}
                      value={place?.displayName ?? ''}
                      onChange={(e) => {
                        const id = placeFor(row.scriptName, place);
                        if (id) updatePlaceIn(id, { displayName: e.target.value });
                      }}
                    />
                    {row.scriptName && (
                      <div className="locmap-field-note">In the script: {row.scriptName}</div>
                    )}

                    <label className="locmap-field-label">Description</label>
                    <textarea
                      className="locmap-field-input locmap-field-textarea"
                      rows={3}
                      value={place?.description ?? ''}
                      onChange={(e) => {
                        const id = placeFor(row.scriptName, place);
                        if (id) updatePlaceIn(id, { description: e.target.value });
                      }}
                    />

                    {place?.fields.map((f) => (
                      <div key={f.id} className="locmap-custom-field">
                        <div className="locmap-custom-label-row">
                          <input
                            className="locmap-field-label locmap-custom-label"
                            value={f.label}
                            title="Rename this field"
                            onChange={(e) => setField(place.id, f.id, { label: e.target.value })}
                          />
                          <button
                            className="locmap-custom-remove" title="Remove this field"
                            onClick={() => removeField(place.id, f.id)}
                          ><FaRegTrashAlt /></button>
                        </div>
                        <textarea
                          className="locmap-field-input locmap-field-textarea"
                          rows={2}
                          value={f.value}
                          onChange={(e) => setField(place.id, f.id, { value: e.target.value })}
                        />
                      </div>
                    ))}
                    <button
                      className="locmap-add-field"
                      onClick={() => {
                        const id = placeFor(row.scriptName, place);
                        if (id) void addCustomField(id);
                      }}
                    >+ Add custom field</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── the map ────────────────────────────────────────────────── */}
      <div className="locmap-main">
        {!hasMap ? (
          <div className="locmap-empty">
            <FaRegImage className="locmap-empty-icon" />
            <div className="locmap-empty-title">No map yet</div>
            <p className="locmap-empty-text">
              Add a map — a world, a city, a floor plan — then click it to drop a pin
              and say which location stands there.
            </p>
            <button className="locmap-add-btn" onClick={() => fileRef.current?.click()}>Add Map</button>
          </div>
        ) : (
          <>
            {/* Rotation is offered ONCE, while importing. Derek: "once the
                rotation is set, it cannot be changed." */}
            {importing && (
              <div className="locmap-import-bar">
                <span className="locmap-import-text">
                  Turn the map upright if you need to — the rotation is fixed once you set it.
                </span>
                <button className="locmap-tool-btn" onClick={rotateMap} title="Rotate 90° clockwise">
                  <FaUndo style={{ transform: 'scaleX(-1)' }} /> Rotate
                </button>
                <button className="locmap-add-btn locmap-import-confirm" onClick={lockRotation}>
                  Set Rotation
                </button>
              </div>
            )}
            <div className="locmap-canvas" ref={canvasRef}>
              <div
                className={`locmap-scroll${importing ? '' : ' locmap-scroll-placing'}`}
                onClick={onCanvasClick}
              >
                <div className="locmap-stage" ref={stageRef} style={stageSize}>
                  {mapFailed ? (
                    <div className="locmap-broken">
                      <FaRegImage className="locmap-empty-icon" />
                      <div className="locmap-empty-title">This map couldn&rsquo;t be loaded</div>
                      <p className="locmap-empty-text">
                        The image file may have been moved or deleted. Replace it from the
                        options button in the header &mdash; the pins are kept.
                      </p>
                    </div>
                  ) : (
                    <div className="locmap-img-wrap">
                      <div className="locmap-img-rot" style={imgStyle}>
                        <MapImage img={mapImage} onNaturalSize={setMapRatio} onFailed={() => setMapFailed(true)} />
                      </div>
                    </div>
                  )}

                  {!importing && drawnPins.map((place) => {
                    const first = place.scriptNames
                      .map((n) => locations.find((l) => l.name.toUpperCase() === n.toUpperCase()))
                      .find(Boolean);
                    const label = placeLabel(place, 'New pin');
                    return (
                      <div
                        key={place.id}
                        className={`locmap-pin${place.scriptNames.length === 0 ? ' locmap-pin-empty' : ''}`}
                        style={{ left: `${(place.x ?? 0) * 100}%`, top: `${(place.y ?? 0) * 100}%` }}
                        onPointerDown={(e) => startPinDrag(e, place)}
                        onPointerMove={onPinMove}
                        onPointerUp={(e) => endPinDrag(e, place)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={() => { if (first) onGoToScene(first.sceneIndices[0]); }}
                        title={place.scriptNames.length
                          ? `${label} — click for options, double-click to go to the scene`
                          : 'Click to choose which location this is'}
                      >
                        <FaMapMarkerAlt className="locmap-pin-icon" />
                        <span className="locmap-pin-label">{label}</span>
                        {place.scriptNames.length > 1 && (
                          <span className="locmap-pin-badge">{place.scriptNames.length}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {menuFor && menuPlace && (
        <LocationPinMenu
          place={menuPlace}
          places={places}
          available={available}
          pos={{ top: menuFor.top, left: menuFor.left }}
          onAttach={(name) => attachLocation(menuPlace.id, name)}
          onDetach={(name) => detachLocation(name)}
          onCreate={(displayName) => updatePlaceIn(menuPlace.id, { displayName })}
          onRenameInScript={renameInScript}
          onMergeInto={(targetId) => mergeInto(menuPlace.id, targetId)}
          onUnpin={() => unpinPlace(menuPlace.id)}
          onClose={() => setMenuFor(null)}
        />
      )}
    </div>
  );
};

export default LocationMapTab;
