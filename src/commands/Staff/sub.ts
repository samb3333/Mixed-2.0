import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { TeamsManager } from '../../classes/TeamsManager';

const teamsManager = TeamsManager.getInstance();

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

    const teamName = tournament.teamNames[participantId] ?? participantId;
    const newRoster = tournament.teams[participantId].map(id => (id === playerOut.id ? playerIn.id : id));

    // Push to ODC first so a failed sync leaves teams.json untouched.
    const sync = await teamsManager.syncParticipant(tournamentName, participantId, newRoster);
    if (sync !== 'ok') {
      return interaction.editReply('⚠️ Failed to update the roster on ODC — nothing was changed. Please try again.');
    }

    const swapped = teamsManager.swapPlayer(tournamentName, participantId, playerOut.id, playerIn.id);
    if (!swapped) {
      return interaction.editReply('⚠️ Updated the roster on ODC, but failed to update teams.json — please check it manually.');
    }

    await interaction.editReply(`✅ Swapped <@${playerOut.id}> out for <@${playerIn.id}> on **${teamName}** in **${tournamentName}**.`);
  },
};
