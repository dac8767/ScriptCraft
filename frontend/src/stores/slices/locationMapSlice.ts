/**
 * locationMapSlice (v5.75, remodelled v5.77) — the Locations Map tab's data.
 *
 * v5.77, Derek: a pin is no longer a name at a spot, it is a PLACE — several
 * script locations can share one ("BELKADAN - SPACE" and "BELKADAN -
 * SURFACE"), and it carries a display name, a description and custom fields.
 * The rules are pure and live in utils/locationPlaces.ts; this slice holds
 * the data and routes actions through them.
 *
 * All of it is SCRIPT data — it describes this story's world — so it rides in
 * the saved file (`_locationPlaces` / `_locationMapImage` in
 * composeSaveContent), not in localStorage, which is per-machine.
 *
 * (The List/Map VIEW choice is the opposite kind of state — a per-machine
 * view preference — and lives in sceneNavSlice with the window's other
 * chrome state.)
 */
import type { StateCreator } from 'zustand';
import type { EditorState } from '../editorStore';
import {
  addPlaceAt, attachLocation, detachLocation, updatePlace, movePlace, removePlace, unpinPlace,
  addPlaceField, setPlaceField, removePlaceField, renameScriptLocation, mergePlaces, togglePlaceLock,
  rotatePlacesClockwise, absorbOrphanPlaces,
  type LocationPlace, type LocationMapImage, type LocationCustomField,
} from '../../utils/locationPlaces';

export type { LocationPlace, LocationMapImage, LocationCustomField };

export interface LocationMapSlice {
  /** The uploaded map, as the standard image-reference attrs (asset when a
   *  project is open, data-URL when local-only) plus its rotation.
   *  null = no map yet. */
  locationMapImage: LocationMapImage | null;
  setLocationMapImage: (img: LocationMapImage | null) => void;
  /** Rotate the map a quarter turn clockwise — any time (v6.39; the old
   *  import-only lock is gone). The pins turn WITH it, so nothing drifts. */
  rotateLocationMap: () => void;

  /** Every place on (or off) the map. */
  locationPlaces: LocationPlace[];
  setLocationPlaces: (places: LocationPlace[]) => void;
  /** Drop a new pin; returns its id so the caller can open its dropdown. */
  addLocationPin: (x: number, y: number) => string;
  moveLocationPin: (placeId: string, x: number, y: number) => void;
  /** Take the pin off the map, keeping whatever the writer wrote on it. */
  unpinLocationPlace: (placeId: string) => void;
  removeLocationPlace: (placeId: string) => void;
  /** Write a script location's description from the LIST view, where only the
   *  name is known — the place is created (unpinned) if it has none yet, so
   *  writing a description never depends on having pinned the map first. */
  setLocationDescriptionFor: (scriptName: string, description: string) => void;
  /** v5.85: keep the place and its pin, take it out of the lists. */
  toggleLocationPlaceHidden: (placeId: string) => void;
  updateLocationPlace: (placeId: string, patch: Partial<Omit<LocationPlace, 'id'>>) => void;
  /** Put a script location on this place (taking it off any other). */
  attachLocationToPlace: (placeId: string, name: string) => void;
  detachLocationFromPlace: (name: string) => void;
  addLocationPlaceField: (placeId: string, label: string) => void;
  setLocationPlaceField: (placeId: string, fieldId: string, patch: Partial<Omit<LocationCustomField, 'id'>>) => void;
  removeLocationPlaceField: (placeId: string, fieldId: string) => void;
  /** v5.78, Derek: lock a pin so a stray drag can't move it. */
  toggleLocationPlaceLock: (placeId: string) => void;
  /** "Assign to an existing pin" — the two become one place. */
  mergeLocationPlaces: (fromId: string, toId: string) => void;
  /** Called by the shared heading rename so places follow their location. */
  renameLocationInPlaces: (from: string, to: string) => void;
}

export const createLocationMapSlice: StateCreator<EditorState, [], [], LocationMapSlice> = (set, get) => ({
  locationMapImage: null,
  setLocationMapImage: (img) => set({ locationMapImage: img }),
  /* v5.81, Derek: Rotate 90 degrees is a Map Options item, so it no longer
     stops at the import pass — and once pins exist, turning the picture
     without turning THEM would slide every pin off its feature. The pins
     ride round with the map. */
  rotateLocationMap: () => set((s) => {
    const img = s.locationMapImage;
    if (!img) return {};
    return {
      locationMapImage: { ...img, rotation: ((img.rotation || 0) + 90) % 360 },
      locationPlaces: rotatePlacesClockwise(s.locationPlaces),
    };
  }),
  toggleLocationPlaceHidden: (placeId) => set((s) => ({
    locationPlaces: s.locationPlaces.map((p) => (p.id === placeId ? { ...p, hidden: !p.hidden } : p)),
  })),
  setLocationDescriptionFor: (scriptName, description) => set((s) => {
    const existing = s.locationPlaces.find(
      (p) => p.scriptNames.some((n) => n.trim().toUpperCase() === scriptName.trim().toUpperCase()),
    );
    if (existing) return { locationPlaces: updatePlace(s.locationPlaces, existing.id, { description }) };
    const { places, id } = addPlaceAt(s.locationPlaces, 0, 0);
    return {
      locationPlaces: updatePlace(attachLocation(places, id, scriptName), id, { description, x: null, y: null }),
    };
  }),
  locationPlaces: [],
  setLocationPlaces: (places) => set({ locationPlaces: Array.isArray(places) ? places : [] }),
  addLocationPin: (x, y) => {
    const { places, id } = addPlaceAt(get().locationPlaces, x, y);
    set({ locationPlaces: places });
    return id;
  },
  moveLocationPin: (placeId, x, y) => set((s) => ({ locationPlaces: movePlace(s.locationPlaces, placeId, x, y) })),
  unpinLocationPlace: (placeId) => set((s) => ({ locationPlaces: unpinPlace(s.locationPlaces, placeId) })),
  removeLocationPlace: (placeId) => set((s) => ({ locationPlaces: removePlace(s.locationPlaces, placeId) })),
  updateLocationPlace: (placeId, patch) => set((s) => ({ locationPlaces: updatePlace(s.locationPlaces, placeId, patch) })),
  /* absorbOrphanPlaces: moving a location off its old place can leave that
     place with nothing — no locations, no pin. The target takes over what it
     was carrying and the husk goes, so a description written in the List
     view survives being pinned on the map. */
  attachLocationToPlace: (placeId, name) => set((s) => ({
    locationPlaces: absorbOrphanPlaces(attachLocation(s.locationPlaces, placeId, name), placeId),
  })),
  detachLocationFromPlace: (name) => set((s) => ({ locationPlaces: detachLocation(s.locationPlaces, name) })),
  addLocationPlaceField: (placeId, label) => set((s) => ({ locationPlaces: addPlaceField(s.locationPlaces, placeId, label) })),
  setLocationPlaceField: (placeId, fieldId, patch) => set((s) => ({ locationPlaces: setPlaceField(s.locationPlaces, placeId, fieldId, patch) })),
  removeLocationPlaceField: (placeId, fieldId) => set((s) => ({ locationPlaces: removePlaceField(s.locationPlaces, placeId, fieldId) })),
  toggleLocationPlaceLock: (placeId) => set((s) => ({ locationPlaces: togglePlaceLock(s.locationPlaces, placeId) })),
  mergeLocationPlaces: (fromId, toId) => set((s) => ({ locationPlaces: mergePlaces(s.locationPlaces, fromId, toId) })),
  renameLocationInPlaces: (from, to) => set((s) => ({ locationPlaces: renameScriptLocation(s.locationPlaces, from, to) })),
});
