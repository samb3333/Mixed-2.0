import * as fs from 'fs';
import * as path from 'path';
import { MatchRecord, TournamentTeams } from '../types';
import { ChannelType, TextChannel, ThreadAutoArchiveDuration, ThreadChannel } from 'discord.js';
import { client } from '..';
import { PlayerManager } from './PlayerManager';
import { getTournamentMatches, updateMatch, OdcMatch, OdcGame } from './OdcApi';

const DB_PATH = path.join(__dirname, '../../data/teams.json');

const MATCHES_PATH = path.join(__dirname, '../../data/posted_matches.json');

export class TeamsManager {
  private static instance: TeamsManager;
  private data = new Map<string, TournamentTeams>();
  private postedMatches = new Map<string, MatchRecord>();

  private constructor() {
    this.load();
    this.loadPostedMatches();
    this.startPolling();
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
        // Tournaments created before the ODC API migration won't have teamNames on disk.
        this.data.set(t.tournamentName, { ...t, teamNames: t.teamNames ?? {} });
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

  /** Fetches a channel/thread, returning null instead of throwing when it's gone (10003). */
  private async fetchChannel(id: string) {
    if (!id) return null;
    try {
      return await client.channels.fetch(id);
    } catch (err: any) {
      if (err?.code === 10003 || err?.status === 404) return null;
      throw err;
    }
  }

  private async checkGames(tournament: TournamentTeams): Promise<void> {
    try {
      const matches = await getTournamentMatches(tournament.odcTournamentId);

      for (const match of matches) {
        try {
          const record = this.postedMatches.get(match._id);
          const team1Name = tournament.teamNames[match.team1Id] ?? 'Team 1';
          const team2Name = tournament.teamNames[match.team2Id] ?? 'Team 2';

          if (!record) {
            if (match.state === 'scheduled') {
              console.log(`${team1Name} vs ${team2Name}`);
              console.log(`${match.stationName} ${match.arena} ${tournament.odcTournamentId}`);

              const channel = await this.fetchChannel(process.env.MatchesChannelID as string) as TextChannel | null;
              if (!channel || !channel.isTextBased()) {
                console.error('Matches channel not found!');
                continue;
              }

              const thread = await channel.threads.create({
                name: `Round: ${match.round} - ${team1Name} vs ${team2Name}`,
                type: ChannelType.PrivateThread,
                invitable: false,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
              });

              await thread.send(`Round: ${match.round} - ${team1Name} vs ${team2Name}`);

              let message = `## Station: ${match.stationName ?? 'TBD'}\n ### Arena: ${match.arena ?? 'TBD'}\n ### Best of ${match.bestOf ?? '?'}\n`;

              message += "\n";
              message += "\n";
              for (const userId of tournament.teams[match.team1Id] ?? []) {
                message += `<@${userId}> `;
              }

              message += "vs ";

              for (const userId of tournament.teams[match.team2Id] ?? []) {
                message += `<@${userId}> `;
              }

              await thread.send(message);

              await updateMatch(tournament.odcTournamentId, match._id, { discordThreadId: thread.id });

              this.postedMatches.set(match._id, {
                matchId: match._id,
                threadId: thread.id,
                completed: false,
              });
              this.savePostedMatches();
            }
          }
          else if (!record.completed) {
            if (match.state === 'completed') {
              const thread = await this.fetchChannel(record.threadId) as ThreadChannel | null;

              let team1Wins = 0;
              let team2Wins = 0;
              for (const game of match.games) {
                if (game.team1Score > game.team2Score) team1Wins++;
                else if (game.team2Score > game.team1Score) team2Wins++;
              }

              let message = `### ${team1Name} ${team1Wins} - ${team2Wins} ${team2Name}`;
              match.games.forEach((game, index) => {
                message += `\nRound ${index + 1}: ${game.team1Score} - ${game.team2Score}`;
              });

              if (thread && thread.isTextBased()) {
                await thread.send(message);
              } else {
                // Thread was deleted or is no longer reachable. Score the match anyway so
                // the record settles instead of being retried on every poll.
                console.error(`Thread ${record.threadId} not found for completed match ${match._id}, scoring without it`);
              }

              console.log(`${team1Name} ${team1Wins} - ${team2Wins} ${team2Name}`);
              record.completed = true;

              const winnerParticipantId = match.winner;
              const loserParticipantId = winnerParticipantId === match.team1Id ? match.team2Id : match.team1Id;

              const winners = (winnerParticipantId && tournament.teams[winnerParticipantId]) || [];
              const losers = tournament.teams[loserParticipantId] ?? [];

              if (!winnerParticipantId || winners.length === 0) {
                console.error(`Could not resolve winner roster for match ${match._id}, skipping MMR update`);
                this.savePostedMatches();
                continue;
              }

              const winnerAvg = winners.reduce((sum, userId) => {
                const player = PlayerManager.getInstance().get(userId);
                return sum + (player ? player.mmr : 1000);
              }, 0) / winners.length;

              const loserAvg = losers.length > 0
                ? losers.reduce((sum, userId) => {
                    const player = PlayerManager.getInstance().get(userId);
                    return sum + (player ? player.mmr : 1000);
                  }, 0) / losers.length
                : 1000;

              const multiplier = 4 * (match.bestOf ?? 3) + 12;

              for (const userId of winners) {
                const player = PlayerManager.getInstance().get(userId);
                if (player) {
                  const newMMR = this.mmrCalc(player.mmr, loserAvg, 1, multiplier);
                  PlayerManager.getInstance().updateMMR(userId, newMMR);
                }
              }

              for (const userId of losers) {
                const player = PlayerManager.getInstance().get(userId);
                if (player) {
                  const newMMR = this.mmrCalc(player.mmr, winnerAvg, 0, multiplier);
                  PlayerManager.getInstance().updateMMR(userId, newMMR);
                }
              }

              this.savePostedMatches();
            }
          }
        } catch (err) {
          console.error(`Failed to process match ${match._id} for ${tournament.tournamentName}:`, err);
        }
      }
    } catch (err) {
      console.error(`Failed to check games for ${tournament.tournamentName}:`, err);
    }
  }

  createTournament(tournamentName: string, teams: Record<string, string[]>, teamNames: Record<string, string>, odcTournamentId: string): TournamentTeams {
    const entry: TournamentTeams = { tournamentName, odcTournamentId, teams, teamNames };
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
      for (const [participantId, members] of Object.entries(tournament.teams)) {
        if (members.includes(userId)) {
          const teamName = tournament.teamNames[participantId] ?? participantId;
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
