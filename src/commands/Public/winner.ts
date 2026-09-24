import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { PlayerManager } from '../../classes/PlayerManager';
import { OrionApiError, togglePlayerRole } from '../../classes/OrionApi';

const WINNER_ROLE_ID = 'c9305c3d-14e7-489a-a4f6-bf1f49b86fb9';
const DEFAULT_FLEET_ID = '1c74c4a2-b3b0-407d-b30a-f0ec6538a397';
const ALLOWED_DISCORD_ROLES = ['1542454339661074452', '1542454457197924402'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('winner-toggle')
    .setDescription('Toggle the in-game Winner role for your saved username')
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return interaction.editReply('Use /winner-toggle in the server.');

    let member;
    try {
      member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
    } catch {
      return interaction.editReply('Could not check your Discord roles. Please try again.');
    }
    if (!ALLOWED_DISCORD_ROLES.some(roleId => member.roles.cache.has(roleId))) {
      return interaction.editReply('You need one of the eligible Discord roles to use /winner-toggle.');
    }

    const username = PlayerManager.getInstance().get(interaction.user.id)?.username?.trim();
    if (!username) {
      return interaction.editReply('Set your in-game username with /edit_username first, then use /winner-toggle.');
    }

    try {
      const fleetId = process.env.WINNER_FLEET_ID?.trim() || DEFAULT_FLEET_ID;
      const result = await togglePlayerRole(fleetId, WINNER_ROLE_ID, username);
      if (result === 'busy') {
        return interaction.editReply('A Winner toggle is already running for your player. Please wait for it to finish.');
      }
      return interaction.editReply(result === 'added'
        ? 'Winner enabled for your saved player.'
        : 'Winner disabled for your saved player.');
    } catch (error) {
      if (error instanceof OrionApiError) {
        if (error.code === 'configuration') {
          return interaction.editReply('Winner is not configured yet. Ask an admin to set ORION_API_KEY.');
        }
        if (error.code === 'permission') {
          return interaction.editReply('The bot cannot access Winner roles on Orion Drift. Ask an admin to check its API key and fleet permissions.');
        }
        if (error.code === 'player_not_found') {
          return interaction.editReply('Orion Drift could not find your saved player. Check your username with /edit_username.');
        }
      }
      console.error('Winner toggle failed:', error instanceof OrionApiError ? error.code : 'unexpected error');
      return interaction.editReply('Could not confirm the Winner toggle. Check your in-game role before trying again.');
    }
  },
};
