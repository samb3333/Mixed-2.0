const API_BASE = 'https://oriondriftcompetitive.com/api/v1';

// Reuses the ODC env var: it used to hold the old tournament.oriondriftcompetitive.com
// bearer token, and now holds an X-Api-Key value for this API instead.
const API_KEY = process.env.ODC as string;

const MATCHES_PAGE_LIMIT = 100;

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

export async function createTournament(payload: CreateTournamentPayload): Promise<OdcTournament | null> {
  const { ok, data } = await odcRequest<OdcTournament>('/tournaments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return ok ? data : null;
}

/** Creates a one-off tournament team from a manually-entered roster of meta usernames, no ODC account required. */
export async function createOneOffTeam(tournamentId: string, name: string, metaUsernames: string[]): Promise<OdcParticipant | null> {
  const { ok, data } = await odcRequest<OdcParticipant>(`/tournaments/${tournamentId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ name, metaUsernames }),
  });
  return ok ? data : null;
}

/** Changes a participant's name and/or meta usernames. Fields left out keep their current value. */
export async function updateParticipant(
  tournamentId: string,
  participantId: string,
  body: { name?: string; metaUsernames?: string[] }
): Promise<boolean> {
  const { ok } = await odcRequest(`/tournaments/${tournamentId}/participants/${participantId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return ok;
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

/** Fetches every match, paging through the API's 100-per-page limit. */
export async function getTournamentMatches(tournamentId: string, params: Record<string, string> = {}): Promise<OdcMatch[]> {
  const matches: OdcMatch[] = [];
  let page = 1;

  while (true) {
    const query = new URLSearchParams({ ...params, limit: String(MATCHES_PAGE_LIMIT), page: String(page) }).toString();
    const { ok, data } = await odcRequest<{ data: OdcMatch[] }>(`/tournaments/${tournamentId}/matches?${query}`);
    if (!ok || !data) break;

    matches.push(...data.data);
    if (data.data.length < MATCHES_PAGE_LIMIT) break;
    page++;
  }

  return matches;
}

/** Finds a participant's current waiting/live match, i.e. the one holding an arena right now. */
export async function findActiveMatchForParticipant(tournamentId: string, participantId: string): Promise<OdcMatch | null> {
  for (const state of ['waiting', 'live'] as const) {
    const matches = await getTournamentMatches(tournamentId, { state });
    const match = matches.find(m => m.team1Id === participantId || m.team2Id === participantId);
    if (match) return match;
  }
  return null;
}

/** Re-pushes a match's whitelists to its arena. Only works while the match still holds one. */
export async function refreshMatchWhitelist(tournamentId: string, matchId: string): Promise<boolean> {
  const { ok } = await odcRequest(`/tournaments/${tournamentId}/matches/${matchId}/whitelist/refresh`, {
    method: 'POST',
  });
  return ok;
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

export async function addOrganisers(tournamentId: string, userIds: string[]): Promise<boolean> {
  for (const userId of userIds) {
    const { ok } = await odcRequest(`/tournaments/${tournamentId}/organisers/${userId}`, {
      method: 'POST',
    });
    if (!ok) return false;
  }
  return true;
}

