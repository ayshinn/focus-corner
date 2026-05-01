// Spotify Web Playback SDK loader. The SDK injects itself via a global
// callback, so we load the script once and resolve when the player
// becomes available. Spec §2 forbids server-side glue — everything here
// is browser-only.

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

interface SpotifyPlayerCtor {
  new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }): SpotifyPlayer;
}

export interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (...args: unknown[]) => void): boolean;
  removeListener(event: string, cb?: (...args: unknown[]) => void): boolean;
  togglePlay(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string; height: number; width: number }> };
  duration_ms: number;
  uri: string;
}

export interface SpotifyPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat_mode: number;
  track_window: {
    current_track: SpotifyTrack;
    previous_tracks: SpotifyTrack[];
    next_tracks: SpotifyTrack[];
  };
}

declare global {
  interface Window {
    Spotify?: { Player: SpotifyPlayerCtor };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let sdkPromise: Promise<SpotifyPlayerCtor> | null = null;

export function loadSpotifySdk(): Promise<SpotifyPlayerCtor> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<SpotifyPlayerCtor>((resolve, reject) => {
    if (window.Spotify?.Player) {
      resolve(window.Spotify.Player);
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = (): void => {
      if (window.Spotify?.Player) resolve(window.Spotify.Player);
      else reject(new Error('Spotify SDK ready but Player undefined'));
    };
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = (): void => reject(new Error('Failed to load Spotify Web Playback SDK'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}
