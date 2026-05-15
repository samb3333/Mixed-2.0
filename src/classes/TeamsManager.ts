import * as fs from 'fs';
import * as path from 'path';
import { MatchRecord, TournamentTeams } from '../types';
import { ChannelType, TextChannel, ThreadAutoArchiveDuration, ThreadChannel } from 'discord.js';
import { client } from '..';
import { PlayerManager } from './PlayerManager';

const DB_PATH = path.join(__dirname, '../../data/teams.json');

const MATCHES_PATH = path.join(__dirname, '../../data/posted_matches.json');

export class TeamsManager {
  private static instance: TeamsManager;
  private data = new Map<string, TournamentTeams>();
  private postedMatches = new Map<string, MatchRecord>();

  private constructor() {
    this.load();
    this.loadPostedMatches();
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
      this.startPolling();
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

  private loadPostedMatches(): void {
    try {
      if (!fs.existsSync(MATCHES_PATH)) return;
      const raw = fs.readFileSync(MATCHES_PATH, 'utf-8');
      const parsed: MatchRecord[] = JSON.parse(raw);
      for (const record of parsed) {
        this.postedMatches.set(record.matchId, record);
      }
      console.log(`Loaded ${this.postedMatches.size} posted match(es) from disk`);
    } catch (err) {
      console.error('Failed to load posted matches:', err);
    }
  }

  private savePostedMatches(): void {
    try {
      fs.writeFileSync(MATCHES_PATH, JSON.stringify([...this.postedMatches.values()], null, 2));
    } catch (err) {
      console.error('Failed to save posted matches:', err);
    }
  }

  async startPolling(intervalMs: number = 60_000): Promise<void> {
    for (const tournament of this.data.values()) {
      console.log(`Checking games for ${tournament.tournamentName}...`);
      await this.checkGames(tournament);
    }

    setInterval(async () => {
      for (const tournament of this.data.values()) {
        //console.log(`Checking games for ${tournament.tournamentName}...`);
        await this.checkGames(tournament);
      }
    }, intervalMs);
  }

  // def expected_score(player_elo, opponent_elo):
  //   return 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))

  // def update_elo(player_elo, opponent_elo, result, k=32):  
  //     expected = expected_score(player_elo, opponent_elo)  
  //     return round(player_elo + k * (result - expected))

  private mmrCalc(player_elo: number, opponent_elo: number, result: number, k: number = 32): number {
    const expected = 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400));
    return Math.round(k * (result - expected));
  }

  private async checkGames(tournament: TournamentTeams): Promise<void> {
    try {
      const res = await fetch(
        `https://tournament.oriondriftcompetitive.com/api/tournaments/${tournament.odcTournamentId}`
      );

      const matches = await res.json();
      if (!matches.data || !Array.isArray(matches.data.matches)) {
        console.error(`Invalid ODC data for ${tournament.tournamentName}`);
        return;
      }
      for (const match of matches.data.matches) {

        const record = this.postedMatches.get(match);
        if (!record) {
          const res = await fetch(
            `https://tournament.oriondriftcompetitive.com/api/matches/${match}`
          );
          const currentMatch = await res.json();
          if (!currentMatch.data) continue;
          if (currentMatch.data.status === 'scheduled') {
            console.log(`${currentMatch.data.home.name} vs ${currentMatch.data.away.name}`);
            console.log(`${currentMatch.data.stationName} ${currentMatch.data.arena} ${tournament.odcTournamentId}`);

            const channel = await client.channels.fetch(process.env.MatchesChannelID as string) as TextChannel;
            if (!channel || !channel.isTextBased()) {
              console.error('Matches channel not found!');
              return;
            }

            const thread = await channel.threads.create({
              name: `Round: ${currentMatch.data.round} - ${currentMatch.data.home.name} vs ${currentMatch.data.away.name}`,
              type: ChannelType.PrivateThread,
              invitable: false,
              autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
            });

            await thread.send(`Round: ${currentMatch.data.round} - ${currentMatch.data.home.name} vs ${currentMatch.data.away.name}`)

            let message = `## Station: ${currentMatch.data.stationName}\n ### Arena: ${currentMatch.data.arena}\n ### Best of ${currentMatch.data.bestOf}\n`

            message += "\n"
            message += "\n"
            for (const user_id of this.getTeam(tournament.tournamentName, currentMatch.data.home.name) || []) {
              message += `<@${user_id}> `;
            }

            message += "vs ";

            for (const user_id of this.getTeam(tournament.tournamentName, currentMatch.data.away.name) || []) {
                message += `<@${user_id}> `
            }

            await thread.send(message);

            this.postedMatches.set(match, {
              matchId: match,
              threadId: thread.id,
              completed: false,
            });
            this.savePostedMatches();
          }
        }
        else if (record && !record.completed) {
          const res = await fetch(
            `https://tournament.oriondriftcompetitive.com/api/matches/${match}`
          );
          const currentMatch = await res.json();

          if (currentMatch.data.status === 'completed') {
            const thread = await client.channels.fetch(record.threadId) as ThreadChannel;
            
            if (thread && thread.isTextBased()) {

              let message = `### ${currentMatch.data.home.name} ${currentMatch.data.home.score} - ${currentMatch.data.away.score} ${currentMatch.data.away.name}`;
              currentMatch.data.matchScores.forEach((score: any, index: number) => {
                  const round = index + 1;
                  message += `\nRound ${round}: ${score.home} - ${score.away}`;
              });
              await thread.send(message);

              console.log(`${currentMatch.data.home.name} ${currentMatch.data.home.score} - ${currentMatch.data.away.score} ${currentMatch.data.away.name}`);
              record.completed = true;

              let winners = null;
              let losers = null;

              if (currentMatch.data.home.score > currentMatch.data.away.score) {
                winners = this.getTeam(tournament.tournamentName, currentMatch.data.home.name) || [];
                losers = this.getTeam(tournament.tournamentName, currentMatch.data.away.name) || [];
              } else {
                winners = this.getTeam(tournament.tournamentName, currentMatch.data.away.name) || [];
                losers = this.getTeam(tournament.tournamentName, currentMatch.data.home.name) || [];
              }

              const winnerAvg = winners.reduce((sum, userId) => {
                const player = PlayerManager.getInstance().get(userId);
                return sum + (player ? player.mmr : 1000);
              }, 0) / winners.length;

              const loserAvg = losers.reduce((sum, userId) => {
                const player = PlayerManager.getInstance().get(userId);
                return sum + (player ? player.mmr : 1000);
              }, 0) / losers.length;

              for (const userId of winners) {
                const player = PlayerManager.getInstance().get(userId);
                if (player) {
                  const newMMR = this.mmrCalc(player.mmr, loserAvg, 1);
                  PlayerManager.getInstance().updateMMR(userId, newMMR);
                }
              }

              for (const userId of losers) {
                const player = PlayerManager.getInstance().get(userId);
                if (player) {
                  const newMMR = this.mmrCalc(player.mmr, winnerAvg, 0);
                  PlayerManager.getInstance().updateMMR(userId, newMMR);
                }
              }

              this.savePostedMatches();
            } else {
              console.error(`Thread ${record.threadId} not found for completed match ${match}`);
            }
          }
        }   
      }
    } catch (err) {
      console.error(`Failed to check games for ${tournament.tournamentName}:`, err);
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