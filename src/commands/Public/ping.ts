import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

module.exports = {
	data: new SlashCommandBuilder().setName('ping').setDescription('pong'),

	async execute(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true });
		await interaction.editReply('Pong!');
	}
};
