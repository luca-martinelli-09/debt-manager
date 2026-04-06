<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { db } from '$lib/db';
	import { contactsQuery, expensesQuery, groupsQuery, settlementsQuery } from '$lib/db.svelte';
	import { userSettings } from '$lib/settings.svelte';
	import { calculateBalances } from '$lib/utils/debt';
	import { Edit, Plus, Trash2, Users } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let searchQuery = $state('');
	let myId = $derived(userSettings.myContactId ? userSettings.myContactId : null);

	let filteredGroups = $derived.by(() => {
		const groups = groupsQuery.value || [];
		if (!searchQuery) return groups;
		return groups.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
	});

	function getMemberNames(memberIds: string[]) {
		const contacts = contactsQuery.value || [];
		return memberIds
			.map((id) => {
				if (myId && id === myId) return 'Tu';
				return contacts.find((c) => c.id === id)?.name;
			})
			.filter(Boolean)
			.join(', ');
	}

	function getGroupBalance(groupId: string, memberIds: string[]) {
		if (!myId || !memberIds.includes(myId)) return null;

		const gExpenses = (expensesQuery.value || []).filter((e) => e.groupId === groupId);
		const gSettlements = (settlementsQuery.value || []).filter((s) => s.groupId === groupId);
		const balances = calculateBalances(gExpenses, gSettlements, memberIds);

		return balances.get(myId) || 0;
	}

	async function deleteGroup(id: string) {
		if (
			confirm(
				'Sei sicuro di voler eliminare questo gruppo? Tutti i dati associati potrebbero diventare orfani.'
			)
		) {
			try {
				await db.groups.delete(id);
				toast.success('Gruppo eliminato');
			} catch (e) {
				toast.error("Errore durante l'eliminazione");
			}
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">Gruppi</h1>
	<Button href="/groups/new">
		<Plus class="mr-2 h-4 w-4" /> Nuovo Gruppo
	</Button>
</div>

<div class="mb-6">
	<input
		type="text"
		placeholder="Cerca gruppi..."
		bind:value={searchQuery}
		class="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
	/>
</div>

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Nome Gruppo</Table.Head>
				<Table.Head>Membri</Table.Head>
				<Table.Head>Partecipanti</Table.Head>
				<Table.Head>Il tuo Bilancio</Table.Head>
				<Table.Head class="text-right">Azioni</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if filteredGroups.length === 0}
				<Table.Row>
					<Table.Cell colspan={5} class="h-24 text-center">Nessun gruppo trovato.</Table.Cell>
				</Table.Row>
			{:else}
				{#each filteredGroups as group (group.id)}
					<Table.Row>
						<Table.Cell class="font-medium">
							<div class="flex items-center">
								<div
									class="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
								>
									<Users class="h-4 w-4" />
								</div>
								{group.name}
							</div>
						</Table.Cell>
						<Table.Cell>{group.memberIds.length}</Table.Cell>
						<Table.Cell class="max-w-[200px] truncate text-muted-foreground">
							{getMemberNames(group.memberIds)}
						</Table.Cell>
						<Table.Cell>
							{@const bal = getGroupBalance(group.id!, group.memberIds)}
							{#if bal === null}
								<span class="text-muted-foreground">-</span>
							{:else if bal > 0}
								<span class="font-bold text-emerald-500">+{bal.toFixed(2)}€</span>
							{:else if bal < 0}
								<span class="font-bold text-destructive">{bal.toFixed(2)}€</span>
							{:else}
								<span class="text-muted-foreground">0.00€</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right">
							<div class="flex justify-end gap-2">
								<Button variant="ghost" size="icon" href="/groups/{group.id}">
									<Edit class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" onclick={() => deleteGroup(group.id!)}>
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
