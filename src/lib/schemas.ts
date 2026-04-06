import { z } from 'zod';

export const contactSchema = z.object({
	id: z.number().optional(),
	name: z.string().min(2, 'Il nome deve avere almeno 2 caratteri'),
	email: z.string().email('Email non valida').optional().or(z.literal('')),
	phone: z.string().optional().or(z.literal('')),
	avatar: z.string().optional()
});

export type ContactSchema = typeof contactSchema;

export const groupSchema = z.object({
	id: z.number().optional(),
	name: z.string().min(2, 'Il nome deve avere almeno 2 caratteri'),
	description: z.string().optional().or(z.literal('')),
	members: z.array(z.number()).min(1, 'Seleziona almeno un membro')
});

export type GroupSchema = typeof groupSchema;

export const expenseSchema = z.object({
	id: z.number().optional(),
	title: z.string().min(2, 'Il titolo deve avere almeno 2 caratteri'),
	amount: z.number().positive('L\'importo deve essere positivo'),
	date: z.string(),
	groupId: z.number().nullable(),
	paidBy: z.number({ required_error: 'Seleziona chi ha pagato' }),
	splitType: z.enum(['equal', 'absolute', 'percentage']).default('equal'),
	participants: z.array(z.number()).min(1, 'Seleziona almeno un partecipante'),
	customAmounts: z.record(z.string(), z.number()).optional()
});

export type ExpenseSchema = typeof expenseSchema;
