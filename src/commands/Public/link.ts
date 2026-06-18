import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction, GuildMember } from 'discord.js';

import { PlayerManager } from '../../classes/PlayerManager';
const players = PlayerManager.getInstance();

module.exports = {
	data: new SlashCommandBuilder().setName('link').setDescription('Register or edit your name').addStringOption(option =>
      option.setName('meta').setDescription('Your meta name').setRequired(true)
    ),

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });
        const name = interaction.options.getString('meta', true);
		const player = players.editUsername(interaction.user.id, name);

		const targetUser = await interaction.guild?.members.fetch(interaction.user.id) as GuildMember;
		//console.log(`Target user: ${targetUser?.user.tag}`);
		if (targetUser) {
			//console.log(`Setting nickname for ${targetUser.user.tag} to ${name}`);
			try {
				await targetUser.setNickname(name);
			} catch (err) {
				console.error(`Failed to set nickname for ${targetUser.user.tag}:`, err);
			}
		}

		if (player === 'not_found') {
			players.register(interaction.user.id, name);
			await interaction.editReply('You are now registered!');
			return;
		}
		await interaction.editReply('Name edited!');
	}
};
