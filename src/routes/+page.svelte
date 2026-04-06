<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { contactsQuery, expensesQuery, settlementsQuery } from '$lib/db.svelte';
	import { userSettings } from '$lib/settings.svelte';
	import { calculateBalances, simplifyDebts } from '$lib/utils/debt';
	import { ArrowDownLeft, ArrowUpRight, Wallet } from '@lucide/svelte';

	let myId = $derived(userSettings.myContactId ? parseInt(userSettings.myContactId) : null);

	let totalBalance = $derived.by(() => {
		const contacts = contactsQuery.value;
		const expenses = expensesQuery.value;
		const settlements = settlementsQuery.value;
		if (!contacts || !expenses || !settlements) return 0;
		const balances = calculateBalances(
			expenses,
			settlements,
			contacts.map((c) => c.id!)
		);
		if (myId) {
			return balances.get(myId) || 0;
		}
		return Array.from(balances.values()).reduce((acc, curr) => acc + curr, 0);
	});

	let creditTotal = $derived.by(() => {
		const contacts = contactsQuery.value;
		const expenses = expensesQuery.value;
		const settlements = settlementsQuery.value;
		if (!contacts || !expenses || !settlements) return 0;
		const balances = calculateBalances(
			expenses,
			settlements,
			contacts.map((c) => c.id!)
		);

		if (myId) {
			const myDebts = simplifyDebts(balances).filter((d) => d.to === myId);
			return myDebts.reduce((acc, curr) => acc + curr.amount, 0);
		}

		return Array.from(balances.values())
			.filter((b) => b > 0)
			.reduce((acc, curr) => acc + curr, 0);
	});

	let debtTotal = $derived.by(() => {
		const contacts = contactsQuery.value;
		const expenses = expensesQuery.value;
		const settlements = settlementsQuery.value;
		if (!contacts || !expenses || !settlements) return 0;
		const balances = calculateBalances(
			expenses,
			settlements,
			contacts.map((c) => c.id!)
		);

		if (myId) {
			const myDebts = simplifyDebts(balances).filter((d) => d.from === myId);
			return myDebts.reduce((acc, curr) => acc + curr.amount, 0);
		}

		return Math.abs(
			Array.from(balances.values())
				.filter((b) => b < 0)
				.reduce((acc, curr) => acc + curr, 0)
		);
	});

	let recentActivity = $derived.by(() => {
		const expenses = expensesQuery.value || [];
		const settlements = settlementsQuery.value || [];
		const contacts = contactsQuery.value || [];

		const getContactName = (id: number) => contacts.find((c) => c.id === id)?.name || 'Sconosciuto';

		const activity = [
			...expenses.map((e) => ({
				type: 'expense',
				date: new Date(e.createdAt),
				title: e.title,
				category: e.category,
				amount: e.amount,
				description: `Pagato da ${getContactName(e.paidById)}`
			})),
			...settlements.map((s) => ({
				type: 'settlement',
				date: new Date(s.createdAt),
				title: 'Pagamento saldato',
				category: undefined,
				amount: s.amount,
				description: `Da ${getContactName(s.fromContactId)} a ${getContactName(s.toContactId)}`
			}))
		];

		return activity.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
	});
</script>

<div class="grid gap-4 md:grid-cols-3">
	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Title class="text-sm font-medium">Bilancio Totale</Card.Title>
			<Wallet class="h-4 w-4 text-muted-foreground" />
		</Card.Header>
		<Card.Content>
			<div class="text-2xl font-bold">{totalBalance.toFixed(2)}€</div>
			<p class="text-xs text-muted-foreground">
				{#if myId}
					Il tuo saldo netto
				{:else}
					Somma di tutti i debiti e crediti
				{/if}
			</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Title class="text-sm font-medium">Devi Dare</Card.Title>
			<ArrowUpRight class="h-4 w-4 text-destructive" />
		</Card.Header>
		<Card.Content>
			<div class="text-2xl font-bold text-destructive">{debtTotal.toFixed(2)}€</div>
			<p class="text-xs text-muted-foreground">Totale debiti passivi</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Title class="text-sm font-medium">Devi Ricevere</Card.Title>
			<ArrowDownLeft class="h-4 w-4 text-primary" />
		</Card.Header>
		<Card.Content>
			<div class="text-2xl font-bold text-primary">{creditTotal.toFixed(2)}€</div>
			<p class="text-xs text-muted-foreground">Totale crediti attivi</p>
		</Card.Content>
	</Card.Root>
</div>

<div class="mt-8">
	<h2 class="mb-4 text-xl font-bold">Attività Recente</h2>
	{#if recentActivity.length === 0}
		<div class="rounded-lg border bg-card p-8 text-center text-muted-foreground">
			Non ci sono ancora attività. Inizia aggiungendo un contatto o una spesa!
		</div>
	{:else}
		<div class="overflow-hidden rounded-lg border bg-card">
			<div class="divide-y">
				{#each recentActivity as activity}
					<div class="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
						<div class="flex items-center gap-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"
							>
								{#if activity.type === 'expense'}
									<ArrowUpRight class="h-5 w-5 text-primary" />
								{:else}
									<Wallet class="h-5 w-5 text-emerald-500" />
								{/if}
							</div>
							<div>
								<p class="text-sm font-medium">
									{activity.title}
								</p>
								<p class="text-xs text-muted-foreground">
									{activity.description} • {activity.date.toLocaleDateString()}
								</p>
							</div>
						</div>
						<div class="shrink-0 text-right">
							{#if activity.type === 'expense'}
								<p class="text-sm font-bold">{activity.amount.toFixed(2)}€</p>
								<p class="text-xs text-muted-foreground">{activity.category || 'Generale'}</p>
							{:else}
								<p class="text-sm font-bold text-emerald-500">+{activity.amount.toFixed(2)}€</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
