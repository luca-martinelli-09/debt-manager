<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { db } from '$lib/db';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Layers, Plus, Trash2, Users } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Checkbox } from '$lib/components/ui/checkbox';

	let open = $state(false);
	let name = $state('');
	let description = $state('');
	let selectedMembers = $state<number[]>([]);

	async function addGroup() {
		if (!name) return;
		const groupId = await db.groups.add({
			name,
			description: description || undefined
		});

		// Aggiungi membri
		for (const contactId of selectedMembers) {
			await db.groupMembers.add({ groupId: groupId as number, contactId });
		}

		name = '';
		description = '';
		selectedMembers = [];
		open = false;
	}

	async function deleteGroup(id: number) {
		if (confirm('Sei sicuro di voler eliminare questo gruppo?')) {
			await db.groups.delete(id);
			await db.groupMembers.where('groupId').equals(id).delete();
		}
	}

	function toggleMember(id: number) {
		if (selectedMembers.includes(id)) {
			selectedMembers = selectedMembers.filter((m) => m !== id);
		} else {
			selectedMembers = [...selectedMembers, id];
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Gruppi</h1>
		<Dialog.Root bind:open>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button {...props} size="sm" class="gap-2">
						<Plus class="h-4 w-4" />
						Nuovo Gruppo
					</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content class="max-w-md">
				<Dialog.Header>
					<Dialog.Title>Nuovo Gruppo</Dialog.Title>
					<Dialog.Description>Crea un gruppo per dividere le spese con più persone.</Dialog.Description>
				</Dialog.Header>
				<div class="grid gap-4 py-4">
					<div class="grid gap-2">
						<Label for="name">Nome Gruppo *</Label>
						<Input id="name" bind:value={name} placeholder="Casa, Viaggio Londra..." />
					</div>
					<div class="grid gap-2">
						<Label for="desc">Descrizione</Label>
						<Input id="desc" bind:value={description} placeholder="Spese condivise per..." />
					</div>
					<div class="grid gap-2">
						<Label>Membri</Label>
						<div class="bg-muted/50 max-h-40 overflow-y-auto rounded-md border p-2">
							{#each appState.contacts as contact}
								<div class="flex items-center space-x-2 py-1">
									<Checkbox
										id="member-{contact.id}"
										checked={selectedMembers.includes(contact.id!)}
										onCheckedChange={() => toggleMember(contact.id!)}
									/>
									<Label
										for="member-{contact.id}"
										class="flex flex-1 cursor-pointer items-center gap-2 text-sm font-normal"
									>
										<Avatar.Root class="h-6 w-6">
											<Avatar.Fallback class="text-[10px]"
												>{contact.name[0].toUpperCase()}</Avatar.Fallback
											>
										</Avatar.Root>
										{contact.name}
									</Label>
								</div>
							{:else}
								<p class="text-muted-foreground p-2 text-center text-xs">Nessun contatto trovato.</p>
							{/each}
						</div>
					</div>
				</div>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (open = false)}>Annulla</Button>
					<Button onclick={addGroup}>Crea</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each appState.groups as group (group.id)}
			<Card.Root>
				<Card.Header class="pb-2">
					<div class="flex items-start justify-between">
						<div>
							<Card.Title>{group.name}</Card.Title>
							<Card.Description>{group.description || 'Nessuna descrizione'}</Card.Description>
						</div>
						<Button
							variant="ghost"
							size="icon"
							class="text-destructive h-8 w-8"
							onclick={() => deleteGroup(group.id!)}
						>
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				</Card.Header>
				<Card.Footer class="pt-0">
					<a href="/groups/{group.id}" class="text-primary text-sm font-medium hover:underline">
						Vedi dettagli
					</a>
				</Card.Footer>
			</Card.Root>
		{:else}
			<div class="col-span-full py-12 text-center">
				<div class="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
					<Layers class="text-muted-foreground h-6 w-6" />
				</div>
				<h3 class="text-lg font-medium">Nessun gruppo</h3>
				<p class="text-muted-foreground">Crea un gruppo per gestire le spese di casa o dei viaggi.</p>
			</div>
		{/each}
	</div>
</div>
