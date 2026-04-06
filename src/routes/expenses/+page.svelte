<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { db } from '$lib/db';
	import { contactsQuery, expensesQuery } from '$lib/db.svelte';
	import { userSettings } from '$lib/settings.svelte';
	import { Calendar, Edit, FileText, Plus, Receipt, Tag, Trash2, User } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let searchQuery = $state('');
	let myId = $derived(userSettings.myContactId ? userSettings.myContactId : null);

	let filteredExpenses = $derived.by(() => {
		const expenses = expensesQuery.value || [];
		if (!searchQuery) return expenses;
		return expenses.filter(
			(e) =>
				e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(e.category || '').toLowerCase().includes(searchQuery.toLowerCase())
		);
	});

	async function deleteExpense(id: string) {
		if (confirm('Sei sicuro di voler eliminare questa spesa?')) {
			try {
				await db.expenses.delete(id);
				toast.success('Spesa eliminata');
			} catch (e) {
				toast.error("Errore durante l'eliminazione");
			}
		}
	}

	function getPayerName(id: string) {
		if (myId && id === myId) return 'Tu';
		return contactsQuery.value?.find((c) => c.id === id)?.name || 'Sconosciuto';
	}

	function getExpenseBalance(expense: any) {
		if (!myId) return null;

		const mySplit = expense.splits.find((s: any) => s.contactId === myId);
		const iPaid = expense.paidById === myId;

		if (!mySplit && !iPaid) return null; // Non coinvolto

		let myShare = 0;
		if (mySplit) {
			if (expense.splitType === 'equally') {
				myShare = expense.amount / (expense.splits.length || 1);
			} else if (expense.splitType === 'percentage') {
				myShare = (expense.amount * mySplit.value) / 100;
			} else {
				myShare = mySplit.value;
			}
		}

		const paidAmount = iPaid ? expense.amount : 0;
		return paidAmount - myShare;
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">Spese</h1>
	<Button href="/expenses/new">
		<Plus class="mr-2 h-4 w-4" /> Nuova Spesa
	</Button>
</div>

<div class="mb-6">
	<input
		type="text"
		placeholder="Cerca spese..."
		bind:value={searchQuery}
		class="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
	/>
</div>

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Data</Table.Head>
				<Table.Head>Titolo</Table.Head>
				<Table.Head>Pagato da</Table.Head>
				<Table.Head>Importo</Table.Head>
				<Table.Head>Categoria</Table.Head>
				<Table.Head>Il tuo Bilancio</Table.Head>
				<Table.Head>All.</Table.Head>
				<Table.Head class="text-right">Azioni</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if filteredExpenses.length === 0}
				<Table.Row>
					<Table.Cell colspan={8} class="h-24 text-center">Nessuna spesa trovata.</Table.Cell>
				</Table.Row>
			{:else}
				{#each filteredExpenses as expense (expense.id)}
					<Table.Row>
						<Table.Cell>
							<div class="flex items-center text-muted-foreground">
								<Calendar class="mr-2 h-3 w-3" />
								{new Date(expense.date).toLocaleDateString()}
							</div>
						</Table.Cell>
						<Table.Cell class="font-medium">
							<div class="flex items-center">
								<Receipt class="mr-2 h-4 w-4 text-muted-foreground" />
								{expense.title}
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center">
								<User class="mr-2 h-3 w-3 text-muted-foreground" />
								{getPayerName(expense.paidById)}
							</div>
						</Table.Cell>
						<Table.Cell class="font-bold">{expense.amount.toFixed(2)}€</Table.Cell>
						<Table.Cell>
							<div class="flex items-center">
								<Tag class="mr-2 h-3 w-3 text-muted-foreground" />
								{expense.category}
							</div>
						</Table.Cell>
						<Table.Cell>
							{@const bal = getExpenseBalance(expense)}
							{#if bal === null}
								<span class="text-muted-foreground">-</span>
							{:else if Math.abs(bal) < 0.01}
								<span class="text-muted-foreground">Pari</span>
							{:else if bal > 0}
								<div class="flex flex-col">
									<span class="font-bold text-emerald-500">+{bal.toFixed(2)}€</span>
									<span class="text-[10px] text-emerald-500">Hai prestato</span>
								</div>
							{:else}
								<div class="flex flex-col">
									<span class="font-bold text-destructive">{bal.toFixed(2)}€</span>
									<span class="text-[10px] text-destructive">Hai in prestito</span>
								</div>
							{/if}
						</Table.Cell>
						<Table.Cell>
							{@const count = (expense.attachments?.length ?? 0) + (expense.attachment ? 1 : 0)}
							{#if count > 0}
								<div class="flex items-center gap-1 text-muted-foreground" title="{count} allegati">
									<FileText class="h-4 w-4" />
									<span class="text-xs font-medium">{count}</span>
								</div>
							{:else}
								<span class="text-muted-foreground opacity-50">-</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right">
							<div class="flex justify-end gap-2">
								<Button variant="ghost" size="icon" href="/expenses/{expense.id}">
									<Edit class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" onclick={() => deleteExpense(expense.id!)}>
									<Trash2 class="h-4 w-4 text-destructive" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			{/if}
		</Table.Body>
	</Table.Root>
</div>
