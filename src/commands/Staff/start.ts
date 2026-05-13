import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { TournamentManager } from '../../classes/TournamentManager';

const manager = TournamentManager.getInstance();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('start')
		.setDescription('Start a tournament')
		.addStringOption(option =>
		option.setName('name').setDescription('The name of the tournament').setRequired(true)
		)
		.setDefaultMemberPermissions(0),

	async execute(interaction: ChatInputCommandInteraction) {

		await interaction.deferReply({ ephemeral: true });
		const name = interaction.options.getString('name', true);

		const result = manager.createTeams(interaction, name);

		if (!result) {
			await interaction.editReply({ 
				content: `No tournament named **${name}** was found!`
			});
			return;
		}

		// await interaction.editReply(`Tournament **${name}** started!`);
	}
};
