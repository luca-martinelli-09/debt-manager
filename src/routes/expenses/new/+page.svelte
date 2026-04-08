<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { uuidv7 } from 'uuidv7';
	import { goto } from '$app/navigation';
	import AttachmentEditor from '$lib/components/AttachmentEditor.svelte';
	import SplitEditor from '$lib/components/SplitEditor.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { db } from '$lib/db';
	import { categoriesQuery, contactsQuery, groupsQuery } from '$lib/db.svelte';
	import { userSettings } from '$lib/settings.svelte';
	import type { Split, SplitType } from '$lib/types';
	import { ArrowLeft, Camera, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
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
		const gId = groupId ? groupId : null;
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
		const gId = groupId ? groupId : null;
		const oldSplits = [...splits];

		if (gId) {
			const group = groupsQuery.value?.find((g) => g.id === gId);
			if (group) {
				splits = group.memberIds.map((id) => {
					const existing = oldSplits.find((s) => s.contactId === id);
					return { contactId: id, value: existing ? existing.value : 0 };
				});
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
			splits = contacts.map((c) => {
				const existing = oldSplits.find((s) => s.contactId === c.id);
				return { contactId: c.id!, value: existing ? existing.value : 0 };
			});
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
					toast.info(`\${m.ocr_amount_detected()} \${val}€`);
				}
			}
			const lines = text.split('\n').filter((l) => l.trim().length > 3);
			if (lines.length > 0) {
				title = lines[0].trim();
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
			await db.expenses.add({
				id: uuidv7(),
				title,
				amount,
				date: new Date(date),
				categoryId: categoryId,
				category: catName,
				groupId: groupId ? groupId : undefined,
				paidById: paidById,
				splitType,
				splits: finalSplits,
				attachments: attachments.length > 0 ? [...attachments] : undefined,
				createdAt: new Date()
			});
			toast.success(m.expense_created());
			goto('/expenses');
		} catch (error) {
			toast.error(m.expense_save_error());
			console.error(error);
		} finally {
			loading = false;
		}
	}
	function getContactName(contactId: string) {
		const name = contactsQuery.value?.find((c) => c.id === contactId)?.name || m.unknown_contact();

		if (userSettings.myContactId && contactId.toString() === userSettings.myContactId) {
			return name + ' (Tu)';
		}
		return name;
	}
</script>

<div class="mb-6">
	<Button variant="ghost" href="/expenses">
		<ArrowLeft class="mr-2 h-4 w-4" />{m.back_to_expenses_btn()}</Button
	>
</div>

<div class="mx-auto max-w-2xl">
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.new_expense_sr()}</Card.Title>
			<Card.Description>{m.add_expense_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Title & Amount -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="title">{m.title()} *</Label>
						<Input id="title" bind:value={title} placeholder={m.example_dinner()} required />
					</div>
					<div class="space-y-2">
						<Label for="amount">{m.amount()} (€) *</Label>
						<InputGroup.Root>
							<InputGroup.Input
								id="amount"
								type="number"
								step="0.01"
								bind:value={amount}
								placeholder="0.00"
								required
							/>
							<InputGroup.Addon align="inline-end">
								<InputGroup.Button
									variant="ghost"
									size="sm"
									class="relative text-muted-foreground hover:bg-transparent"
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
										class="absolute inset-0 cursor-pointer opacity-0"
										onchange={handleOCR}
									/>
								</InputGroup.Button>
							</InputGroup.Addon>
						</InputGroup.Root>
					</div>
				</div>

				<!-- Date & Category -->
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
							<Button variant="outline" href="/categories" title={m.manage_categories()}>+</Button>
						</div>
					</div>
				</div>

				<!-- Allegati -->
				<AttachmentEditor bind:attachments />

				<!-- Group & Payer -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="group">{m.group_optional()}</Label>
						<select
							id="group"
							bind:value={groupId}
							onchange={handleGroupChange}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:outline-none"
						>
							<option value="">{m.none_1_1()}</option>
							{#each groupsQuery.value || [] as group (group.id)}
								<option value={group.id!.toString()}>{group.name}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="payer">{m.who_paid_asterisk()}</Label>
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
				<SplitEditor bind:splitType bind:splits {amount} {availableContacts} {getContactName} />

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? m.saving() : m.add_expense_btn()}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
