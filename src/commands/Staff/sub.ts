import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { TeamsManager } from '../../classes/TeamsManager';
import { getOdcUserByDiscordId, addPlayerToRoster, removePlayerFromRoster, RosterOpResult } from '../../classes/OdcApi';

const teamsManager = TeamsManager.getInstance();

const ROSTER_ERROR_REASONS: Record<Exclude<RosterOpResult, 'ok'>, string> = {
  not_frozen: 'the roster has not been frozen yet',
  not_found: 'the tournament, team, or player was not found on ODC',
  already_on_roster: 'that player is already on the roster',
  error: 'an unexpected ODC API error occurred',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sub')
    .setDescription('Substitute a player on a tournament team')
    .addStringOption(option =>
      option.setName('tournament').setDescription('The name of the tournament').setRequired(true)
    )
    .addUserOption(option =>
      option.setName('player_out').setDescription('The player to remove').setRequired(true)
    )
    .addUserOption(option =>
      option.setName('player_in').setDescription('The player to bring in').setRequired(true)
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const tournamentName = interaction.options.getString('tournament', true);
    const playerOut = interaction.options.getUser('player_out', true);
    const playerIn = interaction.options.getUser('player_in', true);

    if (playerOut.id === playerIn.id) {
      return interaction.editReply('`player_out` and `player_in` cannot be the same player.');
    }

    const tournament = teamsManager.getTournament(tournamentName);
    if (!tournament) {
      return interaction.editReply(`No active tournament named **${tournamentName}** was found.`);
    }

    const participantId = teamsManager.findParticipantByPlayer(tournamentName, playerOut.id);
    if (!participantId) {
      return interaction.editReply(`<@${playerOut.id}> is not on a team in **${tournamentName}**.`);
    }

    if (teamsManager.findParticipantByPlayer(tournamentName, playerIn.id)) {
      return interaction.editReply(`<@${playerIn.id}> is already on a team in **${tournamentName}**.`);
    }

    const [odcOut, odcIn] = await Promise.all([
      getOdcUserByDiscordId(playerOut.id),
      getOdcUserByDiscordId(playerIn.id),
    ]);

    if (!odcIn) {
      return interaction.editReply(`<@${playerIn.id}> doesn't have an ODC account linked, so they can't be added to the roster.`);
    }

    const addResult = await addPlayerToRoster(tournament.odcTournamentId, participantId, odcIn.id);
    if (addResult !== 'ok' && addResult !== 'already_on_roster') {
      return interaction.editReply(`⚠️ Failed to add <@${playerIn.id}> to the roster on ODC: ${ROSTER_ERROR_REASONS[addResult]}.`);
    }

    let removeWarning = '';
    if (odcOut) {
      const removeResult = await removePlayerFromRoster(tournament.odcTournamentId, participantId, odcOut.id);
      if (removeResult !== 'ok') {
        removeWarning = `\n⚠️ <@${playerOut.id}> was **not** removed from the ODC roster (${ROSTER_ERROR_REASONS[removeResult]}) — remove them manually.`;
      }
    } else {
      removeWarning = `\n⚠️ <@${playerOut.id}> has no linked ODC account, so there was nothing to remove from the ODC roster.`;
    }

    const swapped = teamsManager.swapPlayer(tournamentName, participantId, playerOut.id, playerIn.id);
    if (!swapped) {
      return interaction.editReply(`⚠️ Updated the ODC roster, but failed to update teams.json — please check it manually.${removeWarning}`);
    }

    const teamName = tournament.teamNames[participantId] ?? participantId;
    await interaction.editReply(`✅ Swapped <@${playerOut.id}> out for <@${playerIn.id}> on **${teamName}** in **${tournamentName}**.${removeWarning}`);
  },
};
