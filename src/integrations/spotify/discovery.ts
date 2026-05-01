// Spotify discovery API helpers — playlists, search, queue. Each returns
// a typed slice of the underlying response so the UI doesn't have to
// know the (very large) Spotify schema.

import { spotifyFetch } from './api';

export interface SimplifiedPlaylist {
  id: string;
  name: string;
  uri: string;
  description: string;
  trackCount: number;
  imageUrl: string | null;
}

export interface SearchTrack {
  id: string;
  uri: string;
  name: string;
  artists: string;
  album: string;
}

export interface SearchPlaylist extends SimplifiedPlaylist {
  ownerName: string;
}

export interface SearchResults {
  tracks: SearchTrack[];
  playlists: SearchPlaylist[];
}

export interface QueueEntry {
  uri: string;
  name: string;
  artists: string;
}

export interface QueueSnapshot {
  current: QueueEntry | null;
  upcoming: QueueEntry[];
}

interface PlaylistsResponse {
  items: Array<{
    id: string;
    name: string;
    uri: string;
    description?: string;
    tracks?: { total: number };
    images?: Array<{ url: string }>;
    owner?: { display_name?: string };
  }>;
}

interface SearchResponse {
  tracks?: {
    items: Array<{
      id: string;
      uri: string;
      name: string;
      artists: Array<{ name: string }>;
      album: { name: string };
    }>;
  };
  playlists?: PlaylistsResponse;
}

interface QueueResponse {
  currently_playing: SpotifyQueueItem | null;
  queue: SpotifyQueueItem[];
}

interface SpotifyQueueItem {
  uri: string;
  name: string;
  artists: Array<{ name: string }>;
}

function toEntry(item: SpotifyQueueItem): QueueEntry {
  return {
    uri: item.uri,
    name: item.name,
    artists: item.artists.map((a) => a.name).join(', '),
  };
}

function toSimplified(item: PlaylistsResponse['items'][number]): SimplifiedPlaylist {
  return {
    id: item.id,
    name: item.name,
    uri: item.uri,
    description: item.description ?? '',
    trackCount: item.tracks?.total ?? 0,
    imageUrl: item.images?.[0]?.url ?? null,
  };
}

export async function listMyPlaylists(limit = 50): Promise<SimplifiedPlaylist[]> {
  const res = await spotifyFetch<PlaylistsResponse>('/me/playlists', { query: { limit } });
  return res.items.map(toSimplified);
}

export async function search(query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) return { tracks: [], playlists: [] };
  const res = await spotifyFetch<SearchResponse>('/search', {
    query: { q: trimmed, type: 'track,playlist', limit: 8 },
  });
  return {
    tracks: (res.tracks?.items ?? []).map((t) => ({
      id: t.id,
      uri: t.uri,
      name: t.name,
      artists: t.artists.map((a) => a.name).join(', '),
      album: t.album.name,
    })),
    playlists: (res.playlists?.items ?? []).map((p) => ({
      ...toSimplified(p),
      ownerName: p.owner?.display_name ?? '',
    })),
  };
}

export async function getQueue(): Promise<QueueSnapshot> {
  try {
    const res = await spotifyFetch<QueueResponse>('/me/player/queue');
    return {
      current: res.currently_playing ? toEntry(res.currently_playing) : null,
      upcoming: res.queue.map(toEntry),
    };
  } catch {
    return { current: null, upcoming: [] };
  }
}

export async function addToQueue(uri: string, deviceId?: string): Promise<void> {
  await spotifyFetch('/me/player/queue', {
    method: 'POST',
    query: { uri, ...(deviceId ? { device_id: deviceId } : {}) },
    expectNoContent: true,
  });
}

// Plays a context (e.g. playlist) on the given device. Used by the
// playlist picker.
export async function playContext(contextUri: string, deviceId?: string): Promise<void> {
  await spotifyFetch('/me/player/play', {
    method: 'PUT',
    query: deviceId ? { device_id: deviceId } : {},
    body: { context_uri: contextUri },
    expectNoContent: true,
  });
}

// Spotify has no native "clear queue" endpoint. Re-issuing a play call
// with `uris: [currentUri]` empties the manually-queued items at the
// cost of restarting the current track. Documented behavior.
export async function clearQueue(deviceId?: string): Promise<void> {
  const queue = await getQueue();
  if (!queue.current) return;
  await spotifyFetch('/me/player/play', {
    method: 'PUT',
    query: deviceId ? { device_id: deviceId } : {},
    body: { uris: [queue.current.uri] },
    expectNoContent: true,
  });
}
