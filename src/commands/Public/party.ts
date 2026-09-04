import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PartyManager } from '../../classes/PartyManager';
import { Party } from '../../types';
import { PlayerManager } from '../../classes/PlayerManager';

const manager = PartyManager.getInstance()

module.exports = {
	data: new SlashCommandBuilder()
    .setName('party')
    .setDescription('Manage your party')
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Create a new party')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('leave')
            .setDescription('Leave a party')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('info')
            .setDescription('View your party')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('invite')
            .setDescription('Invite someone to your party')
            .addUserOption(option =>
      option.setName('player').setDescription('Player to invite').setRequired(true))
    )
    ,

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();


		try {
            switch (subcommand) {
                case 'create':
                    const r = manager.create(interaction.user.id)
                    if (r === 'already_in') return await interaction.editReply('You are already in a party, use /leave')
                    if (r === 'not_registered') return await interaction.editReply('You need to register first, use the registration panel')
                    await interaction.editReply('Party created successfully!');
                    break;

                case 'leave':
                    const result = manager.leave(interaction.user.id)
                    if (result === 'not_in') return await interaction.editReply('You are not in a party. Use /party create');

                    await interaction.editReply(`You have left the party`);
                    break;

                case 'info':
                    const party: Party | false = manager.getParty(interaction.user.id)

                    if (!party) return await interaction.editReply('You are not in a party. Use /party create');

                    let message = `### Party\n- Leader: <@${party.leader}>`
                    if (party.member) {
                        message += `\n- Member: <@${party.member}>`
                    }
                    await interaction.editReply(message);
                    break;
                case 'invite':
                    const p: Party | false = manager.getParty(interaction.user.id)

                    if (!p) return await interaction.editReply('You are not in a party. Use /party Create');

                    if (p.member) return await interaction.editReply('Your party is full, use /leave and make another one');

                    const player = interaction.options.getUser('player');

                    if (!player) return;

                    const hasLinked = PlayerManager.getInstance().isRegistered(player.id)

                    if (!hasLinked) return await interaction.editReply('That player needs to register first, use the registration panel')

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                        .setCustomId(`party_join:${interaction.user.id}`)
                        .setLabel('accept')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                        new ButtonBuilder()
                        .setCustomId(`party_reject:${interaction.user.id}`)
                        .setLabel('decline')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                    );

                    await player?.send({ content: `**${interaction.user.globalName}** has invited you to their party`, components: [row] })
                    await interaction.editReply(`Invited <@${player?.id}>`);
                    break;

                default:
                    await interaction.editReply('Unknown subcommand.');
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply('There was an error executing this party command.');
        }
	}
};
