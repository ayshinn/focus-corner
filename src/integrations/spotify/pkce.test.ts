import { describe, expect, it } from 'vitest';
import { base64UrlEncode, challengeFromVerifier, generatePkcePair, randomState } from './pkce';

describe('pkce', () => {
  it('base64UrlEncode strips padding and replaces + /', () => {
    const buf = new Uint8Array([0xfb, 0xff, 0xbf]).buffer;
    expect(base64UrlEncode(buf)).toBe('-_-_');
  });

  it('challengeFromVerifier matches RFC 7636 worked example', async () => {
    // RFC 7636 Appendix B sample.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await challengeFromVerifier(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('generatePkcePair returns matching verifier+challenge', async () => {
    const { verifier, challenge } = await generatePkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(challenge).toBe(await challengeFromVerifier(verifier));
  });

  it('randomState produces a hex string', () => {
    const s = randomState();
    expect(s).toMatch(/^[0-9a-f]+$/);
    expect(s.length).toBeGreaterThan(8);
  });
});
