<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { db, type Contact } from '$lib/db';
	import { contactSchema } from '$lib/schemas';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { UserPlus, User, Mail, Phone, Trash2, Pencil } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';

	let open = $state(false);
	let editingId = $state<number | null>(null);

	const superform = superForm(defaults(zod4(contactSchema)), {
		SPA: true,
		validators: zod4(contactSchema),
		onUpdate: async ({ form }) => {
			if (!form.valid) return;

			const data = form.data;
			if (editingId) {
				await db.contacts.update(editingId, {
					name: data.name,
					email: data.email || undefined,
					phone: data.phone || undefined
				});
			} else {
				await db.contacts.add({
					name: data.name,
					email: data.email || undefined,
					phone: data.phone || undefined
				});
			}

			open = false;
			editingId = null;
			superform.reset();
		}
	});

	const { form, enhance, reset } = superform;

	function startEdit(contact: Contact) {
		editingId = contact.id!;
		form.set({
			id: contact.id,
			name: contact.name,
			email: contact.email || '',
			phone: contact.phone || ''
		});
		open = true;
	}


	function startAdd() {
		editingId = null;
		reset();
		open = true;
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
		<Button onclick={startAdd} size="sm" class="gap-2">
			<UserPlus class="h-4 w-4" />
			Aggiungi
		</Button>
	</div>

	<Dialog.Root bind:open onOpenChange={(v) => !v && reset()}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{editingId ? 'Modifica Contatto' : 'Nuovo Contatto'}</Dialog.Title>
				<Dialog.Description>
					{editingId ? 'Aggiorna i dettagli del contatto.' : 'Inserisci i dettagli del nuovo contatto.'}
				</Dialog.Description>
			</Dialog.Header>
			<form use:enhance class="grid gap-4 py-4">
				<Form.Field form={superform} name="name">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Nome *</Form.Label>
							<Input {...props} bind:value={$form.name} placeholder="Mario Rossi" />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field form={superform} name="email">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Email</Form.Label>
							<Input {...props} type="email" bind:value={$form.email} placeholder="mario@example.com" />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field form={superform} name="phone">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Telefono</Form.Label>
							<Input {...props} type="tel" bind:value={$form.phone} placeholder="+39 123 4567890" />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Dialog.Footer>
					<Button variant="outline" type="button" onclick={() => (open = false)}>Annulla</Button>
					<Button type="submit">Salva</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

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
					<div class="flex gap-1">
						<Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => startEdit(contact)}>
							<Pencil class="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="icon" class="text-destructive h-8 w-8" onclick={() => deleteContact(contact.id!)}>
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
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
