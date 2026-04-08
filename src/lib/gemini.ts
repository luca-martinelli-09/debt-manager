import * as m from '$lib/paraglide/messages.js';
import { GoogleGenAI, Type, type Tool } from '@google/genai';
import { db } from './db';
import { userSettings } from './settings.svelte';

export function getGenAIClient() {
	if (!userSettings.geminiApiKey) {
		throw new Error(m.api_key_missing());
	}
	// Usiamo il nuovo SDK standard
	return new GoogleGenAI({ apiKey: userSettings.geminiApiKey });
}

export const debtManagerTools: Tool[] = [
	{
		functionDeclarations: [
			{
				name: 'get_dashboard_summary',
				description: m.desc_get_dashboard()
			},
			{
				name: 'get_all_contacts',
				description: m.desc_get_contacts()
			},
			{
				name: 'get_all_categories',
				description: m.desc_get_categories()
			},
			{
				name: 'get_all_groups',
				description: m.desc_get_groups()
			},
			{
				name: 'get_recent_expenses',
				description: m.desc_get_recent()
			},
			{
				name: 'add_expense',
				description: m.desc_add_expense(),
				parameters: {
					type: Type.OBJECT,
					properties: {
						title: {
							type: Type.STRING,
							description: m.param_title()
						},
						amount: { type: Type.NUMBER, description: m.param_amount() },
						categoryId: {
							type: Type.STRING,
							description: m.param_category()
						},
						paidById: {
							type: Type.STRING,
							description:
								'ID del contatto che ha fisicamente pagato. Se non specificato diversamente o se non lo sai, usa il "myContactId" (ovvero l\'utente che sta parlando) se c\'è.'
						},
						groupId: {
							type: Type.STRING,
							description: m.param_group()
						},
						splitParticipantIds: {
							type: Type.ARRAY,
							items: { type: Type.STRING },
							description: m.param_split()
						}
					},
					required: ['title', 'amount', 'paidById', 'splitParticipantIds']
				}
			}
		]
	}
];

export const systemInstruction = m.system_instruction();

// Le funzioni reali che verranno mappate al tool call
export const toolHandlers: Record<string, Function> = {
	get_dashboard_summary: async () => {
		// Logica semplificata basata sui calcoli di debt
		const { calculateBalances, simplifyDebts, getDirectDebts } = await import('./utils/debt');
		const expenses = await db.expenses.toArray();
		const settlements = await db.settlements.toArray();
		const contacts = await db.contacts.toArray();

		const allIds = contacts.map((c) => c.id).filter((c) => c !== undefined);
		const balances = calculateBalances(expenses, settlements, allIds);

		let debts = [];
		if (userSettings.simplifyDebts) {
			debts = simplifyDebts(balances);
		} else {
			debts = getDirectDebts(expenses, settlements);
		}

		let myId = userSettings.myContactId ? userSettings.myContactId : null;

		if (myId) {
			const myBalance = balances.get(myId) || 0;
			const iOwe = debts.filter((d) => d.from === myId).reduce((sum, d) => sum + d.amount, 0);
			const owedToMe = debts.filter((d) => d.to === myId).reduce((sum, d) => sum + d.amount, 0);
			return JSON.stringify({
				note: m.note_personal(),
				balance: myBalance,
				debt_passivo: iOwe,
				credit_attivo: owedToMe
			});
		} else {
			const globalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
			return JSON.stringify({ note: m.note_global(), global_total_balance_volume: globalDebt });
		}
	},
	get_all_contacts: async () => {
		const contacts = await db.contacts.toArray();
		const myId = userSettings.myContactId ? userSettings.myContactId : null;
		return JSON.stringify(contacts.map((c) => ({ id: c.id, name: c.name, is_me: c.id === myId })));
	},
	get_all_categories: async () => {
		const cats = await db.categories.toArray();
		return JSON.stringify(cats.map((c) => ({ id: c.id, name: c.name })));
	},
	get_all_groups: async () => {
		const groups = await db.groups.toArray();
		return JSON.stringify(groups.map((g) => ({ id: g.id, name: g.name, member_ids: g.memberIds })));
	},
	get_recent_expenses: async () => {
		const expenses = await db.expenses.reverse().limit(20).toArray();
		const contacts = await db.contacts.toArray();
		return JSON.stringify(
			expenses.map((e) => ({
				id: e.id,
				title: e.title,
				amount: e.amount,
				date: e.date,
				paid_by_name: contacts.find((c) => c.id === e.paidById)?.name || m.unknown_contact(),
				category: e.category,
				type: e.splitType
			}))
		);
	},
	add_expense: async (args: any) => {
		try {
			const { title, amount, categoryId, paidById, groupId, splitParticipantIds } = args;

			if (
				!title ||
				!amount ||
				!paidById ||
				!splitParticipantIds ||
				splitParticipantIds.length === 0
			) {
				return JSON.stringify({
					error: m.error_missing_fields()
				});
			}

			// Prepara array per db
			const splitValue = amount / splitParticipantIds.length;
			const splits = splitParticipantIds.map((cid: string) => ({
				contactId: cid,
				value: splitValue
			}));

			let catName: string = m.general_category();
			const realCatId = categoryId;
			if (realCatId) {
				const cat = await db.categories.get(realCatId);
				if (cat) catName = cat.name;
			} else {
				// Cerca la categoria Generale se non specificata
				const allCats = await db.categories.toArray();
				const genCat = allCats.find((c) => c.name === m.general_category());
				if (genCat) catName = genCat.name;
			}

			const newExpId = await db.expenses.add({
				id: (await import('uuidv7')).uuidv7(),
				title,
				amount,
				date: new Date(),
				categoryId: realCatId || undefined,
				category: catName,
				groupId: groupId || undefined,
				paidById: paidById,
				splitType: 'equally',
				splits: splits,
				createdAt: new Date()
			});

			return JSON.stringify({ success: true, message: m.expense_added(), expense_id: newExpId });
		} catch (e: any) {
			console.error(e);
			return JSON.stringify({ error: m.db_insert_error() + e.message });
		}
	}
};
