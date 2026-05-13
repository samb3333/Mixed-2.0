import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('staff-ping')
		.setDescription('pong')
		.setDefaultMemberPermissions(0),

	async execute(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true });
		await interaction.editReply('Pong!');

	}
};
