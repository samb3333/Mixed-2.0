import { ButtonInteraction, Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, LabelBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonComponent, ActionRow, TextChannel } from 'discord.js';
import { TournamentManager } from '../classes/TournamentManager';
import { REGION_ROLES, Region } from '../types';

const manager = TournamentManager.getInstance();

import { PlayerManager } from '../classes/PlayerManager';
const players = PlayerManager.getInstance();

import { TeamsManager } from '../classes/TeamsManager';
const teamsManager = TeamsManager.getInstance();

const token = process.env.ODC as string;

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction: any) {
		if (interaction.isButton()) {
			const i = interaction as ButtonInteraction;
			// handle button interaction here
			if (i.customId === 'open_registration') {
				const modal = new ModalBuilder()
				.setCustomId('registration_modal')
				.setTitle('Server Registration');

				const usernameInput = new TextInputBuilder()
				.setCustomId('username')
				.setLabel('Your in-game username')
				.setPlaceholder('Samzy01')
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setMaxLength(32);

				const regionInput = new LabelBuilder()
				.setLabel('Your region (EU / NA)')
				.setStringSelectMenuComponent(
					new StringSelectMenuBuilder()
					.setCustomId('region')
					.setPlaceholder('Select your region')
					.setOptions(
						new StringSelectMenuOptionBuilder()
						.setLabel('EU')
						.setValue('EU')
						.setEmoji('🇪🇺'),
						new StringSelectMenuOptionBuilder()
						.setLabel('NA')
						.setValue('NA')
						.setEmoji('🇺🇸')
					)
				);

				modal.addComponents(usernameInput);
				modal.addComponents(regionInput);

				return i.showModal(modal);
			}

			const [action, ...nameParts] = i.customId.split(':');
			const tournamentName = nameParts.join(':');

			if (action === 'tournament_join') {
				const result = manager.join(tournamentName, i.user.id);
				if (result === 'already_in') {
				return i.reply({ content: 'You are already in this tournament!', ephemeral: true });
				}
				if (result === 'not_found') {
				return i.reply({ content: 'Tournament already started.', ephemeral: true });
				}
				if (result === 'not_registered') {
				return i.reply({ 
					content: 'You have not linked a username, contact a staff member to fix this.', 
					ephemeral: true 
				});
				}
				await i.reply({ content: `You joined **${tournamentName}**!`, ephemeral: true });

			} else if (action === 'tournament_leave') {
				const result = manager.leave(tournamentName, i.user.id);
				if (result === 'not_in') {
				return i.reply({ content: "You aren't in this tournament.", ephemeral: true });
				}
				if (result === 'not_found') {
				return i.reply({ content: 'Tournament already started.', ephemeral: true });
				}
				await i.reply({ content: `You left **${tournamentName}**.`, ephemeral: true });
			} else if (action === 'check') {
				const confirmResult = await manager.confirmCheck(tournamentName, i.user.id);
				if (!confirmResult) {
					return i.reply({ content: 'Failed to confirm, tournament already started.', ephemeral: true });
				}

				const originalRow = i.message.components[0] as ActionRow<ButtonComponent>;

				const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				...originalRow.components.map(button =>
					ButtonBuilder.from(button).setDisabled(true)
				)
				);

				await i.message.edit({ content: `You confirmed your participation in **${tournamentName}**!`, components: [disabledRow] });
				await i.deferUpdate();
				
				return;
			} else if (action === 'check_end') {
				const result = await manager.endCheck(tournamentName);
				if (!result) {
					return i.reply({ content: 'Failed to end activity check.', ephemeral: true });
				}

				const originalRow = i.message.components[0] as ActionRow<ButtonComponent>;

				const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				...originalRow.components.map(button =>
					ButtonBuilder.from(button).setDisabled(true)
				)
				);

				await i.message.edit({ components: [disabledRow] });

				await i.reply({ content: `Activity check for **${tournamentName}** has ended!`, ephemeral: true });
				return;
			} else if (action === 'confirm_teams') {
				i.deferReply({ ephemeral: true });
				if (!manager.get(tournamentName)) {
					return i.editReply({ content: 'Tournament not found.' });
				}

				const result = await manager.start(i.channel as TextChannel, tournamentName);
				if (!result) {
					return i.editReply({ content: 'Failed to start tournament.' });
				}
				return i.editReply({ content: `**${tournamentName} Tournament** has been started!` });
			} else if (action === 'tournament_start') {
				const teams = teamsManager.getTournament(tournamentName);
				if (!teams) {
					return i.reply({ content: 'Tournament not found.', ephemeral: true });
				}

				const response = await fetch(`https://tournament.oriondriftcompetitive.com/api/tournaments/${teams.odcTournamentId}/start`, {
				method: 'POST',
				headers: {
					'Authorization': token,
					'Content-Type': 'application/json'
				}
				});

				const data = await response.json();

				if (!response.ok) {
					console.error('Failed to start tournament on ODC:', data);
					return i.reply({ content: 'Failed to start tournament on ODC.', ephemeral: true });
				}
				console.log('Tournament started on ODC:', data);
				await i.reply({ content: `**${tournamentName} Tournament** has been started on ODC!`, ephemeral: false });
				return;

			} else if (action === 'tournament_finish') {
				const teams = teamsManager.getTournament(tournamentName);
				if (!teams) {
					return i.reply({ content: 'Tournament not found.', ephemeral: true });
				}

				const response = await fetch(`https://tournament.oriondriftcompetitive.com/api/tournaments/${teams.odcTournamentId}/end`, {
				method: 'POST',
				headers: {
					'Authorization': token,
					'Content-Type': 'application/json'
				}
				});

				const data = await response.json();

				if (!response.ok) {
					console.error('Failed to finish tournament on ODC:', data);
					return i.reply({ content: 'Failed to finish tournament on ODC.', ephemeral: true });
				}
				console.log('Tournament finished on ODC:', data);
				await i.reply({ content: `**${tournamentName} Tournament** has been finished on ODC!`, ephemeral: false });

				const guild = i.guild;
				if (!guild) return;

				const channel = guild.channels.cache.get(process.env.standingsChannelID as string);

				await fetch(`https://api.challonge.com/v1/tournaments/${data.data.challongeTournamentId}/finalize.json?api_key=${process.env.CHALLONGE}`, {
					method: 'POST',
				});

				const participantsResult = await fetch(
					`https://api.challonge.com/v1/tournaments/${data.data.challongeTournamentId}/participants.json?api_key=${process.env.CHALLONGE}`
				);
				const participants = await participantsResult.json();

				if (channel && channel.isTextBased() && participants) {
					const results = participants
					.map((p: any) => ({
						name: p.participant.name,
						rank: p.participant.final_rank,
					}))
					.filter((p: any) => p.rank !== null)
					.sort((a: any, b: any) => a.rank - b.rank);

					console.log(results);

					let messageContent = `### ${tournamentName}`;
					messageContent += "\n 🥇"
					if (results[0]) {
						const team = teamsManager.getTeam(tournamentName, results[0].name);
						if (team) {
							for (const user_id of team) {
								messageContent += `<@${user_id}> `;
							}
						}
					}
					messageContent += "\n 🥈"
					if (results[1]) {
						const team = teamsManager.getTeam(tournamentName, results[1].name);
						if (team) {
							for (const user_id of team) {
								messageContent += `<@${user_id}>`;
							}
						}
					}
					messageContent += "\n 🥉"
					if (results[2]) {
						const team = teamsManager.getTeam(tournamentName, results[2].name);
						if (team) {
							for (const user_id of team) {
								messageContent += `<@${user_id}>`;
							}
						}
					}

					await channel.send(messageContent);
				} else {
					console.error('Standings channel not found or is not text-based or participants data is missing.');
				}

				teamsManager.deleteTournament(tournamentName);
				return;

			} else if (action === 'tournament_delete') {
				const teams = teamsManager.getTournament(tournamentName);
				if (!teams) {
					return i.reply({ content: 'Tournament not found.', ephemeral: true });
				}

				const response = await fetch(`https://tournament.oriondriftcompetitive.com/api/tournaments/${teams.odcTournamentId}`, {
				method: 'DELETE',
				headers: {
					'Authorization': token,
					'Content-Type': 'application/json'
				}
				});

				const data = await response.json();

				if (!response.ok) {
					console.error('Failed to delete tournament on ODC:', data);
					return i.reply({ content: 'Failed to delete tournament on ODC.', ephemeral: true });
				}

				teamsManager.deleteTournament(tournamentName);

				console.log('Tournament deleted on ODC:', data);
				await i.reply({ content: `**${tournamentName} Tournament** has been deleted on ODC!`, ephemeral: false });
				return;

			} else {
				// log unrecognized buttons
				console.log(i.customId);
				return;
			}

			// Update the signup embed with new participant list
			const tournament = manager.get(tournamentName)!;
			const memberList =
				tournament.participants.size > 0
				? [...tournament.participants].map(id => `<@${id}> (${players.get(id)?.username || 'Unknown'})`).join('\n')
				: 'No one yet...';

			const updatedEmbed = EmbedBuilder.from(i.message.embeds[0]).setDescription(memberList);

			await i.message.edit({ embeds: [updatedEmbed] });
			return;

		} else if (interaction.isAutocomplete()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command || !command.autocomplete) return;

			try {
				await command.autocomplete(interaction);
			} catch (error) {
				console.error(error);
			}
			return;
		}

		if (interaction.isModalSubmit()) {
			const i = interaction as ModalSubmitInteraction;

			if (i.customId === 'registration_modal') {
				const username = i.fields.getTextInputValue('username');
				const region = i.fields.getStringSelectValues('region')[0] as Region;

				if (players.isRegistered(i.user.id)) {
					return i.reply({ content: '⚠️ You are already registered!', ephemeral: true });
				}

				// Validate region
				const roleId = REGION_ROLES[region];
				if (!roleId) {
				return i.reply({
					content: 'Invalid region. Please enter EU or NA',
					ephemeral: true,
				});
				}

				// Assign role
				const member = await i.guild?.members.fetch(i.user.id);
				if (!member) return;

				try {
					await member.roles.add(roleId);
					players.register(i.user.id, username);
					return i.reply({
						content: `Welcome **${username}**! You've been given the **${region}** role.`,
						ephemeral: true,
					});
				} catch (err) {
					console.error(err);
					return i.reply({
						content: '⚠️ Failed to assign role. Please contact a staff member.',
						ephemeral: true,
					});
				}
			}
		}

		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(
				`No command matching ${interaction.commandName} was found.`
			);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction
					.followUp({
						content: 'There was an error while executing this command!',
						ephemeral: true
					})
					.catch(() => {});
			} else {
				await interaction
					.reply({
						content: 'There was an error while executing this command!',
						ephemeral: true
					})
					.catch(() => {});
			}
		}
	}
};
