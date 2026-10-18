import { AttachmentBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PlayerManager } from '../../classes/PlayerManager';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('get_role_usernames')
    .setDescription('List registered Meta usernames of members with a selected role')
    .addRoleOption(option =>
      option.setName('role').setDescription('The role whose members to look up').setRequired(true)
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      return interaction.editReply('Use this command in a server.');
    }

    const selectedRole = interaction.options.getRole('role', true);
    const role = await interaction.guild.roles.fetch(selectedRole.id);
    if (!role) {
      return interaction.editReply('The selected role was not found in this server.');
    }

    // Fetch all members: the role's cached member list may be incomplete.
    const members = await interaction.guild.members.fetch();
    const matching = members.filter(member => member.roles.cache.has(role.id));
    if (matching.size === 0) {
      return interaction.editReply('No members have this role.');
    }

    const players = PlayerManager.getInstance();
    const names: string[] = [];
    const missing: string[] = [];
    for (const member of matching.values()) {
      const username = players.get(member.id)?.username?.trim();
      if (username) {
        names.push(username);
      } else {
        missing.push(`${member.user.tag} (${member.id})`);
      }
    }
    names.sort((a, b) => a.localeCompare(b));
    missing.sort((a, b) => a.localeCompare(b));

    const files = [];
    if (names.length) {
      files.push(new AttachmentBuilder(Buffer.from(names.join(','), 'utf8'), {
        name: 'meta-usernames.txt',
      }));
    }
    if (missing.length) {
      files.push(new AttachmentBuilder(Buffer.from(missing.join('\n'), 'utf8'), {
        name: 'missing-meta-usernames.txt',
      }));
    }

    await interaction.editReply({
      content: `Found ${names.length} registered Meta username(s) among ${matching.size} role member(s). ${missing.length} member(s) have no saved username.`,
      files,
      allowedMentions: { parse: [] },
    });
  },
};