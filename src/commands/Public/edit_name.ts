import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';

import { PlayerManager } from '../../classes/PlayerManager';
const players = PlayerManager.getInstance();

module.exports = {
	data: new SlashCommandBuilder().setName('edit_name').setDescription('Edit your name').addStringOption(option =>
      option.setName('name').setDescription('The name of the tournament').setRequired(true)
    ),

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });
        const name = interaction.options.getString('name', true);
		const player = players.editUsername(interaction.user.id, name);
		if (player === 'not_found') {
			await interaction.editReply('You are not registered!');
			return;
		}
		await interaction.editReply('Name edited!');


	}
};
