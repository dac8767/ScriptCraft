/**
 * LocationPlaceDetails — everything a place KNOWS, in one block (v5.96).
 *
 * Derek: "the information that is currently in the side bar of the
 * location > map view should be moved to the location side panel." This is
 * that information — display name, the script locations connected to the
 * place, description, custom fields — extracted from the Map view's sidebar
 * so the Locations panel (the list, docked or fullscreen) is its one home.
 * The map keeps pins and options; the panel keeps knowledge.
 *
 * The display name "overrides what the location name looks like in the
 * location window. it does not change anything in the script" — so the
 * script's own names are always listed beneath it, and the two never blur.
 *
 * A row needs a place before it can hold any of this; one is made on demand
 * (unpinned — x/y null), so an untouched location costs nothing in the file.
 */
import React, { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaRegTrashAlt } from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { usePopup } from '../hooks/usePopup';
import { promptDialog } from './ConfirmDialog';
import { connectTargets, type LocationPlace } from '../utils/locationPlaces';

interface Props {
  /** The visible (filtered/sorted) locations — what the connect menu offers. */
  locations: Array<{ name: string; sceneIndices: number[] }>;
  /** The script locations this row stands for (one, unless it is a group). */
  scriptNames: string[];
  /** The row's place, if it already has one. */
  place?: LocationPlace;
}

export const LocationPlaceDetails: React.FC<Props> = ({ locations, scriptNames, place }) => {
  /* The details are the PLACE's, not the row's: a place holding two script
     locations shows both, whichever of its rows was expanded — otherwise a
     shared place under-reports its own membership. */
  const names = place && place.scriptNames.length ? place.scriptNames : scriptNames;
  const places = useEditorStore((s) => s.locationPlaces);
  const addPin = useEditorStore((s) => s.addLocationPin);
  const updatePlace = useEditorStore((s) => s.updateLocationPlace);
  const attachLocation = useEditorStore((s) => s.attachLocationToPlace);
  const detachLocation = useEditorStore((s) => s.detachLocationFromPlace);
  const mergePlaces = useEditorStore((s) => s.mergeLocationPlaces);
  const addField = useEditorStore((s) => s.addLocationPlaceField);
  const setField = useEditorStore((s) => s.setLocationPlaceField);
  const removeField = useEditorStore((s) => s.removeLocationPlaceField);

  /** The place's id, created on demand — see the header comment. */
  const placeFor = useCallback((): string | null => {
    if (place) return place.id;
    if (scriptNames.length === 0) return null;
    const id = addPin(0, 0);
    updatePlace(id, { x: null, y: null });
    scriptNames.forEach((n) => attachLocation(id, n));
    return id;
  }, [place, scriptNames, addPin, updatePlace, attachLocation]);

  const connect = usePopup({ width: 230 });
  const targets = useMemo(
    () => connectTargets(locations, places, place?.id ?? null),
    [locations, places, place],
  );

  const addCustomField = useCallback(async () => {
    const label = await promptDialog('New field name:', '', { title: 'New Custom Field', confirmLabel: 'Add' });
    const id = placeFor();
    if (id && label && label.trim()) addField(id, label.trim());
  }, [placeFor, addField]);

  return (
    <div className="locplace-details">
      <label className="locmap-field-label">Display Name</label>
      <input
        className="locmap-field-input"
        placeholder={names[0] || 'Name in the Locations window'}
        value={place?.displayName ?? ''}
        onChange={(e) => {
          const id = placeFor();
          if (id) updatePlace(id, { displayName: e.target.value });
        }}
      />

      <label className="locmap-field-label">Script Locations</label>
      <div className="locmap-attached-list">
        {names.length === 0 && (
          <div className="locmap-field-note">Not in the script — this place is yours alone.</div>
        )}
        {names.map((name) => (
          <div key={name} className="locmap-attached-row">
            <span className="locmap-attached-name" title={name}>{name}</span>
            {names.length > 1 && (
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
        ref={(el) => { connect.triggerRef.current = el; }}
        className="locmap-add-field"
        onClick={() => connect.toggle()}
      >+ Connect to location</button>
      {connect.pos && createPortal(
        <div
          ref={(el) => { connect.popupRef.current = el; }}
          className="locmap-pin-menu"
          style={{ top: connect.pos.top, left: connect.pos.left }}
        >
          <div className="locmap-pin-menu-subhead">Script locations</div>
          {targets.scriptLocations.length === 0 && (
            <div className="locmap-pin-menu-empty">Every location is already here.</div>
          )}
          {targets.scriptLocations.map((loc) => (
            <button
              key={loc.name}
              className="locmap-pin-menu-item"
              title={loc.from ? `Currently on ${loc.from} — this moves it here` : undefined}
              onClick={() => {
                const id = placeFor();
                if (id) attachLocation(id, loc.name);
                connect.close();
              }}
            >
              <span className="locmap-pin-menu-item-name">{loc.name}</span>
              {loc.from && <span className="locmap-pin-menu-item-from">on {loc.from}</span>}
              <span className="locmap-pin-menu-item-count">{loc.scenes}</span>
            </button>
          ))}
          {targets.groups.length > 0 && (
            <>
              <div className="locmap-pin-menu-sep" />
              <div className="locmap-pin-menu-subhead">Location groups</div>
              {targets.groups.map((g) => (
                <button
                  key={g.id}
                  className="locmap-pin-menu-item"
                  title={`Join ${g.label}`}
                  onClick={() => {
                    const id = placeFor();
                    if (id) mergePlaces(id, g.id);
                    connect.close();
                  }}
                >
                  <span className="locmap-pin-menu-item-name">{g.label}</span>
                  {g.scriptNames.length > 0 && (
                    <span className="locmap-pin-menu-item-count">{g.scriptNames.length}</span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body,
      )}

      <label className="locmap-field-label">Description</label>
      <textarea
        className="locmap-field-input locmap-field-textarea"
        rows={3}
        value={place?.description ?? ''}
        onChange={(e) => {
          const id = placeFor();
          if (id) updatePlace(id, { description: e.target.value });
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
      <button className="locmap-add-field" onClick={() => void addCustomField()}>+ Add custom field</button>
    </div>
  );
};

export default LocationPlaceDetails;
