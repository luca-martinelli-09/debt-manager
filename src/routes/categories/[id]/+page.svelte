<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { db } from '$lib/db';
	import { ArrowLeft } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const id = page.params.id || '';
	let name = $state('');
	let color = $state('#64748b');
	let loading = $state(false);
	let fetching = $state(true);

	onMount(async () => {
		const cat = await db.categories.get(id);
		if (cat) {
			name = cat.name;
			color = cat.color || '#64748b';
		} else {
			toast.error(m.category_not_found());
			goto('/categories');
		}
		fetching = false;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error(m.name_required());
			return;
		}

		loading = true;
		try {
			await db.categories.update(id, {
				name,
				color
			});
			toast.success(m.category_updated());
			goto('/categories');
		} catch (error) {
			toast.error(m.update_error());
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6">
	<Button variant="ghost" href="/categories">
		<ArrowLeft class="mr-2 h-4 w-4" />{m.back_to_categories_btn()}</Button
	>
</div>

{#if fetching}
	<p class="p-8 text-center">{m.loading()}</p>
{:else}
	<Card.Root class="mx-auto max-w-lg">
		<Card.Header>
			<Card.Title>{m.edit_category()}</Card.Title>
			<Card.Description>{m.edit_category_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit} class="space-y-4">
				<div class="space-y-2">
					<Label for="name">{m.name()} *</Label>
					<Input id="name" bind:value={name} required />
				</div>
				<div class="space-y-2">
					<Label for="color">{m.color()}</Label>
					<div class="flex items-center gap-4">
						<Input id="color" type="color" bind:value={color} class="h-10 w-16 p-1" />
						<span class="text-sm text-muted-foreground">{color}</span>
					</div>
				</div>
				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? m.saving() : m.update_category()}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
{/if}
