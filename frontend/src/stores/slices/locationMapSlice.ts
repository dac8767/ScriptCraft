/**
 * locationMapSlice (v5.75) — the Locations window's Map tab data.
 *
 * Derek: upload a map, pin locations from the list onto it. Both the image
 * reference and the pins are SCRIPT data, not view state: they describe this
 * story's world, so they ride in the saved file (`_locationMapImage` /
 * `_locationPins` in composeSaveContent) exactly like beats and notes — not
 * in localStorage, which is per-machine and would lose the map on another
 * computer.
 *
 * (The Map/List TAB choice is the opposite kind of state — a view preference,
 * persisted per machine like pagesTab — so it lives in sceneNavSlice with the
 * window's other chrome state.)
 *
 * The rules themselves are pure and live in utils/locationPins.ts; this slice
 * only holds the data and routes actions through them.
 */
import type { StateCreator } from 'zustand';
import type { EditorState } from '../editorStore';
import {
  upsertPin, removePin, renamePin,
  type LocationPin, type LocationMapImage,
} from '../../utils/locationPins';

export type { LocationPin, LocationMapImage };

export interface LocationMapSlice {
  /** The uploaded map, as the standard image-reference attrs (asset when a
   *  project is open, data-URL when local-only). null = no map yet. */
  locationMapImage: LocationMapImage | null;
  setLocationMapImage: (img: LocationMapImage | null) => void;
  /** Where each location sits on the map, in 0..1 fractions of the image. */
  locationPins: LocationPin[];
  setLocationPins: (pins: LocationPin[]) => void;
  /** Drop a location on the map (or move one already there). */
  pinLocation: (name: string, x: number, y: number) => void;
  unpinLocation: (name: string) => void;
  /** Called by the list's Rename Location so a pin follows its location
   *  instead of being orphaned by the heading rewrite. */
  renameLocationPin: (from: string, to: string) => void;
}

export const createLocationMapSlice: StateCreator<EditorState, [], [], LocationMapSlice> = (set) => ({
  locationMapImage: null,
  setLocationMapImage: (img) => set({ locationMapImage: img }),
  locationPins: [],
  setLocationPins: (pins) => set({ locationPins: Array.isArray(pins) ? pins : [] }),
  pinLocation: (name, x, y) => set((s) => ({ locationPins: upsertPin(s.locationPins, name, x, y) })),
  unpinLocation: (name) => set((s) => ({ locationPins: removePin(s.locationPins, name) })),
  renameLocationPin: (from, to) => set((s) => ({ locationPins: renamePin(s.locationPins, from, to) })),
});
