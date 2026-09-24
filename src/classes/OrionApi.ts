const API_BASE = 'https://api.oriondrift.net';
const pendingToggles = new Set<string>();

type OrionErrorCode = 'configuration' | 'permission' | 'request' | 'unavailable' | 'invalid_response' | 'player_not_found';

export class OrionApiError extends Error {
  constructor(public readonly code: OrionErrorCode) {
    super(`Orion API: ${code}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function orionRequest(path: string, init?: RequestInit): Promise<unknown> {
  // Read at request time, after dotenv has been loaded by the bot entry point.
  const apiKey = process.env.ORION_API_KEY?.trim();
  if (!apiKey || apiKey === '...') throw new OrionApiError('configuration');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    });
    if (response.status === 401 || response.status === 403) {
      throw new OrionApiError('permission');
    }
    if (!response.ok) throw new OrionApiError('request');
    try {
      return await response.json();
    } catch {
      throw new OrionApiError('invalid_response');
    }
  } catch (error) {
    if (error instanceof OrionApiError) throw error;
    // Do not log API keys, request headers, or untrusted response bodies.
    throw new OrionApiError('unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

interface RoleMember {
  userId: string;
  username: string;
}

function parseRoleMembers(data: unknown): RoleMember[] {
  // Fleetview documents `users`; also supports `items` and bare arrays.
  const rows = Array.isArray(data) ? data : isRecord(data) ? data.users ?? data.items : undefined;
  if (!Array.isArray(rows)) throw new OrionApiError('invalid_response');

  // Never mistake an explicitly partial membership list for the full list.
  if (isRecord(data) && isRecord(data.page)) {
    if (typeof data.page.pages !== 'number' || data.page.pages > 1) {
      throw new OrionApiError('invalid_response');
    }
  }

  return rows.map(row => {
    if (!isRecord(row)) throw new OrionApiError('invalid_response');
    const userId = row.user_id ?? row.id;
    const username = row.username ?? row.display_name;
    // Keep player IDs as strings to avoid precision loss for large IDs.
    if (typeof userId !== 'string' || !userId.trim() || typeof username !== 'string' || !username.trim()) {
      throw new OrionApiError('invalid_response');
    }
    return { userId, username };
  });
}

/** Toggle only this role, using live membership and the caller's stored username.
 * Routes/payloads: https://github.com/FairyVR/fleetview/blob/main/src/shared/registry/endpoints.ts
 */
export async function togglePlayerRole(
  fleetId: string,
  roleId: string,
  username: string,
): Promise<'added' | 'removed' | 'busy'> {
  const name = username.trim();
  if (!name) throw new OrionApiError('player_not_found');
  const normalizedName = name.toLowerCase();
  const lockKey = JSON.stringify([fleetId, roleId, normalizedName]);
  if (pendingToggles.has(lockKey)) return 'busy';
  pendingToggles.add(lockKey);

  try {
    const fleet = encodeURIComponent(fleetId);
    const role = encodeURIComponent(roleId);
    const members = parseRoleMembers(await orionRequest(`/v2/fleets/${fleet}/roles/${role}/users`));
    const matches = members.filter(member => member.username.trim().toLowerCase() === normalizedName);
    if (matches.length > 1) throw new OrionApiError('invalid_response');

    if (matches.length === 1) {
      const userId = encodeURIComponent(matches[0].userId);
      const result = await orionRequest(`/v1/fleets/${fleet}/users/${userId}/role/${role}`, {
        method: 'DELETE',
      });
      if (!isRecord(result) || result.success !== true) throw new OrionApiError('invalid_response');
      return 'removed';
    }

    const result = await orionRequest(`/v2/fleets/${fleet}/user_roles`, {
      method: 'POST',
      body: JSON.stringify({ username: name, role_id: roleId, expires_hours: 0 }),
    });
    if (isRecord(result) && result.user_exists === false) throw new OrionApiError('player_not_found');
    if (!isRecord(result) || result.success !== true || result.user_exists !== true) {
      throw new OrionApiError('invalid_response');
    }
    return 'added';
  } finally {
    pendingToggles.delete(lockKey);
  }
}
