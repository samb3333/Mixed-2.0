import { Client, Events } from 'discord.js';

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client1: Client) {
		// Client ready event - Runs when the client is first logged into
		console.log(`Ready! Logged in as ${client1.user?.tag}`);
	}
};
