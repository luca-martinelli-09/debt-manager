<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { db } from '$lib/db';
	import * as m from '$lib/paraglide/messages.js';
	import { ArrowLeft } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { uuidv7 } from 'uuidv7';

	let name = $state('');
	let email = $state('');
	let tel = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error(m.name_required());
			return;
		}

		loading = true;
		try {
			await db.contacts.add({
				id: uuidv7(),
				name,
				email: email || undefined,
				tel: tel || undefined,
				createdAt: new Date()
			});
			toast.success(m.contact_created());
			goto('/contacts');
		} catch (error) {
			toast.error(m.contact_create_error());
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6">
	<Button variant="ghost" href="/contacts">
		<ArrowLeft class="mr-2 h-4 w-4" />{m.back_to_contacts_btn()}</Button
	>
</div>

<Card.Root class="mx-auto max-w-lg">
	<Card.Header>
		<Card.Title>{m.new_contact()}</Card.Title>
		<Card.Description>{m.add_contact_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-2">
				<Label for="name">{m.name()} *</Label>
				<Input id="name" bind:value={name} placeholder={m.example_mario()} required />
			</div>
			<div class="space-y-2">
				<Label for="email">{m.email()} (opzionale)</Label>
				<Input id="email" type="email" bind:value={email} placeholder="mario@esempio.com" />
			</div>
			<div class="space-y-2">
				<Label for="tel">{m.phone()} (opzionale)</Label>
				<Input id="tel" type="tel" bind:value={tel} placeholder="+39 333 1234567" />
			</div>
			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? m.saving() : m.create_contact()}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
