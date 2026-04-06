<script lang="ts">
	import { db } from '$lib/db';
	import { Button } from '$lib/components/ui/button';
	import { Download, Upload, Trash2, ShieldAlert } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';

	async function exportData() {
		const contacts = await db.contacts.toArray();
		const groups = await db.groups.toArray();
		const groupMembers = await db.groupMembers.toArray();
		const expenses = await db.expenses.toArray();
		const expenseSplits = await db.expenseSplits.toArray();
		const payments = await db.payments.toArray();

		const data = {
			contacts,
			groups,
			groupMembers,
			expenses,
			expenseSplits,
			payments,
			exportDate: new Date().toISOString()
		};

		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `debt-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function importData(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const data = JSON.parse(e.target?.result as string);

				// Importazione atomica (pulizia e inserimento)
				await db.transaction('rw', [db.contacts, db.groups, db.groupMembers, db.expenses, db.expenseSplits, db.payments], async () => {
					await db.contacts.clear();
					await db.groups.clear();
					await db.groupMembers.clear();
					await db.expenses.clear();
					await db.expenseSplits.clear();
					await db.payments.clear();

					if (data.contacts) await db.contacts.bulkAdd(data.contacts);
					if (data.groups) await db.groups.bulkAdd(data.groups);
					if (data.groupMembers) await db.groupMembers.bulkAdd(data.groupMembers);
					if (data.expenses) await db.expenses.bulkAdd(data.expenses);
					if (data.expenseSplits) await db.expenseSplits.bulkAdd(data.expenseSplits);
					if (data.payments) await db.payments.bulkAdd(data.payments);
				});

				alert('Dati importati con successo!');
				window.location.reload();
			} catch (err) {
				console.error(err);
				alert('Errore durante l\'importazione dei dati.');
			}
		};
		reader.readAsText(file);
	}

	async function clearAll() {
		if (confirm('ATTENZIONE: Questo cancellerà tutti i dati in modo permanente. Sei sicuro?')) {
			await db.delete();
			window.location.reload();
		}
	}
</script>

<div class="flex flex-col gap-6">
	<h1 class="text-3xl font-bold">Impostazioni</h1>

	<div class="grid gap-6">
		<Card.Root>
			<Card.Header>
				<Card.Title>Backup e Ripristino</Card.Title>
				<Card.Description>Esporta o importa i tuoi dati per non perderli.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex items-center justify-between gap-4">
					<div class="flex-1">
						<div class="font-medium">Esporta Backup</div>
						<div class="text-muted-foreground text-sm">Scarica un file JSON con tutti i tuoi dati.</div>
					</div>
					<Button onclick={exportData} variant="outline" class="gap-2">
						<Download class="h-4 w-4" /> Esporta
					</Button>
				</div>

				<div class="flex items-center justify-between gap-4 border-t pt-4">
					<div class="flex-1">
						<div class="font-medium">Importa Backup</div>
						<div class="text-muted-foreground text-sm">Carica un file JSON precedentemente esportato.</div>
					</div>
					<div class="relative">
						<input type="file" accept=".json" onchange={importData} class="absolute inset-0 cursor-pointer opacity-0" />
						<Button variant="outline" class="gap-2">
							<Upload class="h-4 w-4" /> Importa
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-destructive">
			<Card.Header>
				<Card.Title class="text-destructive flex items-center gap-2">
					<ShieldAlert class="h-5 w-5" /> Zona Pericolo
				</Card.Title>
				<Card.Description>Azioni irreversibili sui tuoi dati.</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center justify-between gap-4">
					<div class="flex-1">
						<div class="font-medium">Cancella tutto</div>
						<div class="text-muted-foreground text-sm">Elimina permanentemente tutti i contatti, gruppi e spese.</div>
					</div>
					<Button onclick={clearAll} variant="destructive" class="gap-2">
						<Trash2 class="h-4 w-4" /> Elimina DB
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
