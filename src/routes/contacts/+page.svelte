<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { contactsQuery, expensesQuery, settlementsQuery } from '$lib/db.svelte';
	import { userSettings } from '$lib/settings.svelte';
	import { db } from '$lib/db';
	import { calculateBalances, simplifyDebts } from '$lib/utils/debt';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Plus, User, Trash2, Edit } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let searchQuery = $state('');
	let myId = $derived(userSettings.myContactId ? parseInt(userSettings.myContactId) : null);

	let allDebts = $derived.by(() => {
		if (!contactsQuery.value || !expensesQuery.value || !settlementsQuery.value) return [];
		const allIds = contactsQuery.value.map((c) => c.id!);
		const balances = calculateBalances(expensesQuery.value, settlementsQuery.value, allIds);
		return simplifyDebts(balances);
	});

	function getNetBalance(contactId: number) {
		if (myId && myId !== contactId) {
			const debtToMe = allDebts.find((d) => d.from === contactId && d.to === myId)?.amount || 0;
			const debtFromMe = allDebts.find((d) => d.from === myId && d.to === contactId)?.amount || 0;
			return debtToMe - debtFromMe;
		} else {
			if (!expensesQuery.value || !settlementsQuery.value || !contactsQuery.value) return 0;
			const allIds = contactsQuery.value.map((c) => c.id!);
			const balances = calculateBalances(expensesQuery.value, settlementsQuery.value, allIds);
			return balances.get(contactId) || 0;
		}
	}

	let filteredContacts = $derived.by(() => {
		const contacts = contactsQuery.value || [];
		if (!searchQuery) return contacts;
		return contacts.filter(
			(c) =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				c.email?.toLowerCase().includes(searchQuery.toLowerCase())
		);
	});

	async function deleteContact(id: number) {
		if (confirm('Sei sicuro di voler eliminare questo contatto?')) {
			try {
				await db.contacts.delete(id);
				toast.success('Contatto eliminato');
			} catch (e) {
				toast.error("Errore durante l'eliminazione");
			}
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">Contatti</h1>
	<Button href="/contacts/new">
		<Plus class="mr-2 h-4 w-4" /> Nuovo Contatto
	</Button>
</div>

<div class="mb-6">
	<input
		type="text"
		placeholder="Cerca contatti..."
		bind:value={searchQuery}
		class="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
	/>
</div>

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Nome</Table.Head>
				<Table.Head>Email</Table.Head>
				<Table.Head>Telefono</Table.Head>
				<Table.Head>Bilancio</Table.Head>
				<Table.Head class="text-right">Azioni</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if filteredContacts.length === 0}
				<Table.Row>
					<Table.Cell colspan={5} class="h-24 text-center">Nessun contatto trovato.</Table.Cell>
				</Table.Row>
			{:else}
				{#each filteredContacts as contact (contact.id)}
					<Table.Row>
						<Table.Cell class="font-medium">
							<div class="flex items-center">
								<div
									class="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
								>
									<User class="h-4 w-4" />
								</div>
								{contact.name}
								{#if myId === contact.id}
									<span class="ml-2 text-xs text-muted-foreground">(Tu)</span>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>{contact.email || '-'}</Table.Cell>
						<Table.Cell>{contact.tel || '-'}</Table.Cell>
						<Table.Cell>
							{#if myId === contact.id}
								-
							{:else}
								{@const bal = getNetBalance(contact.id!)}
								{#if bal > 0}
									<span class="font-bold text-emerald-500">+{bal.toFixed(2)}€</span>
								{:else if bal < 0}
									<span class="font-bold text-destructive">{bal.toFixed(2)}€</span>
								{:else}
									<span class="text-muted-foreground">0.00€</span>
								{/if}
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right">
							<div class="flex justify-end gap-2">
								<Button variant="ghost" size="icon" href="/contacts/{contact.id}">
									<Edit class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" onclick={() => deleteContact(contact.id!)}>
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
