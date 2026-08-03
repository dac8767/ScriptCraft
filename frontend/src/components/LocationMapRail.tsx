/**
 * LocationMapRail — the Map view's location list (v5.97, extracted whole
 * from LocationMapTab).
 *
 * It exists as its own component because of WHERE it can now render: inside
 * the Map view as its sidebar, and — when the Locations window is FULLSCREEN
 * on the map — in the side panel window, the way the Scrapbook's navigator
 * docks while its surface owns the editor area. Same rows, same menus, same
 * store; only the container changes.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FaMapMarkerAlt, FaChevronRight, FaChevronDown, FaRegMap, FaRegEyeSlash,
  FaLock, FaLockOpen,
} from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import {
  locationRows, connectTargets, type LocationPlace,
} from '../utils/locationPlaces';

interface Props {
  /** The filtered/sorted script locations — same list the map pins read. */
  locations: Array<{ name: string; sceneIndices: number[] }>;
  /** True when the rail IS a side panel (fullscreen map) — full width. */
  standalone?: boolean;
}

export const LocationMapRail: React.FC<Props> = ({ locations, standalone = false }) => {
  const places = useEditorStore((s) => s.locationPlaces);
  const addPin = useEditorStore((s) => s.addLocationPin);
  const updatePlaceIn = useEditorStore((s) => s.updateLocationPlace);
  const attachLocation = useEditorStore((s) => s.attachLocationToPlace);
  const mergePlaces = useEditorStore((s) => s.mergeLocationPlaces);
  const toggleLock = useEditorStore((s) => s.toggleLocationPlaceLock);
  const toggleHidden = useEditorStore((s) => s.toggleLocationPlaceHidden);
  const unpinPlace = useEditorStore((s) => s.unpinLocationPlace);
  const showHidden = useEditorStore((s) => s.showHiddenLocations);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<
    { kind: 'map' | 'pin'; rowKey: string; names: string[]; place?: LocationPlace; top: number; left: number } | null
  >(null);
  const [attachTo, setAttachTo] = useState<{ id: string; top: number; left: number } | null>(null);

  const rows = useMemo(
    () => locationRows(locations, places).filter((r) => showHidden || !r.place?.hidden),
    [locations, places, showHidden],
  );
  const connectable = useMemo(
    () => connectTargets(locations, places, attachTo?.id ?? null),
    [locations, places, attachTo],
  );

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

  return (
    <>
{/* ── the sidebar: one row per PLACE, expandable ──────────────── */}
<div className={`locmap-rail${standalone ? ' locmap-rail-standalone' : ''}`}>
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
        <div
          key={row.key}
          className={`locmap-rail-item${isOpen ? ' locmap-rail-item-open' : ''}${place?.hidden ? ' locmap-rail-item-hidden' : ''}`}
        >
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
            {place?.hidden && <FaRegEyeSlash className="locmap-rail-lock" title="Hidden from the locations list" />}
            {row.scenes > 0 && <span className="locmap-rail-scenes">{row.scenes}</span>}
          </div>
          {isOpen && (
            <div className="locmap-rail-detail">
              {/* v5.96, Derek: the options buttons live in the TOP ROW
                  of the expanded row's body — and the editing fields
                  that were here moved to the Locations panel
                  (LocationPlaceDetails). The map keeps pins and
                  options; the panel keeps knowledge. */}
              <div className="locmap-detail-actions">
                <button
                  className="locmap-tool-btn"
                  title="Map options"
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setRowMenu({ kind: 'map', rowKey: row.key, names: row.scriptNames, place, top: r.bottom + 4, left: Math.max(8, r.left) });
                  }}
                ><FaRegMap /> Map Options</button>
                <button
                  className="locmap-tool-btn"
                  title="Pin options"
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setRowMenu({ kind: 'pin', rowKey: row.key, names: row.scriptNames, place, top: r.bottom + 4, left: Math.max(8, r.left) });
                  }}
                ><FaMapMarkerAlt /> Pin Options</button>
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
</div>
{/* v5.85: the row menus. Two short lists rather than one long one —
    the map icon is about WHAT the place is, the pin icon about WHERE
    it sits. */}
{rowMenu && createPortal(
  <>
    <div className="locmap-menu-veil" onPointerDown={() => setRowMenu(null)} />
    <div className="locmap-pin-menu" style={{ top: rowMenu.top, left: rowMenu.left }}>
      {rowMenu.kind === 'map' ? (
        <>
          <button
            className="locmap-pin-menu-item"
            onClick={() => {
              const id = placeFor(rowMenu.names, rowMenu.place);
              setRowMenu(null);
              if (id) setAttachTo({ id, top: rowMenu.top, left: rowMenu.left });
            }}
          >Connect to location…</button>
          <button
            className="locmap-pin-menu-item"
            onClick={() => {
              const id = placeFor(rowMenu.names, rowMenu.place);
              if (id) toggleHidden(id);
              setRowMenu(null);
            }}
          >{rowMenu.place?.hidden ? 'Show in locations list' : 'Hide from locations list'}</button>
        </>
      ) : (
        <>
          <button
            className="locmap-pin-menu-item"
            disabled={!rowMenu.place || rowMenu.place.x === null}
            title={rowMenu.place && rowMenu.place.x !== null ? undefined : 'This location has no pin on the map yet'}
            onClick={() => { if (rowMenu.place) toggleLock(rowMenu.place.id); setRowMenu(null); }}
          >
            {rowMenu.place?.locked ? <><FaLock /> Unlock pin&rsquo;s position</> : <><FaLockOpen /> Lock pin&rsquo;s position</>}
          </button>
          <button
            className="locmap-pin-menu-item locmap-pin-menu-danger"
            disabled={!rowMenu.place || rowMenu.place.x === null}
            title={rowMenu.place && rowMenu.place.x !== null ? undefined : 'This location has no pin on the map yet'}
            onClick={() => { if (rowMenu.place) unpinPlace(rowMenu.place.id); setRowMenu(null); }}
          >Delete pin</button>
        </>
      )}
    </div>
  </>,
  document.body,
)}
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
    </>
  );
};

export default LocationMapRail;
