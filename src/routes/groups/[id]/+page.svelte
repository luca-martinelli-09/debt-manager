<script lang="ts">
	import { page } from '$app/state';
	import { appState } from '$lib/state.svelte';
	import { db, type Contact, type Expense } from '$lib/db';
	import { calculateBalances, simplifyDebts, type Debt, type Balance } from '$lib/balances';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Receipt, Users, Plus, Check, Trash2, ArrowLeft } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { liveQuery } from 'dexie';

	const groupId = $derived(parseInt(page.params.id || '0'));
	const group = $derived(appState.getGroupById(groupId));

	let groupExpenses = $state<Expense[]>([]);
	let members = $state<Contact[]>([]);
	let balances = $state<Balance[]>([]);
	let debts = $state<Debt[]>([]);

	// Osserva cambiamenti nel database per questo gruppo
	$effect(() => {
		if (isNaN(groupId)) return;

		// Spese del gruppo
		const expenseSub = liveQuery(() =>
			db.expenses.where('groupId').equals(groupId).reverse().toArray()
		).subscribe((val) => (groupExpenses = val));

		// Membri del gruppo
		const memberSub = liveQuery(async () => {
			const mLinks = await db.groupMembers.where('groupId').equals(groupId).toArray();
			const ids = mLinks.map((l) => l.contactId);
			return db.contacts.where('id').anyOf(ids).toArray();
		}).subscribe((val) => (members = val));

		// Saldi del gruppo
		calculateBalances(groupId).then((res) => {
			balances = res;
			debts = simplifyDebts(res);
		});

		return () => {
			expenseSub.unsubscribe();
			memberSub.unsubscribe();
		};
	});

	async function settleUp(debt: Debt) {
		if (confirm(`Confermi di aver pagato € ${debt.amount.toFixed(2)} a ${appState.getContactById(debt.to)?.name}?`)) {
			await db.payments.add({
				fromId: debt.from,
				toId: debt.to,
				amount: debt.amount,
				date: new Date(),
				groupId
			});
			// Ricarica i saldi
			calculateBalances(groupId).then((res) => {
				balances = res;
				debts = simplifyDebts(res);
			});
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/groups">
			<ArrowLeft class="h-5 w-5" />
		</Button>
		<div class="flex-1">
			<h1 class="text-3xl font-bold">{group?.name || 'Caricamento...'}</h1>
			<p class="text-muted-foreground text-sm">{group?.description || ''}</p>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<div class="lg:col-span-2 flex flex-col gap-6">
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-semibold">Spese Gruppo</h2>
				<Button size="sm" href="/expenses/new?groupId={groupId}" class="gap-2">
					<Plus class="h-4 w-4" /> Aggiungi
				</Button>
			</div>

			<div class="flex flex-col gap-3">
				{#each groupExpenses as expense}
					<Card.Root>
						<Card.Content class="flex items-center gap-4 p-4">
							<div class="bg-muted flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold">
								{new Intl.DateTimeFormat('it-IT', { day: '2-digit' }).format(expense.date)}
							</div>
							<div class="flex-1">
								<div class="font-medium">{expense.title}</div>
								<div class="text-muted-foreground text-xs">
									Pagato da {appState.getContactById(expense.paidBy)?.name}
								</div>
							</div>
							<div class="font-bold">€ {expense.amount.toFixed(2)}</div>
						</Card.Content>
					</Card.Root>
				{:else}
					<div class="bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
						<Receipt class="text-muted-foreground mb-2 h-8 w-8" />
						<p class="text-muted-foreground text-sm">Nessuna spesa registrata in questo gruppo.</p>
					</div>
				{/each}
			</div>
		</div>

		<div class="flex flex-col gap-6">
			<h2 class="text-xl font-semibold">Saldi e Membri</h2>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-sm font-medium">Debiti Semplificati</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-col gap-3 pt-0">
					{#each debts as debt}
						<div class="flex items-center justify-between text-sm">
							<div class="flex items-center gap-2">
								<span class="font-medium">{appState.getContactById(debt.from)?.name}</span>
								<span>→</span>
								<span class="font-medium">{appState.getContactById(debt.to)?.name}</span>
							</div>
							<div class="flex items-center gap-2 font-bold">
								€ {debt.amount.toFixed(2)}
								<Button size="icon" variant="ghost" class="h-6 w-6 text-green-600" onclick={() => settleUp(debt)}>
									<Check class="h-4 w-4" />
								</Button>
							</div>
						</div>
					{:else}
						<p class="text-muted-foreground text-xs italic">Siete pari!</p>
					{/each}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-sm font-medium">Partecipanti ({members.length})</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-col gap-2 pt-0">
					{#each members as member}
						<div class="flex items-center gap-2 py-1">
							<Avatar.Root class="h-6 w-6">
								<Avatar.Fallback class="text-[10px]">{member.name[0].toUpperCase()}</Avatar.Fallback>
							</Avatar.Root>
							<span class="flex-1 text-sm">{member.name}</span>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
