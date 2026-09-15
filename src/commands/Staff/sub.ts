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

    const swapped = teamsManager.swapPlayer(tournamentName, participantId, playerOut.id, playerIn.id);
    if (!swapped) {
      return interaction.editReply('⚠️ Failed to update teams.json — please check it manually.');
    }

    const teamName = tournament.teamNames[participantId] ?? participantId;

    const sync = await teamsManager.syncParticipant(tournamentName, participantId);
    if (sync !== 'ok') {
      return interaction.editReply(`⚠️ Swapped <@${playerOut.id}> out for <@${playerIn.id}> on **${teamName}** locally, but failed to sync the roster/whitelist on ODC — please refresh it manually.`);
    }

    await interaction.editReply(`✅ Swapped <@${playerOut.id}> out for <@${playerIn.id}> on **${teamName}** in **${tournamentName}**.`);
  },
};
