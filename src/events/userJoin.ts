import { Events, GuildMember } from 'discord.js';

module.exports = {
	name: Events.GuildMemberAdd,
	once: true,
	async execute(member: GuildMember) {
		// Handle any user join events here
	}
};
