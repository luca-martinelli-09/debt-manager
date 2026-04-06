<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { uuidv7 } from 'uuidv7';
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

	const id = page.params.id || '';
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
			toast.error(m.expense_not_found());
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
		const gId = groupId ? groupId : null;
		if (gId) {
			const group = groupsQuery.value?.find((g) => g.id === gId);
			if (group) {
				return contacts.filter((c) => group.memberIds.includes(c.id!));
			}
		}
		return contacts;
	});

	function handleGroupChange() {
		const gId = groupId ? groupId : null;
		if (gId) {
			const group = groupsQuery.value?.find((g) => g.id === gId);
			if (group) {
				splits = group.memberIds.map((memberId) => ({ contactId: memberId, value: 0 }));
				if (!paidById || !group.memberIds.includes(paidById)) {
					const myId = userSettings.myContactId ? userSettings.myContactId : null;
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
					toast.info(`\${m.amount_updated()} \${val}€`);
				}
			}
		} catch (error) {
			console.error(error);
			toast.error(m.ocr_error());
		} finally {
			ocrLoading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title || !amount || !paidById) {
			toast.error(m.fill_required_fields());
			return;
		}

		if (splits.length === 0) {
			toast.error(m.select_at_least_one());
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
					`\${m.sum_of_shares()} (\${sum.toFixed(2)}€) \${m.must_equal_amount()} (\${amount}€)`
				);
				return;
			}
		} else if (splitType === 'percentage') {
			const sum = finalSplits.reduce((acc, s) => acc + s.value, 0);
			if (Math.abs(sum - 100) > 0.01) {
				toast.error(`\${m.sum_of_percentages()} (\${sum}%) \${m.must_be_100()}`);
				return;
			}
		}

		loading = true;
		try {
			const catName =
				categoriesQuery.value?.find((c) => c.id === categoryId)?.name || m.general_category();
			await db.expenses.update(id, {
				title,
				amount,
				date: new Date(date),
				categoryId: categoryId,
				category: catName,
				groupId: groupId ? groupId : undefined,
				paidById: paidById,
				splitType,
				splits: finalSplits,
				attachments: attachments.length > 0 ? [...attachments] : undefined
			});
			toast.success(m.expense_updated());
			goto('/expenses');
		} catch (error) {
			toast.error(m.update_error());
			console.error(error);
		} finally {
			loading = false;
		}
	}

	async function deleteExpense() {
		if (confirm(m.delete_expense_confirm())) {
			try {
				await db.expenses.delete(id);
				toast.success(m.expense_deleted());
				goto('/expenses');
			} catch (e) {
				toast.error(m.delete_error());
			}
		}
	}

	function getContactName(contactId: string) {
		const name = contactsQuery.value?.find((c) => c.id === contactId)?.name || m.unknown_contact();

		if (userSettings.myContactId && contactId.toString() === userSettings.myContactId) {
			return name + ' (Tu)';
		}
		return name;
	}

	let computedDebts = $derived.by(() => {
		if (!paidById) return [];
		const payer = paidById;
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

	async function settleDebt(from: string, to: string, settleAmt: number) {
		if (settleAmt <= 0) {
			toast.error(m.amount_gt_zero());
			return;
		}
		try {
			await db.settlements.add({
				id: uuidv7(),
				fromContactId: from,
				toContactId: to,
				amount: settleAmt,
				date: new Date(),
				groupId: groupId ? groupId : undefined,
				createdAt: new Date()
			});
			toast.success(m.debt_settled());
		} catch (error) {
			toast.error(m.settle_error());
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<Button variant="ghost" href="/expenses">
		<ArrowLeft class="mr-2 h-4 w-4" />{m.back_to_expenses_btn()}</Button
	>
	<Button variant="destructive" size="icon" onclick={deleteExpense}>
		<Trash2 class="h-4 w-4" />
	</Button>
</div>

{#if fetching}
	<p class="p-8 text-center">{m.loading()}</p>
{:else}
	<div class="mx-auto max-w-2xl">
		<Tabs.Root value="modifica" class="space-y-6">
			<Tabs.List class="grid w-full grid-cols-2">
				<Tabs.Trigger value="modifica">{m.edit()}</Tabs.Trigger>
				<Tabs.Trigger value="saldi">{m.details()} & Ripartizioni</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="modifica">
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.edit()} {m.expense()}</Card.Title>
					</Card.Header>
					<Card.Content>
						<form onsubmit={handleSubmit} class="space-y-6">
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="title">{m.title()} *</Label>
									<Input id="title" bind:value={title} required />
								</div>
								<div class="space-y-2">
									<Label for="amount">{m.amount()} (€) *</Label>
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
									<Label for="date">{m.date()}</Label>
									<Input id="date" type="date" bind:value={date} />
								</div>
								<div class="space-y-2">
									<Label for="category">{m.category()}</Label>
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
										<Button variant="outline" href="/categories" title={m.manage_categories()}
											>+</Button
										>
									</div>
								</div>
							</div>

							<!-- Allegati -->
							<AttachmentEditor bind:attachments />

							<div class="grid gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="group">{m.group()}</Label>
									<select
										id="group"
										bind:value={groupId}
										onchange={handleGroupChange}
										class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									>
										<option value="">{m.none_1_1()}</option>
										{#each groupsQuery.value || [] as group (group.id)}
											<option value={group.id!.toString()}>{group.name}</option>
										{/each}
									</select>
								</div>
								<div class="space-y-2">
									<Label for="payer">{m.who_paid()}</Label>
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
								{loading ? m.saving() : m.update_expense()}
							</Button>
						</form>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="saldi">
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.who_owes_who()}</Card.Title>
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
									{m.all_paid_or_no_debts()}
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
												<span class="font-bold">{getContactName(debt.from)}</span>
												{m.owes_to()}
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
