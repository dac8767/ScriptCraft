/**
 * locationPlaces (v5.77) — the Locations Map tab's data, as pure rules.
 *
 * v5.75 pinned a NAME to a spot. Derek's v5.77 brief makes a pin a PLACE in
 * its own right:
 *
 *   "you can assign the location to an already existing map pin. For
 *    instance, BELKADAN - SPACE, and BELKADAN - SURFACE, would be the same
 *    location on the map."
 *
 * So one pin can carry several script locations, plus a display name that
 * "overrides what the location name looks like in the location window — it
 * does not change anything in the script", a description, and custom fields.
 *
 * A place therefore owns everything about a spot in the story's world; the
 * script's location names are attached TO it. A place may exist with no pin
 * (fields filled in from the sidebar before it's placed) and a pin may exist
 * with nothing attached yet (dropped on the map, dropdown still open).
 *
 * Positions are FRACTIONS of the map image (0..1), never pixels — the tab is
 * resizable and the map is scaled to fit it.
 */

export interface LocationCustomField {
  id: string;
  label: string;
  value: string;
}

export interface LocationPlace {
  id: string;
  /** Script location names attached here, uppercase — the names the scene
   *  headings actually use. Several ⇒ they are one place on the map. */
  scriptNames: string[];
  /** Overrides the label shown in the Locations window. NOT the script. */
  displayName: string;
  description: string;
  fields: LocationCustomField[];
  /** Pin position, 0..1 of the map image. null ⇒ not on the map. */
  x: number | null;
  y: number | null;
}

/** The map image + how it was rotated when it was imported. */
export interface LocationMapImage {
  assetId?: string | null;
  projectId?: string | null;
  filename?: string | null;
  src?: string | null;
  /** 0 | 90 | 180 | 270, clockwise. Set once, at import. */
  rotation?: number;
  /** Derek: "once the rotation is set, it cannot be changed." True after the
   *  writer confirms the import — every pin dropped afterwards is placed in
   *  the rotated frame, so letting it change later would move every pin. */
  rotationLocked?: boolean;
}

export const ROTATIONS = [0, 90, 180, 270] as const;

/** Next rotation clockwise (the import bar's only control). */
export const nextRotation = (r: number): number => ((((r || 0) / 90 + 1) % 4) * 90);

/** A 90°/270° turn swaps the image's width and height. */
export const rotatedRatio = (ratio: number, rotation: number): number =>
  (((rotation || 0) / 90) % 2 === 1 ? 1 / ratio : ratio);

export const clampFraction = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

const key = (name: string) => name.trim().toUpperCase();

/** ids are content-free, so a counter seeded from the existing set is enough
 *  and keeps them stable/readable in a saved file. */
export function newPlaceId(places: LocationPlace[]): string {
  let n = places.length + 1;
  const taken = new Set(places.map((p) => p.id));
  while (taken.has(`place-${n}`)) n++;
  return `place-${n}`;
}

export function emptyPlace(id: string, x: number | null = null, y: number | null = null): LocationPlace {
  return { id, scriptNames: [], displayName: '', description: '', fields: [], x, y };
}

/** The place a script location belongs to, if any. */
export function placeForLocation(places: LocationPlace[], name: string): LocationPlace | undefined {
  const k = key(name);
  return places.find((p) => p.scriptNames.some((n) => key(n) === k));
}

/** What the Locations window CALLS this place: the display name when the
 *  writer set one, otherwise the script's own name(s). */
export function placeLabel(place: LocationPlace | undefined, fallback = ''): string {
  if (!place) return fallback;
  if (place.displayName.trim()) return place.displayName.trim();
  return place.scriptNames[0] || fallback;
}

/** Label for one script location — its place's display name, or its own. */
export function locationLabel(places: LocationPlace[], name: string): string {
  const place = placeForLocation(places, name);
  const display = place?.displayName.trim();
  return display || name;
}

/** Drop a new pin. Returns the places and the new place's id. */
export function addPlaceAt(
  places: LocationPlace[], x: number, y: number,
): { places: LocationPlace[]; id: string } {
  const id = newPlaceId(places);
  return { places: [...places, emptyPlace(id, clampFraction(x), clampFraction(y))], id };
}

/** Attach a script location to a place. It leaves whatever place it was on —
 *  a location is in exactly one spot on the map. A place left with nothing
 *  attached AND nothing filled in is dropped, so merging two pins doesn't
 *  strand an empty one on the map. */
export function attachLocation(places: LocationPlace[], placeId: string, name: string): LocationPlace[] {
  const k = key(name);
  if (!k) return places;
  const next = places.map((p) => (
    p.id === placeId
      ? (p.scriptNames.some((n) => key(n) === k) ? p : { ...p, scriptNames: [...p.scriptNames, k] })
      : { ...p, scriptNames: p.scriptNames.filter((n) => key(n) !== k) }
  ));
  return next.filter((p) => p.id === placeId || !isStrandedPlace(p));
}

export function detachLocation(places: LocationPlace[], name: string): LocationPlace[] {
  const k = key(name);
  return places
    .map((p) => ({ ...p, scriptNames: p.scriptNames.filter((n) => key(n) !== k) }))
    .filter((p) => !isStrandedPlace(p));
}

/** Nothing attached and nothing written — no reason to keep it. A pin the
 *  writer just dropped is NOT stranded while its dropdown is open: it has a
 *  position, so it stays until they attach something or delete it. */
function isStrandedPlace(p: LocationPlace): boolean {
  return p.scriptNames.length === 0
    && !p.displayName.trim() && !p.description.trim() && p.fields.length === 0
    && p.x === null;
}

export function updatePlace(
  places: LocationPlace[], placeId: string, patch: Partial<Omit<LocationPlace, 'id'>>,
): LocationPlace[] {
  return places.map((p) => (p.id === placeId ? { ...p, ...patch } : p));
}

export function movePlace(places: LocationPlace[], placeId: string, x: number, y: number): LocationPlace[] {
  return updatePlace(places, placeId, { x: clampFraction(x), y: clampFraction(y) });
}

export function removePlace(places: LocationPlace[], placeId: string): LocationPlace[] {
  return places.filter((p) => p.id !== placeId);
}

/** Take the pin off the map but keep the place's fields — the writer spent
 *  time on them, and unpinning is not "delete everything I wrote". */
export function unpinPlace(places: LocationPlace[], placeId: string): LocationPlace[] {
  const place = places.find((p) => p.id === placeId);
  if (!place) return places;
  if (isStrandedPlace({ ...place, x: null })) return removePlace(places, placeId);
  return updatePlace(places, placeId, { x: null, y: null });
}

// ── custom fields (the Characters window's affordance, per place) ────────

export function addPlaceField(places: LocationPlace[], placeId: string, label: string): LocationPlace[] {
  const clean = label.trim();
  if (!clean) return places;
  const place = places.find((p) => p.id === placeId);
  if (!place) return places;
  let n = place.fields.length + 1;
  const taken = new Set(place.fields.map((f) => f.id));
  while (taken.has(`f${n}`)) n++;
  return updatePlace(places, placeId, { fields: [...place.fields, { id: `f${n}`, label: clean, value: '' }] });
}

export function setPlaceField(
  places: LocationPlace[], placeId: string, fieldId: string, patch: Partial<Omit<LocationCustomField, 'id'>>,
): LocationPlace[] {
  const place = places.find((p) => p.id === placeId);
  if (!place) return places;
  return updatePlace(places, placeId, {
    fields: place.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
  });
}

export function removePlaceField(places: LocationPlace[], placeId: string, fieldId: string): LocationPlace[] {
  const place = places.find((p) => p.id === placeId);
  if (!place) return places;
  return updatePlace(places, placeId, { fields: place.fields.filter((f) => f.id !== fieldId) });
}

/**
 * Derek: "you can assign the location to an already existing map pin … they
 * would be the same location on the map." So the two BECOME one: the source's
 * script locations move over, the pin itself goes, and anything the writer
 * wrote on the source is carried across rather than silently dropped — a
 * merge that eats a description is a merge nobody trusts twice.
 */
export function mergePlaces(places: LocationPlace[], fromId: string, toId: string): LocationPlace[] {
  if (fromId === toId) return places;
  const from = places.find((p) => p.id === fromId);
  const to = places.find((p) => p.id === toId);
  if (!from || !to) return places;
  const names = [...to.scriptNames];
  for (const n of from.scriptNames) if (!names.some((m) => key(m) === key(n))) names.push(key(n));
  const labels = new Set(to.fields.map((f) => f.label.trim().toLowerCase()));
  const carried = from.fields.filter((f) => !labels.has(f.label.trim().toLowerCase()));
  return places
    .filter((p) => p.id !== fromId)
    .map((p) => (p.id !== toId ? p : {
      ...p,
      scriptNames: names,
      displayName: p.displayName.trim() ? p.displayName : from.displayName,
      description: p.description.trim() ? p.description : from.description,
      fields: [...p.fields, ...carried.map((f, i) => ({ ...f, id: `f${p.fields.length + i + 1}` }))],
    }));
}

// ── the script's side ────────────────────────────────────────────────────

/** Follow a rename in the scene headings, so a place keeps its location. */
export function renameScriptLocation(places: LocationPlace[], from: string, to: string): LocationPlace[] {
  const fromK = key(from);
  const toK = key(to);
  if (!fromK || !toK || fromK === toK) return places;
  return places.map((p) => {
    if (!p.scriptNames.some((n) => key(n) === fromK)) return p;
    const renamed = p.scriptNames.map((n) => (key(n) === fromK ? toK : n));
    return { ...p, scriptNames: Array.from(new Set(renamed)) };
  });
}

/** The pins the map draws: placed places, ordered by the LIST's order so pin
 *  z-order matches the sidebar. A place whose only script locations have all
 *  left the script is still drawn if it has a display name of its own — the
 *  writer put it there deliberately. */
export function pinnedPlaces(places: LocationPlace[], locationNames: string[]): LocationPlace[] {
  const order = new Map(locationNames.map((n, i) => [key(n), i]));
  const rank = (p: LocationPlace) => {
    const hits = p.scriptNames.map((n) => order.get(key(n))).filter((i): i is number => i !== undefined);
    return hits.length ? Math.min(...hits) : Number.MAX_SAFE_INTEGER;
  };
  return places
    .filter((p) => p.x !== null && p.y !== null)
    .filter((p) => p.scriptNames.some((n) => order.has(key(n))) || !!p.displayName.trim() || p.scriptNames.length === 0)
    .sort((a, b) => rank(a) - rank(b));
}

/** Script locations not yet on any pin — what the "attach" menu offers. */
export function unplacedLocations<T extends { name: string }>(locations: T[], places: LocationPlace[]): T[] {
  const taken = new Set(places.filter((p) => p.x !== null).flatMap((p) => p.scriptNames.map(key)));
  return locations.filter((l) => !taken.has(key(l.name)));
}

// ── migration ────────────────────────────────────────────────────────────

/** v5.75 saved `{ name, x, y }` pins. Read them as places so a script saved
 *  by that build keeps its map. */
export function migratePins(pins: Array<{ name?: string; x?: number; y?: number }>): LocationPlace[] {
  const out: LocationPlace[] = [];
  for (const pin of Array.isArray(pins) ? pins : []) {
    const name = key(String(pin?.name ?? ''));
    if (!name) continue;
    out.push({
      ...emptyPlace(`place-${out.length + 1}`, clampFraction(Number(pin.x)), clampFraction(Number(pin.y))),
      scriptNames: [name],
    });
  }
  return out;
}

/** Accept whatever a saved file holds and return sane places. */
export function readPlaces(raw: unknown): LocationPlace[] {
  if (!Array.isArray(raw)) return [];
  const out: LocationPlace[] = [];
  for (const r of raw as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string') continue;
    out.push({
      id: r.id,
      scriptNames: Array.isArray(r.scriptNames) ? (r.scriptNames as unknown[]).map((n) => key(String(n))).filter(Boolean) : [],
      displayName: typeof r.displayName === 'string' ? r.displayName : '',
      description: typeof r.description === 'string' ? r.description : '',
      fields: Array.isArray(r.fields)
        ? (r.fields as Array<Record<string, unknown>>)
          .filter((f) => f && typeof f.id === 'string')
          .map((f) => ({ id: String(f.id), label: String(f.label ?? ''), value: String(f.value ?? '') }))
        : [],
      x: typeof r.x === 'number' ? clampFraction(r.x) : null,
      y: typeof r.y === 'number' ? clampFraction(r.y) : null,
    });
  }
  return out;
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
