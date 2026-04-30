// Versioned localStorage envelope. Every persisted blob in the app rides
// through this so schema changes can be migrated forward instead of
// silently corrupting on read.

export type Migration = (previous: unknown) => unknown;
export type MigrationMap = Record<number, Migration>;

interface Envelope {
  version: number;
  data: unknown;
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { version?: unknown }).version === 'number' &&
    'data' in (value as object)
  );
}

export function read<T>(
  key: string,
  currentVersion: number,
  migrations: MigrationMap = {},
): T | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isEnvelope(parsed)) return null;

  let version = parsed.version;
  let data = parsed.data;

  // Forward-incompatible: stored data came from a newer build. Don't guess
  // how to read it; treat as fresh and let the caller default.
  if (version > currentVersion) return null;

  while (version < currentVersion) {
    const migrate = migrations[version];
    if (!migrate) return null;
    data = migrate(data);
    version += 1;
  }
  return data as T;
}

export function write<T>(key: string, version: number, value: T): void {
  const envelope: Envelope = { version, data: value };
  try {
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or storage blocked. Settings layer can re-attempt.
  }
}

export function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
