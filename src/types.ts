interface Person {
	name: string;
}

export interface Tournament {
  name: string;
  participants: Set<string>;
  partyOnly: boolean;
  region: Region;
}

export interface TournamentJSON {
  name: string;
  participants: string[];
  partyOnly: boolean;
  region: Region;
}

export interface ActivityCheck {
  name: string;
  channelId: string;
  msgId: string;
  notConfirmed: Set<string>;
}

export type Region = 'EU' | 'NA' | 'OCE';

export const REGION_ROLES: Record<Region, string> = {
  EU:   process.env.EUroleID as string || '0',
  NA:   process.env.NAroleID as string || '0',
  OCE:  process.env.OCEroleID as string || '0',
};

export interface Player {
	userId: string;
	mmr: number;
}

export interface TournamentTeams {
  tournamentName: string;
  odcTournamentId: string;
  teams: Record<string, string[]>; // odcParticipantId -> discord user ids
  teamNames: Record<string, string>; // odcParticipantId -> display name
}

export interface MatchRecord {
  matchId: string;
  threadId: string;
  completed: boolean;
}

export interface Party {
  leader: string;
  member: string | null;
}