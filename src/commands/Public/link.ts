import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';

import { PlayerManager } from '../../classes/PlayerManager';
const players = PlayerManager.getInstance();

module.exports = {
	data: new SlashCommandBuilder().setName('link').setDescription('Edit your name').addStringOption(option =>
      option.setName('meta').setDescription('Your meta name').setRequired(true)
    ),

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });
        const name = interaction.options.getString('meta', true);
		const player = players.editUsername(interaction.user.id, name);
		if (player === 'not_found') {
			players.register(interaction.user.id, name);
			await interaction.editReply('You are now registered!');
			return;
		}
		await interaction.editReply('Name edited!');

	}
};
