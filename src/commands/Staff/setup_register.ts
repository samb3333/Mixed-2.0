import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup_register')
    .setDescription('Post the registration button in this channel')
    .setDefaultMemberPermissions(0),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('📋 Server Registration')
      .setDescription('Click the button below to register and get access to your region!')
      .setColor(0x5865F2);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('open_registration')
        .setLabel('Register')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋')
    );

    await interaction.reply({ content: 'Registration panel posted!', ephemeral: true });
    const channel = interaction.channel as TextChannel;
    await channel.send({ embeds: [embed], components: [row] });
  }
};