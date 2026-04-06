<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import type { Contact, Split, SplitType } from '$lib/types';
	import { Info } from '@lucide/svelte';

	let {
		splitType = $bindable(),
		splits = $bindable(),
		amount,
		availableContacts,
		getContactName
	} = $props<{
		splitType: SplitType;
		splits: Split[];
		amount: number;
		availableContacts: Contact[];
		getContactName: (id: number) => string;
	}>();
</script>

<div class="space-y-4">
	<Label>Suddivisione ({splits.length} selezionati)</Label>
	<Tabs.Root bind:value={splitType} class="w-full">
		<Tabs.List class="grid w-full grid-cols-3">
			<Tabs.Trigger value="equally">Equamente</Tabs.Trigger>
			<Tabs.Trigger value="unequally">Quote</Tabs.Trigger>
			<Tabs.Trigger value="percentage">Percentuale</Tabs.Trigger>
		</Tabs.List>

		<div class="mt-4 space-y-4">
			{#if splitType === 'equally'}
				<div class="flex items-center rounded-md bg-muted p-4 text-sm text-muted-foreground">
					<Info class="mr-2 h-4 w-4" />
					La spesa sarà divisa equamente tra le persone spuntate qui sotto ({splits.length > 0
						? (amount / splits.length).toFixed(2)
						: '0.00'}€ a testa).
				</div>
			{/if}

			<div class="space-y-3">
				{#each availableContacts as contact (contact.id)}
					{@const splitIdx = splits.findIndex((s: Split) => s.contactId === contact.id)}
					{@const isParticipating = splitIdx !== -1}
					<div class="flex items-center justify-between gap-4">
						<div class="flex items-center gap-3">
							{#if splitType === 'equally'}
								<Checkbox
									checked={isParticipating}
									onCheckedChange={(v) => {
										if (v) {
											splits = [...splits, { contactId: contact.id!, value: 0 }];
										} else {
											splits = splits.filter((s: Split) => s.contactId !== contact.id);
										}
									}}
								/>
							{/if}
							<span class="text-sm font-medium {isParticipating ? '' : 'text-muted-foreground'}">
								{getContactName(contact.id!)}
							</span>
						</div>

						{#if splitType === 'equally'}
							{#if isParticipating}
								<span class="text-sm font-medium"
									>{(amount / (splits.length || 1)).toFixed(2)}€</span
								>
							{:else}
								<span class="text-sm text-muted-foreground">0.00€</span>
							{/if}
						{:else if splitType === 'unequally'}
							<div class="relative w-32">
								<Input
									type="number"
									step="0.01"
									value={isParticipating ? splits[splitIdx].value : 0}
									oninput={(e) => {
										const val = parseFloat(e.currentTarget.value) || 0;
										if (isParticipating) {
											splits = splits.map((s: Split) =>
												s.contactId === contact.id ? { ...s, value: val } : s
											);
										} else if (val > 0) {
											splits = [...splits, { contactId: contact.id!, value: val }];
										}
									}}
									class="pr-6 text-right"
								/>
								<span
									class="absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground"
									>€</span
								>
							</div>
						{:else if splitType === 'percentage'}
							<div class="relative w-32">
								<Input
									type="number"
									step="1"
									value={isParticipating ? splits[splitIdx].value : 0}
									oninput={(e) => {
										const val = parseFloat(e.currentTarget.value) || 0;
										if (isParticipating) {
											splits = splits.map((s: Split) =>
												s.contactId === contact.id ? { ...s, value: val } : s
											);
										} else if (val > 0) {
											splits = [...splits, { contactId: contact.id!, value: val }];
										}
									}}
									class="pr-6 text-right"
								/>
								<span
									class="absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground"
									>%</span
								>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</Tabs.Root>
</div>
