# Mixed 2.0

A Discord bot that runs "mixed" community tournaments for **Orion Drift**, a VR game. Players sign up on Discord, the bot builds balanced teams from their skill ratings, and then it runs the whole bracket through the [Orion Drift Competitive (ODC)](https://oriondriftcompetitive.com) platform: posting matches, reporting results and updating ratings.

Built with **TypeScript**, **Node.js** and **discord.js**, and connected to the ODC REST API.

## Features

- **Player registration**: a sign-up button asks players for their in-game username and region (EU, NA or OCE) and gives them the matching Discord role.
- **Tournament sign-ups**: staff create a tournament, and players join or leave with buttons. There's a solo mode, and a party mode where players enter as a duo.
- **Activity checks**: before teams are made, the bot DMs every participant a confirm button and removes anyone who doesn't respond. DMs are sent in batches to stay within Discord's rate limits.
- **Balanced team generation**: each player has an MMR (skill rating). The bot splits players into teams of 4 so that each team's total skill is as close as possible. In party mode, duos are kept together and spread across teams in a snake-draft order.
- **ODC integration**: the bot creates the tournament on ODC, registers each team with its players' in-game usernames, adds organisers, and generates a single or double elimination bracket.
- **Live match updates**: the bot checks ODC every minute. When a match is ready, it opens a private Discord thread for the two teams with their station, arena and best-of. When the match ends, it posts the score for each game.
- **MMR updates**: after every match, the bot adjusts each player's rating with an Elo-style formula. Longer series (best of 5 or 7) move ratings more.
- **Substitutions**: staff can swap a player out with `/sub`. The new roster is sent to ODC first, and the local copy only changes if ODC accepts it, so the two never get out of sync.
- **Results**: when a tournament finishes, the bot posts the top three teams to a standings channel.

## Commands

| Who | Command | What it does |
| --- | --- | --- |
| Players | `/party create`, `/party invite`, `/party leave`, `/party info` | Manage a duo for party tournaments |
| Players | `/edit_username` | Change your stored in-game username (also updated on ODC) |
| Staff | `/setup_register` | Post the registration button |
| Staff | `/make_tournament` | Create a tournament and open sign-ups |
| Staff | `/check` | Run an activity check |
| Staff | `/start` | Generate balanced teams and choose the bracket format and fleet |
| Staff | `/sub` | Substitute a player on a team |
| Staff | `/get_usernames` | Look up the registered in-game usernames for members |
| Staff | `/delete_tournament` | Remove a tournament |

## Who it works with

- **Players** in the Orion Drift community, across the EU, NA and OCE regions, who sign up and play entirely through Discord.
- **Tournament staff**, who run every step from Discord with slash commands and buttons instead of setting up brackets by hand.
- **Orion Drift Competitive (ODC)**, the competitive platform that hosts the brackets and matches. The bot talks to it through its API.
- **Discord**, through the discord.js library.

## Running it

1. Install dependencies: `npm install`
2. Copy `example.env` to `.env` and fill in your Discord bot token, server ID, ODC API key and channel/role IDs.
3. Start the bot with `npm run dev`. It builds the TypeScript and registers the slash commands when it starts.
