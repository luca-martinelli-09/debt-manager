<script lang="ts">
	import { db } from '$lib/db';
	import { contactsQuery } from '$lib/db.svelte';
	import { userSettings, setMyContactId } from '$lib/settings.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Download, Upload, Trash2, AlertTriangle, User } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	async function exportData() {
		try {
			const contacts = await db.contacts.toArray();
			const groups = await db.groups.toArray();
			const expenses = await db.expenses.toArray();
			const settlements = await db.settlements.toArray();

			const data = {
				contacts,
				groups,
				expenses,
				settlements,
				exportedAt: new Date().toISOString(),
				version: 1
			};

			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `debt-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			toast.success('Dati esportati con successo');
		} catch (error) {
			toast.error("Errore durante l'esportazione dei dati");
			console.error(error);
		}
	}

	async function importData(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (event) => {
			try {
				const data = JSON.parse(event.target?.result as string);

				if (!data.contacts || !data.groups || !data.expenses || !data.settlements) {
					throw new Error('Formato file non valido');
				}

				if (confirm("L'importazione sovrascriverà i dati esistenti. Continuare?")) {
					await db.transaction(
						'rw',
						db.contacts,
						db.groups,
						db.expenses,
						db.settlements,
						async () => {
							await db.contacts.clear();
							await db.groups.clear();
							await db.expenses.clear();
							await db.settlements.clear();

							// Add data back (handling potential ID issues by removing them if they are auto-increment)
							// Actually, Dexie handles it if we provide them, or we can remove them to let it re-increment.
							// For a backup, keeping IDs is better to maintain relationships.
							await db.contacts.bulkAdd(data.contacts);
							await db.groups.bulkAdd(data.groups);
							await db.expenses.bulkAdd(data.expenses);
							await db.settlements.bulkAdd(data.settlements);
						}
					);
					toast.success('Dati importati con successo');
				}
			} catch (error) {
				toast.error("Errore durante l'importazione: " + (error as Error).message);
				console.error(error);
			}
		};
		reader.readAsText(file);
	}

	async function resetDatabase() {
		if (
			confirm(
				'SEI SICURO? Questa azione eliminerà PERMANENTEMENTE tutti i contatti, gruppi e spese.'
			)
		) {
			try {
				await db.transaction(
					'rw',
					db.contacts,
					db.groups,
					db.expenses,
					db.settlements,
					async () => {
						await db.contacts.clear();
						await db.groups.clear();
						await db.expenses.clear();
						await db.settlements.clear();
					}
				);
				toast.success('Database resettato');
			} catch (error) {
				toast.error('Errore durante il reset');
			}
		}
	}
</script>

<h1 class="mb-6 text-2xl font-bold">Impostazioni</h1>

<div class="grid max-w-4xl gap-6">
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<User class="h-5 w-5" /> Il Mio Profilo
			</Card.Title>
			<Card.Description
				>Seleziona quale contatto ti rappresenta per poter calcolare correttamente i tuoi debiti e
				crediti nella dashboard.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<div class="max-w-md space-y-2">
				<Label for="myProfile">Seleziona Contatto</Label>
				<select
					id="myProfile"
					value={userSettings.myContactId}
					onchange={(e) => setMyContactId(e.currentTarget.value)}
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:outline-none"
				>
					<option value="">Nessuno (Modalità generica)</option>
					{#each contactsQuery.value || [] as contact (contact.id)}
						<option value={contact.id!.toString()}>{contact.name}</option>
					{/each}
				</select>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Portabilità dei Dati</Card.Title>
			<Card.Description
				>Gestisci i tuoi dati localmente. Esporta per il backup o importa da un altro dispositivo.</Card.Description
			>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex flex-wrap gap-4">
				<Button onclick={exportData} variant="outline">
					<Download class="mr-2 h-4 w-4" /> Esporta Backup (JSON)
				</Button>

				<div class="relative">
					<Button variant="outline" class="w-full">
						<Upload class="mr-2 h-4 w-4" /> Importa Backup
					</Button>
					<input
						type="file"
						accept=".json"
						onchange={importData}
						class="absolute inset-0 cursor-pointer opacity-0"
					/>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root class="border-destructive/50">
		<Card.Header>
			<Card.Title class="flex items-center text-destructive">
				<AlertTriangle class="mr-2 h-5 w-5" /> Zona Pericolo
			</Card.Title>
			<Card.Description>Queste azioni sono irreversibili.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button variant="destructive" onclick={resetDatabase}>
				<Trash2 class="mr-2 h-4 w-4" /> Cancella Tutti i Dati
			</Button>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Informazioni</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4 text-sm text-muted-foreground">
			<p>
				Debt Manager è una PWA (Progressive Web App) progettata per la privacy totale. I tuoi dati
				non lasciano mai il tuo dispositivo e sono salvati localmente tramite IndexedDB.
			</p>
			<div class="flex items-center gap-2">
				<span>Sviluppato con SvelteKit 5 & Dexie.js</span>
			</div>
		</Card.Content>
	</Card.Root>
</div>
