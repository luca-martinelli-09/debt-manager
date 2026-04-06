<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { db, type Contact } from '$lib/db';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { goto } from '$app/navigation';
	import { Receipt, Camera, User, Users } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import Tesseract from 'tesseract.js';

	let title = $state('');
	let amount = $state<number>(0);
	let date = $state(new Date().toISOString().split('T')[0]);
	let groupId = $state<string>('none');
	let paidBy = $state<number | null>(null);

	let splitType = $state<'equal' | 'absolute' | 'percentage'>('equal');
	let participants = $state<number[]>([]);
	let customAmounts = $state<Record<number, number>>({});
	let isScanning = $state(false);

	async function handleScan(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		isScanning = true;
		const file = input.files[0];
		
		try {
			const { data: { text } } = await Tesseract.recognize(file, 'ita+eng');
			
			// Semplice euristica per trovare l'importo totale
			// Cerchiamo pattern come "TOTALE", "TOTAL", "EUR", "€" seguiti da numeri
			const lines = text.split('\n');
			for (const line of lines) {
				const match = line.match(/(?:TOTALE|TOTAL|EUR|€)\s*[:=]?\s*(\d+[.,]\d{2})/i);
				if (match) {
					amount = parseFloat(match[1].replace(',', '.'));
					break;
				}
			}
			
			// Se non troviamo il totale, cerchiamo il numero più alto che sembra un prezzo
			if (amount === 0) {
				const prices = text.match(/\d+[.,]\d{2}/g);
				if (prices) {
					const numericPrices = prices.map(p => parseFloat(p.replace(',', '.')));
					amount = Math.max(...numericPrices);
				}
			}

			if (title === '') {
				// Prova a prendere la prima riga come titolo (spesso è il nome del negozio)
				title = lines[0].trim();
			}
		} catch (err) {
			console.error('OCR Error:', err);
		} finally {
			isScanning = false;
		}
	}

	// Caricamento membri del gruppo selezionato
	let groupMembers = $derived.by(() => {
		if (groupId === 'none') return appState.contacts;
		const gid = parseInt(groupId);
		// In un'app reale, useremmo una query Dexie reattiva per i membri.
		// Per semplicità qui simuliamo filtrando se avessimo i dati pronti nello stato.
		// Ma Dexie è asincrono. Usiamo un effetto o un derivato asincrono.
		return appState.contacts; // Placeholder: dovremmo caricare i membri effettivi del gruppo
	});

	$effect(() => {
		// Reset partecipanti quando cambia il gruppo
		participants = groupMembers.map((m) => m.id!);
	});

	async function saveExpense() {
		if (!title || !amount || !paidBy) return;

		const gid = groupId === 'none' ? null : parseInt(groupId);
		const expenseId = (await db.expenses.add({
			title,
			amount,
			date: new Date(date),
			groupId: gid,
			paidBy: paidBy!
		})) as number;

		// Salva i split
		if (splitType === 'equal') {
			const share = amount / participants.length;
			for (const pid of participants) {
				await db.expenseSplits.add({
					expenseId,
					contactId: pid,
					shareAmount: share
				});
			}
		} else if (splitType === 'absolute') {
			for (const pid of participants) {
				await db.expenseSplits.add({
					expenseId,
					contactId: pid,
					shareAmount: customAmounts[pid] || 0
				});
			}
		}

		goto('/expenses');
	}

	function toggleParticipant(id: number) {
		if (participants.includes(id)) {
			participants = participants.filter((p) => p !== id);
		} else {
			participants = [...participants, id];
		}
	}
</script>

<div class="mx-auto max-w-lg">
	<div class="mb-6 flex items-center gap-4">
		<Button variant="ghost" size="icon" onclick={() => history.back()}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-chevron-left"
				><path d="m15 18-6-6 6-6" /></svg
			>
		</Button>
		<h1 class="text-2xl font-bold">Nuova Spesa</h1>
	</div>

	<div class="grid gap-6">
		<div class="grid gap-2">
			<div class="flex items-center justify-between">
				<Label for="title">Cosa hai pagato?</Label>
				<div class="relative">
					<input type="file" accept="image/*" capture="environment" onchange={handleScan} class="absolute inset-0 cursor-pointer opacity-0" disabled={isScanning} />
					<Button variant="outline" size="sm" class="gap-2" disabled={isScanning}>
						<Camera class="h-4 w-4" />
						{isScanning ? 'Scansione...' : 'Scansiona Scontrino'}
					</Button>
				</div>
			</div>
			<Input id="title" bind:value={title} placeholder="Esempio: Pizza, Affitto, Spesa..." />
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div class="grid gap-2">
				<Label for="amount">Importo</Label>
				<div class="relative">
					<span class="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">€</span>
					<Input id="amount" type="number" bind:value={amount} class="pl-7" placeholder="0.00" />
				</div>
			</div>
			<div class="grid gap-2">
				<Label for="date">Data</Label>
				<Input id="date" type="date" bind:value={date} />
			</div>
		</div>

		<div class="grid gap-2">
			<Label>Pagato da</Label>
			<div class="flex flex-wrap gap-2">
				{#each appState.contacts as contact}
					<button
						class="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors {paidBy ===
						contact.id
							? 'bg-primary border-primary text-primary-foreground'
							: 'bg-background hover:bg-muted'}"
						onclick={() => (paidBy = contact.id!)}
					>
						<Avatar.Root class="h-5 w-5">
							<Avatar.Fallback class="text-[8px]">{contact.name[0].toUpperCase()}</Avatar.Fallback>
						</Avatar.Root>
						{contact.name}
					</button>
				{/each}
			</div>
		</div>

		<div class="grid gap-2">
			<Label>Gruppo</Label>
			<select
				bind:value={groupId}
				class="bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<option value="none">Nessun Gruppo (1-1)</option>
				{#each appState.groups as group}
					<option value={group.id?.toString()}>{group.name}</option>
				{/each}
			</select>
		</div>

		<div class="grid gap-4 border-t pt-4">
			<div class="flex items-center justify-between">
				<Label class="text-lg font-semibold">Divisa tra:</Label>
				<div class="flex gap-2">
					<Button
						variant={splitType === 'equal' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (splitType = 'equal')}>Equa</Button
					>
					<Button
						variant={splitType === 'absolute' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (splitType = 'absolute')}>Custom</Button
					>
				</div>
			</div>

			<div class="grid gap-2">
				{#each groupMembers as member}
					<div class="flex items-center justify-between py-1">
						<div class="flex items-center gap-2">
							<Checkbox
								id="p-{member.id}"
								checked={participants.includes(member.id!)}
								onCheckedChange={() => toggleParticipant(member.id!)}
							/>
							<Label for="p-{member.id}" class="flex items-center gap-2 cursor-pointer">
								<Avatar.Root class="h-6 w-6">
									<Avatar.Fallback class="text-[10px]">{member.name[0].toUpperCase()}</Avatar.Fallback>
								</Avatar.Root>
								{member.name}
							</Label>
						</div>
						{#if splitType === 'equal'}
							<div class="text-muted-foreground text-sm">
								{#if participants.includes(member.id!)}
									€ {(amount / participants.length || 0).toFixed(2)}
								{:else}
									€ 0.00
								{/if}
							</div>
						{:else}
							<div class="relative w-24">
								<span class="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">€</span>
								<Input
									type="number"
									class="h-8 pl-5 text-right text-xs"
									bind:value={customAmounts[member.id!]}
									disabled={!participants.includes(member.id!)}
								/>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<Button class="mt-4 w-full" size="lg" onclick={saveExpense}>Salva Spesa</Button>
	</div>
</div>
