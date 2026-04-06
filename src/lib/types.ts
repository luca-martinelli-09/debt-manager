export interface Category {
	id?: number;
	name: string;
	color?: string;
	createdAt: Date;
}

export interface Contact {
	id?: number;
	name: string;
	avatar?: string;
	email?: string;
	tel?: string;
	createdAt: Date;
}

export interface Group {
	id?: number;
	name: string;
	memberIds: number[];
	createdAt: Date;
}

export type SplitType = 'equally' | 'unequally' | 'percentage';

export interface Split {
	contactId: number;
	value: number; // amount, percentage, or weight depending on SplitType
}

export interface Expense {
	id?: number;
	title: string;
	amount: number;
	date: Date;
	categoryId?: number;
	category?: string; // Fallback per retrocompatibilità
	groupId?: number; // Optional for 1-1 expenses
	paidById: number;
	splitType: SplitType;
	splits: Split[];
	attachment?: Blob; // Deprecato, usato per retrocompatibilità
	attachments?: Blob[]; // Nuovo campo per multipli allegati
	createdAt: Date;
}

export interface Settlement {
	id?: number;
	fromContactId: number;
	toContactId: number;
	amount: number;
	date: Date;
	groupId?: number;
	createdAt: Date;
}

export interface Debt {
	from: number;
	to: number;
	amount: number;
}
