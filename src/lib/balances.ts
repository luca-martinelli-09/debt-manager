import { db, type Expense, type Payment } from './db';

export interface Balance {
	contactId: number;
	amount: number; // Positivo: deve ricevere, Negativo: deve dare
}

export async function calculateBalances(groupId: number | null = null): Promise<Balance[]> {
	const balances: Record<number, number> = {};

	// 1. Considera tutte le spese
	const expenses = groupId
		? await db.expenses.where('groupId').equals(groupId).toArray()
		: await db.expenses.toArray();

	for (const expense of expenses) {
		const splits = await db.expenseSplits.where('expenseId').equals(expense.id!).toArray();

		// Chi ha pagato guadagna l'importo totale
		balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;

		// Chi partecipa deve la sua quota
		for (const split of splits) {
			balances[split.contactId] = (balances[split.contactId] || 0) - split.shareAmount;
		}
	}

	// 2. Considera tutti i pagamenti (settle ups)
	const payments = groupId
		? await db.payments.where('groupId').equals(groupId).toArray()
		: await db.payments.toArray();

	for (const payment of payments) {
		// Chi paga riduce il suo debito (o aumenta il credito)
		balances[payment.fromId] = (balances[payment.fromId] || 0) + payment.amount;
		// Chi riceve riduce il suo credito
		balances[payment.toId] = (balances[payment.toId] || 0) - payment.amount;
	}

	return Object.entries(balances).map(([contactId, amount]) => ({
		contactId: parseInt(contactId),
		amount
	}));
}

// Algoritmo di semplificazione del debito
export interface Debt {
	from: number;
	to: number;
	amount: number;
}

export function simplifyDebts(balances: Balance[]): Debt[] {
	const debtors = balances.filter((b) => b.amount < -0.01).sort((a, b) => a.amount - b.amount);
	const creditors = balances.filter((b) => b.amount > 0.01).sort((a, b) => b.amount - a.amount);

	const debts: Debt[] = [];

	let dIdx = 0;
	let cIdx = 0;

	const d = debtors.map((v) => ({ ...v, amount: Math.abs(v.amount) }));
	const c = creditors.map((v) => ({ ...v }));

	while (dIdx < d.length && cIdx < c.length) {
		const amount = Math.min(d[dIdx].amount, c[cIdx].amount);

		if (amount > 0.01) {
			debts.push({
				from: d[dIdx].contactId,
				to: c[cIdx].contactId,
				amount
			});
		}

		d[dIdx].amount -= amount;
		c[cIdx].amount -= amount;

		if (d[dIdx].amount < 0.01) dIdx++;
		if (c[cIdx].amount < 0.01) cIdx++;
	}

	return debts;
}
