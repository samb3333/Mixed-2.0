import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { TournamentManager } from '../../classes/TournamentManager';
import { BracketFormat } from '../../types';

const manager = TournamentManager.getInstance();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('start')
		.setDescription('Start a tournament')
		.addStringOption(option =>
		option.setName('name').setDescription('The name of the tournament').setRequired(true)
		)
		.addStringOption(option =>
		option.setName('format').setDescription('Bracket format').setRequired(true)
			.addChoices(
				{ name: 'Single Elimination', value: 'single' },
				{ name: 'Double Elimination', value: 'double' },
			)
		)
		.setDefaultMemberPermissions(0),

	async execute(interaction: ChatInputCommandInteraction) {

		await interaction.deferReply({ ephemeral: true });
		const name = interaction.options.getString('name', true);
		const format = interaction.options.getString('format', true) as BracketFormat;

		const result = manager.createTeams(interaction, name, format);

		if (!result) {
			await interaction.editReply({ 
				content: `No tournament named **${name}** was found!`
			});
			return;
		}

		// await interaction.editReply(`Tournament **${name}** started!`);
	}
};
