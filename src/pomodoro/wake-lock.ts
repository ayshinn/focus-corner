// Screen Wake Lock wrapper. Held during `work` intervals so the display
// stays on; released for breaks and idle. Feature-detected — non-supporting
// browsers (or insecure contexts) get a silent no-op.

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockManager {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

function getManager(): WakeLockManager | null {
  if (typeof navigator === 'undefined') return null;
  const lock = (navigator as unknown as { wakeLock?: WakeLockManager }).wakeLock;
  return lock ?? null;
}

let sentinel: WakeLockSentinelLike | null = null;
let wantHeld = false;

async function acquire(): Promise<void> {
  const mgr = getManager();
  if (!mgr) return;
  if (sentinel && !sentinel.released) return;
  try {
    sentinel = await mgr.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
      // OS may auto-release when the tab hides. Re-acquire on
      // re-visibility if we still want the lock.
      if (wantHeld && !document.hidden) void acquire();
    });
  } catch {
    sentinel = null;
  }
}

export async function acquireWakeLock(): Promise<void> {
  wantHeld = true;
  if (document.hidden) return;
  await acquire();
}

export async function releaseWakeLock(): Promise<void> {
  wantHeld = false;
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    /* ignore */
  }
  sentinel = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && wantHeld) void acquire();
  });
}
