const API_BASE = 'https://oriondriftcompetitive.com/api/v1';

// Reuses the ODC env var: it used to hold the old tournament.oriondriftcompetitive.com
// bearer token, and now holds an X-Api-Key value for this API instead.
const API_KEY = process.env.ODC as string;

const BATCH_DISCORD_LOOKUP_LIMIT = 50;

export interface OdcUser {
  id: string;
  discordId: string;
  displayName: string;
  metaUsername: string;
  roles: string[];
  avatar: string;
}

export type TournamentRegion = 'EU' | 'NA' | 'OCE';
export type TournamentFormat = 'single' | 'double' | 'swiss';
export type TournamentType = 'league' | 'independent' | 'community';
export type SignupType = 'open' | 'invite_only' | 'admin_only';
export type TournamentState = 'draft' | 'signups_open' | 'signups_closed' | 'in_progress' | 'completed' | 'cancelled';
export type MatchState = 'created' | 'scheduled' | 'waiting' | 'live' | 'completed' | 'forfeited' | 'cancelled';

export interface CreateTournamentPayload {
  name: string;
  region: TournamentRegion;
  type: TournamentType;
  format: TournamentFormat;
  signupType: SignupType;
  startsAt?: string;
  gameConfig: {
    fleetId: string;
    arenas: string[];
  };
  settings: {
    bestOf: number;
    bestOfOverrides?: {
      winnersSemi?: number;
      winnersFinal?: number;
      losersSemi?: number;
      losersFinal?: number;
    };
    maxTeams: number;
    bracketReset?: boolean;
  };
}

export interface OdcTournament {
  _id: string;
  name: string;
  state: TournamentState;
  [key: string]: unknown;
}

export interface OdcParticipant {
  _id: string;
  tournamentId: string;
  [key: string]: unknown;
}

export interface OdcGame {
  _id: string;
  team1Score: number;
  team2Score: number;
  timestamp: string;
  startedAt?: string;
}

export interface OdcMatch {
  _id: string;
  tournamentId: string;
  round: number;
  bracket: 'winners' | 'losers' | 'main';
  bestOf?: number;
  team1Id: string;
  team2Id: string;
  state: MatchState;
  games: OdcGame[];
  arena?: string;
  stationName?: string;
  discordThreadId?: string;
  winner?: string;
  [key: string]: unknown;
}

export interface OdcPlacement {
  participantId: string;
  place: number;
  wins: number;
  losses: number;
}

interface OdcResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

async function odcRequest<T = unknown>(path: string, init?: RequestInit): Promise<OdcResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    let data: T | null = null;
    if (res.status !== 204) {
      try {
        data = (await res.json()) as T;
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      console.error(`ODC API ${init?.method ?? 'GET'} ${path} failed: ${res.status}`, data);
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error(`Failed to reach ODC API (${path}):`, err);
    return { ok: false, status: 0, data: null };
  }
}

/** Resolves Discord IDs to ODC accounts. IDs with no account are simply absent from the result. */
export async function getOdcUsersByDiscordIds(discordIds: string[]): Promise<OdcUser[]> {
  const users: OdcUser[] = [];

  for (let i = 0; i < discordIds.length; i += BATCH_DISCORD_LOOKUP_LIMIT) {
    const batch = discordIds.slice(i, i + BATCH_DISCORD_LOOKUP_LIMIT);
    if (batch.length === 0) continue;

    const { ok, data } = await odcRequest<OdcUser[]>(`/users/batch/discord?discordIds=${batch.join(',')}`);
    if (ok && data) users.push(...data);
  }

  return users;
}

export async function getOdcUserByDiscordId(discordId: string): Promise<OdcUser | null> {
  const [user] = await getOdcUsersByDiscordIds([discordId]);
  return user ?? null;
}

export async function hasOdcAccount(discordId: string): Promise<boolean> {
  return (await getOdcUserByDiscordId(discordId)) !== null;
}

export async function createTournament(payload: CreateTournamentPayload): Promise<OdcTournament | null> {
  const { ok, data } = await odcRequest<OdcTournament>('/tournaments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return ok ? data : null;
}

/** Creates a one-off tournament team from a custom roster of ODC user IDs, no persistent team required. */
export async function createOneOffTeam(tournamentId: string, name: string, userIds: string[]): Promise<OdcParticipant | null> {
  const { ok, data } = await odcRequest<OdcParticipant>(`/tournaments/${tournamentId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ name, users: userIds }),
  });
  return ok ? data : null;
}

export async function generateBracket(tournamentId: string): Promise<boolean> {
  const { ok } = await odcRequest(`/tournaments/${tournamentId}/generate`, { method: 'POST' });
  return ok;
}

export async function setTournamentState(tournamentId: string, state: TournamentState): Promise<boolean> {
  const { ok } = await odcRequest(`/tournaments/${tournamentId}/state`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
  });
  return ok;
}

export async function getTournamentMatches(tournamentId: string, params: Record<string, string> = {}): Promise<OdcMatch[]> {
  const query = new URLSearchParams(params).toString();
  const { ok, data } = await odcRequest<{ data: OdcMatch[] }>(
    `/tournaments/${tournamentId}/matches${query ? `?${query}` : ''}`
  );
  return ok && data ? data.data : [];
}

export async function updateMatch(tournamentId: string, matchId: string, body: Record<string, unknown>): Promise<boolean> {
  const { ok } = await odcRequest(`/tournaments/${tournamentId}/matches/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return ok;
}

export async function getPlacements(tournamentId: string): Promise<OdcPlacement[]> {
  const { ok, data } = await odcRequest<OdcPlacement[]>(`/tournaments/${tournamentId}/placements`);
  return ok && data ? data : [];
}
