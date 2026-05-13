interface Person {
	name: string;
}

export interface Tournament {
  name: string;
  participants: Set<string>;
}

export interface TournamentJSON {
  name: string;
  participants: string[];
}

export interface ActivityCheck {
  name: string;
  channelId: string;
  msgId: string;
  notConfirmed: Set<string>;
}

export type Region = 'EU' | 'NA';

export const REGION_ROLES: Record<Region, string> = {
  EU:   process.env.EUroleID as string || '0',
  NA:   process.env.NAroleID as string || '0',
};

export interface Player {
	userId: string;
	username: string;
	mmr: number;
}

export interface TournamentTeams {
  tournamentName: string;
  odcTournamentId?: string;
  teams: Record<string, string[]>; // { 'Team 1': ['id1', 'id2', ...] }
}