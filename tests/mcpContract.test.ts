import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildServer } from '../src/server.js';
import { newRoom, rigRandom } from './helpers.js';

/**
 * Contract tests from the agent's point of view: talk to the real MCP server
 * through an MCP client, the same way PlayMCP's agent does.
 *
 * Background: tool responses used to embed base64 image blocks. PlayMCP's
 * answer-generation step failed on them ("temporary error"), even after the
 * images were compressed from ~26 MB to ~2.9 MB in total. The fix was to serve
 * images by URL and keep every tool response a single small text block. These
 * tests pin that decision so a future change can't quietly bring it back.
 */

const BASE_URL = 'https://example.test';
const MAX_RESPONSE_CHARS = 2_000;
const assetsRoot = path.join(import.meta.dirname, '..', 'assets');

let client: Client;
let tools: Tool[];

beforeAll(async () => {
  const server = buildServer(BASE_URL);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'contract-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  tools = (await client.listTools()).tools;
});

afterAll(async () => {
  await client.close();
});

interface TextBlock {
  type: string;
  text?: string;
}

async function call(name: string, args: Record<string, unknown>): Promise<TextBlock[]> {
  const result = await client.callTool({ name, arguments: args });
  return result.content as TextBlock[];
}

describe('tool discovery (what the agent reads before calling)', () => {
  it('exposes exactly the 8 documented tools', () => {
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'check_dex',
        'check_status',
        'enhance_toilet',
        'flush_toilet',
        'select_skin',
        'throw_poop',
        'use_bidet',
        'use_perfume',
      ].sort(),
    );
  });

  it('gives every tool a real description', () => {
    for (const tool of tools) {
      expect(tool.description?.length, tool.name).toBeGreaterThan(80);
    }
  });

  it('describes every input parameter, so the agent knows what to put there', () => {
    for (const tool of tools) {
      const props = (tool.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
      for (const [param, schema] of Object.entries(props)) {
        expect(schema.description, `${tool.name}.${param}`).toBeTruthy();
      }
      expect(tool.inputSchema.required, tool.name).toEqual(expect.arrayContaining(['room_code', 'nickname']));
    }
  });

  it('marks read-only tools as read-only', () => {
    const readOnly = tools.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name);
    expect(readOnly).toEqual(expect.arrayContaining(['check_status', 'check_dex']));
    expect(readOnly).not.toContain('throw_poop');
  });
});

describe('tool responses (what the agent has to turn into an answer)', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['throw_poop', { target_nickname: 'b' }],
    ['flush_toilet', {}],
    ['enhance_toilet', {}],
    ['use_bidet', {}],
    ['use_perfume', {}],
    ['check_status', {}],
    ['check_dex', {}],
    ['select_skin', {}],
    ['select_skin', { skin: '0' }],
  ];

  it.each(cases)('%s returns one small text block and no inline image data', async (name, extra) => {
    rigRandom(0);
    const content = await call(name, { room_code: newRoom(), nickname: 'a', ...extra });

    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
    expect(content[0].text!.length).toBeLessThan(MAX_RESPONSE_CHARS);
    expect(content[0].text).not.toMatch(/data:image|base64,/);
  });

  it('links images by URL, and every linked file actually exists', async () => {
    rigRandom(0);
    const [block] = await call('throw_poop', { room_code: newRoom(), nickname: 'a', target_nickname: 'b' });
    const urls = block.text!.match(/https?:\/\/\S+/g) ?? [];

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith(`${BASE_URL}/assets/`)).toBe(true);
      const rel = url.slice(`${BASE_URL}/assets/`.length);
      expect(fs.existsSync(path.join(assetsRoot, rel)), rel).toBe(true);
    }
  });

  it('rejects invalid input with an error the agent can see, instead of crashing', async () => {
    const result = await client.callTool({ name: 'throw_poop', arguments: { room_code: '', nickname: 'a' } });
    expect(result.isError).toBe(true);
  });

  it('answers a missing target with guidance instead of an error', async () => {
    const [block] = await call('throw_poop', { room_code: newRoom(), nickname: 'a' });
    expect(block.text).toContain('누구에게');
  });
});
