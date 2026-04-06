<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { db } from '$lib/db';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { UserPlus, User, Mail, Phone, Trash2 } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';

	let open = $state(false);
	let name = $state('');
	let email = $state('');
	let phone = $state('');

	async function addContact() {
		if (!name) return;
		await db.contacts.add({
			name,
			email: email || undefined,
			phone: phone || undefined
		});
		name = '';
		email = '';
		phone = '';
		open = false;
	}

	async function deleteContact(id: number) {
		if (confirm('Sei sicuro di voler eliminare questo contatto?')) {
			await db.contacts.delete(id);
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Contatti</h1>
		<Dialog.Root bind:open>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button {...props} size="sm" class="gap-2">
						<UserPlus class="h-4 w-4" />
						Aggiungi
					</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Nuovo Contatto</Dialog.Title>
					<Dialog.Description>Inserisci i dettagli del nuovo contatto.</Dialog.Description>
				</Dialog.Header>
				<div class="grid gap-4 py-4">
					<div class="grid gap-2">
						<Label for="name">Nome *</Label>
						<Input id="name" bind:value={name} placeholder="Mario Rossi" />
					</div>
					<div class="grid gap-2">
						<Label for="email">Email</Label>
						<Input id="email" type="email" bind:value={email} placeholder="mario@example.com" />
					</div>
					<div class="grid gap-2">
						<Label for="phone">Telefono</Label>
						<Input id="phone" type="tel" bind:value={phone} placeholder="+39 123 4567890" />
					</div>
				</div>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (open = false)}>Annulla</Button>
					<Button onclick={addContact}>Salva</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each appState.contacts as contact (contact.id)}
			<Card.Root>
				<Card.Content class="flex items-center gap-4 p-4">
					<Avatar.Root>
						<Avatar.Fallback>{contact.name[0].toUpperCase()}</Avatar.Fallback>
					</Avatar.Root>
					<div class="flex-1 overflow-hidden">
						<div class="font-semibold truncate">{contact.name}</div>
						<div class="text-muted-foreground flex flex-col text-xs">
							{#if contact.email}
								<span class="flex items-center gap-1 truncate"><Mail class="h-3 w-3" /> {contact.email}</span>
							{/if}
							{#if contact.phone}
								<span class="flex items-center gap-1"><Phone class="h-3 w-3" /> {contact.phone}</span>
							{/if}
						</div>
					</div>
					<Button variant="ghost" size="icon" class="text-destructive h-8 w-8" onclick={() => deleteContact(contact.id!)}>
						<Trash2 class="h-4 w-4" />
					</Button>
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="col-span-full py-12 text-center">
				<div class="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
					<User class="text-muted-foreground h-6 w-6" />
				</div>
				<h3 class="text-lg font-medium">Nessun contatto</h3>
				<p class="text-muted-foreground">Aggiungi i tuoi amici per iniziare a dividere le spese.</p>
			</div>
		{/each}
	</div>
</div>
