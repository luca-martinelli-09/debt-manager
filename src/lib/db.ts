import Dexie, { type EntityTable } from 'dexie';

export interface Contact {
	id?: number;
	name: string;
	avatar?: string;
	email?: string;
	phone?: string;
}

export interface Group {
	id?: number;
	name: string;
	description?: string;
}

export interface GroupMember {
	groupId: number;
	contactId: number;
}

export interface Expense {
	id?: number;
	groupId: number | null;
	title: string;
	amount: number;
	date: Date;
	paidBy: number; // contactId
	category?: string;
}

export interface ExpenseSplit {
	id?: number;
	expenseId: number;
	contactId: number;
	shareAmount: number;
}

export interface Payment {
	id?: number;
	fromId: number; // contactId
	toId: number; // contactId
	amount: number;
	date: Date;
	groupId: number | null;
}

export interface Attachment {
	id?: number;
	expenseId: number;
	name: string;
	type: string;
	data: Blob;
}

class DebtDatabase extends Dexie {
	contacts!: EntityTable<Contact, 'id'>;
	groups!: EntityTable<Group, 'id'>;
	groupMembers!: EntityTable<GroupMember, 'groupId' | 'contactId'>;
	expenses!: EntityTable<Expense, 'id'>;
	expenseSplits!: EntityTable<ExpenseSplit, 'id'>;
	payments!: EntityTable<Payment, 'id'>;
	attachments!: EntityTable<Attachment, 'id'>;

	constructor() {
		super('DebtDatabase');
		this.version(1).stores({
			contacts: '++id, name, email',
			groups: '++id, name',
			groupMembers: '[groupId+contactId], groupId, contactId',
			expenses: '++id, groupId, title, paidBy',
			expenseSplits: '++id, expenseId, contactId',
			payments: '++id, fromId, toId, groupId',
			attachments: '++id, expenseId'
		});
	}
}

export const db = new DebtDatabase();
