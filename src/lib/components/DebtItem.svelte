<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { TrendingDown, TrendingUp, Wallet } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		amount,
		isNegative = false,
		descriptionSnippet,
		onSettle
	} = $props<{
		amount: number;
		isNegative?: boolean;
		descriptionSnippet: Snippet;
		onSettle: (amount: number) => void;
	}>();

	let settling = $state(false);
	let settleAmount = $state(0);

	function startSettle() {
		settleAmount = amount;
		settling = true;
	}
</script>

<div class="rounded-lg border p-4 shadow-sm">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-center gap-3">
			{#if isNegative}
				<TrendingDown class="h-8 w-8 rounded-full bg-destructive/10 p-1.5 text-destructive" />
			{:else}
				<TrendingUp class="h-8 w-8 rounded-full bg-emerald-500/10 p-1.5 text-emerald-500" />
			{/if}
			<div class="text-sm">
				{@render descriptionSnippet()}
			</div>
		</div>

		{#if !settling}
			<Button variant="outline" size="sm" onclick={startSettle}>
				<Wallet class="mr-2 h-4 w-4" />
				{m.settle()}
			</Button>
		{/if}
	</div>

	{#if settling}
		<div
			class="mt-4 flex flex-col gap-3 rounded-md border bg-muted/50 p-4 sm:flex-row sm:items-end"
		>
			<div class="flex-1 space-y-1">
				<Label class="text-xs">{m.amount_to_settle()}</Label>
				<Input type="number" step="0.01" max={amount} min="0.01" bind:value={settleAmount} />
			</div>
			<div class="flex gap-2">
				<Button variant="ghost" onclick={() => (settling = false)}>{m.cancel()}</Button>
				<Button
					onclick={() => {
						onSettle(settleAmount);
						settling = false;
					}}>{m.confirm()}</Button
				>
			</div>
		</div>
	{/if}
</div>
