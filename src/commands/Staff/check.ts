import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { TournamentManager } from '../../classes/TournamentManager';

const manager = TournamentManager.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Start activity check')
    .addStringOption(option =>
      option.setName('name').setDescription('The name of the tournament').setRequired(true)
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction: ChatInputCommandInteraction) {
    const reply = await interaction.deferReply({ ephemeral: false, fetchReply: true });

    const name = interaction.options.getString('name', true);
    const result = await manager.check(interaction.client, name, interaction.channelId, reply.id);

    if (result === false) {
      await interaction.deleteReply();
        await interaction.followUp({ 
            content: `No tournament named **${name}** was found!`,
            ephemeral: true
        });
    } else {

        // const embed = new EmbedBuilder()
        //       .setTitle(`${name} Tournament - (0) confirmed`)
        //       .setColor(0x57f287)
        //       .addFields({ name: 'Not confirmed', value: manager.get(name)?.participants.size ? [...manager.get(name)!.participants].map(id => `<@${id}>`).join('\n') : 'No participants yet!' });


        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`check_end:${name}`)
                .setLabel('End Check')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏱️'),
        );

        await interaction.editReply({ 
            content: null,
            embeds: [manager.checkEmbed(name)],
            components: [row]
        });
    }
  },
};