import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const clientId = process.env.CLIENT_ID as string;

const token = process.env.TOKEN as string;

export async function deployCommands() {
	const commands: Map<string, any> = new Map();
	const foldersPath = path.join(__dirname, 'commands');
	const commandFolders = fs.readdirSync(foldersPath);

	for (const folder of commandFolders) {
		const commandsPath = path.join(foldersPath, folder);
		const commandFiles = fs
			.readdirSync(commandsPath)
			.filter((file) => file.endsWith('.js') || file.endsWith('.ts'));
		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			const command = await import(filePath);
			if ('data' in command && 'execute' in command) {
				const cmdData = command.data.toJSON();
				if (commands.has(cmdData.name)) {
					console.error(
						`Duplicate command name found: ${cmdData.name} in file ${filePath}`
					);
				} else {
					console.log(`Registering command: ${cmdData.name}`);
					commands.set(cmdData.name, cmdData);
				}
			} else {
				console.log(
					`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
				);
			}
		}
	}

	const rest = new REST().setToken(token);

	// This deploys commands to specific guild
	// Use Routes.applicationCommands for global commands
	(async () => {
		try {
			console.log(
				`Started refreshing ${commands.size} application (/) commands.`
			);

			const data: any = await rest.put(
				Routes.applicationGuildCommands(clientId, process.env.GUILD_ID!),
				{
					body: Array.from(commands.values())
				}
			);

			console.log(
				`Successfully reloaded ${data.length} application (/) commands.`
			);
		} catch (error) {
			console.error(error);
		}
	})();
}
