// MCP over Streamable HTTP. Stateless: every POST carries one JSON-RPC
// message (or a batch) and gets a JSON answer; there is no SSE stream.
import { authorized } from '@/lib/auth';
import { handle, type RpcMessage } from '@/lib/mcp';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
};

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'missing or wrong key' } }, { status: 401, headers: { ...CORS, 'WWW-Authenticate': 'Bearer' } });
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: CORS });
  }
  const batch = Array.isArray(payload);
  const messages = (batch ? payload : [payload]) as RpcMessage[];
  const replies = (await Promise.all(messages.map((m) => handle(m)))).filter(Boolean);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? replies : replies[0], { headers: { ...CORS, 'Cache-Control': 'no-store' } });
}

export function GET() {
  return new Response('Daybook speaks MCP over POST (Streamable HTTP, no SSE stream).', { status: 405, headers: { ...CORS, Allow: 'POST' } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
