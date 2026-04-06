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
	import { ChevronLeft } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { onMount } from 'svelte';

	const expenseId = parseInt(page.params.id);
	let isLoading = $state(true);

	const superform = superForm(defaults(zod4(expenseSchema)), {
		SPA: true,
		dataType: 'json',
		validators: zod4(expenseSchema),
		onUpdate: async ({ form }) => {
			if (!form.valid) return;

			const data = form.data;
			await db.transaction('rw', [db.expenses, db.expenseSplits], async () => {
				await db.expenses.update(expenseId, {
					title: data.title,
					amount: data.amount,
					date: new Date(data.date),
					groupId: data.groupId,
					paidBy: data.paidBy
				});

				// Aggiorna split: cancella e riaggiungi
				await db.expenseSplits.where('expenseId').equals(expenseId).delete();

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

	const { form, enhance, reset } = superform;


	onMount(async () => {
		const expense = await db.expenses.get(expenseId);
		if (!expense) {
			goto('/expenses');
			return;
		}

		const splits = await db.expenseSplits.where('expenseId').equals(expenseId).toArray();
		
		// Determina il tipo di split (semplificato)
		const firstShare = splits[0]?.shareAmount || 0;
		const isAllEqual = splits.every(s => Math.abs(s.shareAmount - firstShare) < 0.01);

		const customAmounts: Record<string, number> = {};
		splits.forEach(s => {
			customAmounts[s.contactId.toString()] = s.shareAmount;
		});

		form.set({
			id: expense.id,
			title: expense.title,
			amount: expense.amount,
			date: expense.date.toISOString().split('T')[0],
			groupId: expense.groupId,
			paidBy: expense.paidBy,
			splitType: isAllEqual ? 'equal' : 'absolute',
			participants: splits.map(s => s.contactId),
			customAmounts
		});
		
		isLoading = false;
	});

	let groupMembers = $derived.by(() => {
		if (!$form.groupId) return appState.contacts;
		return appState.contacts; 
	});

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
		<h1 class="text-2xl font-bold">Modifica Spesa</h1>
	</div>

	{#if isLoading}
		<p>Caricamento...</p>
	{:else}
		<form use:enhance class="grid gap-6">
			<Form.Field form={superform} name="title">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Cosa hai pagato?</Form.Label>
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
							{#each appState.contacts as contact}
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

			<Button class="mt-4 w-full" size="lg" type="submit">Salva Modifiche</Button>
		</form>
	{/if}
</div>
