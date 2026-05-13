import { Events, Message } from 'discord.js';

module.exports = {
	name: Events.MessageCreate,
	execute(message: Message) {
		// Handle any message events here
	}
};
