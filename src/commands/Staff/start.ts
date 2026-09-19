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
		.addStringOption(option =>
		option.setName('fleet').setDescription('The fleet the matches should be created in').setRequired(true)
			.addChoices(
				{ name: 'ODC Matches', value: 'bd6946d4-1853-4a3b-9f57-3be2ddc7d67c' },
				{ name: 'Tournament Fleet', value: '1c74c4a2-b3b0-407d-b30a-f0ec6538a397' },
			)
		)
		.setDefaultMemberPermissions(0),

	async execute(interaction: ChatInputCommandInteraction) {

		await interaction.deferReply({ ephemeral: true });
		const name = interaction.options.getString('name', true);
		const format = interaction.options.getString('format', true) as BracketFormat;
		const fleetId = interaction.options.getString('fleet', true);

		const result = manager.createTeams(interaction, name, format, fleetId);

		if (!result) {
			await interaction.editReply({ 
				content: `No tournament named **${name}** was found!`
			});
			return;
		}

		// await interaction.editReply(`Tournament **${name}** started!`);
	}
};
