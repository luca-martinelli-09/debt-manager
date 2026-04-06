<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AttachmentEditor from '$lib/components/AttachmentEditor.svelte';
	import DebtItem from '$lib/components/DebtItem.svelte';
	import SplitEditor from '$lib/components/SplitEditor.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { db } from '$lib/db';
	import { categoriesQuery, contactsQuery, groupsQuery } from '$lib/db.svelte';
	import { userSettings } from '$lib/settings.svelte';
	import type { Split, SplitType } from '$lib/types';
	import { ArrowLeft, Camera, Loader2, Trash2, Wallet } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
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
		const name = contactsQuery.value?.find((c) => c.id === contactId)?.name || 'Sconosciuto';

		if (userSettings.myContactId && contactId.toString() === userSettings.myContactId) {
			return name + ' (Tu)';
		}
		return name;
	}

	let computedDebts = $derived.by(() => {
		if (!paidById) return [];
		const payer = parseInt(paidById);
		const debts = [];

		for (const s of splits) {
			if (s.contactId !== payer) {
				let owed;
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
							<AttachmentEditor bind:attachments />

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

							<!-- Splitting Logic -->
							<SplitEditor
								bind:splitType
								bind:splits
								{amount}
								{availableContacts}
								{getContactName}
							/>

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
									<DebtItem
										amount={debt.amount}
										isNegative={false}
										onSettle={(amt) => settleDebt(debt.from, debt.to, amt)}
									>
										{#snippet descriptionSnippet()}
											<p>
												<span class="font-bold">{getContactName(debt.from)}</span> deve a
												<span class="font-bold">{getContactName(debt.to)}</span>
											</p>
											<p class="font-bold text-emerald-500">{debt.amount.toFixed(2)}€</p>
										{/snippet}
									</DebtItem>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	</div>
{/if}
