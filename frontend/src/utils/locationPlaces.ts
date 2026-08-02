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
  /** v5.78, Derek: a locked pin can't be dragged. Once a place is where it
   *  belongs, the next click near it shouldn't be able to nudge it. */
  locked?: boolean;
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
  return { id, scriptNames: [], displayName: '', description: '', fields: [], x, y, locked: false };
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

/**
 * Where a pointer landed on the map, taken from the event's OWN offsets
 * inside the stage rather than from a client rect (v5.82).
 *
 * Derek: "the window is appearing in the correct location where I clicked.
 * the pin is appearing off the map." The menu is placed from clientX/clientY
 * and was right; the pin was placed from clientY minus a measured rect top,
 * and was not — so the rect and the event disagreed about where the stage
 * was, and the negative result clamped the pin to the top edge. offsetX and
 * offsetY are measured against the target element itself, in the same pass
 * as the event: there is no second measurement to disagree with. Returns
 * null when it cannot be trusted, so the caller can fall back.
 */
/**
 * A raw (unclamped) reading of where a point sits inside a box, as fractions.
 * Raw is the point: a click that lands ON the stage cannot honestly be at
 * -0.4 or 1.7, so an out-of-range reading is PROOF that the box it came from
 * is wrong — see pickFraction.
 */
export function rawFraction(
  box: { left: number; top: number; width: number; height: number },
  clientX: number, clientY: number,
): { x: number; y: number } | null {
  if (!box.width || !box.height) return null;
  const x = (clientX - box.left) / box.width;
  const y = (clientY - box.top) / box.height;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/**
 * Choose the point from several independent readings — PER AXIS (v5.83).
 *
 * Derek's bug, twice over: the pin's x was right and its y was pinned to the
 * map's top edge. One reading of the stage's box was half-wrong — its left
 * and width sound, its top not — so trusting any single reading whole is the
 * mistake. Each axis is taken from the first reading that puts the click
 * INSIDE the map, which a click on the map must be. Nothing plausible? Then
 * the first reading, clamped, exactly as before.
 */
export function pickFraction(readings: Array<{ x: number; y: number } | null>): { x: number; y: number } {
  const live = readings.filter((r): r is { x: number; y: number } => !!r);
  const sane = (v: number) => v >= 0 && v <= 1;
  const first = live[0];
  const x = live.find((r) => sane(r.x))?.x ?? first?.x ?? 0;
  const y = live.find((r) => sane(r.y))?.y ?? first?.y ?? 0;
  return { x: clampFraction(x), y: clampFraction(y) };
}

export function offsetFraction(
  offsetX: number, offsetY: number, width: number, height: number,
): { x: number; y: number } | null {
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return null;
  if (!width || !height) return null;
  return { x: clampFraction(offsetX / width), y: clampFraction(offsetY / height) };
}

/**
 * Connecting a location to a pin MOVES it off whatever place held it before
 * — and a place left with no locations and no pin is unreachable: it shows
 * as a stray "Unnamed place" row, and whatever was written on it (the
 * description typed in the List view, say) is stranded there out of sight.
 *
 * So the target absorbs what the emptied place was carrying — description
 * and custom fields it doesn't already have — and the husk is dropped. A
 * place that still holds a location, or still sits on the map, is never
 * touched: those are real places the writer put there.
 */
export function absorbOrphanPlaces(places: LocationPlace[], targetId: string): LocationPlace[] {
  const orphans = places.filter((p) => p.id !== targetId && p.scriptNames.length === 0 && p.x === null);
  if (orphans.length === 0) return places;
  const kept = places.filter((p) => !orphans.includes(p));
  return kept.map((p) => {
    if (p.id !== targetId) return p;
    let next = p;
    for (const o of orphans) {
      if (!next.description.trim() && o.description.trim()) next = { ...next, description: o.description };
      const missing = o.fields.filter((f) => !next.fields.some((g) => g.label.trim().toUpperCase() === f.label.trim().toUpperCase()));
      if (missing.length) next = { ...next, fields: [...next.fields, ...missing] };
    }
    return next;
  });
}

/** The description written for a script location, wherever it lives (v5.81).
 *  The Locations LIST edits the same text the Map view's sidebar does — one
 *  description per place, two ways in. */
export function placeDescription(places: LocationPlace[], name: string): string {
  return placeForLocation(places, name)?.description ?? '';
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

/** Moving a LOCKED place is a no-op — the lock is the whole point. */
export function movePlace(places: LocationPlace[], placeId: string, x: number, y: number): LocationPlace[] {
  const place = places.find((p) => p.id === placeId);
  if (!place || place.locked) return places;
  return updatePlace(places, placeId, { x: clampFraction(x), y: clampFraction(y) });
}

export function togglePlaceLock(places: LocationPlace[], placeId: string): LocationPlace[] {
  const place = places.find((p) => p.id === placeId);
  if (!place) return places;
  return updatePlace(places, placeId, { locked: !place.locked });
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

/**
 * The sidebar's rows. Derek, v5.78: "when multiple script locations are
 * connected to one pin, just show that single location in the side panel" —
 * so a PLACE is one row however many script locations it carries, and the
 * expanded row is where those locations are listed.
 *
 * Order follows the script: a place ranks by its earliest location, and a
 * location with no place keeps its own position in the list.
 */
export interface LocationRow {
  key: string;
  /** The place this row is about, when there is one. */
  place?: LocationPlace;
  /** Script locations this row covers (one, unless they share a pin). */
  scriptNames: string[];
  /** What to call it: display name, else the (first) script name. */
  label: string;
  /** Scenes across every script location on this row. */
  scenes: number;
}

export function locationRows<T extends { name: string; sceneIndices: number[] }>(
  locations: T[], places: LocationPlace[],
): LocationRow[] {
  const rows: LocationRow[] = [];
  const done = new Set<string>();
  for (const loc of locations) {
    if (done.has(key(loc.name))) continue;
    const place = placeForLocation(places, loc.name);
    if (!place) {
      rows.push({ key: loc.name, scriptNames: [loc.name], label: loc.name, scenes: loc.sceneIndices.length });
      done.add(key(loc.name));
      continue;
    }
    // One row for the whole place, counting every location it carries.
    const names = place.scriptNames.filter((n) => locations.some((l) => key(l.name) === key(n)));
    names.forEach((n) => done.add(key(n)));
    const scenes = names.reduce(
      (sum, n) => sum + (locations.find((l) => key(l.name) === key(n))?.sceneIndices.length || 0), 0,
    );
    rows.push({ key: place.id, place, scriptNames: names, label: placeLabel(place, loc.name), scenes });
  }
  // Places the writer created that the script has no name for.
  for (const p of places) {
    if (p.scriptNames.length === 0 && (p.displayName.trim() || p.description.trim() || p.x !== null)) {
      rows.push({ key: p.id, place: p, scriptNames: [], label: placeLabel(p, 'Unnamed place'), scenes: 0 });
    }
  }
  return rows;
}

/**
 * A quarter turn moves the pins with the picture (v5.81). Rotating the map
 * and leaving the pins on their old fractions would slide every one of them
 * off its feature — the pin belongs to the PLACE on the map, not to a corner
 * of the frame. Clockwise: the point (x, y) lands at (1 - y, x).
 */
export function rotatePlacesClockwise(places: LocationPlace[]): LocationPlace[] {
  return places.map((p) => (p.x === null || p.y === null ? p : { ...p, x: 1 - p.y, y: p.x }));
}

/**
 * What "+ Connect to location" offers (v5.79, Derek: "the list should include
 * all script locations, plus any location groups — locations linked together
 * with one display name").
 *
 * Script locations are ALL of them, not just the unplaced ones: connecting a
 * location that already sits somewhere else is exactly how a writer says
 * "actually, that's here". Groups are the other places that stand for more
 * than their own name — a display name, or several locations already linked —
 * and picking one MERGES this place into it.
 */
export interface ConnectTargets {
  scriptLocations: Array<{ name: string; scenes: number; from?: string }>;
  groups: Array<{ id: string; label: string; scriptNames: string[] }>;
}

export function connectTargets<T extends { name: string; sceneIndices: number[] }>(
  locations: T[], places: LocationPlace[], selfId: string | null,
): ConnectTargets {
  const self = places.find((p) => p.id === selfId);
  const mine = new Set((self?.scriptNames ?? []).map(key));
  const scriptLocations = locations
    .filter((l) => !mine.has(key(l.name)))
    .map((l) => {
      const on = places.find((p) => p.id !== selfId && p.scriptNames.some((n) => key(n) === key(l.name)));
      return { name: l.name, scenes: l.sceneIndices.length, ...(on ? { from: placeLabel(on, l.name) } : {}) };
    });
  const groups = places
    .filter((p) => p.id !== selfId && (p.displayName.trim() !== '' || p.scriptNames.length > 1))
    .map((p) => ({ id: p.id, label: placeLabel(p, 'Unnamed place'), scriptNames: [...p.scriptNames] }));
  return { scriptLocations, groups };
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
      locked: r.locked === true,
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
