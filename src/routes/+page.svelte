<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { db } from '$lib/db';
	import { calculateBalances, simplifyDebts, type Debt, type Balance } from '$lib/balances';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, TrendingDown, Check } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';

	let balances = $state<Balance[]>([]);
	let debts = $state<Debt[]>([]);

	$effect(() => {
		// Ricalcola i saldi quando cambiano le spese o i pagamenti
		// appState.recentExpenses e appState.recentPayments sono reattivi
		appState.recentExpenses;
		appState.recentPayments;

		calculateBalances().then((res) => {
			balances = res;
			debts = simplifyDebts(res);
		});
	});

	async function settleUp(debt: Debt) {
		if (confirm(`Confermi di aver pagato € ${debt.amount.toFixed(2)} a ${appState.getContactById(debt.to)?.name}?`)) {
			await db.payments.add({
				fromId: debt.from,
				toId: debt.to,
				amount: debt.amount,
				date: new Date(),
				groupId: null
			});
		}
	}

	let totalOwed = $derived(balances.filter(b => b.amount > 0).reduce((acc, b) => acc + b.amount, 0));
	let totalDebts = $derived(Math.abs(balances.filter(b => b.amount < 0).reduce((acc, b) => acc + b.amount, 0)));
</script>

<div class="flex flex-col gap-8">
	<div class="grid gap-4 sm:grid-cols-2">
		<Card.Root class="bg-primary text-primary-foreground">
			<Card.Header class="pb-2">
				<Card.Title class="flex items-center gap-2 text-sm font-medium opacity-80">
					<TrendingUp class="h-4 w-4" />
					Ti devono
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="text-3xl font-bold">€ {totalOwed.toFixed(2)}</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="bg-destructive text-destructive-foreground">
			<Card.Header class="pb-2">
				<Card.Title class="flex items-center gap-2 text-sm font-medium opacity-80">
					<TrendingDown class="h-4 w-4" />
					Devi dare
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="text-3xl font-bold">€ {totalDebts.toFixed(2)}</div>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<div class="flex flex-col gap-4">
			<h2 class="text-xl font-semibold">Salda i Debiti</h2>
			<div class="flex flex-col gap-3">
				{#each debts as debt}
					<Card.Root>
						<Card.Content class="flex items-center gap-4 p-4">
							<div class="flex flex-1 items-center gap-3">
								<div class="flex -space-x-2">
									<Avatar.Root class="border-background h-8 w-8 border-2">
										<Avatar.Fallback>{appState.getContactById(debt.from)?.name[0]}</Avatar.Fallback>
									</Avatar.Root>
									<Avatar.Root class="border-background h-8 w-8 border-2">
										<Avatar.Fallback>{appState.getContactById(debt.to)?.name[0]}</Avatar.Fallback>
									</Avatar.Root>
								</div>
								<div class="text-sm">
									<span class="font-semibold">{appState.getContactById(debt.from)?.name}</span>
									deve a
									<span class="font-semibold">{appState.getContactById(debt.to)?.name}</span>
								</div>
							</div>
							<div class="flex flex-col items-end gap-2">
								<div class="font-bold">€ {debt.amount.toFixed(2)}</div>
								<Button size="sm" variant="outline" class="h-7 px-2 text-xs" onclick={() => settleUp(debt)}>
									<Check class="mr-1 h-3 w-3" /> Salda
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				{:else}
					<div class="bg-muted/50 rounded-lg border border-dashed p-8 text-center">
						<Wallet class="text-muted-foreground mx-auto mb-2 h-8 w-8" />
						<p class="text-muted-foreground text-sm">Tutti i conti sono in pareggio!</p>
					</div>
				{/each}
			</div>
		</div>

		<div class="flex flex-col gap-4">
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-semibold">Attività Recente</h2>
				<Button variant="link" href="/expenses" class="h-auto p-0 text-sm">Vedi tutto</Button>
			</div>
			<div class="flex flex-col gap-3">
				{#each appState.recentExpenses.slice(0, 5) as expense}
					<div class="flex items-center gap-3 rounded-lg border p-3">
						<div class="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
							<ArrowUpRight class="text-primary h-5 w-5" />
						</div>
						<div class="flex-1 overflow-hidden">
							<div class="font-medium truncate">{expense.title}</div>
							<div class="text-muted-foreground text-xs">
								Pagato da {appState.getContactById(expense.paidBy)?.name}
							</div>
						</div>
						<div class="font-semibold">€ {expense.amount.toFixed(2)}</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
