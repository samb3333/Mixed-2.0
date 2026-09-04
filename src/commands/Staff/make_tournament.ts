import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { TournamentManager } from '../../classes/TournamentManager';
import { Region } from '../../types';

const manager = TournamentManager.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('make_tournament')
    .setDescription('Make a new tournament')
    .addStringOption(option =>
      option.setName('name').setDescription('The name of the tournament').setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('party_only').setDescription('Party only tournament').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('region').setDescription('The tournament region').setRequired(true)
        .addChoices(
          { name: 'EU', value: 'EU' },
          { name: 'NA', value: 'NA' },
          { name: 'OCE', value: 'OCE' },
        )
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const name = interaction.options.getString('name', true);
    const partyOnly = interaction.options.getBoolean('party_only', true);
    const region = interaction.options.getString('region', true) as Region;

    const result = manager.create(name, partyOnly, region);

    if (result === 'already_exists') {
        await interaction.deleteReply();
        return interaction.followUp({ 
            content: `A tournament named **${name}** already exists!`, 
            ephemeral: true 
        });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${name} Tournament (0)`)
      .setColor(0x5865f2)
      .setDescription(`Region: **${region}**\nNo one yet...`);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`tournament_join:${name}`)
        .setLabel('Join')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`tournament_leave:${name}`)
        .setLabel('Leave')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

    // const channel = await interaction.guild?.channels.create({
    //     name: `${name.toLowerCase().replace(/\s+/g, '-')}-config`,
    //     type: ChannelType.GuildText,
    //     permissionOverwrites: [
    //         {
    //             id: interaction.guild.roles.everyone,
    //             deny: ['ViewChannel'],
    //         },
    //     ],
    // });

    // if (channel) {
    //     const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    //         new ButtonBuilder()
    //             .setCustomId(`tournament_check:${name}`)
    //             .setLabel('Check')
    //             .setStyle(ButtonStyle.Secondary)
    //             .setEmoji('⏱️'),
    //         new ButtonBuilder()
    //             .setCustomId(`tournament_start:${name}`)
    //             .setLabel('Start')
    //             .setStyle(ButtonStyle.Success)
    //             .setEmoji('▶️')
    //     );
    //     await channel.send({ content: 'test', components: [row] });
    // } else {
    //     console.error('Failed to create tournament channel');
    // }
  },
};