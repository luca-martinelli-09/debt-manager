<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DebtItem from '$lib/components/DebtItem.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { db } from '$lib/db';
	import { contactsQuery, expensesQuery, settlementsQuery } from '$lib/db.svelte';
	import { calculateBalances, simplifyDebts } from '$lib/utils/debt';
	import { ArrowLeft, Check, Receipt, Trash2, Users, Wallet } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const groupId = parseInt(page.params.id || '0');

	let currentGroup = $state<any>(null);
	let name = $state('');
	let selectedMemberIds = $state<number[]>([]);
	let loading = $state(false);
	let fetching = $state(true);

	onMount(async () => {
		const g = await db.groups.get(groupId);
		if (g) {
			currentGroup = g;
			name = g.name;
			selectedMemberIds = g.memberIds;
		} else {
			toast.error('Gruppo non trovato');
			goto('/groups');
		}
		fetching = false;
	});

	let groupExpenses = $derived((expensesQuery.value || []).filter((e) => e.groupId === groupId));
	let groupSettlements = $derived(
		(settlementsQuery.value || []).filter((s) => s.groupId === groupId)
	);

	let groupBalances = $derived.by(() => {
		if (!currentGroup || !expensesQuery.value || !settlementsQuery.value)
			return new Map<number, number>();
		return calculateBalances(groupExpenses, groupSettlements, currentGroup.memberIds);
	});

	let simplifiedDebts = $derived(simplifyDebts(groupBalances));

	function getContactName(id: number) {
		return contactsQuery.value?.find((c) => c.id === id)?.name || 'Sconosciuto';
	}

	async function settleDebt(from: number, to: number, amount: number) {
		if (amount <= 0) {
			toast.error("L'importo deve essere maggiore di zero");
			return;
		}
		try {
			await db.settlements.add({
				fromContactId: from,
				toContactId: to,
				amount,
				date: new Date(),
				groupId,
				createdAt: new Date()
			});
			toast.success('Debito saldato con successo');
		} catch (error) {
			toast.error('Errore durante il saldo');
		}
	}

	async function deleteSettlement(id: number) {
		if (confirm('Vuoi davvero eliminare questo pagamento?')) {
			try {
				await db.settlements.delete(id);
				toast.success('Pagamento eliminato');
			} catch (e) {
				toast.error("Errore durante l'eliminazione");
			}
		}
	}

	// Funzioni per l'Editing del gruppo
	function toggleMember(contactId: number) {
		if (selectedMemberIds.includes(contactId)) {
			selectedMemberIds = selectedMemberIds.filter((mid) => mid !== contactId);
		} else {
			selectedMemberIds = [...selectedMemberIds, contactId];
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error('Il nome del gruppo è obbligatorio');
			return;
		}
		if (selectedMemberIds.length === 0) {
			toast.error('Seleziona almeno un partecipante');
			return;
		}

		loading = true;
		try {
			await db.groups.update(groupId, {
				name,
				memberIds: [...selectedMemberIds]
			});
			toast.success('Gruppo aggiornato con successo');
			// Aggiorna lo state visivo per evitare un ricaricamento forzato
			currentGroup.name = name;
			currentGroup.memberIds = [...selectedMemberIds];
		} catch (error) {
			toast.error("Errore durante l'aggiornamento del gruppo");
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<Button variant="ghost" href="/groups">
		<ArrowLeft class="mr-2 h-4 w-4" /> Torna ai gruppi
	</Button>
</div>

{#if fetching}
	<p class="p-8 text-center">Caricamento...</p>
{:else if !currentGroup}
	<p class="p-8 text-center text-destructive">Impossibile caricare il gruppo.</p>
{:else}
	<div class="mx-auto max-w-2xl">
		<div class="mb-6 flex items-center gap-4">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
			>
				<Users class="h-8 w-8" />
			</div>
			<div class="flex-1">
				<h1 class="text-3xl font-bold">{currentGroup.name}</h1>
				<p class="text-muted-foreground">{currentGroup.memberIds.length} partecipanti</p>
			</div>
			<Button href="/expenses/new?groupId={groupId}">
				<Receipt class="mr-2 h-4 w-4" /> Spesa
			</Button>
		</div>

		<Tabs.Root value="balances" class="space-y-6">
			<Tabs.List class="grid w-full grid-cols-4">
				<Tabs.Trigger value="balances">Saldi</Tabs.Trigger>
				<Tabs.Trigger value="expenses">Spese</Tabs.Trigger>
				<Tabs.Trigger value="settlements">Pagamenti</Tabs.Trigger>
				<Tabs.Trigger value="modifica">Dettagli</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="balances" class="space-y-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>Situazione Partecipanti</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="space-y-4">
							{#each currentGroup.memberIds as memberId (memberId)}
								{@const balance = groupBalances.get(memberId) || 0}
								<div class="flex items-center justify-between">
									<div class="flex items-center">
										<div
											class="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted"
										>
											<Users class="h-4 w-4" />
										</div>
										<span>{getContactName(memberId)}</span>
									</div>
									<span
										class={balance >= 0 ? 'font-bold text-primary' : 'font-bold text-destructive'}
									>
										{balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
									</span>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Debiti Semplificati</Card.Title>
						<Card.Description
							>Conti ottimizzati nel gruppo per ridurre al minimo le transazioni.</Card.Description
						>
					</Card.Header>
					<Card.Content>
						{#if simplifiedDebts.length === 0}
							<div
								class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
							>
								<Wallet class="mb-4 h-8 w-8 opacity-50" />
								<p>Tutti i conti del gruppo sono in pareggio!</p>
							</div>
						{:else}
							<div class="space-y-4">
								{#each simplifiedDebts as debt}
									<DebtItem
										amount={debt.amount}
										isNegative={false}
										onSettle={(amt) => settleDebt(debt.from, debt.to, amt)}
									>
										{#snippet descriptionSnippet()}
											<p><span class="font-bold">{getContactName(debt.from)}</span> deve dare</p>
											<p class="font-bold text-emerald-500">
												{debt.amount.toFixed(2)}€ a {getContactName(debt.to)}
											</p>
										{/snippet}
									</DebtItem>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="expenses">
				<Card.Root>
					<Card.Content class="p-0">
						{#if groupExpenses.length === 0}
							<p class="p-8 text-center text-muted-foreground">Nessuna spesa in questo gruppo.</p>
						{:else}
							<div class="divide-y">
								{#each groupExpenses as expense (expense.id)}
									<a
										href="/expenses/{expense.id}"
										class="block flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
									>
										<div>
											<p class="font-medium">{expense.title}</p>
											<p class="text-xs text-muted-foreground">
												Da {getContactName(expense.paidById)} • {new Date(
													expense.date
												).toLocaleDateString()}
											</p>
										</div>
										<div class="text-right">
											<p class="font-bold">{expense.amount.toFixed(2)}€</p>
											<div
												class="flex items-center justify-end gap-1 text-xs text-muted-foreground"
											>
												{#if (expense.attachments?.length ?? 0) > 0 || expense.attachment}
													<Receipt class="h-3 w-3" />
												{/if}
												{expense.category || 'Generale'}
											</div>
										</div>
									</a>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="settlements">
				<Card.Root>
					<Card.Content class="p-0">
						{#if groupSettlements.length === 0}
							<p class="p-8 text-center text-muted-foreground">Nessun pagamento registrato.</p>
						{:else}
							<div class="divide-y">
								{#each groupSettlements as settlement (settlement.id)}
									<div
										class="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
									>
										<div class="flex items-center gap-3">
											<Wallet class="h-6 w-6 text-primary" />
											<div class="text-sm">
												<p>
													<span class="font-bold">{getContactName(settlement.fromContactId)}</span>
													ha pagato a
													<span class="font-bold">{getContactName(settlement.toContactId)}</span>
												</p>
												<p class="text-xs text-muted-foreground">
													{new Date(settlement.date).toLocaleDateString()}
												</p>
											</div>
										</div>
										<div class="flex items-center gap-3">
											<p class="font-bold text-primary">{settlement.amount.toFixed(2)}€</p>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => deleteSettlement(settlement.id!)}
											>
												<Trash2 class="h-4 w-4 text-destructive" />
											</Button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="modifica">
				<Card.Root>
					<Card.Header>
						<Card.Title>Modifica Gruppo</Card.Title>
						<Card.Description>Aggiorna il nome o aggiungi e rimuovi partecipanti.</Card.Description>
					</Card.Header>
					<Card.Content>
						<form onsubmit={handleSubmit} class="space-y-6">
							<div class="space-y-2">
								<Label for="name">Nome Gruppo *</Label>
								<Input id="name" bind:value={name} required />
							</div>

							<div class="space-y-3">
								<Label>Partecipanti *</Label>
								<div class="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
									{#if !contactsQuery.value || contactsQuery.value.length === 0}
										<p class="p-4 text-center text-sm text-muted-foreground">
											Nessun contatto trovato. <a
												href="/contacts/new"
												class="text-primary hover:underline">Aggiungine uno</a
											> prima.
										</p>
									{:else}
										{#each contactsQuery.value as contact (contact.id)}
											<button
												type="button"
												class="flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors hover:bg-muted"
												onclick={() => toggleMember(contact.id!)}
											>
												<span>{contact.name}</span>
												{#if selectedMemberIds.includes(contact.id!)}
													<Check class="h-4 w-4 text-primary" />
												{/if}
											</button>
										{/each}
									{/if}
								</div>
								<p class="text-xs text-muted-foreground">
									Selezionati: {selectedMemberIds.length}
								</p>
							</div>

							<Button type="submit" class="w-full" disabled={loading}>
								{loading ? 'Salvataggio...' : 'Aggiorna Gruppo'}
							</Button>
						</form>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	</div>
{/if}
