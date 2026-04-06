import { liveQuery } from 'dexie';
import { db, type Contact, type Group, type Expense, type Payment } from './db';

// Utilizziamo liveQuery per osservare i cambiamenti nel database IndexedDB
// e renderli disponibili come stati reattivi in Svelte 5.

export function createGlobalState() {
	let contacts = $state<Contact[]>([]);
	let groups = $state<Group[]>([]);
	let recentExpenses = $state<Expense[]>([]);
	let recentPayments = $state<Payment[]>([]);

	// Sincronizzazione con Dexie
	liveQuery(() => db.contacts.toArray()).subscribe((val) => (contacts = val));
	liveQuery(() => db.groups.toArray()).subscribe((val) => (groups = val));
	liveQuery(() => db.expenses.orderBy('date').reverse().limit(10).toArray()).subscribe(
		(val) => (recentExpenses = val)
	);
	liveQuery(() => db.payments.orderBy('date').reverse().limit(10).toArray()).subscribe(
		(val) => (recentPayments = val)
	);

	return {
		get contacts() {
			return contacts;
		},
		get groups() {
			return groups;
		},
		get recentExpenses() {
			return recentExpenses;
		},
		get recentPayments() {
			return recentPayments;
		},

		// Helper per trovare un contatto per ID
		getContactById(id: number) {
			return contacts.find((c) => c.id === id);
		},

		// Helper per trovare un gruppo per ID
		getGroupById(id: number) {
			return groups.find((g) => g.id === id);
		}
	};
}

// Singleton per l'app
export const appState = createGlobalState();
