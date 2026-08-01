/**
 * locationPins (v5.75) — the Locations window's MAP tab, as pure data.
 *
 * Derek: "in the map tab, allow the user to upload a map, which acts as a
 * background in the tab, and then the user can pin locations from the list
 * onto the map."
 *
 * A pin is a location NAME plus a position given as FRACTIONS of the map
 * image (0..1), never pixels: the tab is a resizable window and the map is
 * scaled to fit it, so a pixel offset would slide off its landmark the
 * moment the window changed size.
 *
 * The list is the source of truth for which locations exist — it is derived
 * from the script's scene headings. Pins are matched to it by name, so
 * `visiblePins` is what the map draws and `unpinnedLocations` is what the
 * rail offers to drag. A pin whose location is gone (heading edited, scene
 * cut) is KEPT in the data but not drawn: retyping the heading brings the
 * pin back where it was, which is what a writer expects from an undo.
 */

/** The map image itself — the same attrs shape every other image in the app
 *  uses (utils/imageAsset.resolveImageUrl reads exactly these), so a project
 *  asset and a local data-URL both work with one resolver. */
export interface LocationMapImage {
  assetId?: string | null;
  projectId?: string | null;
  filename?: string | null;
  src?: string | null;
}

export interface LocationPin {
  /** The location's name, uppercase — the same key the list groups by. */
  name: string;
  /** 0..1 across the map image (0 = left edge, 1 = right edge). */
  x: number;
  /** 0..1 down the map image. */
  y: number;
}

/** Hold a fraction inside the image. Pins are dropped from a drag that can
 *  end a few px outside the stage; clamping keeps them reachable. */
export const clampFraction = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

const key = (name: string) => name.trim().toUpperCase();

/** Place (or move) a location's pin. One pin per location — dropping a
 *  location that is already pinned MOVES it rather than stacking a second. */
export function upsertPin(pins: LocationPin[], name: string, x: number, y: number): LocationPin[] {
  const k = key(name);
  if (!k) return pins;
  const pin: LocationPin = { name: k, x: clampFraction(x), y: clampFraction(y) };
  const i = pins.findIndex((p) => key(p.name) === k);
  if (i < 0) return [...pins, pin];
  const next = [...pins];
  next[i] = pin;
  return next;
}

export function removePin(pins: LocationPin[], name: string): LocationPin[] {
  const k = key(name);
  return pins.filter((p) => key(p.name) !== k);
}

/** Follow a location rename. The list's "Rename Location" rewrites every
 *  scene heading; without this the pin would point at a name that no longer
 *  exists and quietly vanish from the map. */
export function renamePin(pins: LocationPin[], from: string, to: string): LocationPin[] {
  const fromK = key(from);
  const toK = key(to);
  if (!fromK || !toK || fromK === toK) return pins;
  const moving = pins.find((p) => key(p.name) === fromK);
  if (!moving) return pins;
  // The target name may already own a pin — the rename wins, and the two
  // locations are now one, so it keeps a single pin (the renamed one).
  return [...pins.filter((p) => key(p.name) !== fromK && key(p.name) !== toK), { ...moving, name: toK }];
}

export function pinFor(pins: LocationPin[], name: string): LocationPin | undefined {
  const k = key(name);
  return pins.find((p) => key(p.name) === k);
}

/** The pins the map draws: those whose location is still in the list.
 *  Order follows the LIST, so pin z-order matches what the rail shows. */
export function visiblePins(pins: LocationPin[], locationNames: string[]): LocationPin[] {
  const order = new Map(locationNames.map((n, i) => [key(n), i]));
  return pins
    .filter((p) => order.has(key(p.name)))
    .sort((a, b) => (order.get(key(a.name)) ?? 0) - (order.get(key(b.name)) ?? 0));
}

/** The rail's contents: locations with no pin yet, in list order. */
export function unpinnedLocations<T extends { name: string }>(locations: T[], pins: LocationPin[]): T[] {
  const pinned = new Set(pins.map((p) => key(p.name)));
  return locations.filter((l) => !pinned.has(key(l.name)));
}

/** A drop point (client coords) as fractions of the map image's box. */
export function dropFraction(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: clampFraction((clientX - rect.left) / rect.width),
    y: clampFraction((clientY - rect.top) / rect.height),
  };
}
