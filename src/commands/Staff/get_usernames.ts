import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { PlayerManager } from '../../classes/PlayerManager';

const players = PlayerManager.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('get_usernames')
    .setDescription('Get the registered in-game usernames for a list of @ mentioned members')
    .addStringOption(option =>
      option.setName('users').setDescription('@ mention the members to look up').setRequired(true)
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const input = interaction.options.getString('users', true);
    const userIds = [...new Set([...input.matchAll(/<@!?(\d+)>/g)].map(match => match[1]))];

    if (userIds.length === 0) {
      return interaction.editReply('Please @ mention at least one member.');
    }

    const names = userIds.map(userId => players.get(userId)?.username ?? `<@${userId}>`);

    await interaction.editReply(`\`\`\`\n${names.join('\n')}\n\`\`\``);
  },
};
