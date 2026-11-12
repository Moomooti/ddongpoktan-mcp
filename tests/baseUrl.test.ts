import { afterEach, describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { publicBaseUrl } from '../src/baseUrl.js';

function req(headers: Record<string, string | string[]>, protocol = 'http'): Request {
  return {
    protocol,
    headers,
    get: (name: string) => (name.toLowerCase() === 'host' ? (headers.host as string | undefined) : undefined),
  } as unknown as Request;
}

afterEach(() => {
  delete process.env.PUBLIC_BASE_URL;
});

describe('publicBaseUrl', () => {
  it('uses the request protocol when no proxy header is present (local runs)', () => {
    // Regression: this used to return https://..., so every image link was dead locally.
    expect(publicBaseUrl(req({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });

  it('trusts X-Forwarded-Proto from a TLS-terminating proxy', () => {
    expect(publicBaseUrl(req({ host: 'game.example.com', 'x-forwarded-proto': 'https' }))).toBe('https://game.example.com');
  });

  it('takes the first value when proxies are chained', () => {
    expect(publicBaseUrl(req({ host: 'g.example', 'x-forwarded-proto': 'https, http' }))).toBe('https://g.example');
  });

  it('lets PUBLIC_BASE_URL override everything', () => {
    process.env.PUBLIC_BASE_URL = 'https://cdn.example.com/';
    expect(publicBaseUrl(req({ host: 'internal:3000' }))).toBe('https://cdn.example.com');
  });
});
