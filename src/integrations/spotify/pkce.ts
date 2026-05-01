// PKCE (RFC 7636) helpers for the Spotify auth code flow. Spotify
// supports PKCE with a public client, so no client secret is needed —
// which is exactly what a static-site, browser-only app requires.

const VERIFIER_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const VERIFIER_LENGTH = 96; // RFC allows 43-128. 96 is plenty of entropy.

function randomVerifier(length: number = VERIFIER_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += VERIFIER_CHARS[bytes[i]! % VERIFIER_CHARS.length];
  }
  return out;
}

export function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomVerifier();
  const challenge = await challengeFromVerifier(verifier);
  return { verifier, challenge };
}

export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
