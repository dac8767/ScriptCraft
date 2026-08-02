/**
 * LocationMapTab (v5.75, remodelled v5.77) — the Locations window's Map view.
 *
 * Derek's v5.77 brief:
 *  - rotate the background ON IMPORT only, then the rotation is fixed;
 *  - map actions behind the "Map Options" button on the + Add Pin row
 *    (LocationMapOptions, moved out of the header in v5.81);
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
import {
  FaMapMarkerAlt, FaRegImage, FaChevronRight, FaChevronDown, FaRegTrashAlt, FaUndo,
  FaLock, FaLockOpen, FaTimes,
} from 'react-icons/fa';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { resolveImageUrl } from '../utils/imageAsset';
import { AssetImage } from './CharacterAssetMedia';
import { promptDialog } from './ConfirmDialog';
import { showToast } from './Toast';
import LocationPinMenu from './LocationPinMenu';
import LocationMapOptions, { importLocationMap } from './LocationMapOptions';
import { renameLocationInScript } from '../utils/renameLocationInScript';
import {
  pinnedPlaces, locationRows, connectTargets, placeLabel, dropFraction, offsetFraction, rotatedRatio,
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
  const toggleLock = useEditorStore((s) => s.toggleLocationPlaceLock);

  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [menuFor, setMenuFor] = useState<{ id: string; top: number; left: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  /** The sidebar's "connect a script location" list (Derek #3). */
  const [attachTo, setAttachTo] = useState<{ id: string; top: number; left: number } | null>(null);
  /* v5.79, Derek: "+ Add Pin" arms placement and the pin rides the cursor
     until a click sets it down — so the writer sees exactly where it will
     land before committing, rather than finding out afterwards. */
  const [placing, setPlacing] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef<{ id: string; moved: boolean; locked: boolean; x0: number; y0: number } | null>(null);
  /* A pin drag ends with a mouseup on the MAP, and the browser then fires a
     click on their common ancestor — which dropped a second, unwanted pin
     wherever the drag was released. Ignoring map clicks for a moment after a
     drag swallows exactly that one — but a TIME window is either too short
     to be sure or long enough to eat a quick genuine click. So the flag is
     cleared by whichever comes first: the drag's own click, or the next
     press. It can never outlive one gesture. */
  const swallowClickRef = useRef(false);

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
  const connectable = useMemo(
    () => connectTargets(locations, places, attachTo?.id ?? null),
    [locations, places, attachTo],
  );
  const menuTargets = useMemo(
    () => connectTargets(locations, places, menuFor?.id ?? null),
    [locations, places, menuFor],
  );

  // ── placing and moving pins ──────────────────────────────────────────
  /**
   * The point a pointer event lands on, in stage fractions.
   *
   * v5.82, Derek: "the window is appearing in the correct location where I
   * clicked. the pin is appearing off the map." The menu comes from
   * clientX/clientY and was right; the pin came from clientY minus the stage
   * rect's top and was pinned to the map's top edge — so the RECT and the
   * EVENT disagreed about where the stage was, and a negative result clamped
   * to 0. Two measurements, one of them stale.
   *
   * So there is only one now: the map image is pointer-transparent, which
   * makes the stage itself the target of every map click, and offsetX/offsetY
   * are that event's own position inside that element — nothing to be out of
   * step with. The rect is kept only as a fallback for events that land
   * somewhere else (a drag, whose pointer is captured by the pin).
   */
  const pointFor = useCallback((e: React.MouseEvent, stage: HTMLElement) => {
    const native = e.nativeEvent as PointerEvent;
    if (e.target === stage) {
      const f = offsetFraction(native.offsetX, native.offsetY, stage.offsetWidth, stage.offsetHeight);
      if (f) return f;
    }
    return dropFraction(stage.getBoundingClientRect(), e.clientX, e.clientY);
  }, []);


  const openMenuAt = (id: string, clientX: number, clientY: number) =>
    setMenuFor({
      id,
      top: Math.min(clientY + 10, Math.max(60, window.innerHeight - 340)),
      left: Math.min(clientX, Math.max(8, window.innerWidth - 250)),
    });

  /* Derek: the button ARMS placement — the pin then follows the cursor over
     the map and the next click sets it down. Pressing it again (or Escape)
     calls it off. */
  const armPin = useCallback(() => {
    if (importing) return;
    setPlacing((v) => !v);
    setGhost(null);
  }, [importing]);

  React.useEffect(() => {
    if (!placing) return;
    const off = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPlacing(false); setGhost(null); } };
    window.addEventListener('keydown', off);
    return () => window.removeEventListener('keydown', off);
  }, [placing]);

  /** While armed, the ghost pin tracks the pointer across the map. */
  const trackGhost = useCallback((e: React.PointerEvent) => {
    if (!placing || !stageRef.current) return;
    const target = e.target as HTMLElement;
    const stage = target.closest('.locmap-stage') as HTMLElement | null;
    if (!stage) { setGhost(null); return; }
    // The ghost is placed by the SAME reckoning as the pin, so where the
    // ghost sits is where the pin lands — no second opinion.
    setGhost(pointFor(e, stage));
  }, [placing, pointFor]);

  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    if (swallowClickRef.current) { swallowClickRef.current = false; return; }
    // v5.81, Derek: "after placing a pin, you have to press + Add Pin again to
    // make another one" — the map is a placing surface only while ARMED.
    // Otherwise a click on it is just a click.
    if (!placing || importing || !stageRef.current) return;
    // Only a click on the MAP itself places a pin — not one on a pin, or on
    // the empty canvas around the image.
    const target = e.target as HTMLElement;
    // The stage that RECEIVED the click, not whichever one the ref happens to
    // hold — they are the same in every case I can reproduce, and when they
    // are not, the one under the cursor is the true one.
    const stage = target.closest('.locmap-stage') as HTMLElement | null;
    if (!stage || target.closest('.locmap-pin')) return;
    const { x, y } = pointFor(e, stage);
    const id = addPin(x, y);
    setPlacing(false);
    setGhost(null);
    openMenuAt(id, e.clientX, e.clientY);
  }, [addPin, importing, placing, pointFor]);

  /** Pins move by POINTER drag, not HTML5 drag: a pin is also a click target
   *  (it opens its menu), and a pointer drag tells the two apart by whether
   *  it actually moved. */
  const startPinDrag = useCallback((e: React.PointerEvent, place: LocationPlace) => {
    if (importing) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // A LOCKED pin still tracks the press — that is how its dropdown opens,
    // and the dropdown is where it gets unlocked. It just never moves.
    // The start point is kept so a PRESS can be told from a DRAG: a trackpad
    // click almost always wobbles a pixel or two, and treating that as a drag
    // both nudged the pin and swallowed the click that should have opened its
    // dropdown.
    draggingRef.current = { id: place.id, moved: false, locked: !!place.locked, x0: e.clientX, y0: e.clientY };
  }, [importing]);

  /** How far the pointer must travel before a press becomes a drag. */
  const DRAG_SLOP = 3;

  const onPinMove = useCallback((e: React.PointerEvent) => {
    const drag = draggingRef.current;
    if (!drag || drag.locked || !stageRef.current) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_SLOP) return;
    drag.moved = true;
    const { x, y } = dropFraction(stageRef.current.getBoundingClientRect(), e.clientX, e.clientY);
    movePin(drag.id, x, y);
  }, [movePin]);

  const endPinDrag = useCallback((e: React.PointerEvent, place: LocationPlace) => {
    const drag = draggingRef.current;
    draggingRef.current = null;
    if (!drag) return;
    if (drag.moved) swallowClickRef.current = true;   // …swallow the drag's own click
    else openMenuAt(place.id, e.clientX, e.clientY);
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
  /* Derek #1: "when multiple script locations are connected to one pin, just
     show that single location in the side panel" — locationRows collapses a
     place's locations into ONE row (utils/locationPlaces, tested there). */
  const rows = useMemo(() => locationRows(locations, places), [locations, places]);

  /** A sidebar row needs a place before it can hold a display name. One is
   *  made on demand — an untouched location costs nothing in the file. */
  const placeFor = useCallback((scriptNames: string[], existing?: LocationPlace): string | null => {
    if (existing) return existing.id;
    if (scriptNames.length === 0) return null;
    const id = addPin(0, 0);
    updatePlaceIn(id, { x: null, y: null });   // it exists, but it isn't on the map
    scriptNames.forEach((n) => attachLocation(id, n));
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

      {/* ── the sidebar: one row per PLACE, expandable ──────────────── */}
      <div className="locmap-rail">
        {/* v5.81, Derek: no "LOCATIONS" title and no count here — the window
            header carries both, and saying it twice is the duplication this
            app keeps rooting out. */}
        <div className="locmap-rail-list">
          {rows.length === 0 ? (
            <div className="navigator-empty">
              No locations yet. Scene headings like &ldquo;INT. COFFEE SHOP - DAY&rdquo; will appear here.
            </div>
          ) : rows.map((row) => {
            const isOpen = expanded === row.key;
            const place = row.place;
            const pinned = !!place && place.x !== null;
            return (
              <div key={row.key} className={`locmap-rail-item${isOpen ? ' locmap-rail-item-open' : ''}`}>
                <div className="locmap-rail-row" onClick={() => setExpanded(isOpen ? null : row.key)}>
                  <span className="locmap-rail-chevron">{isOpen ? <FaChevronDown /> : <FaChevronRight />}</span>
                  <FaMapMarkerAlt className={`locmap-rail-icon${pinned ? ' locmap-rail-icon-pinned' : ''}`} />
                  <span className="locmap-rail-name" title={row.scriptNames.join(', ') || row.label}>{row.label}</span>
                  {/* A row standing for several script locations says so with
                      a count, rather than repeating one of their names. */}
                  {row.scriptNames.length > 1 && (
                    <span className="locmap-rail-badge" title={row.scriptNames.join(', ')}>{row.scriptNames.length}</span>
                  )}
                  {pinned && place?.locked && <FaLock className="locmap-rail-lock" title="This pin is locked" />}
                  {row.scenes > 0 && <span className="locmap-rail-scenes">{row.scenes}</span>}
                </div>
                {isOpen && (
                  <div className="locmap-rail-detail">
                    {/* Derek: the display name "overrides what the location
                        name looks like in the location window. it does not
                        change anything in the script" — so the script's own
                        names are listed below, and the two never blur. */}
                    <label className="locmap-field-label">Display Name</label>
                    <input
                      className="locmap-field-input"
                      placeholder={row.scriptNames[0] || 'Name in the Locations window'}
                      value={place?.displayName ?? ''}
                      onChange={(e) => {
                        const id = placeFor(row.scriptNames, place);
                        if (id) updatePlaceIn(id, { displayName: e.target.value });
                      }}
                    />

                    {/* Derek #2: the row's script locations, as a field —
                        #3: and this is where another one is attached. */}
                    <label className="locmap-field-label">Script Locations</label>
                    <div className="locmap-attached-list">
                      {row.scriptNames.length === 0 && (
                        <div className="locmap-field-note">Not in the script — this place is yours alone.</div>
                      )}
                      {row.scriptNames.map((name) => (
                        <div key={name} className="locmap-attached-row">
                          <span className="locmap-attached-name" title={name}>{name}</span>
                          {row.scriptNames.length > 1 && (
                            <button
                              className="locmap-attached-remove"
                              title={`Disconnect ${name} from this place`}
                              onClick={() => detachLocation(name)}
                            ><FaTimes /></button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      className="locmap-add-field"
                      onClick={(e) => {
                        const id = placeFor(row.scriptNames, place);
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        if (id) setAttachTo({ id, top: r.bottom + 4, left: r.left });
                      }}
                    >+ Connect to location</button>

                    <label className="locmap-field-label">Description</label>
                    <textarea
                      className="locmap-field-input locmap-field-textarea"
                      rows={3}
                      value={place?.description ?? ''}
                      onChange={(e) => {
                        const id = placeFor(row.scriptNames, place);
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
                        const id = placeFor(row.scriptNames, place);
                        if (id) void addCustomField(id);
                      }}
                    >+ Add custom field</button>

    {/* v5.81, Derek: "just show a lock/unlock icon (depending on current
                        state)… add a delete button next to it." Two icons, their
                        meaning in the tooltip — the lock reads as its own state and
                        the row stops spending a full line on a sentence. */}
                    {pinned && place && (
                      <div className="locmap-pin-tools">
                        <button
                          className={`locmap-pin-tool${place.locked ? ' locmap-pin-tool-on' : ''}`}
                          title={place.locked ? "Unlock pin's location" : "Lock pin's location"}
                          aria-label={place.locked ? "Unlock pin's location" : "Lock pin's location"}
                          aria-pressed={place.locked}
                          onClick={() => toggleLock(place.id)}
                        >{place.locked ? <FaLock /> : <FaLockOpen />}</button>
                        <button
                          className="locmap-pin-tool locmap-pin-tool-danger"
                          title="Delete this pin"
                          aria-label="Delete this pin"
                          onClick={() => unpinPlace(place.id)}
                        ><FaRegTrashAlt /></button>
                      </div>
                    )}
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
            {/* v5.81, ROOT CAUSE of "the pin does not appear where I clicked":
                this row used to say "Click the map to set the pin" while armed
                — a longer label, which WRAPPED the row in a narrow window and
                pushed the map 21px down. The click landed correctly on the map
                as it then sat; placing disarmed, the label shrank back, the row
                un-wrapped and the map (pin and all) jumped up. The label never
                changes now, the row cannot wrap, and the hint has its own
                single-line lane — so nothing under the cursor moves between
                the press and the pin. */}
            <div className="locmap-actionbar">
              <button
                className={`locmap-add-btn locmap-addpin-btn${placing ? ' locmap-addpin-armed' : ''}`}
                onClick={armPin}
                aria-pressed={placing}
                title={placing ? 'Click the map to set the pin, or press Escape' : 'Add a pin — it follows the cursor until you click'}
              >+ Add Pin</button>
              <LocationMapOptions />
              <span className="locmap-pin-count">
                {placing ? 'Click the map to set the pin · Esc to cancel' : `${drawnPins.length} pinned`}
              </span>
            </div>
            <div className="locmap-canvas" ref={canvasRef}>
              <div
                className={`locmap-scroll${importing ? '' : ' locmap-scroll-placing'}${placing ? ' locmap-scroll-armed' : ''}`}
                onClick={onCanvasClick}
                /* A new press is a new gesture: whatever the last drag left
                   armed is stale by now. */
                onPointerDown={() => { swallowClickRef.current = false; }}
                onPointerMove={trackGhost}
                onPointerLeave={() => setGhost(null)}
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

                  {/* the pin riding the cursor — not a place yet, just a promise */}
                  {placing && ghost && (
                    <div
                      className={`locmap-pin locmap-pin-ghost${ghost.x > 0.5 ? ' locmap-pin-flip' : ''}`}
                      style={{ left: `${ghost.x * 100}%`, top: `${ghost.y * 100}%` }}
                    >
                      <FaMapMarkerAlt className="locmap-pin-icon" />
                      <span className="locmap-pin-label">New pin</span>
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
                        data-place-id={place.id}
                        /* Derek #5: "when I attach a location to a pin, the pin
                           jumps off the screen." The whole capsule used to be
                           CENTRED on the point, so a longer label dragged the
                           marker sideways — attaching a name moved the marker
                           from 4.5% to -3.3% of the map in the driver. Now the
                           MARKER sits on the point and the label hangs off it,
                           flipping to the left in the right-hand half so it
                           never runs off the edge either. */
                        className={`locmap-pin${place.scriptNames.length === 0 ? ' locmap-pin-empty' : ''}`
                          + ((place.x ?? 0) > 0.5 ? ' locmap-pin-flip' : '')
                          + (place.locked ? ' locmap-pin-locked' : '')}
                        style={{ left: `${(place.x ?? 0) * 100}%`, top: `${(place.y ?? 0) * 100}%` }}
                        onPointerDown={(e) => startPinDrag(e, place)}
                        onPointerMove={onPinMove}
                        onPointerUp={(e) => endPinDrag(e, place)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={() => { if (first) onGoToScene(first.sceneIndices[0]); }}
                        title={place.scriptNames.length
                          ? `${label} — click for options, double-click to go to the scene${place.locked ? ' (locked)' : ''}`
                          : 'Click to choose which location this is'}
                      >
                        <FaMapMarkerAlt className="locmap-pin-icon" />
                        <span className="locmap-pin-label">{label}</span>
                        {place.locked && <FaLock className="locmap-pin-lockmark" />}
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

      {/* Connect to location — v5.79, Derek: EVERY script location (moving one
          that already sits elsewhere is how you say "actually, it's here"),
          plus the location GROUPS, where picking one merges this place into
          that group. */}
      {attachTo && createPortal(
        <>
          <div className="locmap-menu-veil" onPointerDown={() => setAttachTo(null)} />
          <div className="locmap-pin-menu" style={{ top: attachTo.top, left: attachTo.left }}>
            <div className="locmap-pin-menu-subhead">Script locations</div>
            {connectable.scriptLocations.length === 0 && (
              <div className="locmap-pin-menu-empty">Every location is already here.</div>
            )}
            {connectable.scriptLocations.map((loc) => (
              <button
                key={loc.name}
                className="locmap-pin-menu-item"
                title={loc.from ? `Currently on ${loc.from} — this moves it here` : undefined}
                onClick={() => { attachLocation(attachTo.id, loc.name); setAttachTo(null); }}
              >
                <span className="locmap-pin-menu-item-name">{loc.name}</span>
                {loc.from && <span className="locmap-pin-menu-item-from">on {loc.from}</span>}
                <span className="locmap-pin-menu-item-count">{loc.scenes}</span>
              </button>
            ))}
            {connectable.groups.length > 0 && (
              <>
                <div className="locmap-pin-menu-sep" />
                <div className="locmap-pin-menu-subhead">Location groups</div>
                {connectable.groups.map((g) => (
                  <button
                    key={g.id}
                    className="locmap-pin-menu-item"
                    title={`Join ${g.label}${g.scriptNames.length ? ` (${g.scriptNames.join(', ')})` : ''}`}
                    onClick={() => { mergePlaces(attachTo.id, g.id); setAttachTo(null); }}
                  >
                    <span className="locmap-pin-menu-item-name">{g.label}</span>
                    {g.scriptNames.length > 0 && (
                      <span className="locmap-pin-menu-item-count">{g.scriptNames.length}</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </>,
        document.body,
      )}

      {menuFor && menuPlace && (
        <LocationPinMenu
          place={menuPlace}
          places={places}
          targets={menuTargets}
          pos={{ top: menuFor.top, left: menuFor.left }}
          onAttach={(name) => attachLocation(menuPlace.id, name)}
          onDetach={(name) => detachLocation(name)}
          onCreate={(displayName) => updatePlaceIn(menuPlace.id, { displayName })}
          onRenameInScript={renameInScript}
          onMergeInto={(targetId) => mergeInto(menuPlace.id, targetId)}
          locked={!!menuPlace.locked}
          onToggleLock={() => toggleLock(menuPlace.id)}
          onUnpin={() => unpinPlace(menuPlace.id)}
          onClose={() => setMenuFor(null)}
        />
      )}
    </div>
  );
};

export default LocationMapTab;
