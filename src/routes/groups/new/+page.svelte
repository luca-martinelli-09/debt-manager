<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { db } from '$lib/db';
	import { contactsQuery } from '$lib/db.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { ArrowLeft, Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { uuidv7 } from 'uuidv7';

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
			toast.error(m.group_name_required());
			return;
		}
		if (selectedMemberIds.length === 0) {
			toast.error(m.select_at_least_one_participant());
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
			toast.success(m.group_created());
			goto('/groups');
		} catch (error) {
			toast.error(m.group_create_error());
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6">
	<Button variant="ghost" href="/groups">
		<ArrowLeft class="mr-2 h-4 w-4" />{m.back_to_groups_btn()}</Button
	>
</div>

<Card.Root class="mx-auto max-w-lg">
	<Card.Header>
		<Card.Title>{m.new_group_title()}</Card.Title>
		<Card.Description>{m.add_group_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit} class="space-y-6">
			<div class="space-y-2">
				<Label for="name">{m.group_name_label()}</Label>
				<Input id="name" bind:value={name} placeholder={m.example_group()} required />
			</div>

			<div class="space-y-3">
				<Label>{m.participants()} *</Label>
				<div class="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
					{#if !contactsQuery.value || contactsQuery.value.length === 0}
						<p class="p-4 text-center text-sm text-muted-foreground">
							{m.no_contact_found()}
							<a href="/contacts/new" class="text-primary hover:underline">{m.add_one()}</a> prima.
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
					{m.selected_label()}
					{selectedMemberIds.length}
				</p>
			</div>

			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? m.saving() : m.create_group()}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
