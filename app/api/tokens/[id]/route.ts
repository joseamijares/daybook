// DELETE /api/tokens/:id   revoke a token (owner only)
import { json, route } from '@/lib/http';
import { revokeToken } from '@/lib/tokens';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(
  async (_req, { params }) => {
    const { id } = await params;
    return (await revokeToken(id)) ? json({ revoked: id }) : json({ error: 'no such token' }, 404);
  },
  { owner: true },
);
