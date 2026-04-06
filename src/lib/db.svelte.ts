import { db } from './db';
import type { Contact, Group, Expense, Settlement, Category } from './types';
import { liveQuery } from 'dexie';

export function createQuery<T>(query: () => Promise<T> | T) {
	let data = $state<T | undefined>(undefined);

	liveQuery(query).subscribe({
		next: (v) => {
			data = v;
		},
		error: (err) => {
			console.error(err);
		}
	});

	return {
		get value() {
			return data;
		}
	};
}

export const contactsQuery = createQuery(() => db.contacts.toArray());
export const groupsQuery = createQuery(() => db.groups.toArray());
export const expensesQuery = createQuery(() => db.expenses.toArray());
export const settlementsQuery = createQuery(() => db.settlements.toArray());
export const categoriesQuery = createQuery(() => db.categories.toArray());
