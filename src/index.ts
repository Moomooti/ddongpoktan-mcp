import path from 'node:path';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import './db.js'; // initializes the SQLite schema + seed data as a side effect
import { buildServer } from './server.js';
import { handleSkillRequest } from './skill.js';

const app = express();
app.use(express.json());

// Serves illustration assets by URL instead of embedding base64 image content
// blocks in MCP tool responses - PlayMCP's answer-generation step choked on
// inline base64 image data, so tool responses reference these URLs as plain
// text instead.
app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.status(200).send('Ddongpoktan(똥폭탄) MCP server. POST to /mcp.');
});

// Stateless Streamable HTTP per PlayMCP's dev guide: a fresh McpServer +
// transport is built for every request (sessionIdGenerator: undefined), so no
// game state may live on the transport/server instance itself - all state
// goes through repository.ts into SQLite.
app.post('/mcp', async (req, res) => {
  try {
    const baseUrl = `${(req.headers['x-forwarded-proto'] as string) || 'https'}://${req.get('host')}`;
    const server = buildServer(baseUrl);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('Error handling /mcp request:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Kakao i OpenBuilder Skill server endpoint - a separate integration path from
// /mcp (different request/response JSON shape), reusing the same game logic.
// See skill.ts for details and its known room-identity limitation.
app.post('/skill', handleSkillRequest);

// Stateless mode has no session to stream (GET) or close (DELETE).
app.get('/mcp', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed: this is a stateless MCP server' },
    id: null,
  });
});
app.delete('/mcp', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed: this is a stateless MCP server' },
    id: null,
  });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Ddongpoktan MCP server listening on port ${port}`);
});
