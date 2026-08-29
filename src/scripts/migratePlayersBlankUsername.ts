import * as fs from 'fs';
import * as path from 'path';
import { Player } from '../types';

const DB_PATH = path.join(__dirname, '../../data/players.json');

function main(): void {
  if (!fs.existsSync(DB_PATH)) {
    console.log(`No players.json found at ${DB_PATH}, nothing to migrate.`);
    return;
  }

  const raw = fs.readFileSync(DB_PATH, 'utf-8').trim();
  if (!raw) {
    console.log('players.json is empty, nothing to migrate.');
    return;
  }

  const players: Player[] = JSON.parse(raw);
  if (!Array.isArray(players)) {
    throw new Error('players.json is not an array, aborting.');
  }

  fs.writeFileSync(`${DB_PATH}.bak`, raw);

  for (const player of players) {
    player.username = '';
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(players, null, 2));
  console.log(`Blanked username for ${players.length} player(s) in ${DB_PATH}`);
  console.log(`Backup of the original file saved to ${DB_PATH}.bak`);
}

main();
