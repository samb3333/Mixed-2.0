import { Tournament, TournamentJSON , ActivityCheck} from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { PlayerManager } from './PlayerManager';
import { TeamsManager } from './TeamsManager';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ChatInputCommandInteraction, Client, EmbedBuilder, TextChannel } from 'discord.js';
import { client } from '..';

const DB_PATH = path.join(__dirname, '../../data/tournaments.json');

export class TournamentManager {
  private static instance: TournamentManager;
  private tournaments = new Map<string, Tournament>();
  private activityChecks = new Map<string, ActivityCheck>();

  private constructor() {
    this.load();
  }

  static getInstance(): TournamentManager {
    if (!TournamentManager.instance) {
      TournamentManager.instance = new TournamentManager();
    }
    return TournamentManager.instance;
  }

  // --- Persistence ---

  private load(): void {
    try {
      if (!fs.existsSync(DB_PATH)) return;
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed: TournamentJSON[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('⚠️ tournaments.json was not an array, resetting...');
        this.save(); // overwrite with empty valid state
        return;
      }
      for (const t of parsed) {
        this.tournaments.set(t.name, {
          ...t,
          participants: new Set(t.participants),
        });
      }
      console.log(`Loaded ${this.tournaments.size} tournament(s) from disk`);
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    }
  }

  endCheck(tournamentName: string): boolean {
    const t = this.tournaments.get(tournamentName);
    if (!t) return false;
    const a = this.activityChecks.get(tournamentName);
    if (!a) return false;

    let count = 0;
    for (const userId of a.notConfirmed) {
      t.participants.delete(userId);
      count++;
    }
    this.save();
    console.log(`Ended activity check for ${tournamentName}. Removed ${count} participant(s).`);
    this.activityChecks.delete(tournamentName);
    return true;
  }

  async check(client: Client, tournamentName: string, channelId: string, msgId: string): Promise<boolean> {
    const t = this.tournaments.get(tournamentName);
    if (!t) return false;

    const participants = [...t.participants];

    this.activityChecks.set(tournamentName, {
      name: tournamentName,
      channelId: channelId,
      msgId: msgId,
      notConfirmed: new Set([...t.participants])
    });

    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_DMS = 1000;      // 1s between each DM
    const DELAY_BETWEEN_BATCHES = 5000;  // 5s between batches

    for (let i = 0; i < participants.length; i += BATCH_SIZE) {
      const batch = participants.slice(i, i + BATCH_SIZE);

      for (const userId of batch) {
        try {
          const user = await client.users.fetch(userId);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`check:${tournamentName}`)
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✅')
            );


          await user.send({ content: `Click to confirm your participation in **${tournamentName}**!`, components: [row] });
        } catch (err) {
          console.warn(`Could not DM ${userId}:`, err);
        }
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DMS));
      }

      if (i + BATCH_SIZE < participants.length) {
        console.log(`Batch done, waiting before next...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    console.log(`Finished DMing all participants in ${tournamentName}`);
    return true;
  }

  checkEmbed(tournamentName: string): EmbedBuilder {
    let participantsText = this.getActivityChecks(tournamentName)?.notConfirmed.size ? [...this.getActivityChecks(tournamentName)!.notConfirmed].map(id => `<@${id}>`).join('\n') : 'Everyone has confirmed!';
    if (participantsText.length > 4000) {
      participantsText = participantsText.slice(0, 3990) + '\n...and more';
    }
    const embed = new EmbedBuilder()
      .setTitle(`${tournamentName} Tournament - (${Math.max(0, (this.get(tournamentName)?.participants.size || 0) - (this.getActivityChecks(tournamentName)?.notConfirmed.size || 0))}) confirmed`)
      .setColor(0x57f287)
      .setDescription(`Not Confirmed yet:\n${participantsText}`);

    return embed;
  }

  async confirmCheck(tournamentName: string, userId: string): Promise<boolean> {
    const a = this.activityChecks.get(tournamentName);
    if (!a) return false;
    if (!a.notConfirmed.has(userId)) return false;

    const player = PlayerManager.getInstance().get(userId);
    if (!player) return false;

    a.notConfirmed.delete(userId);

  try {
    const channel = await client.channels.fetch(a.channelId);
    if (!channel || !channel.isTextBased()) return false;

    const msg = await (channel as TextChannel).messages.fetch(a.msgId);
    const embed = this.checkEmbed(tournamentName);
    await msg.edit({ content: null, embeds: [embed] });

    return true;
  } catch (err) {
    console.error('Failed to update activity check message:', err);
    return false;
  }
}

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      const data: TournamentJSON[] = [...this.tournaments.values()].map(t => ({
        ...t,
        participants: [...t.participants],
      }));
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to save tournaments:', err);
    }
  }

  create(name: string): Tournament | 'already_exists' {
    if (this.tournaments.has(name)) return 'already_exists';
    const tournament: Tournament = { name, participants: new Set() };
    this.tournaments.set(name, tournament);
    this.save();
    return tournament;
  }

  join(name: string, userId: string): 'joined' | 'already_in' | 'not_found' | 'not_registered' {
    const t = this.tournaments.get(name);
    if (!t) return 'not_found';
    if (t.participants.has(userId)) return 'already_in';

    const player = PlayerManager.getInstance().get(userId);
    if (!player) return 'not_registered';

    t.participants.add(userId);
    this.save();
    return 'joined';
  }

  leave(name: string, userId: string): 'left' | 'not_in' | 'not_found' {
    const t = this.tournaments.get(name);
    if (!t) return 'not_found';
    if (!t.participants.has(userId)) return 'not_in';
    t.participants.delete(userId);
    this.save();
    return 'left';
  }

  get(name: string): Tournament | undefined {
    return this.tournaments.get(name);
  }

  getActivityChecks(tournamentName: string): ActivityCheck | undefined {
    return this.activityChecks.get(tournamentName);
  }

  delete(name: string): boolean {
    const deleted = this.tournaments.delete(name);
    if (deleted) this.save();
    return deleted;
  }

  greedyTeamAssignment(memberIds: string[], teamSize: number): string[][] {
    const playerManager = PlayerManager.getInstance();

    // Sort players by MMR highest first
    const sorted = [...memberIds].sort((a, b) => {
      const mmrA = playerManager.get(a)?.mmr ?? 1000;
      const mmrB = playerManager.get(b)?.mmr ?? 1000;
      return mmrB - mmrA;
    });

    const teamCount = Math.floor(memberIds.length / teamSize);
    const teams: string[][] = Array.from({ length: teamCount }, () => []);

    for (const id of sorted) {
      // Find the team with the lowest total MMR
      const lowestTeam = teams.reduce((lowest, team) => {
        const teamMMR = (t: string[]) => t.reduce((sum, id) => sum + (playerManager.get(id)?.mmr ?? 1000), 0);
        return teamMMR(team) < teamMMR(lowest) ? team : lowest;
      });

      lowestTeam.push(id);
    }

    return teams;
  }

  createTeams(interaction: ChatInputCommandInteraction, name: string): boolean {
    const t = this.tournaments.get(name);
    if (!t) return false;

    const team_size = 4;
    const allPlayers = [...t.participants];
    const validCount = Math.floor(allPlayers.length / team_size) * team_size;
    const activePlayers = allPlayers.slice(0, validCount);

    const teams = this.greedyTeamAssignment(activePlayers, team_size);

    let messageContent = `**${name}** Tournament has started!\n`;
    teams.forEach((team, index) => {
      const teamMembers = team.map(id => `<@${id}>`).join(', ');
      const avgMMR = Math.round(team.reduce((sum, id) => sum + (PlayerManager.getInstance().get(id)?.mmr ?? 1000), 0) / team.length);
      messageContent += `**Team ${index + 1}:** ${teamMembers} (${avgMMR})\n`;
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_teams:${name}`)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✅')
    );

    interaction.followUp({ content: messageContent, components: [row] });

    return true;
  }

  async start(channel: TextChannel, name: string): Promise<boolean> {
    const t = this.tournaments.get(name);
    if (!t) return false;

    const team_size = 4;
    const allPlayers = [...t.participants];
    const validCount = Math.floor(allPlayers.length / team_size) * team_size;
    const activePlayers = allPlayers.slice(0, validCount);

    const teams = this.greedyTeamAssignment(activePlayers, team_size);

    let messageContent = `**${name}** Tournament Teams:\n`;
    for (const [index, team] of teams.entries()) {
      const teamMembers = team.map(id => `<@${id}>`).join(', ');
      const avgMMR = Math.round(team.reduce((sum, id) => sum + (PlayerManager.getInstance().get(id)?.mmr ?? 1000), 0) / team.length);
      if (messageContent.length + `**Team ${index + 1}:** ${teamMembers} (${avgMMR})\n`.length > 2000) {
        await channel.send({ content: messageContent });
        messageContent = '';
      }
      messageContent += `**Team ${index + 1}:** ${teamMembers} (${avgMMR})\n`;
    };

    await channel.send({ content: messageContent });

    let payload = {
            "name": name,
            "region": "EU",
            "startTime": new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
            "maxTeams": 64,
            "createChallongeBracket": true,
            "stationIDs": ["n"],
            "arenas": ["gamma 01","beta 01","gamma 02","beta 02","gamma 03","beta 03"],
            "checkInsEnabled": false,
            "bestOf": 3,
            "bestOfSemifinals": 5,
            "bestOfLosersFinals": 5,
            "bestOfFinals": 7
        }

    const token = process.env.ODC as string;
    const response = await fetch('https://tournament.oriondriftcompetitive.com/api/tournaments', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    channel.send(`**Tournament started on Challonge:** https://challonge.com/${data.data.challongeTournamentId}`);

    console.log(data);

    const teamData: Record<string, any[]> = {};
    teams.forEach((members, i) => {
      teamData[`Team ${i + 1}`] = members;
    });
    //console.log(teamData);

    // make odc teams
    const metas = PlayerManager.getInstance()

    for (const [teamName, members] of Object.entries(teamData)) {
      console.log(teamName);

      const payload = {
        name: teamName,
        tournamentId: `${data.data.id}`,
        captainInGameName: metas.get(members[0])?.username ?? 'n',
        additionalPlayers: members.slice(1).map(p => ({
          inGameName: metas.get(p)?.username ?? 'n',
          discordId: 'n',
        })),
      };

      const currentTeam = await fetch('https://tournament.oriondriftcompetitive.com/api/teams/register', {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const currentTeamData = await currentTeam.json();
      console.log(currentTeam.status, currentTeamData);
    }

    TeamsManager.getInstance().createTournament(name, teamData, data.data.id);

    this.delete(name); // remove tournament from our system since it's now in Teams

    const guildID = process.env.GUILD_ID as string;
    const guild = client.guilds.cache.get(guildID);
    if (!guild) throw new Error('Guild not found');
    
    const configChannel = await guild.channels.create({
        name: `${name.toLowerCase().replace(/\s+/g, '-')}-config`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: ['ViewChannel'],
            },
        ],
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`tournament_start:${name}`)
                .setLabel('Start')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`tournament_finish:${name}`)
                .setLabel('Finish')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🏁'),
            new ButtonBuilder()
                .setCustomId(`tournament_delete:${name}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );

    await configChannel.send( { content: `Tournament configuration panel https://challonge.com/${data.data.challongeTournamentId}\n`, components: [row] });
    await configChannel.send(data.data.id);

    return true;
  }
}