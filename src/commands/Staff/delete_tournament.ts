import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { TournamentManager } from '../../classes/TournamentManager';

const manager = TournamentManager.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_tournament')
    .setDescription('Delete an existing tournament')
    .addStringOption(option =>
      option.setName('name').setDescription('The name of the tournament').setRequired(true)
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true);
    const result = manager.delete(name);

    if (result === false) {
        await interaction.editReply({ 
            content: `No tournament named **${name}** was found!`
        });
    } else {
        await interaction.editReply({ 
            content: `Tournament **${name}** has been deleted!`,
        });
    }
  },
};