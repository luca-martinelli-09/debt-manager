<script lang="ts">
	import { uuidv7 } from 'uuidv7';
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
	import { ArrowLeft, Trash2, User, Wallet } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const id = page.params.id || '';
	let name = $state('');
	let email = $state('');
	let tel = $state('');
	let loading = $state(false);
	let fetching = $state(true);

	// Per i pagamenti parziali in-line

	onMount(async () => {
		const contact = await db.contacts.get(id);
		if (contact) {
			name = contact.name;
			email = contact.email || '';
			tel = contact.tel || '';
		} else {
			toast.error('Contatto non trovato');
			goto('/contacts');
		}
		fetching = false;
	});

	let contactDebts = $derived.by(() => {
		if (!contactsQuery.value || !expensesQuery.value || !settlementsQuery.value) return [];
		const allIds = contactsQuery.value.map((c) => c.id!);
		const balances = calculateBalances(expensesQuery.value, settlementsQuery.value, allIds);
		const debts = simplifyDebts(balances);
		// Filtra solo i debiti che coinvolgono questo contatto
		return debts.filter((d) => d.from === id || d.to === id);
	});

	let contactSettlements = $derived.by(() => {
		const s = settlementsQuery.value || [];
		return s.filter((d) => d.fromContactId === id || d.toContactId === id);
	});

	function getContactName(cId: string) {
		return contactsQuery.value?.find((c) => c.id === cId)?.name || 'Sconosciuto';
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error('Il nome è obbligatorio');
			return;
		}

		loading = true;
		try {
			await db.contacts.update(id, {
				name,
				email: email || undefined,
				tel: tel || undefined
			});
			toast.success('Contatto aggiornato con successo');
		} catch (error) {
			toast.error("Errore durante l'aggiornamento del contatto");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function settleDebt(from: string, to: string, amount: number) {
		if (amount <= 0) {
			toast.error("L'importo deve essere maggiore di zero");
			return;
		}
		try {
			await db.settlements.add({
				id: uuidv7(),
				fromContactId: from,
				toContactId: to,
				amount,
				date: new Date(),
				createdAt: new Date()
			});
			toast.success('Debito saldato con successo');
			// Chiudi il form inline
		} catch (error) {
			toast.error('Errore durante il saldo');
		}
	}

	async function deleteSettlement(sid: string) {
		if (confirm('Vuoi davvero eliminare questo pagamento?')) {
			try {
				await db.settlements.delete(sid);
				toast.success('Pagamento eliminato');
			} catch (e) {
				toast.error("Errore durante l'eliminazione");
			}
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<Button variant="ghost" href="/contacts">
		<ArrowLeft class="mr-2 h-4 w-4" /> Torna ai contatti
	</Button>
</div>

{#if fetching}
	<div class="flex justify-center p-8">
		<p>Caricamento...</p>
	</div>
{:else}
	<div class="mx-auto max-w-2xl">
		<div class="mb-6 flex items-center gap-4">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
			>
				<User class="h-8 w-8" />
			</div>
			<div>
				<h1 class="text-3xl font-bold">{name}</h1>
				<p class="text-muted-foreground">{email || tel || 'Nessun recapito'}</p>
			</div>
		</div>

		<Tabs.Root value="saldi" class="space-y-6">
			<Tabs.List class="grid w-full grid-cols-3">
				<Tabs.Trigger value="saldi">Debiti & Saldi</Tabs.Trigger>
				<Tabs.Trigger value="pagamenti">Pagamenti</Tabs.Trigger>
				<Tabs.Trigger value="dettagli">Modifica Profilo</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="saldi">
				<Card.Root>
					<Card.Header>
						<Card.Title>Situazione con {name}</Card.Title>
						<Card.Description
							>Tutti i debiti semplificati (cross-gruppo) che coinvolgono questo contatto.</Card.Description
						>
					</Card.Header>
					<Card.Content>
						{#if contactDebts.length === 0}
							<div
								class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
							>
								<Wallet class="mb-4 h-8 w-8 opacity-50" />
								<p>Tutti i conti con {name} sono in pareggio!</p>
							</div>
						{:else}
							<div class="space-y-4">
								{#each contactDebts as debt}
									{@const isDebtor = debt.from === id}
									<DebtItem
										amount={debt.amount}
										isNegative={isDebtor}
										onSettle={(amt) => settleDebt(debt.from, debt.to, amt)}
									>
										{#snippet descriptionSnippet()}
											{#if isDebtor}
												<p><span class="font-bold">{name}</span> deve dare</p>
												<p class="font-bold text-destructive">
													{debt.amount.toFixed(2)}€ a {getContactName(debt.to)}
												</p>
											{:else}
												<p><span class="font-bold">{name}</span> deve ricevere</p>
												<p class="font-bold text-emerald-500">
													{debt.amount.toFixed(2)}€ da {getContactName(debt.from)}
												</p>
											{/if}
										{/snippet}
									</DebtItem>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="pagamenti">
				<Card.Root>
					<Card.Content class="p-0">
						{#if contactSettlements.length === 0}
							<p class="p-8 text-center text-muted-foreground">Nessun pagamento registrato.</p>
						{:else}
							<div class="divide-y">
								{#each contactSettlements as settlement (settlement.id)}
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

			<Tabs.Content value="dettagli">
				<Card.Root>
					<Card.Header>
						<Card.Title>Dettagli Contatto</Card.Title>
						<Card.Description>Aggiorna le informazioni di base.</Card.Description>
					</Card.Header>
					<Card.Content>
						<form onsubmit={handleSubmit} class="space-y-4">
							<div class="space-y-2">
								<Label for="name">Nome *</Label>
								<Input id="name" bind:value={name} placeholder="Es. Mario Rossi" required />
							</div>
							<div class="space-y-2">
								<Label for="email">Email (opzionale)</Label>
								<Input id="email" type="email" bind:value={email} placeholder="mario@esempio.com" />
							</div>
							<div class="space-y-2">
								<Label for="tel">Telefono (opzionale)</Label>
								<Input id="tel" type="tel" bind:value={tel} placeholder="+39 333 1234567" />
							</div>
							<Button type="submit" class="w-full" disabled={loading}>
								{loading ? 'Salvataggio...' : 'Aggiorna Contatto'}
							</Button>
						</form>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	</div>
{/if}
