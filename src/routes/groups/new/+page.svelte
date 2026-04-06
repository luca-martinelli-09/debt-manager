<script lang="ts">
	import { uuidv7 } from 'uuidv7';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { db } from '$lib/db';
	import { contactsQuery } from '$lib/db.svelte';
	import { ArrowLeft, Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let name = $state('');
	let selectedMemberIds = $state<string[]>([]);
	let loading = $state(false);

	function toggleMember(id: string) {
		if (selectedMemberIds.includes(id)) {
			selectedMemberIds = selectedMemberIds.filter((mid) => mid !== id);
		} else {
			selectedMemberIds = [...selectedMemberIds, id];
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
			await db.groups.add({
				id: uuidv7(),
				name,
				memberIds: [...selectedMemberIds], // Rimuove il Proxy creando un nuovo array
				createdAt: new Date()
			});
			toast.success('Gruppo creato con successo');
			goto('/groups');
		} catch (error) {
			toast.error('Errore durante la creazione del gruppo');
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6">
	<Button variant="ghost" href="/groups">
		<ArrowLeft class="mr-2 h-4 w-4" /> Torna ai gruppi
	</Button>
</div>

<Card.Root class="mx-auto max-w-lg">
	<Card.Header>
		<Card.Title>Nuovo Gruppo</Card.Title>
		<Card.Description>Crea un gruppo per dividere le spese tra più persone.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit} class="space-y-6">
			<div class="space-y-2">
				<Label for="name">Nome Gruppo *</Label>
				<Input id="name" bind:value={name} placeholder="Es. Viaggio Londra, Casa, Cena" required />
			</div>

			<div class="space-y-3">
				<Label>Partecipanti *</Label>
				<div class="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
					{#if !contactsQuery.value || contactsQuery.value.length === 0}
						<p class="p-4 text-center text-sm text-muted-foreground">
							Nessun contatto trovato. <a href="/contacts/new" class="text-primary hover:underline"
								>Aggiungine uno</a
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
				{loading ? 'Salvataggio...' : 'Crea Gruppo'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
