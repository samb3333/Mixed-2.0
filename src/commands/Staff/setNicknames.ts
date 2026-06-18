import { SlashCommandBuilder, CommandInteraction, GuildMember } from 'discord.js';
import { PlayerManager } from '../../classes/PlayerManager';
const players = PlayerManager.getInstance();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('nicknames')
		.setDescription('set nicknames for all members')
		.setDefaultMemberPermissions(0),

	async execute(interaction: CommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        for (const player of players.getAll()) {
        try {
            const member = await interaction.guild?.members.fetch(player.userId);
            if (!member) continue;

            await member.setNickname(player.username);
            console.log(`Set nickname for ${member.user.tag} to ${player.username}`);
        } catch (err: any) {
            if (err.code === 10007) {
                console.warn(`Skipping ${player.username} — not in server`);
            } else {
                console.error(`Failed to set nickname for ${player.username}:`, err);
            }
        }
        }

        await interaction.editReply('Nicknames updated!');
    }
};
