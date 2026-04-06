<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { db } from '$lib/db';
	import { ArrowLeft } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let name = $state('');
	let email = $state('');
	let tel = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error('Il nome è obbligatorio');
			return;
		}

		loading = true;
		try {
			await db.contacts.add({
				name,
				email: email || undefined,
				tel: tel || undefined,
				createdAt: new Date()
			});
			toast.success('Contatto creato con successo');
			goto('/contacts');
		} catch (error) {
			toast.error('Errore durante la creazione del contatto');
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6">
	<Button variant="ghost" href="/contacts">
		<ArrowLeft class="mr-2 h-4 w-4" /> Torna ai contatti
	</Button>
</div>

<Card.Root class="mx-auto max-w-lg">
	<Card.Header>
		<Card.Title>Nuovo Contatto</Card.Title>
		<Card.Description>Inserisci i dettagli del nuovo contatto.</Card.Description>
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
				{loading ? 'Salvataggio...' : 'Crea Contatto'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
