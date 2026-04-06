<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { db } from '$lib/db';
	import { categoriesQuery } from '$lib/db.svelte';
	import { Edit, Plus, Tag, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	async function deleteCategory(id: number) {
		if (confirm('Sei sicuro di voler eliminare questa categoria?')) {
			try {
				await db.categories.delete(id);
				toast.success('Categoria eliminata');
			} catch (e) {
				toast.error("Errore durante l'eliminazione");
			}
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">Categorie</h1>
	<Button href="/categories/new">
		<Plus class="mr-2 h-4 w-4" /> Nuova Categoria
	</Button>
</div>

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Colore</Table.Head>
				<Table.Head>Nome</Table.Head>
				<Table.Head>Data Creazione</Table.Head>
				<Table.Head class="text-right">Azioni</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if !categoriesQuery.value || categoriesQuery.value.length === 0}
				<Table.Row>
					<Table.Cell colspan={4} class="h-24 text-center">Nessuna categoria trovata.</Table.Cell>
				</Table.Row>
			{:else}
				{#each categoriesQuery.value as cat (cat.id)}
					<Table.Row>
						<Table.Cell>
							<div
								class="h-6 w-6 rounded-full border"
								style="background-color: {cat.color || '#ccc'}"
							></div>
						</Table.Cell>
						<Table.Cell class="font-medium">
							<div class="flex items-center">
								<Tag class="mr-2 h-4 w-4 text-muted-foreground" />
								{cat.name}
							</div>
						</Table.Cell>
						<Table.Cell>{new Date(cat.createdAt).toLocaleDateString()}</Table.Cell>
						<Table.Cell class="text-right">
							<div class="flex justify-end gap-2">
								<Button variant="ghost" size="icon" href="/categories/{cat.id}">
									<Edit class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" onclick={() => deleteCategory(cat.id!)}>
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
