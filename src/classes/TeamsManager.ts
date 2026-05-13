import * as fs from 'fs';
import * as path from 'path';
import { TournamentTeams } from '../types';

const DB_PATH = path.join(__dirname, '../../data/teams.json');

export class TeamsManager {
  private static instance: TeamsManager;
  private data = new Map<string, TournamentTeams>();

  private constructor() {
    this.load();
  }

  static getInstance(): TeamsManager {
    if (!TeamsManager.instance) {
      TeamsManager.instance = new TeamsManager();
    }
    return TeamsManager.instance;
  }

  private load(): void {
    try {
      if (!fs.existsSync(DB_PATH)) return;
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed: TournamentTeams[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.save();
        return;
      }
      for (const t of parsed) {
        this.data.set(t.tournamentName, t);
      }
      console.log(`Loaded ${this.data.size} odc tournaments(s) from disk`);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify([...this.data.values()], null, 2));
    } catch (err) {
      console.error('Failed to save teams:', err);
    }
  }

  createTournament(tournamentName: string, teams: Record<string, string[]>, odcTournamentId?: string): TournamentTeams {
    const entry: TournamentTeams = { tournamentName, odcTournamentId, teams };
    this.data.set(tournamentName, entry);
    this.save();
    return entry;
  }

  getTournament(tournamentName: string): TournamentTeams | undefined {
    return this.data.get(tournamentName);
  }

  getTeam(tournamentName: string, teamName: string): string[] | undefined {
    return this.data.get(tournamentName)?.teams[teamName];
  }

  getByPlayer(userId: string): { tournament: string; teamName: string; members: string[] }[] {
    const results = [];
    for (const tournament of this.data.values()) {
      for (const [teamName, members] of Object.entries(tournament.teams)) {
        if (members.includes(userId)) {
          results.push({ tournament: tournament.tournamentName, teamName, members });
        }
      }
    }
    return results;
  }

  deleteTournament(tournamentName: string): boolean {
    const deleted = this.data.delete(tournamentName);
    if (deleted) this.save();
    return deleted;
  }
}