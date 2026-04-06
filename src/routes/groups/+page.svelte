<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { db, type Group } from '$lib/db';
	import { groupSchema } from '$lib/schemas';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Layers, Plus, Trash2, Pencil } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Checkbox } from '$lib/components/ui/checkbox';

	let open = $state(false);
	let editingId = $state<number | null>(null);

	const superform = superForm(defaults(zod4(groupSchema)), {
		SPA: true,
		validators: zod4(groupSchema),
		onUpdate: async ({ form }) => {
			if (!form.valid) return;

			const data = form.data;
			await db.transaction('rw', [db.groups, db.groupMembers], async () => {
				let gid = editingId;
				if (editingId) {
					await db.groups.update(editingId, {
						name: data.name,
						description: data.description || undefined
					});
					// Aggiorna membri: cancella e riaggiungi
					await db.groupMembers.where('groupId').equals(editingId).delete();
				} else {
					gid = (await db.groups.add({
						name: data.name,
						description: data.description || undefined
					})) as number;
				}

				for (const contactId of data.members) {
					await db.groupMembers.add({ groupId: gid!, contactId });
				}
			});

			open = false;
			editingId = null;
			superform.reset();
		}
	});

	const { form, enhance, reset } = superform;

	async function startEdit(group: Group) {
		editingId = group.id!;
		const currentMembers = await db.groupMembers.where('groupId').equals(editingId).toArray();
		form.set({
			id: group.id,
			name: group.name,
			description: group.description || '',
			members: currentMembers.map(m => m.contactId)
		});
		open = true;
	}


	function startAdd() {
		editingId = null;
		reset();
		open = true;
	}

	async function deleteGroup(id: number) {
		if (confirm('Sei sicuro di voler eliminare questo gruppo?')) {
			await db.groups.delete(id);
			await db.groupMembers.where('groupId').equals(id).delete();
		}
	}

	function toggleMember(id: number) {
		if ($form.members.includes(id)) {
			$form.members = $form.members.filter((m) => m !== id);
		} else {
			$form.members = [...$form.members, id];
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Gruppi</h1>
		<Button onclick={startAdd} size="sm" class="gap-2">
			<Plus class="h-4 w-4" />
			Nuovo Gruppo
		</Button>
	</div>

	<Dialog.Root bind:open onOpenChange={(v) => !v && reset()}>
		<Dialog.Content class="max-w-md">
			<Dialog.Header>
				<Dialog.Title>{editingId ? 'Modifica Gruppo' : 'Nuovo Gruppo'}</Dialog.Title>
				<Dialog.Description>
					{editingId ? 'Aggiorna i dettagli del gruppo e i suoi membri.' : 'Crea un gruppo per dividere le spese con più persone.'}
				</Dialog.Description>
			</Dialog.Header>
			<form use:enhance class="grid gap-4 py-4">
				<Form.Field form={superform} name="name">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Nome Gruppo *</Form.Label>
							<Input {...props} bind:value={$form.name} placeholder="Casa, Viaggio Londra..." />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field form={superform} name="description">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Descrizione</Form.Label>
							<Input {...props} bind:value={$form.description} placeholder="Spese condivise per..." />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field form={superform} name="members">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Membri</Form.Label>
							<div class="bg-muted/50 max-h-40 overflow-y-auto rounded-md border p-2">
								{#each appState.contacts as contact}
									<div class="flex items-center space-x-2 py-1">
										<Checkbox
											id="member-{contact.id}"
											checked={$form.members.includes(contact.id!)}
											onCheckedChange={() => toggleMember(contact.id!)}
										/>
										<label
											for="member-{contact.id}"
											class="flex flex-1 cursor-pointer items-center gap-2 text-sm font-normal"
										>
											<Avatar.Root class="h-6 w-6">
												<Avatar.Fallback class="text-[10px]"
													>{contact.name[0].toUpperCase()}</Avatar.Fallback
												>
											</Avatar.Root>
											{contact.name}
										</label>
									</div>
								{:else}
									<p class="text-muted-foreground p-2 text-center text-xs">Nessun contatto trovato.</p>
								{/each}
							</div>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Dialog.Footer>
					<Button variant="outline" type="button" onclick={() => (open = false)}>Annulla</Button>
					<Button type="submit">{editingId ? 'Salva Modifiche' : 'Crea'}</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each appState.groups as group (group.id)}
			<Card.Root>
				<Card.Header class="pb-2">
					<div class="flex items-start justify-between">
						<div>
							<Card.Title>{group.name}</Card.Title>
							<Card.Description>{group.description || 'Nessuna descrizione'}</Card.Description>
						</div>
						<div class="flex gap-1">
							<Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => startEdit(group)}>
								<Pencil class="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="text-destructive h-8 w-8"
								onclick={() => deleteGroup(group.id!)}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
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
