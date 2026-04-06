<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { db } from '$lib/db';
	import { categoriesQuery } from '$lib/db.svelte';
	import { Edit, Plus, Tag, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	async function deleteCategory(id: string) {
		if (confirm(m.delete_category_confirm())) {
			try {
				await db.categories.delete(id);
				toast.success(m.category_deleted());
			} catch (e) {
				toast.error(m.delete_error());
			}
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">{m.nav_categories()}</h1>
	<Button href="/categories/new">
		<Plus class="mr-2 h-4 w-4" />{m.new_category()}</Button
	>
</div>

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>{m.color()}</Table.Head>
				<Table.Head>{m.name()}</Table.Head>
				<Table.Head>{m.creation_date()}</Table.Head>
				<Table.Head class="text-right">{m.actions()}</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if !categoriesQuery.value || categoriesQuery.value.length === 0}
				<Table.Row>
					<Table.Cell colspan={4} class="h-24 text-center">{m.no_categories()}</Table.Cell>
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
