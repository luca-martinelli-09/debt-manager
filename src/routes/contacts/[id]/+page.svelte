<script lang="ts">
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
	import * as m from '$lib/paraglide/messages.js';
	import { calculateBalances, simplifyDebts } from '$lib/utils/debt';
	import { ArrowLeft, Trash2, User, Wallet } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { uuidv7 } from 'uuidv7';

	const id = page.params.id || '';
	let name = $state('');
	let email = $state('');
	let tel = $state('');
	let loading = $state(false);
	let fetching = $state(true);

	// Per i pagamenti parziali in-line

	onMount(async () => {
		const contact = await db.contacts.get(id);
		if (contact) {
			name = contact.name;
			email = contact.email || '';
			tel = contact.tel || '';
		} else {
			toast.error(m.contact_not_found());
			goto('/contacts');
		}
		fetching = false;
	});

	let contactDebts = $derived.by(() => {
		if (!contactsQuery.value || !expensesQuery.value || !settlementsQuery.value) return [];
		const allIds = contactsQuery.value.map((c) => c.id!);
		const balances = calculateBalances(expensesQuery.value, settlementsQuery.value, allIds);
		const debts = simplifyDebts(balances);
		// Filtra solo i debiti che coinvolgono questo contatto
		return debts.filter((d) => d.from === id || d.to === id);
	});

	let contactSettlements = $derived.by(() => {
		const s = settlementsQuery.value || [];
		return s.filter((d) => d.fromContactId === id || d.toContactId === id);
	});

	function getContactName(cId: string) {
		return contactsQuery.value?.find((c) => c.id === cId)?.name || m.unknown_contact();
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name) {
			toast.error(m.name_required());
			return;
		}

		loading = true;
		try {
			await db.contacts.update(id, {
				name,
				email: email || undefined,
				tel: tel || undefined
			});
			toast.success(m.contact_updated());
		} catch (error) {
			toast.error(m.contact_update_error());
			console.error(error);
		} finally {
			loading = false;
		}
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
				createdAt: new Date()
			});
			toast.success(m.debt_settled());
			// Chiudi il form inline
		} catch (error) {
			toast.error(m.settle_error());
		}
	}

	async function deleteSettlement(sid: string) {
		if (confirm(m.delete_payment_confirm())) {
			try {
				await db.settlements.delete(sid);
				toast.success(m.payment_deleted());
			} catch (e) {
				toast.error(m.delete_error());
			}
		}
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<Button variant="ghost" href="/contacts">
		<ArrowLeft class="mr-2 h-4 w-4" />{m.back_to_contacts_btn()}</Button
	>
</div>

{#if fetching}
	<div class="flex justify-center p-8">
		<p>{m.loading()}</p>
	</div>
{:else}
	<div class="mx-auto max-w-2xl">
		<div class="mb-6 flex items-center gap-4">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
			>
				<User class="h-8 w-8" />
			</div>
			<div>
				<h1 class="text-3xl font-bold">{name}</h1>
				<p class="text-muted-foreground">{email || tel || m.no_contact_info()}</p>
			</div>
		</div>

		<Tabs.Root value="saldi" class="space-y-6">
			<Tabs.List class="grid w-full grid-cols-3">
				<Tabs.Trigger value="saldi">{m.debts_and_balances()}</Tabs.Trigger>
				<Tabs.Trigger value="pagamenti">{m.payments()}</Tabs.Trigger>
				<Tabs.Trigger value="dettagli">{m.edit_profile()}</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="saldi">
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.situation_with()} {name}</Card.Title>
						<Card.Description>{m.cross_group_debts()}</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if contactDebts.length === 0}
							<div
								class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
							>
								<Wallet class="mb-4 h-8 w-8 opacity-50" />
								<p>{m.all_settled_with()} {name} {m.are_settled()}</p>
							</div>
						{:else}
							<div class="space-y-4">
								{#each contactDebts as debt}
									{@const isDebtor = debt.from === id}
									<DebtItem
										amount={debt.amount}
										isNegative={isDebtor}
										onSettle={(amt) => settleDebt(debt.from, debt.to, amt)}
									>
										{#snippet descriptionSnippet()}
											{#if isDebtor}
												<p><span class="font-bold">{name}</span> {m.must_give()}</p>
												<p class="font-bold text-destructive">
													{debt.amount.toFixed(2)}€ a {getContactName(debt.to)}
												</p>
											{:else}
												<p><span class="font-bold">{name}</span> {m.must_receive()}</p>
												<p class="font-bold text-emerald-500">
													{debt.amount.toFixed(2)}€ da {getContactName(debt.from)}
												</p>
											{/if}
										{/snippet}
									</DebtItem>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<Tabs.Content value="pagamenti">
				<Card.Root>
					<Card.Content class="p-0">
						{#if contactSettlements.length === 0}
							<p class="p-8 text-center text-muted-foreground">{m.no_payments()}</p>
						{:else}
							<div class="divide-y">
								{#each contactSettlements as settlement (settlement.id)}
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

			<Tabs.Content value="dettagli">
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.details()}{m.contact_label()}</Card.Title>
						<Card.Description>{m.update_basic_info()}</Card.Description>
					</Card.Header>
					<Card.Content>
						<form onsubmit={handleSubmit} class="space-y-4">
							<div class="space-y-2">
								<Label for="name">{m.name()} *</Label>
								<Input id="name" bind:value={name} placeholder={m.example_mario()} required />
							</div>
							<div class="space-y-2">
								<Label for="email">{m.email_optional()}</Label>
								<Input id="email" type="email" bind:value={email} placeholder="mario@example.com" />
							</div>
							<div class="space-y-2">
								<Label for="tel">{m.phone_optional()}</Label>
								<Input id="tel" type="tel" bind:value={tel} placeholder="+39 333 1234567" />
							</div>
							<Button type="submit" class="w-full" disabled={loading}>
								{loading ? m.saving() : m.update_contact()}
							</Button>
						</form>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	</div>
{/if}
