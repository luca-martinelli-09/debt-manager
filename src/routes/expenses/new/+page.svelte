<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { db } from '$lib/db';
	import { contactsQuery, groupsQuery, categoriesQuery } from '$lib/db.svelte';
	import { userSettings } from '$lib/settings.svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { toast } from 'svelte-sonner';
	import { ArrowLeft, Camera, Loader2, Info, FileText, Eye, Trash2 } from '@lucide/svelte';
	import type { SplitType, Split } from '$lib/types';
	import Tesseract from 'tesseract.js';

	let title = $state('');
	let amount = $state<number>(0);
	let date = $state(new Date().toISOString().split('T')[0]);
	let categoryId = $state<string>('');
	let groupId = $state<string>('');
	let paidById = $state<string>('');
	let splitType = $state<SplitType>('equally');
	let splits = $state<Split[]>([]);
	let attachments = $state<(File | Blob)[]>([]);

	let loading = $state(false);
	let ocrLoading = $state(false);
	let isFirstLoad = $state(true);

	$effect(() => {
		const cats = categoriesQuery.value || [];
		if (cats.length > 0 && !categoryId) {
			categoryId = cats[0].id!.toString();
		}
	});

	let availableContacts = $derived.by(() => {
		const contacts = contactsQuery.value || [];
		const gId = groupId ? parseInt(groupId) : null;
		if (gId) {
			const group = groupsQuery.value?.find((g) => g.id === gId);
			if (group) {
				return contacts.filter((c) => group.memberIds.includes(c.id!));
			}
		}
		return contacts;
	});

	// Inizializza gli split la prima volta che i contatti sono pronti
	$effect(() => {
		if (isFirstLoad && contactsQuery.value && contactsQuery.value.length > 0) {
			isFirstLoad = false;
			splits = contactsQuery.value.map((c) => ({ contactId: c.id!, value: 0 }));
			if (!paidById) {
				const myId = userSettings.myContactId;
				paidById =
					myId && contactsQuery.value.some((c) => c.id?.toString() === myId)
						? myId
						: contactsQuery.value[0].id!.toString();
			}
		}
	});

	function handleGroupChange() {
		const gId = groupId ? parseInt(groupId) : null;
		if (gId) {
			const group = groupsQuery.value?.find((g) => g.id === gId);
			if (group) {
				splits = group.memberIds.map((id) => ({ contactId: id, value: 0 }));
				if (!paidById || !group.memberIds.includes(parseInt(paidById))) {
					const myId = userSettings.myContactId ? parseInt(userSettings.myContactId) : null;
					paidById =
						myId && group.memberIds.includes(myId)
							? myId.toString()
							: group.memberIds[0].toString();
				}
			}
		} else {
			const contacts = contactsQuery.value || [];
			splits = contacts.map((c) => ({ contactId: c.id!, value: 0 }));
			const myId = userSettings.myContactId;
			if (!paidById || !contacts.some((c) => c.id?.toString() === paidById)) {
				paidById =
					myId && contacts.some((c) => c.id?.toString() === myId)
						? myId
						: contacts[0].id!.toString();
			}
		}
	}

	async function handleOCR(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		attachments = [...attachments, file];
		ocrLoading = true;
		try {
			const {
				data: { text }
			} = await Tesseract.recognize(file, 'ita+eng');
			const amountMatch = text.match(/(?:TOTALE|TOTAL|EUR|€)\s*(\d+[.,]\d{2})/i);
			if (amountMatch) {
				const val = parseFloat(amountMatch[1].replace(',', '.'));
				if (!isNaN(val)) {
					amount = val;
					toast.info(`Importo rilevato dall'OCR: ${val}€`);
				}
			}
			const lines = text.split('\n').filter((l) => l.trim().length > 3);
			if (lines.length > 0) {
				title = lines[0].trim();
			}
		} catch (error) {
			console.error(error);
			toast.error('Errore durante la scansione dello scontrino');
		} finally {
			ocrLoading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title || !amount || !paidById) {
			toast.error('Compila tutti i campi obbligatori');
			return;
		}

		if (splits.length === 0) {
			toast.error('Seleziona almeno un partecipante per la divisione');
			return;
		}

		const finalSplits = splits.map((s) => {
			if (splitType === 'equally') {
				return { contactId: s.contactId, value: amount / splits.length };
			}
			return { contactId: s.contactId, value: s.value };
		});

		if (splitType === 'unequally') {
			const sum = finalSplits.reduce((acc, s) => acc + s.value, 0);
			if (Math.abs(sum - amount) > 0.01) {
				toast.error(
					`La somma delle quote (${sum.toFixed(2)}€) deve essere uguale all'importo totale (${amount}€)`
				);
				return;
			}
		} else if (splitType === 'percentage') {
			const sum = finalSplits.reduce((acc, s) => acc + s.value, 0);
			if (Math.abs(sum - 100) > 0.01) {
				toast.error(`La somma delle percentuali (${sum}%) deve essere 100%`);
				return;
			}
		}

		loading = true;
		try {
			const catName =
				categoriesQuery.value?.find((c) => c.id === parseInt(categoryId))?.name || 'Generale';
			await db.expenses.add({
				title,
				amount,
				date: new Date(date),
				categoryId: parseInt(categoryId),
				category: catName,
				groupId: groupId ? parseInt(groupId) : undefined,
				paidById: parseInt(paidById),
				splitType,
				splits: finalSplits,
				attachments: attachments.length > 0 ? [...attachments] : undefined,
				createdAt: new Date()
			});
			toast.success('Spesa aggiunta con successo');
			goto('/expenses');
		} catch (error) {
			toast.error('Errore durante il salvataggio della spesa');
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6">
	<Button variant="ghost" href="/expenses">
		<ArrowLeft class="mr-2 h-4 w-4" /> Torna alle spese
	</Button>
</div>

<div class="mx-auto max-w-2xl">
	<Card.Root>
		<Card.Header>
			<Card.Title>Nuova Spesa</Card.Title>
			<Card.Description>Aggiungi una spesa e dividila con i tuoi amici.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Title & Amount -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="title">Titolo *</Label>
						<Input id="title" bind:value={title} placeholder="Es. Cena Sushi" required />
					</div>
					<div class="space-y-2">
						<Label for="amount">Importo (€) *</Label>
						<div class="relative">
							<Input
								id="amount"
								type="number"
								step="0.01"
								bind:value={amount}
								placeholder="0.00"
								required
							/>
							<div class="absolute inset-y-0 right-0 flex items-center pr-3">
								<label
									for="ocr-upload"
									class="cursor-pointer text-muted-foreground hover:text-primary"
									title="Scansiona scontrino con OCR"
								>
									{#if ocrLoading}
										<Loader2 class="h-4 w-4 animate-spin" />
									{:else}
										<Camera class="h-4 w-4" />
									{/if}
									<input
										id="ocr-upload"
										type="file"
										accept="image/*"
										class="hidden"
										onchange={handleOCR}
									/>
								</label>
							</div>
						</div>
					</div>
				</div>

				<!-- Date & Category -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="date">Data</Label>
						<Input id="date" type="date" bind:value={date} />
					</div>
					<div class="space-y-2">
						<Label for="category">Categoria</Label>
						<div class="flex gap-2">
							<select
								id="category"
								bind:value={categoryId}
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:outline-none"
								required
							>
								{#each categoriesQuery.value || [] as cat (cat.id)}
									<option value={cat.id!.toString()}>{cat.name}</option>
								{/each}
							</select>
							<Button variant="outline" href="/categories" title="Gestisci Categorie">+</Button>
						</div>
					</div>
				</div>

				<!-- Allegati -->
				<div class="space-y-3">
					<Label>Allegati (Scontrini/Ricevute)</Label>
					<Input
						type="file"
						multiple
						accept="image/*,application/pdf"
						onchange={(e) => {
							const target = e.target as HTMLInputElement;
							if (target.files && target.files.length > 0) {
								attachments = [...attachments, ...Array.from(target.files)];
							}
						}}
					/>
					{#if attachments.length > 0}
						<div class="rounded-md border">
							<table class="w-full text-sm">
								<tbody>
									{#each attachments as att, i}
										<tr class="border-b last:border-0 hover:bg-muted/50">
											<td class="p-2">
												<div class="flex items-center gap-2">
													<FileText class="h-4 w-4 shrink-0 text-muted-foreground" />
													<span class="block max-w-[200px] truncate sm:max-w-xs">
														{att instanceof File ? att.name : 'Allegato ' + (i + 1)}
													</span>
												</div>
											</td>
											<td class="w-[100px] p-2 text-right">
												<div class="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8"
														type="button"
														onclick={() => {
															const url = URL.createObjectURL(att);
															window.open(url, '_blank');
														}}
													>
														<Eye class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-destructive"
														type="button"
														onclick={() => {
															attachments = attachments.filter((_, idx) => idx !== i);
														}}
													>
														<Trash2 class="h-4 w-4" />
													</Button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<!-- Group & Payer -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="group">Gruppo (opzionale)</Label>
						<select
							id="group"
							bind:value={groupId}
							onchange={handleGroupChange}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:outline-none"
						>
							<option value="">Nessuno (1-1)</option>
							{#each groupsQuery.value || [] as group (group.id)}
								<option value={group.id!.toString()}>{group.name}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="payer">Chi ha pagato? *</Label>
						<select
							id="payer"
							bind:value={paidById}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:outline-none"
							required
						>
							{#each availableContacts as contact (contact.id)}
								<option value={contact.id!.toString()}>{contact.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Splitting Logic -->
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
								<div
									class="flex items-center rounded-md bg-muted p-4 text-sm text-muted-foreground"
								>
									<Info class="mr-2 h-4 w-4" />
									La spesa sarà divisa equamente tra le persone spuntate qui sotto ({splits.length >
									0
										? (amount / splits.length).toFixed(2)
										: '0.00'}€ a testa).
								</div>
							{/if}

							<div class="space-y-3">
								{#each availableContacts as contact (contact.id)}
									{@const splitIdx = splits.findIndex((s) => s.contactId === contact.id)}
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
															splits = splits.filter((s) => s.contactId !== contact.id);
														}
													}}
												/>
											{/if}
											<span
												class="text-sm font-medium {isParticipating ? '' : 'text-muted-foreground'}"
											>
												{contact.name}
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
															splits = splits.map((s) =>
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
															splits = splits.map((s) =>
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

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Salvataggio...' : 'Aggiungi Spesa'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
