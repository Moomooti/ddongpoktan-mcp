import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildServer } from '../src/server.js';
import { ENHANCE_TABLE } from '../src/constants.js';

/**
 * DESIGN.md is the spec the code was written from. These tests read the spec
 * file itself and compare it with what the running server actually exposes,
 * so the document and the code can't silently drift apart.
 */

const design = fs.readFileSync(path.join(import.meta.dirname, '..', 'DESIGN.md'), 'utf8');

/** Rows of the tool table in DESIGN.md: | `tool` | trigger | input | output | annotations | note | */
function specToolRows(): Map<string, { inputs: string[]; annotations: Record<string, boolean> }> {
  const rows = new Map<string, { inputs: string[]; annotations: Record<string, boolean> }>();
  for (const line of design.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 7 || !/^`[a-z_]+`$/.test(cells[1]) || !cells[5].includes('readOnly:')) continue;
    const name = cells[1].replaceAll('`', '');
    const inputs = cells[3].replaceAll('`', '').split(',').map((s) => s.trim().replace(/\?$/, ''));
    const annotations: Record<string, boolean> = {};
    for (const m of cells[5].matchAll(/(readOnly|destructive|idempotent|openWorld):(true|false)/g)) {
      annotations[`${m[1]}Hint`] = m[2] === 'true';
    }
    rows.set(name, { inputs, annotations });
  }
  return rows;
}

let tools: Tool[];

beforeAll(async () => {
  const server = buildServer('https://example.test');
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'spec-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  tools = (await client.listTools()).tools;
});

describe('DESIGN.md tool table matches the server', () => {
  const spec = specToolRows();

  it('parses the tool table (guards against the parser silently matching nothing)', () => {
    expect(spec.size).toBeGreaterThanOrEqual(7);
  });

  it.each([...spec.keys()])('%s exists with the documented inputs and annotations', (name) => {
    const tool = tools.find((t) => t.name === name);
    expect(tool, `${name} is in DESIGN.md but not registered`).toBeDefined();

    const { inputs, annotations } = spec.get(name)!;
    expect(Object.keys(tool!.inputSchema.properties ?? {}).sort()).toEqual([...inputs].sort());
    expect(tool!.annotations).toMatchObject(annotations);
  });
});

describe('DESIGN.md enhance table matches constants.ts', () => {
  it.each(ENHANCE_TABLE)('Lv.$level: cost $cost, success $successRate, flush $flushRate', (row) => {
    const pattern = new RegExp(
      `level:\\s*${row.level},\\s*cost:\\s*${row.cost},\\s*successRate:\\s*${row.successRate.toFixed(2)},\\s*flushRate:\\s*${row.flushRate.toFixed(2)},\\s*resetRisk:\\s*${row.resetRisk}`,
    );
    expect(design).toMatch(pattern);
  });
});
