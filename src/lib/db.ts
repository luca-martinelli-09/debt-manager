import Dexie, { type EntityTable } from 'dexie';
import { uuidv7 } from 'uuidv7';
import type { Category, Contact, Expense, Group, Settlement } from './types';

export class DebtManagerDB extends Dexie {
	contacts!: EntityTable<Contact, 'id'>;
	groups!: EntityTable<Group, 'id'>;
	expenses!: EntityTable<Expense, 'id'>;
	settlements!: EntityTable<Settlement, 'id'>;
	categories!: EntityTable<Category, 'id'>;

	constructor() {
		super('DebtManagerDB');

		// Version history
		this.version(1).stores({
			contacts: '++id, name, email, createdAt',
			groups: '++id, name, *memberIds, createdAt',
			expenses: '++id, title, amount, date, groupId, paidById, createdAt',
			settlements: '++id, fromContactId, toContactId, date, groupId, createdAt'
		});

		this.version(2).stores({
			categories: '++id, name'
		});

		// Version 3: Move to UUIDs (string IDs)
		this.version(3)
			.stores({
				contacts: 'id, name, email, tel, createdAt',
				groups: 'id, name, *memberIds, createdAt',
				expenses: 'id, title, amount, date, groupId, paidById, createdAt',
				settlements: 'id, fromContactId, toContactId, date, groupId, createdAt',
				categories: 'id, name'
			})
			.upgrade(async (tx) => {
				// Population of categories if upgrading from version 2
				const count = await tx.table('categories').count();
				if (count === 0) {
					await tx.table('categories').bulkAdd([
						{ id: uuidv7(), name: 'Cibo', color: '#f97316', createdAt: new Date() },
						{ id: uuidv7(), name: 'Viaggio', color: '#3b82f6', createdAt: new Date() },
						{ id: uuidv7(), name: 'Casa', color: '#10b981', createdAt: new Date() },
						{ id: uuidv7(), name: 'Spesa', color: '#8b5cf6', createdAt: new Date() },
						{ id: uuidv7(), name: 'Generale', color: '#64748b', createdAt: new Date() }
					]);
				}
			});

		// Populate for NEW databases
		this.on('populate', (tx) => {
			tx.table('categories').bulkAdd([
				{ id: uuidv7(), name: 'Cibo', color: '#f97316', createdAt: new Date() },
				{ id: uuidv7(), name: 'Viaggio', color: '#3b82f6', createdAt: new Date() },
				{ id: uuidv7(), name: 'Casa', color: '#10b981', createdAt: new Date() },
				{ id: uuidv7(), name: 'Spesa', color: '#8b5cf6', createdAt: new Date() },
				{ id: uuidv7(), name: 'Generale', color: '#64748b', createdAt: new Date() }
			]);
		});
	}
}

export const db = new DebtManagerDB();
