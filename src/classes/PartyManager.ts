import { Party } from '../types'
import * as fs from 'fs';
import * as path from 'path';

import { PlayerManager } from './PlayerManager';
import { TournamentManager } from './TournamentManager';

const DB_PATH = path.join(__dirname, '../../data/parties.json');

export class PartyManager {
    private static instance: PartyManager;
    private parties = new Map<string, Party>();
    
    private constructor() {
        this.load()
    }

    static getInstance(): PartyManager {
        if (!PartyManager.instance) {
        PartyManager.instance = new PartyManager();
        }
        return PartyManager.instance;
    }

    private save(): void {
      try {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        const data = [...this.parties.values()];
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      } catch (err) {
        console.error('Failed to save parties:', err);
      }
    }
    
    private load(): void {
        try {
            if (!fs.existsSync(DB_PATH)) return;
            const raw = fs.readFileSync(DB_PATH, 'utf-8').trim();
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
            console.warn('parties.json was not an array, resetting...');
            this.save();
            return;
            }
            for (const p of parsed) {
            this.parties.set(p.leader, p);
            }
            console.log(`Loaded ${this.parties.size} parties from disk`);
        } catch (err) {
            console.error('Failed to load parties:', err);
        }
    }

    public create(userId: string): Party | 'already_in' | 'not_registered' {
        if (!PlayerManager.getInstance().isRegistered(userId)) return 'not_registered'
        if (this.getParty(userId)) return 'already_in';
        const party: Party = { leader: userId, member: null };
        this.parties.set(userId, party);
        this.save();
        return party;
    }

    public invite(leader: string, member: string): 'complete' | 'full' | 'not_found' | 'already_in' {
        const party = this.getParty(leader)
        if (!party) return 'not_found'

        if (party.member) return 'full'

        if (this.getParty(member)) return 'already_in'

        party.member = member
        this.save()
        return 'complete'
    }

    private delete(userId: string): boolean {
        const deleted = this.parties.delete(userId);
        if (deleted) this.save();
        return deleted
    }

    public getParty(userId: string): Party | false {
        const ownedParty: Party | undefined = this.parties.get(userId)
        if (ownedParty) return ownedParty

        for (const [key, party] of this.parties) {
            if (party.member === userId) {
                return party
            }
        }
        return false
    }

    public leave(userId: string): 'deleted' | 'left' | 'not_in' {
        const deleted = this.delete(userId);
        if (deleted)  {
            TournamentManager.getInstance().removeParty(userId)
            return'deleted'
        };

        const party = this.getParty(userId);
        if (party) {
            party.member = null
            TournamentManager.getInstance().removeParty(party.leader)
            this.save();
            return 'left'
        }
        return 'not_in'
    }
}