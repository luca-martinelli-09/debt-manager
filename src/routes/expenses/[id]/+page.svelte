<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { db } from '$lib/db';
	import { page } from '$app/state';
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
	import {
		ArrowLeft,
		Loader2,
		Info,
		Trash2,
		Camera,
		FileText,
		Eye,
		TrendingDown,
		TrendingUp,
		Wallet
	} from '@lucide/svelte';
	import type { SplitType, Split, Expense } from '$lib/types';
	import { onMount } from 'svelte';
	import Tesseract from 'tesseract.js';

	const id = parseInt(page.params.id || '0');
	let title = $state('');
	let amount = $state<number>(0);
	let date = $state('');
	let categoryId = $state<string>('');
	let groupId = $state<string>('');
	let paidById = $state<string>('');
	let splitType = $state<SplitType>('equally');
	let splits = $state<Split[]>([]);
	let attachments = $state<(File | Blob)[]>([]);

	let loading = $state(false);
	let fetching = $state(true);
	let ocrLoading = $state(false);

	// Variabili per il saldo rapido
	let settlingDebtId = $state<string | null>(null);
	let settleAmount = $state<number>(0);

	onMount(async () => {
		const expense = await db.expenses.get(id);
		if (expense) {
			title = expense.title;
			amount = expense.amount;
			date = new Date(expense.date).toISOString().split('T')[0];
			categoryId = expense.categoryId?.toString() || '';
			groupId = expense.groupId?.toString() || '';
			paidById = expense.paidById.toString();
			splitType = expense.splitType;
			splits = expense.splits;
			attachments = expense.attachments || (expense.attachment ? [expense.attachment] : []);
		} else {
			toast.error('Spesa non trovata');
			goto('/expenses');
		}
		fetching = false;
	});

	$effect(() => {
		const cats = categoriesQuery.value || [];
		if (cats.length > 0 && !categoryId && !fetching) {
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

	function handleGroupChange() {
		const gId = groupId ? parseInt(groupId) : null;
		if (gId) {
			const group = groupsQuery.value?.find((g) => g.id === gId);
			if (group) {
				splits = group.memberIds.map((memberId) => ({ contactId: memberId, value: 0 }));
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
					toast.info(`Importo aggiornato: ${val}€`);
				}
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
			await db.expenses.update(id, {
				title,
				amount,
				date: new Date(date),
				categoryId: parseInt(categoryId),
				category: catName,
				groupId: groupId ? parseInt(groupId) : undefined,
				paidById: parseInt(paidById),
				splitType,
				splits: finalSplits,
				attachments: attachments.length > 0 ? [...attachments] : undefined
			});
			toast.success('Spesa aggiornata con successo');
			goto('/expenses');
		} catch (error) {
			toast.error("Errore durante l'aggiornamento");
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function deleteExpense() {
		if (confirm('Sei sicuro di voler eliminare questa spesa?')) {
			try {
				await db.expenses.delete(id);
				toast.success('Spesa eliminata');
				goto('/expenses');
			} catch (e) {
				toast.error("Errore durante l'eliminazione");
			}
		}
	}

	function getContactName(contactId: number) {
		if (userSettings.myContactId && contactId.toString() === userSettings.myContactId) {
			return 'Te (Io)';
		}
		return contactsQuery.value?.find((c) => c.id === contactId)?.name || 'Sconosciuto';
	}

	let computedDebts = $derived.by(() => {
		if (!paidById) return [];
		const payer = parseInt(paidById);
		const debts = [];

		for (const s of splits) {
			if (s.contactId !== payer) {
				let owed = 0;
				if (splitType === 'equally') {
					owed = amount / (splits.length || 1);
				} else if (splitType === 'percentage') {
					owed = (amount * s.value) / 100;
				} else {
					owed = s.value;
				}

				if (owed > 0) {
					debts.push({ from: s.contactId, to: payer, amount: owed });
				}
			}
		}
		return debts;
	});

	function startSettle(debt: { from: number; to: number; amount: number }) {
		settlingDebtId = `${debt.from}-${debt.to}`;
		settleAmount = debt.amount;
	}

	async function settleDebt(from: number, to: number, settleAmt: number) {
		if (settleAmt <= 0) {
			toast.error("L'importo deve essere maggiore di zero");
			return;
		}
		try {
			await db.settlements.add({
				fromContactId: from,
				toContactId: to,
				amount: settleAmt,
				date: new Date(),
				groupId: groupId ? parseInt(groupId) : undefined,
				createdAt: new Date()
			});
			toast.success('Debito saldato con successo');
			settlingDebtId = null;
		} catch (error) {
			toast.error('Errore durante il saldo');
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<Button variant="ghost" href="/expenses">
		<ArrowLeft class="mr-2 h-4 w-4" /> Torna alle spese
	</Button>
	<Button variant="destructive" size="icon" onclick={deleteExpense}>
		<Trash2 class="h-4 w-4" />
	</Button>
</div>

{#if fetching}
	<p class="p-8 text-center">Caricamento...</p>
{:else}
	<div class="mx-auto max-w-2xl">
		<Tabs.Root value="modifica" class="space-y-6">
			<Tabs.List class="grid w-full grid-cols-2">
				<Tabs.Trigger value="modifica">Modifica</Tabs.Trigger>
				<Tabs.Trigger value="saldi">Dettagli & Ripartizioni</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="modifica">
				<Card.Root>
					<Card.Header>
						<Card.Title>Modifica Spesa</Card.Title>
					</Card.Header>
					<Card.Content>
						<form onsubmit={handleSubmit} class="space-y-6">
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="title">Titolo *</Label>
									<Input id="title" bind:value={title} required />
								</div>
								<div class="space-y-2">
									<Label for="amount">Importo (€) *</Label>
									<div class="relative">
										<Input id="amount" type="number" step="0.01" bind:value={amount} required />
										<div class="absolute inset-y-0 right-0 flex items-center pr-3">
											<label
												for="ocr-upload"
												class="cursor-pointer text-muted-foreground hover:text-primary"
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
										<Button variant="outline" href="/categories" title="Gestisci Categorie"
											>+</Button
										>
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
																	class="h-8 w-8"
																	type="button"
																	onclick={() => {
																		attachments = attachments.filter((_, idx) => idx !== i);
																	}}
																>
																	<Trash2 class="h-4 w-4 text-destructive" />
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

							<div class="grid gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="group">Gruppo</Label>
									<select
										id="group"
										bind:value={groupId}
										onchange={handleGroupChange}
										class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									>
										<option value="">Nessuno (1-1)</option>
										{#each groupsQuery.value || [] as group (group.id)}
											<option value={group.id!.toString()}>{group.name}</option>
										{/each}
									</select>
								</div>
								<div class="space-y-2">
									<Label for="payer">Chi ha pagato?</Label>
									<select
										id="payer"
										bind:value={paidById}
										class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									>
										{#each availableContacts as contact (contact.id)}
											<option value={contact.id!.toString()}>{contact.name}</option>
										{/each}
									</select>
								</div>
							</div>

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
															class="text-sm font-medium {isParticipating
																? ''
																: 'text-muted-foreground'}"
														>
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
								{loading ? 'Salvataggio...' : 'Aggiorna Spesa'}
							</Button>
						</form>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="saldi">
				<Card.Root>
					<Card.Header>
						<Card.Title>Chi deve pagare chi per questa spesa</Card.Title>
						<Card.Description
							>Visualizza le ripartizioni del costo e segna un pagamento veloce per chiudere il
							debito di questo scontrino. I pagamenti sono generali.</Card.Description
						>
					</Card.Header>
					<Card.Content>
						{#if computedDebts.length === 0}
							<div
								class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
							>
								<Wallet class="mb-4 h-8 w-8 opacity-50" />
								<p>
									Tutti coloro che hanno partecipato alla spesa hanno già pagato la loro quota
									direttamente o non ci sono debiti sospesi rilevati nella spesa.
								</p>
							</div>
						{:else}
							<div class="space-y-4">
								{#each computedDebts as debt}
									{@const debtId = `${debt.from}-${debt.to}`}
									<div class="rounded-lg border p-4 shadow-sm">
										<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
											<div class="flex items-center gap-3">
												<TrendingUp
													class="h-8 w-8 rounded-full bg-emerald-500/10 p-1.5 text-emerald-500"
												/>
												<div class="text-sm">
													<p>
														<span class="font-bold">{getContactName(debt.from)}</span> deve a
														<span class="font-bold">{getContactName(debt.to)}</span>
													</p>
													<p class="font-bold text-emerald-500">{debt.amount.toFixed(2)}€</p>
												</div>
											</div>

											{#if settlingDebtId !== debtId}
												<Button variant="outline" size="sm" onclick={() => startSettle(debt)}>
													<Wallet class="mr-2 h-4 w-4" /> Paga la sua quota
												</Button>
											{/if}
										</div>

										{#if settlingDebtId === debtId}
											<div
												class="mt-4 flex flex-col gap-3 rounded-md border bg-muted/50 p-4 sm:flex-row sm:items-end"
											>
												<div class="flex-1 space-y-1">
													<Label class="text-xs">Importo da saldare (€)</Label>
													<Input
														type="number"
														step="0.01"
														max={debt.amount}
														min="0.01"
														bind:value={settleAmount}
													/>
												</div>
												<div class="flex gap-2">
													<Button variant="ghost" onclick={() => (settlingDebtId = null)}
														>Annulla</Button
													>
													<Button onclick={() => settleDebt(debt.from, debt.to, settleAmount)}
														>Conferma Pagamento</Button
													>
												</div>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	</div>
{/if}
