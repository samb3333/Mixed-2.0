import { Player } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '../../data/players.json');

export class PlayerManager {
  private static instance: PlayerManager;
  private players = new Map<string, Player>();

  private constructor() {
    this.load();
  }

  static getInstance(): PlayerManager {
    if (!PlayerManager.instance) {
      PlayerManager.instance = new PlayerManager();
    }
    return PlayerManager.instance;
  }

  // --- Persistence ---

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      const data = [...this.players.values()];
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to save players:', err);
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(DB_PATH)) return;
      const raw = fs.readFileSync(DB_PATH, 'utf-8').trim();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('players.json was not an array, resetting...');
        this.save();
        return;
      }
      for (const p of parsed) {
        this.players.set(p.userId, p);
      }
      console.log(`Loaded ${this.players.size} player(s) from disk`);
    } catch (err) {
      console.error('Failed to load players:', err);
    }
  }

  // --- Methods ---

  register(userId: string, username: string): Player | 'already_registered' {
    if (this.players.has(userId)) return 'already_registered';
    const player: Player = { userId, username, mmr: 1000 };
    this.players.set(userId, player);
    this.save();
    return player;
  }

  editUsername(userId: string, newUsername: string): Player | 'not_found' {
    const player = this.players.get(userId);
    if (!player) return 'not_found';
    player.username = newUsername;
    this.save();
    return player;
  }

  get(userId: string): Player | undefined {
    return this.players.get(userId);
  }

  updateMMR(userId: string, delta: number): Player | 'not_found' {
    const player = this.players.get(userId);
    if (!player) return 'not_found';
    player.mmr = Math.max(0, player.mmr + delta);
    this.save();
    return player;
  }

  isRegistered(userId: string): boolean {
    return this.players.has(userId);
  }
}