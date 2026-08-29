const API_BASE = 'https://oriondriftcompetitive.com/api/v1';

export interface OdcUser {
  id: string;
  discordId: string;
  displayName: string;
  metaUsername: string;
  roles: string[];
  avatar: string;
}

/** Resolves Discord IDs to ODC accounts. IDs with no account are simply absent from the result. */
export async function getOdcUsersByDiscordIds(discordIds: string[]): Promise<OdcUser[]> {
  if (discordIds.length === 0) return [];

  try {
    const url = `${API_BASE}/users/batch/discord?discordIds=${discordIds.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`ODC batch/discord lookup failed: ${res.status}`);
      return [];
    }
    return (await res.json()) as OdcUser[];
  } catch (err) {
    console.error('Failed to reach ODC API:', err);
    return [];
  }
}

export async function getOdcUserByDiscordId(discordId: string): Promise<OdcUser | null> {
  const [user] = await getOdcUsersByDiscordIds([discordId]);
  return user ?? null;
}

export async function hasOdcAccount(discordId: string): Promise<boolean> {
  return (await getOdcUserByDiscordId(discordId)) !== null;
}
