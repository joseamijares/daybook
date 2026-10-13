// GET  /api/tokens                 agent tokens (never the token itself)
// POST /api/tokens  { name, client }  create one; the response is the only time the token is shown
// Owner only: an agent can't mint or list tokens.
import { body, json, route } from '@/lib/http';
import { createToken, listTokens } from '@/lib/tokens';

export const GET = route(async () => json({ tokens: await listTokens() }), { owner: true });

export const POST = route(
  async (req) => {
    const b = await body<{ name?: string; client?: string }>(req);
    const { token, record } = await createToken(b.name || 'Agent', b.client || 'other');
    return json({ token, record }, 201);
  },
  { owner: true },
);
