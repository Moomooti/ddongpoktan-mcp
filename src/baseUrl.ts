import type { Request } from 'express';

/**
 * The public origin that image URLs in tool responses should point at.
 *
 * 1. PUBLIC_BASE_URL, if set - for proxies that rewrite the host or drop headers.
 * 2. X-Forwarded-Proto + Host - what TLS-terminating proxies (PlayMCP, most PaaS) send.
 * 3. The request's own protocol + Host - local runs with no proxy.
 *
 * This used to fall back to "https" when the header was missing, so every image link
 * was broken when the server ran locally over plain HTTP. mcp-agent-lint's
 * response-broken-link rule caught it.
 */
export function publicBaseUrl(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const header = req.headers['x-forwarded-proto'];
  const forwarded = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim();
  const proto = forwarded || req.protocol;
  return `${proto}://${req.get('host') ?? 'localhost'}`;
}
