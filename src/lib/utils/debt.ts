import type { Debt, Expense, Settlement } from '../types';

export function calculateBalances(
	expenses: Expense[],
	settlements: Settlement[],
	contactIds: string[]
): Map<string, number> {
	const balances = new Map<string, number>();
	contactIds.forEach((id) => balances.set(id, 0));

	// Process expenses
	expenses.forEach((expense) => {
		// Payer gets credit
		balances.set(expense.paidById, (balances.get(expense.paidById) || 0) + expense.amount);

		// Participants get debit
		expense.splits.forEach((split) => {
			let share = 0;
			if (expense.splitType === 'equally') {
				share = expense.amount / expense.splits.length;
			} else if (expense.splitType === 'unequally') {
				share = split.value;
			} else if (expense.splitType === 'percentage') {
				share = (expense.amount * split.value) / 100;
			}
			balances.set(split.contactId, (balances.get(split.contactId) || 0) - share);
		});
	});

	// Process settlements
	settlements.forEach((settlement) => {
		balances.set(
			settlement.fromContactId,
			(balances.get(settlement.fromContactId) || 0) + settlement.amount
		);
		balances.set(
			settlement.toContactId,
			(balances.get(settlement.toContactId) || 0) - settlement.amount
		);
	});

	return balances;
}

export function simplifyDebts(balancesMap: Map<string, number>): Debt[] {
	const debtors: { id: string; balance: number }[] = [];
	const creditors: { id: string; balance: number }[] = [];

	balancesMap.forEach((balance, id) => {
		if (balance < -0.01) {
			debtors.push({ id, balance: Math.abs(balance) });
		} else if (balance > 0.01) {
			creditors.push({ id, balance });
		}
	});

	const debts: Debt[] = [];

	let dIdx = 0;
	let cIdx = 0;

	while (dIdx < debtors.length && cIdx < creditors.length) {
		const debtor = debtors[dIdx];
		const creditor = creditors[cIdx];

		const amount = Math.min(debtor.balance, creditor.balance);
		debts.push({ from: debtor.id, to: creditor.id, amount });

		debtor.balance -= amount;
		creditor.balance -= amount;

		if (debtor.balance < 0.01) dIdx++;
		if (creditor.balance < 0.01) cIdx++;
	}

	return debts;
}
