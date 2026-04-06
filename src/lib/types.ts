export interface Category {
	id?: string;
	name: string;
	color?: string;
	createdAt: Date;
}

export interface Contact {
	id?: string;
	name: string;
	avatar?: string;
	email?: string;
	tel?: string;
	createdAt: Date;
}

export interface Group {
	id?: string;
	name: string;
	memberIds: string[];
	createdAt: Date;
}

export type SplitType = 'equally' | 'unequally' | 'percentage';

export interface Split {
	contactId: string;
	value: number; // amount, percentage, or weight depending on SplitType
}

export interface Expense {
	id?: string;
	title: string;
	amount: number;
	date: Date;
	categoryId?: string;
	category?: string; // Fallback per retrocompatibilità
	groupId?: string; // Optional for 1-1 expenses
	paidById: string;
	splitType: SplitType;
	splits: Split[];
	attachment?: Blob; // Deprecato, usato per retrocompatibilità
	attachments?: Blob[]; // Nuovo campo per multipli allegati
	createdAt: Date;
}

export interface Settlement {
	id?: string;
	fromContactId: string;
	toContactId: string;
	amount: number;
	date: Date;
	groupId?: string;
	createdAt: Date;
}

export interface Debt {
	from: string;
	to: string;
	amount: number;
}
