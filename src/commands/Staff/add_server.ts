import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { TeamsManager } from '../../classes/TeamsManager';

const manager = TeamsManager.getInstance();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add_server')
        .setDescription('Add a server to a tournament')
        .addStringOption(option =>
        option.setName('name').setDescription('The name of the tournament').setRequired(true)
        )
        .addStringOption(option =>
        option.setName('server_id').setDescription('The id of the orion drift server').setRequired(true)
        )
        .setDefaultMemberPermissions(0),

    async execute(interaction: ChatInputCommandInteraction) {

        await interaction.deferReply({ ephemeral: true });
        const name = interaction.options.getString('name', true);
        const id = interaction.options.getString('server_id', true);

        const result = await manager.updateServers(name, id);

        if (!result) {
            await interaction.editReply({ 
                content: `Failed to add server too **${name}**!`
            });
            return;
        }

        console.log(`${interaction.user.globalName} added ${id} to ${name}`)
        await interaction.editReply(`Added server too **${name}**!`);
    }
};
