// One-off cleanup: drop tournament signups for players with no ODC account and DM them to fix it.
//
// IMPORTANT: stop the bot (or at least don't create/join/leave tournaments) while this runs,
// and restart it afterwards. This script edits data/tournaments.json directly; if the live bot
// process saves that file again before it reloads, it'll overwrite this script's changes.
//
// Run with: npx ts-node src/scripts/removeUnlinkedTournamentSignups.ts

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { Client, GatewayIntentBits } from 'discord.js';
import { TournamentJSON, Party } from '../types';
import { getOdcUsersByDiscordIds } from '../classes/OdcApi';

const TOURNAMENTS_PATH = path.join(__dirname, '../../data/tournaments.json');
const PARTIES_PATH = path.join(__dirname, '../../data/parties.json');

const ODC_SIGNUP_URL = 'https://oriondriftcompetitive.com';

function loadJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

interface DmInfo {
  own: string[]; // tournaments removed because the recipient has no ODC account
  partner: string[]; // tournaments removed because the recipient's party partner has no ODC account
}

function dmMessage(info: DmInfo): string {
  const messages: string[] = [];

  if (info.own.length > 0) {
    const list = info.own.map(n => `**${n}**`).join(', ');
    const noun = info.own.length > 1 ? 'tournament signups' : 'a tournament signup';
    messages.push(`You've been removed from ${noun} (${list}) because your Discord account isn't linked to an account on ${ODC_SIGNUP_URL} yet. Create one there, then rejoin.`);
  }

  if (info.partner.length > 0) {
    const list = info.partner.map(n => `**${n}**`).join(', ');
    const noun = info.partner.length > 1 ? 'tournament signups' : 'a tournament signup';
    messages.push(`You've been removed from ${noun} (${list}) because your party partner's Discord account isn't linked to an account on ${ODC_SIGNUP_URL} yet. Have them create one, then rejoin.`);
  }

  return messages.join('\n\n');
}

async function main(): Promise<void> {
  if (!fs.existsSync(TOURNAMENTS_PATH)) {
    console.log(`No tournaments.json found at ${TOURNAMENTS_PATH}, nothing to check.`);
    return;
  }

  const originalRaw = fs.readFileSync(TOURNAMENTS_PATH, 'utf-8');
  const tournaments = loadJsonArray<TournamentJSON>(TOURNAMENTS_PATH);
  const parties = loadJsonArray<Party>(PARTIES_PATH);

  if (tournaments.length === 0) {
    console.log('No open tournament signups found, nothing to check.');
    return;
  }

  const partyByLeader = new Map(parties.map(p => [p.leader, p]));

  // Collect every discord id we need an ODC account check for.
  const idsToCheck = new Set<string>();
  for (const tournament of tournaments) {
    for (const participantId of tournament.participants) {
      idsToCheck.add(participantId);
      if (tournament.partyOnly) {
        const member = partyByLeader.get(participantId)?.member;
        if (member) idsToCheck.add(member);
      }
    }
  }

  console.log(`Checking ${idsToCheck.size} signed-up player(s) for an ODC account...`);
  const odcUsers = await getOdcUsersByDiscordIds([...idsToCheck]);
  const hasAccount = new Set(odcUsers.map(u => u.discordId));

  const toDm = new Map<string, DmInfo>();
  let removedCount = 0;

  const markForDm = (userId: string, tournamentName: string, reason: 'own' | 'partner') => {
    const info = toDm.get(userId) ?? { own: [], partner: [] };
    info[reason].push(tournamentName);
    toDm.set(userId, info);
  };

  for (const tournament of tournaments) {
    const kept: string[] = [];

    for (const participantId of tournament.participants) {
      if (tournament.partyOnly) {
        const member = partyByLeader.get(participantId)?.member ?? null;
        const leaderMissing = !hasAccount.has(participantId);
        const memberMissing = member ? !hasAccount.has(member) : false;

        if (!leaderMissing && !memberMissing) {
          kept.push(participantId);
          continue;
        }

        removedCount++;
        console.log(`Removing party (leader ${participantId}${member ? `, member ${member}` : ''}) from "${tournament.name}"`);
        markForDm(participantId, tournament.name, leaderMissing ? 'own' : 'partner');
        if (member) markForDm(member, tournament.name, memberMissing ? 'own' : 'partner');
      } else {
        if (hasAccount.has(participantId)) {
          kept.push(participantId);
          continue;
        }

        removedCount++;
        console.log(`Removing ${participantId} from "${tournament.name}"`);
        markForDm(participantId, tournament.name, 'own');
      }
    }

    tournament.participants = kept;
  }

  if (removedCount === 0) {
    console.log('Everyone signed up already has an ODC account, nothing to remove.');
    return;
  }

  fs.writeFileSync(`${TOURNAMENTS_PATH}.bak`, originalRaw);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  console.log(`Removed ${removedCount} signup(s). Backup saved to ${TOURNAMENTS_PATH}.bak`);
  console.log('Restart the bot now so it reloads this file, if it was left running.');

  console.log(`DMing ${toDm.size} affected player(s)...`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.TOKEN);

  for (const [userId, info] of toDm) {
    try {
      const user = await client.users.fetch(userId);
      await user.send(dmMessage(info));
      console.log(`DMed ${userId}`);
    } catch (err) {
      console.error(`Failed to DM ${userId}:`, err);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  client.destroy();
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
