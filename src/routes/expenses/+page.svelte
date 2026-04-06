<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { db } from '$lib/db';
	import { Button } from '$lib/components/ui/button';
	import { Plus, Receipt, Trash2, Pencil } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';

	import * as Avatar from '$lib/components/ui/avatar';

	async function deleteExpense(id: number) {
		if (confirm('Sei sicuro di voler eliminare questa spesa?')) {
			await db.expenses.delete(id);
			await db.expenseSplits.where('expenseId').equals(id).delete();
		}
	}

	function formatDate(date: Date) {
		return new Intl.DateTimeFormat('it-IT', {
			day: '2-digit',
			month: 'short'
		}).format(date);
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Spese</h1>
		<Button href="/expenses/new" size="sm" class="gap-2">
			<Plus class="h-4 w-4" />
			Aggiungi
		</Button>
	</div>

	<div class="flex flex-col gap-3">
		{#each appState.recentExpenses as expense (expense.id)}
			<Card.Root>
				<Card.Content class="flex items-center gap-4 p-4">
					<div class="bg-muted flex flex-col items-center justify-center rounded-md px-2 py-1 text-center">
						<span class="text-[10px] font-bold uppercase">{formatDate(expense.date).split(' ')[1]}</span>
						<span class="text-lg font-bold leading-none">{formatDate(expense.date).split(' ')[0]}</span>
					</div>
					<div class="flex-1 overflow-hidden">
						<div class="font-semibold truncate">{expense.title}</div>
						<div class="text-muted-foreground text-xs">
							Pagato da <span class="font-medium text-foreground">{appState.getContactById(expense.paidBy)?.name || 'Sconosciuto'}</span>
							{#if expense.groupId}
								in <span class="font-medium text-foreground">{appState.getGroupById(expense.groupId)?.name || 'Gruppo'}</span>
							{/if}
						</div>
					</div>
					<div class="flex flex-col items-end gap-1">
						<div class="font-bold">€ {expense.amount.toFixed(2)}</div>
						<div class="flex gap-1">
							<Button variant="ghost" size="icon" class="h-6 w-6" href="/expenses/{expense.id}/edit">
								<Pencil class="h-3 w-3" />
							</Button>
							<Button variant="ghost" size="icon" class="text-destructive h-6 w-6" onclick={() => deleteExpense(expense.id!)}>
								<Trash2 class="h-3 w-3" />
							</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="py-12 text-center">
				<div class="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
					<Receipt class="text-muted-foreground h-6 w-6" />
				</div>
				<h3 class="text-lg font-medium">Nessuna spesa</h3>
				<p class="text-muted-foreground">Inizia a tracciare le tue spese condivise.</p>
				<Button href="/expenses/new" variant="outline" class="mt-4">Aggiungi la prima spesa</Button>
			</div>
		{/each}
	</div>
</div>
