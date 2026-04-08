<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { uuidv7 } from 'uuidv7';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DebtItem from '$lib/components/DebtItem.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { db } from '$lib/db';
	import { contactsQuery, expensesQuery, settlementsQuery } from '$lib/db.svelte';
	import { calculateBalances, getDirectDebts, simplifyDebts } from '$lib/utils/debt';
	import { userSettings } from '$lib/settings.svelte';
	import { ArrowLeft, Check, Receipt, Trash2, Users, Wallet } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const groupId = page.params.id || '';

	let currentGroup = $state<any>(null);
	let name = $state('');
	let selectedMemberIds = $state<string[]>([]);
	let loading = $state(false);
	let fetching = $state(true);

	onMount(async () => {
		const g = await db.groups.get(groupId);
		if (g) {
			currentGroup = g;
			name = g.name;
			selectedMemberIds = g.memberIds;
		} else {
			toast.error(m.group_not_found());
			goto('/groups');
		}
		fetching = false;
	});

	let groupExpenses = $derived((expensesQuery.value || []).filter((e) => e.groupId === groupId));
	let groupSettlements = $derived(
		(settlementsQuery.value || []).filter((s) => s.groupId === groupId)
	);

	let groupBalances = $derived.by(() => {
		if (!currentGroup || !expensesQuery.value || !settlementsQuery.value)
			return new Map<string, number>();
		return calculateBalances(groupExpenses, groupSettlements, currentGroup.memberIds);
	});

	let simplifiedDebts = $derived.by(() => {
		if (userSettings.simplifyDebts) {
			return simplifyDebts(groupBalances);
		} else {
			return getDirectDebts(groupExpenses, groupSettlements);
		}
	});

	function getContactName(id: string) {
		return contactsQuery.value?.find((c) => c.id === id)?.name || m.unknown_contact();
	}

	async function settleDebt(from: string, to: string, amount: number) {
		if (amount <= 0) {
			toast.error(m.amount_gt_zero());
			return;
		}
		try {
			await db.settlements.add({
				id: uuidv7(),
				fromContactId: from,
				toContactId: to,
				amount,
				date: new Date(),
				groupId,
				createdAt: new Date()
			});
			toast.success(m.debt_settled());
		} catch (error) {
			toast.error(m.settle_error());
		}
	}

	async function deleteSettlement(id: string) {
		if (confirm(m.delete_payment_confirm())) {
			try {
				await db.settlements.delete(id);
				toast.success(m.payment_deleted());
			} catch (e) {
				toast.error(m.delete_error());
			}
		}
	}

	// Funzioni per l'Editing del gruppo
	function toggleMember(contactId: string) {
		if (selectedMemberIds.includes(contactId)) {
			selectedMemberIds = selectedMemberIds.filter((mid) => mid !== contactId);
		} else {
			selectedMemberIds = [...selectedMemberIds, contactId];
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error(m.group_name_required());
			return;
		}
		if (selectedMemberIds.length === 0) {
			toast.error(m.select_at_least_one_participant());
			return;
		}

		loading = true;
		try {
			await db.groups.update(groupId, {
				name,
				memberIds: [...selectedMemberIds]
			});
			toast.success(m.group_updated());
			// Aggiorna lo state visivo per evitare un ricaricamento forzato
			currentGroup.name = name;
			currentGroup.memberIds = [...selectedMemberIds];
		} catch (error) {
			toast.error(m.group_update_error());
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<Button variant="ghost" href="/groups">
		<ArrowLeft class="mr-2 h-4 w-4" />{m.back_to_groups_btn()}</Button
	>
</div>

{#if fetching}
	<p class="p-8 text-center">{m.loading()}</p>
{:else if !currentGroup}
	<p class="p-8 text-center text-destructive">{m.group_load_error()}</p>
{:else}
	<div class="mx-auto max-w-2xl">
		<div class="mb-6 flex items-center gap-4">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
			>
				<Users class="h-8 w-8" />
			</div>
			<div class="flex-1">
				<h1 class="text-3xl font-bold">{currentGroup.name}</h1>
				<p class="text-muted-foreground">{currentGroup.memberIds.length} {m.participant_count()}</p>
			</div>
			<Button href="/expenses/new?groupId={groupId}">
				<Receipt class="mr-2 h-4 w-4" />
				{m.new_expense_btn()}
			</Button>
		</div>

		<Tabs.Root value="balances" class="space-y-6">
			<Tabs.List class="grid w-full grid-cols-4">
				<Tabs.Trigger value="balances">{m.balances()}</Tabs.Trigger>
				<Tabs.Trigger value="expenses">{m.nav_expenses()}</Tabs.Trigger>
				<Tabs.Trigger value="settlements">{m.payments()}</Tabs.Trigger>
				<Tabs.Trigger value="modifica">{m.details()}</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="balances" class="space-y-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.participant_situation()}</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="space-y-4">
							{#each currentGroup.memberIds as memberId (memberId)}
								{@const balance = groupBalances.get(memberId) || 0}
								<div class="flex items-center justify-between">
									<div class="flex items-center">
										<div
											class="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted"
										>
											<Users class="h-4 w-4" />
										</div>
										<span>{getContactName(memberId)}</span>
									</div>
									<span
										class={balance >= 0 ? 'font-bold text-primary' : 'font-bold text-destructive'}
									>
										{balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
									</span>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title
							>{userSettings.simplifyDebts
								? m.simplified_debts()
								: m.debts_and_balances()}</Card.Title
						>
						<Card.Description
							>{userSettings.simplifyDebts ? m.optimized_accounts() : ''}</Card.Description
						>
					</Card.Header>
					<Card.Content>
						{#if simplifiedDebts.length === 0}
							<div
								class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
							>
								<Wallet class="mb-4 h-8 w-8 opacity-50" />
								<p>{m.all_group_accounts()}{m.are_settled()}</p>
							</div>
						{:else}
							<div class="space-y-4">
								{#each simplifiedDebts as debt}
									<DebtItem
										amount={debt.amount}
										isNegative={false}
										onSettle={(amt) => settleDebt(debt.from, debt.to, amt)}
									>
										{#snippet descriptionSnippet()}
											<p>
												<span class="font-bold">{getContactName(debt.from)}</span>
												{m.must_give()}
											</p>
											<p class="font-bold text-emerald-500">
												{debt.amount.toFixed(2)}€ a {getContactName(debt.to)}
											</p>
										{/snippet}
									</DebtItem>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="expenses">
				<Card.Root>
					<Card.Content class="p-0">
						{#if groupExpenses.length === 0}
							<p class="p-8 text-center text-muted-foreground">{m.no_expenses_in_group()}</p>
						{:else}
							<div class="divide-y">
								{#each groupExpenses as expense (expense.id)}
									<a
										href="/expenses/{expense.id}"
										class="block flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
									>
										<div>
											<p class="font-medium">{expense.title}</p>
											<p class="text-xs text-muted-foreground">
												Da {getContactName(expense.paidById)} • {new Date(
													expense.date
												).toLocaleDateString()}
											</p>
										</div>
										<div class="text-right">
											<p class="font-bold">{expense.amount.toFixed(2)}€</p>
											<div
												class="flex items-center justify-end gap-1 text-xs text-muted-foreground"
											>
												{#if (expense.attachments?.length ?? 0) > 0 || expense.attachment}
													<Receipt class="h-3 w-3" />
												{/if}
												{expense.category || m.general_category()}
											</div>
										</div>
									</a>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="settlements">
				<Card.Root>
					<Card.Content class="p-0">
						{#if groupSettlements.length === 0}
							<p class="p-8 text-center text-muted-foreground">{m.no_payments()}</p>
						{:else}
							<div class="divide-y">
								{#each groupSettlements as settlement (settlement.id)}
									<div
										class="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
									>
										<div class="flex items-center gap-3">
											<Wallet class="h-6 w-6 text-primary" />
											<div class="text-sm">
												<p>
													<span class="font-bold">{getContactName(settlement.fromContactId)}</span>
													{m.paid_to()}
													<span class="font-bold">{getContactName(settlement.toContactId)}</span>
												</p>
												<p class="text-xs text-muted-foreground">
													{new Date(settlement.date).toLocaleDateString()}
												</p>
											</div>
										</div>
										<div class="flex items-center gap-3">
											<p class="font-bold text-primary">{settlement.amount.toFixed(2)}€</p>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => deleteSettlement(settlement.id!)}
											>
												<Trash2 class="h-4 w-4 text-destructive" />
											</Button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="modifica">
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.edit()} {m.group()}</Card.Title>
						<Card.Description>{m.update_group_desc()}</Card.Description>
					</Card.Header>
					<Card.Content>
						<form onsubmit={handleSubmit} class="space-y-6">
							<div class="space-y-2">
								<Label for="name">{m.group_name_label()}</Label>
								<Input id="name" bind:value={name} required />
							</div>

							<div class="space-y-3">
								<Label>{m.participants()} *</Label>
								<div class="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
									{#if !contactsQuery.value || contactsQuery.value.length === 0}
										<p class="p-4 text-center text-sm text-muted-foreground">
											{m.no_contact_found()}
											<a href="/contacts/new" class="text-primary hover:underline">{m.add_one()}</a> prima.
										</p>
									{:else}
										{#each contactsQuery.value as contact (contact.id)}
											<button
												type="button"
												class="flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors hover:bg-muted"
												onclick={() => toggleMember(contact.id!)}
											>
												<span>{contact.name}</span>
												{#if selectedMemberIds.includes(contact.id!)}
													<Check class="h-4 w-4 text-primary" />
												{/if}
											</button>
										{/each}
									{/if}
								</div>
								<p class="text-xs text-muted-foreground">
									{m.selected_label()}
									{selectedMemberIds.length}
								</p>
							</div>

							<Button type="submit" class="w-full" disabled={loading}>
								{loading ? m.saving() : m.update_group_btn()}
							</Button>
						</form>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	</div>
{/if}
