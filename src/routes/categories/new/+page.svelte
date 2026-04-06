<script lang="ts">
	import { uuidv7 } from 'uuidv7';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { db } from '$lib/db';
	import { ArrowLeft } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let name = $state('');
	let color = $state('#64748b');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error('Il nome è obbligatorio');
			return;
		}

		loading = true;
		try {
			await db.categories.add({ id: uuidv7(), name, color, createdAt: new Date() });
			toast.success('Categoria creata con successo');
			goto('/categories');
		} catch (error) {
			toast.error('Errore durante la creazione della categoria');
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6">
	<Button variant="ghost" href="/categories">
		<ArrowLeft class="mr-2 h-4 w-4" /> Torna alle categorie
	</Button>
</div>

<Card.Root class="mx-auto max-w-lg">
	<Card.Header>
		<Card.Title>Nuova Categoria</Card.Title>
		<Card.Description>Aggiungi una nuova categoria per le tue spese.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Nome *</Label>
				<Input id="name" bind:value={name} placeholder="Es. Carburante" required />
			</div>
			<div class="space-y-2">
				<Label for="color">Colore</Label>
				<div class="flex items-center gap-4">
					<Input id="color" type="color" bind:value={color} class="h-10 w-16 p-1" />
					<span class="text-sm text-muted-foreground">{color}</span>
				</div>
			</div>
			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? 'Salvataggio...' : 'Crea Categoria'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
