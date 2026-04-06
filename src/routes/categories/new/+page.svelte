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
	let color = $state('#64748b');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error(m.name_required());
			return;
		}

		loading = true;
		try {
			await db.categories.add({ id: uuidv7(), name, color, createdAt: new Date() });
			toast.success(m.category_created());
			goto('/categories');
		} catch (error) {
			toast.error(m.category_create_error());
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

<Card.Root class="mx-auto max-w-lg">
	<Card.Header>
		<Card.Title>{m.new_category()}</Card.Title>
		<Card.Description>{m.add_category_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-2">
				<Label for="name">{m.name()} *</Label>
				<Input id="name" bind:value={name} placeholder={m.example_fuel()} required />
			</div>
			<div class="space-y-2">
				<Label for="color">{m.color()}</Label>
				<div class="flex items-center gap-4">
					<Input id="color" type="color" bind:value={color} class="h-10 w-16 p-1" />
					<span class="text-sm text-muted-foreground">{color}</span>
				</div>
			</div>
			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? m.saving() : m.create_category()}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
