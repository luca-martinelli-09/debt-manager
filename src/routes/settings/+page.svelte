<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { db } from '$lib/db';
	import { contactsQuery } from '$lib/db.svelte';
	import { userSettings, setMyContactId } from '$lib/settings.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import {
		Download,
		Upload,
		Trash2,
		AlertTriangle,
		User,
		Share2,
		ScanLine,
		Loader2
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { onMount, onDestroy } from 'svelte';
	import QRCode from 'qrcode';

	// === DATA PORTABILITY LOGIC ===
	async function exportData() {
		try {
			const data = await getFullExportData();
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

	async function getFullExportData() {
		return {
			contacts: await db.contacts.toArray(),
			groups: await db.groups.toArray(),
			expenses: await db.expenses.toArray(),
			settlements: await db.settlements.toArray(),
			categories: await db.categories.toArray(),
			exportedAt: new Date().toISOString(),
			version: 2
		};
	}

	async function performImport(data: any) {
		if (!data.contacts || !data.groups || !data.expenses || !data.settlements) {
			throw new Error('Formato dati non valido');
		}
		await db.transaction(
			'rw',
			[db.contacts, db.groups, db.expenses, db.settlements, db.categories],
			async () => {
				await db.contacts.clear();
				await db.groups.clear();
				await db.expenses.clear();
				await db.settlements.clear();
				if (data.categories) await db.categories.clear();

				await db.contacts.bulkAdd(data.contacts);
				await db.groups.bulkAdd(data.groups);
				await db.expenses.bulkAdd(data.expenses);
				await db.settlements.bulkAdd(data.settlements);
				if (data.categories) await db.categories.bulkAdd(data.categories);
			}
		);
	}

	async function importData(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (event) => {
			try {
				const data = JSON.parse(event.target?.result as string);
				if (confirm("L'importazione sovrascriverà i dati esistenti. Continuare?")) {
					await performImport(data);
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
					[db.contacts, db.groups, db.expenses, db.settlements, db.categories],
					async () => {
						await db.contacts.clear();
						await db.groups.clear();
						await db.expenses.clear();
						await db.settlements.clear();
						await db.categories.clear();
					}
				);
				toast.success('Database resettato');
			} catch (error) {
				toast.error('Errore durante il reset');
			}
		}
	}

	// === WEBRTC P2P SYNC LOGIC ===
	let peer: any = null;
	let peerId = $state<string>('');
	let qrCodeUrl = $state<string>('');
	let connectToId = $state<string>('');
	let isConnecting = $state(false);
	let isHost = $state(false);
	let syncStatus = $state<string>('Disconnesso');
	let PeerJS: any;

	onMount(async () => {
		// Import dynamically to avoid SSR issues
		const module = await import('peerjs');
		PeerJS = module.default;
	});

	onDestroy(() => {
		if (peer) {
			peer.destroy();
		}
	});

	async function startHosting() {
		if (!PeerJS) return;
		isConnecting = true;
		syncStatus = 'Generazione ID...';

		peer = new PeerJS();

		peer.on('open', async (id: string) => {
			peerId = id;
			isHost = true;
			syncStatus =
				'In attesa di connessione... (Scansiona il QR con un altro dispositivo per scaricare i dati)';
			isConnecting = false;
			try {
				qrCodeUrl = await QRCode.toDataURL(id, { margin: 1, width: 250 });
			} catch (err) {
				console.error('Error generating QR', err);
			}
		});

		peer.on('connection', (conn: any) => {
			syncStatus = 'Dispositivo connesso! Invio dati...';
			conn.on('open', async () => {
				try {
					const data = await getFullExportData();
					conn.send({ type: 'sync_data', payload: data });
					toast.success('Dati inviati al dispositivo remoto!');
					syncStatus = 'Sincronizzazione completata.';
					setTimeout(() => {
						peer.destroy();
						peer = null;
						isHost = false;
						qrCodeUrl = '';
					}, 3000);
				} catch (e) {
					toast.error("Errore durante l'invio dei dati.");
					syncStatus = 'Errore invio.';
				}
			});
		});

		peer.on('error', (err: any) => {
			console.error(err);
			toast.error('Errore P2P: ' + err.message);
			syncStatus = 'Errore P2P';
			isConnecting = false;
		});
	}

	function connectAndReceive() {
		if (!PeerJS || !connectToId) return;
		isConnecting = true;
		syncStatus = 'Connessione in corso...';

		peer = new PeerJS();

		peer.on('open', () => {
			const conn = peer.connect(connectToId);
			conn.on('open', () => {
				syncStatus = 'Connesso. In attesa dei dati...';
			});

			conn.on('data', async (msg: any) => {
				if (msg.type === 'sync_data') {
					syncStatus = 'Ricezione dati in corso...';
					if (
						confirm(
							'Hai ricevuto un backup remoto. Vuoi sovrascrivere il database locale corrente?'
						)
					) {
						try {
							await performImport(msg.payload);
							toast.success('Sincronizzazione completata!');
							syncStatus = 'Dati sincronizzati con successo!';
						} catch (e) {
							toast.error('Errore durante il salvataggio dei dati remoti.');
							syncStatus = 'Errore nel salvataggio.';
						}
					} else {
						syncStatus = "Sincronizzazione annullata dall'utente.";
					}
					setTimeout(() => {
						peer.destroy();
						peer = null;
						connectToId = '';
					}, 3000);
				}
			});

			conn.on('error', (err: any) => {
				toast.error('Errore di connessione.');
				console.error(err);
				syncStatus = 'Errore di connessione.';
			});
		});

		peer.on('error', (err: any) => {
			toast.error('Impossibile connettersi: ' + err.message);
			syncStatus = 'Errore P2P';
			isConnecting = false;
		});
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
			<Card.Title class="flex items-center gap-2">
				<Share2 class="h-5 w-5" /> Sincronizzazione P2P (WebRTC)
			</Card.Title>
			<Card.Description
				>Trasferisci il database tra i tuoi dispositivi istantaneamente via rete (senza passare per
				server cloud).</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<Tabs.Root value="send" class="w-full">
				<Tabs.List class="grid w-full grid-cols-2">
					<Tabs.Trigger value="send">Invia Dati</Tabs.Trigger>
					<Tabs.Trigger value="receive">Ricevi Dati</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="send" class="space-y-4 pt-4">
					{#if !isHost}
						<p class="text-sm text-muted-foreground">
							Premi il pulsante qui sotto per generare un codice QR o un ID. Inseriscilo nell'altro
							dispositivo per inviare una copia esatta di questo database.
						</p>
						<Button onclick={startHosting} disabled={isConnecting}>
							{#if isConnecting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" /> Preparazione...
							{:else}
								<Share2 class="mr-2 h-4 w-4" /> Genera Codice Sync
							{/if}
						</Button>
					{:else}
						<div class="flex flex-col items-center gap-4 py-4">
							{#if qrCodeUrl}
								<div class="rounded-lg border border-border bg-white p-2 shadow-sm">
									<img src={qrCodeUrl} alt="QR Code per Sync P2P" class="h-48 w-48" />
								</div>
							{/if}
							<div class="text-center">
								<p class="mb-1 text-sm font-bold">
									ID Sync: <span class="rounded bg-muted px-2 py-1 text-primary">{peerId}</span>
								</p>
								<p class="mt-2 text-sm text-muted-foreground">{syncStatus}</p>
							</div>
							<Button
								variant="outline"
								onclick={() => {
									peer?.destroy();
									peer = null;
									isHost = false;
									qrCodeUrl = '';
									syncStatus = 'Disconnesso';
								}}>Annulla Sincronizzazione</Button
							>
						</div>
					{/if}
				</Tabs.Content>

				<Tabs.Content value="receive" class="space-y-4 pt-4">
					<p class="text-sm text-muted-foreground">
						Inserisci l'ID Sync generato dall'altro dispositivo (oppure premi e usa la fotocamera
						per scansionare il QR) e ricevi i dati.
					</p>
					<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
						<div class="flex-1 space-y-1">
							<Label>ID Sync Remoto</Label>
							<Input type="text" placeholder="Es. abc-123-def" bind:value={connectToId} />
						</div>
						<Button onclick={connectAndReceive} disabled={!connectToId || isConnecting}>
							<ScanLine class="mr-2 h-4 w-4" /> Richiedi e Ricevi
						</Button>
					</div>
					{#if syncStatus !== 'Disconnesso' && !isHost}
						<p class="mt-2 text-sm font-medium text-primary">{syncStatus}</p>
					{/if}
				</Tabs.Content>
			</Tabs.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Portabilità dei Dati</Card.Title>
			<Card.Description
				>Gestisci i tuoi dati localmente. Esporta per il backup o importa da un file.</Card.Description
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
</div>
