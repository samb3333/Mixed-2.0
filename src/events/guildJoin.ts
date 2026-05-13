import { Events, Guild } from 'discord.js';

module.exports = {
	name: Events.GuildCreate,
	once: true,
	execute(guild: Guild) {
		// I use this to leave random servers that it might get added to:
		/*

		if (
			guild.id !== ''
		) {
			console.log(`Left ${guild.name}`);
			guild.leave();
		}
			
		*/
	}
};
