import Dexie, { type EntityTable } from 'dexie';
import type { Contact, Group, Expense, Settlement, Category } from './types';

export class DebtManagerDB extends Dexie {
	contacts!: EntityTable<Contact, 'id'>;
	groups!: EntityTable<Group, 'id'>;
	expenses!: EntityTable<Expense, 'id'>;
	settlements!: EntityTable<Settlement, 'id'>;
	categories!: EntityTable<Category, 'id'>;

	constructor() {
		super('DebtManagerDB');
		this.version(1).stores({
			contacts: '++id, name, email, createdAt',
			groups: '++id, name, *memberIds, createdAt',
			expenses: '++id, title, amount, date, groupId, paidById, createdAt',
			settlements: '++id, fromContactId, toContactId, date, groupId, createdAt'
		});

		this.version(2)
			.stores({
				categories: '++id, name'
			})
			.upgrade((tx) => {
				// Aggiungi alcune categorie di default
				tx.table('categories').bulkAdd([
					{ name: 'Cibo', color: '#f97316', createdAt: new Date() },
					{ name: 'Viaggio', color: '#3b82f6', createdAt: new Date() },
					{ name: 'Casa', color: '#10b981', createdAt: new Date() },
					{ name: 'Spesa', color: '#8b5cf6', createdAt: new Date() },
					{ name: 'Generale', color: '#64748b', createdAt: new Date() }
				]);
			});
	}
}

export const db = new DebtManagerDB();
