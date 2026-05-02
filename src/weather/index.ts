// Weather pill. Open-Meteo is keyless and CORS-friendly so the static
// site can hit it directly. Cache for 1 hour to stay polite. Falls back
// from Geolocation → manual city (resolved via Open-Meteo geocoding).

import { read, write, type MigrationMap } from '../storage/versioned';
import { getSettings, subscribeSettings } from '../storage/settings';

const CACHE_KEY = 'weather-cache';
const CACHE_VERSION = 1;
const CACHE_MIGRATIONS: MigrationMap = {};
const CACHE_TTL_MS = 60 * 60 * 1000;

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

interface ForecastResponse {
  current_weather?: {
    temperature?: number;
    weathercode?: number;
  };
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
}

interface GeocodeResponse {
  results?: Array<{
    name: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
}

interface CachedWeather {
  fetchedAt: number;
  cityLabel: string;
  temperatureC: number;
  weatherCode: number;
}

const WEATHER_LABEL: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Drizzle',
  61: 'Rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunder w/ hail',
  99: 'Thunder w/ hail',
};

function readCache(): CachedWeather | null {
  return read<CachedWeather>(CACHE_KEY, CACHE_VERSION, CACHE_MIGRATIONS);
}
function writeCache(value: CachedWeather): void {
  write(CACHE_KEY, CACHE_VERSION, value);
}

async function geolocate(): Promise<{ lat: number; lon: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000, maximumAge: CACHE_TTL_MS },
    );
  });
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set('name', city);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as GeocodeResponse;
    const first = data.results?.[0];
    if (!first) return null;
    const label = first.country ? `${first.name}, ${first.country}` : first.name;
    return { lat: first.latitude, lon: first.longitude, label };
  } catch {
    return null;
  }
}

async function fetchForecast(lat: number, lon: number): Promise<{ temperatureC: number; code: number } | null> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('current_weather', 'true');
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as ForecastResponse;
    const cw = data.current_weather ?? data.current;
    if (!cw) return null;
    const temp = (cw as { temperature?: number; temperature_2m?: number }).temperature
      ?? (cw as { temperature_2m?: number }).temperature_2m;
    const code = (cw as { weathercode?: number; weather_code?: number }).weathercode
      ?? (cw as { weather_code?: number }).weather_code;
    if (typeof temp !== 'number' || typeof code !== 'number') return null;
    return { temperatureC: temp, code };
  } catch {
    return null;
  }
}

async function resolveLocation(): Promise<{ lat: number; lon: number; label: string } | null> {
  const settings = getSettings();
  if (settings.weather.mode === 'manual' && settings.weather.city) {
    return geocodeCity(settings.weather.city);
  }
  // auto
  if (
    settings.weather.lat !== undefined &&
    settings.weather.lon !== undefined
  ) {
    return { lat: settings.weather.lat, lon: settings.weather.lon, label: settings.weather.city ?? 'Saved' };
  }
  const pos = await geolocate();
  if (!pos) {
    if (settings.weather.city) return geocodeCity(settings.weather.city);
    return null;
  }
  return { ...pos, label: 'Local' };
}

export function mountWeatherPill(target: HTMLElement): void {
  target.classList.add('topbar-weather');
  target.hidden = false;

  function renderEmpty(message: string): void {
    target.dataset.state = 'empty';
    target.textContent = message;
  }

  function renderCached(cache: CachedWeather): void {
    target.dataset.state = 'ok';
    const label = WEATHER_LABEL[cache.weatherCode] ?? 'Weather';
    target.textContent = `${label}, ${Math.round(cache.temperatureC)}°C · ${cache.cityLabel}`;
    target.title = `Updated ${new Date(cache.fetchedAt).toLocaleTimeString()}`;
  }

  async function refresh(force = false): Promise<void> {
    const cache = readCache();
    if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      renderCached(cache);
      return;
    }
    if (cache) renderCached(cache); // show stale instantly while refresh runs
    else renderEmpty('Loading weather…');
    const location = await resolveLocation();
    if (!location) {
      if (!cache) renderEmpty('Set city in settings');
      return;
    }
    const forecast = await fetchForecast(location.lat, location.lon);
    if (!forecast) {
      if (!cache) renderEmpty('Weather unavailable');
      return;
    }
    const next: CachedWeather = {
      fetchedAt: Date.now(),
      cityLabel: location.label,
      temperatureC: forecast.temperatureC,
      weatherCode: forecast.code,
    };
    writeCache(next);
    renderCached(next);
  }

  void refresh();
  // Hourly auto-refresh while the tab is visible.
  window.setInterval(() => {
    if (!document.hidden) void refresh();
  }, CACHE_TTL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refresh();
  });
  subscribeSettings(() => void refresh(true));
}
