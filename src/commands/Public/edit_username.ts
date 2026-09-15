import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { PlayerManager } from '../../classes/PlayerManager';
import { TeamsManager } from '../../classes/TeamsManager';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit_username')
    .setDescription('Edit your stored in-game username')
    .addStringOption(option =>
      option.setName('name').setDescription('Your new username').setRequired(true).setMaxLength(64)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('name', true).trim();
    if (!username) {
      return interaction.editReply('Please enter a valid username.');
    }

    const result = PlayerManager.getInstance().setUsername(interaction.user.id, username);
    if (result === 'not_found') {
      return interaction.editReply('You need to register first! Use the registration button in the server.');
    }

    try {
      const member = await interaction.guild?.members.fetch(interaction.user.id);
      await member?.setNickname(username);
    } catch (err) {
      console.error('Failed to update nickname:', err);
    }

    const teamsManager = TeamsManager.getInstance();
    const memberships = teamsManager.getByPlayer(interaction.user.id);

    const failures: string[] = [];
    for (const { tournament } of memberships) {
      const participantId = teamsManager.findParticipantByPlayer(tournament, interaction.user.id);
      if (!participantId) continue;

      const sync = await teamsManager.syncParticipant(tournament, participantId);
      if (sync !== 'ok') failures.push(tournament);
    }

    let content = `✅ Your username has been set to **${username}**.`;
    if (failures.length > 0) {
      content += `\n⚠️ Failed to sync your team roster on ODC for: ${failures.map(n => `**${n}**`).join(', ')} — please refresh it manually.`;
    }

    await interaction.editReply(content);
  },
};
