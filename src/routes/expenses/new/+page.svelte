<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { db } from '$lib/db';
	import { expenseSchema } from '$lib/schemas';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import * as Form from '$lib/components/ui/form';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Camera, ChevronLeft } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import Tesseract from 'tesseract.js';

	let isScanning = $state(false);

	const initialGroupId = page.url.searchParams.get('groupId');
	
	const superform = superForm(defaults({
		date: new Date().toISOString().split('T')[0],
		groupId: initialGroupId ? parseInt(initialGroupId) : null,
		splitType: 'equal',
		participants: appState.contacts.map(c => c.id!),
		customAmounts: {}
	}, zod4(expenseSchema)), {
		SPA: true,
		dataType: 'json',
		validators: zod4(expenseSchema),

		onUpdate: async ({ form }) => {
			if (!form.valid) return;
			
			const data = form.data;
			await db.transaction('rw', [db.expenses, db.expenseSplits], async () => {
				const expenseId = (await db.expenses.add({
					title: data.title,
					amount: data.amount,
					date: new Date(data.date),
					groupId: data.groupId,
					paidBy: data.paidBy
				})) as number;

				if (data.splitType === 'equal') {
					const share = data.amount / data.participants.length;
					for (const pid of data.participants) {
						await db.expenseSplits.add({
							expenseId,
							contactId: pid,
							shareAmount: share
						});
					}
				} else if (data.splitType === 'absolute' && data.customAmounts) {
					for (const pid of data.participants) {
						await db.expenseSplits.add({
							expenseId,
							contactId: pid,
							shareAmount: data.customAmounts[pid.toString()] || 0
						});
					}
				}
			});

			goto('/expenses');
		}
	});

	const { form, enhance, reset, validate } = superform;

	// Caricamento reattivo dei membri del gruppo selezionato
	let groupMemberIds = $state<number[]>([]);

	$effect(() => {
		if ($form.groupId) {
			db.groupMembers.where('groupId').equals($form.groupId).toArray().then(members => {
				groupMemberIds = members.map(m => m.contactId);
				// Reset partecipanti se non sono nel nuovo gruppo
				$form.participants = $form.participants.filter(id => groupMemberIds.includes(id));
				if ($form.participants.length === 0) {
					$form.participants = [...groupMemberIds];
				}
			});
		} else {
			groupMemberIds = appState.contacts.map(c => c.id!);
		}
	});

	let groupMembers = $derived(
		$form.groupId 
			? appState.contacts.filter(c => groupMemberIds.includes(c.id!))
			: appState.contacts
	);

	async function handleScan(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		isScanning = true;
		const file = input.files[0];
		
		try {
			const { data: { text } } = await Tesseract.recognize(file, 'ita+eng');
			const lines = text.split('\n');
			
			for (const line of lines) {
				const match = line.match(/(?:TOTALE|TOTAL|EUR|€)\s*[:=]?\s*(\d+[.,]\d{2})/i);
				if (match) {
					$form.amount = parseFloat(match[1].replace(',', '.'));
					break;
				}
			}
			
			if ($form.amount === 0) {
				const prices = text.match(/\d+[.,]\d{2}/g);
				if (prices) {
					const numericPrices = prices.map(p => parseFloat(p.replace(',', '.')));
					$form.amount = Math.max(...numericPrices);
				}
			}

			if (!$form.title) {
				$form.title = lines[0].trim();
			}
		} catch (err) {
			console.error('OCR Error:', err);
		} finally {
			isScanning = false;
		}
	}

	function toggleParticipant(id: number) {
		if ($form.participants.includes(id)) {
			$form.participants = $form.participants.filter((p) => p !== id);
		} else {
			$form.participants = [...$form.participants, id];
		}
	}
</script>

<div class="mx-auto max-w-lg">
	<div class="mb-6 flex items-center gap-4">
		<Button variant="ghost" size="icon" onclick={() => history.back()}>
			<ChevronLeft class="h-6 w-6" />
		</Button>
		<h1 class="text-2xl font-bold">Nuova Spesa</h1>
	</div>

	<form use:enhance class="grid gap-6">
		<Form.Field form={superform} name="title">
			<Form.Control>
				{#snippet children({ props })}
					<div class="flex items-center justify-between mb-2">
						<Form.Label>Cosa hai pagato?</Form.Label>
						<div class="relative">
							<input type="file" accept="image/*" capture="environment" onchange={handleScan} class="absolute inset-0 cursor-pointer opacity-0" disabled={isScanning} />
							<Button variant="outline" size="sm" class="gap-2" disabled={isScanning}>
								<Camera class="h-4 w-4" />
								{isScanning ? 'Scansione...' : 'Scansiona'}
							</Button>
						</div>
					</div>
					<Input {...props} bind:value={$form.title} placeholder="Esempio: Pizza, Affitto, Spesa..." />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<div class="grid grid-cols-2 gap-4">
			<Form.Field form={superform} name="amount">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Importo</Form.Label>
						<div class="relative">
							<span class="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">€</span>
							<Input {...props} type="number" step="0.01" bind:value={$form.amount} class="pl-7" placeholder="0.00" />
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field form={superform} name="date">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Data</Form.Label>
						<Input {...props} type="date" bind:value={$form.date} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
		</div>

		<Form.Field form={superform} name="paidBy">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Pagato da</Form.Label>
					<div class="flex flex-wrap gap-2">
						{#each groupMembers as contact}
							<button
								type="button"
								class="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors {$form.paidBy ===
								contact.id
									? 'bg-primary border-primary text-primary-foreground'
									: 'bg-background hover:bg-muted'}"
								onclick={() => ($form.paidBy = contact.id!)}
							>
								<Avatar.Root class="h-5 w-5">
									<Avatar.Fallback class="text-[8px]">{contact.name[0].toUpperCase()}</Avatar.Fallback>
								</Avatar.Root>
								{contact.name}
							</button>
						{/each}
					</div>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<Form.Field form={superform} name="groupId">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Gruppo</Form.Label>
					<select
						bind:value={$form.groupId}
						class="bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value={null}>Nessun Gruppo (1-1)</option>
						{#each appState.groups as group}
							<option value={group.id}>{group.name}</option>
						{/each}
					</select>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<div class="grid gap-4 border-t pt-4">
			<div class="flex items-center justify-between">
				<Label class="text-lg font-semibold">Divisa tra:</Label>
				<div class="flex gap-2">
					<Button
						type="button"
						variant={$form.splitType === 'equal' ? 'default' : 'outline'}
						size="sm"
						onclick={() => ($form.splitType = 'equal')}>Equa</Button
					>
					<Button
						type="button"
						variant={$form.splitType === 'absolute' ? 'default' : 'outline'}
						size="sm"
						onclick={() => ($form.splitType = 'absolute')}>Custom</Button
					>
				</div>
			</div>

			<div class="grid gap-2">
				{#each groupMembers as member}
					<div class="flex items-center justify-between py-1">
						<div class="flex items-center gap-2">
							<Checkbox
								id="p-{member.id}"
								checked={$form.participants.includes(member.id!)}
								onCheckedChange={() => toggleParticipant(member.id!)}
							/>
							<Label for="p-{member.id}" class="flex items-center gap-2 cursor-pointer">
								<Avatar.Root class="h-6 w-6">
									<Avatar.Fallback class="text-[10px]">{member.name[0].toUpperCase()}</Avatar.Fallback>
								</Avatar.Root>
								{member.name}
							</Label>
						</div>
						{#if $form.splitType === 'equal'}
							<div class="text-muted-foreground text-sm">
								{#if $form.participants.includes(member.id!)}
									€ {($form.amount / $form.participants.length || 0).toFixed(2)}
								{:else}
									€ 0.00
								{/if}
							</div>
						{:else}
							<div class="relative w-24">
								<span class="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">€</span>
								<Input
									type="number"
									step="0.01"
									class="h-8 pl-5 text-right text-xs"
									bind:value={$form.customAmounts[member.id!.toString()]}
									disabled={!$form.participants.includes(member.id!)}
								/>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<Button class="mt-4 w-full" size="lg" type="submit">Salva Spesa</Button>
	</form>
</div>
