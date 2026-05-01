// Loads the music manifest from `public/audio/manifest.json`. The file
// can be empty (`{ "tracks": [] }`) before any bundled tracks ship —
// the music UI degrades gracefully in that case.

export interface Track {
  id: string;
  label: string;
  src: string;
}

function isTrack(value: unknown): value is Track {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.label === 'string' && typeof v.src === 'string';
}

function manifestUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}audio/manifest.json`;
}

function resolveSrc(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith('/')) return src;
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}audio/${src}`;
}

export async function loadManifest(): Promise<Track[]> {
  try {
    const res = await fetch(manifestUrl());
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const tracks = (data as { tracks?: unknown }).tracks;
    if (!Array.isArray(tracks)) return [];
    return tracks.filter(isTrack).map((t) => ({ ...t, src: resolveSrc(t.src) }));
  } catch {
    return [];
  }
}
