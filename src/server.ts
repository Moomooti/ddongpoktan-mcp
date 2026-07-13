import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools.js';

const SERVER_NAME = 'ddongpoktan';
const SERVER_VERSION = '0.1.0';

/** Builds a fresh McpServer instance. Called per-request (see index.ts) to stay
 *  fully stateless, per PlayMCP's dev guide ("Stateless MCP 서버 권장, no session"). */
export function buildServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerAllTools(server);
  return server;
}
