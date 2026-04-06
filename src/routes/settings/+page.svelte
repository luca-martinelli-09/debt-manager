<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { db } from '$lib/db';
	import { contactsQuery } from '$lib/db.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { setGeminiSettings, setMyContactId, userSettings } from '$lib/settings.svelte';
	import {
		AlertTriangle,
		Download,
		Eye,
		EyeOff,
		Loader2,
		ScanLine,
		Share2,
		Sparkles,
		Trash2,
		Upload,
		User
	} from '@lucide/svelte';
	import QRCode from 'qrcode';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

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
			toast.success(m.data_exported_success());
		} catch (error) {
			toast.error(m.export_error());
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
			settings: await db.settings.toArray(),
			exportedAt: new Date().toISOString(),
			version: 2
		};
	}

	async function performImport(data: any) {
		if (!data.contacts || !data.groups || !data.expenses || !data.settlements) {
			throw new Error(m.invalid_data_format());
		}
		await db.transaction(
			'rw',
			[db.contacts, db.groups, db.expenses, db.settlements, db.categories, db.settings],
			async () => {
				await db.contacts.clear();
				await db.groups.clear();
				await db.expenses.clear();
				await db.settlements.clear();
				if (data.categories) await db.categories.clear();
				if (data.settings) await db.settings.clear();

				await db.contacts.bulkAdd(data.contacts);
				await db.groups.bulkAdd(data.groups);
				await db.expenses.bulkAdd(data.expenses);
				await db.settlements.bulkAdd(data.settlements);
				if (data.categories) await db.categories.bulkAdd(data.categories);
				if (data.settings) await db.settings.bulkAdd(data.settings);
			}
		);
		// Forza ricaricamento delle settings dal DB appena importato
		window.location.reload();
	}

	async function importData(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (event) => {
			try {
				const data = JSON.parse(event.target?.result as string);
				if (confirm(m.import_overwrite_confirm())) {
					await performImport(data);
					toast.success(m.data_imported_success());
				}
			} catch (error) {
				toast.error(m.import_error_prefix() + (error as Error).message);
				console.error(error);
			}
		};
		reader.readAsText(file);
	}

	async function resetDatabase() {
		if (confirm(m.reset_db_confirm())) {
			try {
				await db.transaction(
					'rw',
					[db.contacts, db.groups, db.expenses, db.settlements, db.categories, db.settings],
					async () => {
						await db.contacts.clear();
						await db.groups.clear();
						await db.expenses.clear();
						await db.settlements.clear();
						await db.categories.clear();
						await db.settings.clear();
					}
				);
				toast.success(m.db_reset_success());
				window.location.reload();
			} catch (error) {
				toast.error(m.reset_error());
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
	let syncStatus = $state<string>(m.disconnected());
	let PeerJS: any;

	let geminiApiKeyInput = $state('');
	let geminiModelInput = $state('gemini-2.5-flash');
	let showApiKey = $state(false);

	let availableModels = $state<{ name: string; description: string }[]>([]);
	let loadingModels = $state(false);

	let initializedSettings = $state(false);

	$effect(() => {
		if (userSettings.isLoaded && !initializedSettings) {
			initializedSettings = true;
			geminiApiKeyInput = userSettings.geminiApiKey;
			geminiModelInput = userSettings.geminiModel;
			if (userSettings.geminiApiKey) {
				fetchModels(userSettings.geminiApiKey);
			}
		}
	});

	onMount(async () => {
		// Import dynamically to avoid SSR issues
		const module = await import('peerjs');
		PeerJS = module.default;
	});

	async function fetchModels(apiKey: string) {
		if (!apiKey) return;
		loadingModels = true;
		try {
			const { GoogleGenAI } = await import('@google/genai');
			const client = new GoogleGenAI({ apiKey });

			// Get actual list of models
			const response = await client.models.list();
			const allModels = [];
			for await (const m of response) {
				allModels.push(m);
			}

			// Filter to show only useful models (Gemini models, avoiding embedding/tuning specific ones)
			availableModels = allModels
				.filter(
					(m) =>
						m.name &&
						m.name.includes('gemini') &&
						!m.name.includes('vision') &&
						!m.name.includes('embedding') &&
						!m.name.includes('aqa')
				)
				.map((m) => ({
					name: (m.name || '').replace('models/', ''),
					description: m.description || m.displayName || m.name || ''
				}));

			// If current model is not in list (or empty list), default to the first one or flash
			if (availableModels.length > 0 && !availableModels.find((m) => m.name === geminiModelInput)) {
				const flashModel = availableModels.find((m) => m.name.includes('flash'));
				geminiModelInput = flashModel ? flashModel.name : availableModels[0].name;
			}
		} catch (error) {
			console.error('Error fetching models:', error);
			// Fallback quietly to defaults if API key is invalid or network fails
			availableModels = [
				{ name: 'gemini-2.5-flash', description: 'Gemini 2.5 Flash' },
				{ name: 'gemini-1.5-flash', description: 'Gemini 1.5 Flash' },
				{ name: 'gemini-1.5-pro', description: 'Gemini 1.5 Pro' }
			];
		} finally {
			loadingModels = false;
		}
	}

	async function saveGeminiSettings() {
		setGeminiSettings(geminiApiKeyInput, geminiModelInput);
		toast.success(m.gemini_settings_saved());

		// Refetch models if API key changed
		if (geminiApiKeyInput !== userSettings.geminiApiKey) {
			await fetchModels(geminiApiKeyInput);
		}
	}

	onDestroy(() => {
		if (peer) {
			peer.destroy();
		}
	});

	async function startHosting() {
		if (!PeerJS) return;
		isConnecting = true;
		syncStatus = m.generating_id();

		peer = new PeerJS();

		peer.on('open', async (id: string) => {
			peerId = id;
			isHost = true;
			syncStatus = m.waiting_connection();
			isConnecting = false;
			try {
				qrCodeUrl = await QRCode.toDataURL(id, { margin: 1, width: 250 });
			} catch (err) {
				console.error('Error generating QR', err);
			}
		});

		peer.on('connection', (conn: any) => {
			syncStatus = m.device_connected_sending();
			conn.on('open', async () => {
				try {
					const data = await getFullExportData();
					conn.send({ type: 'sync_data', payload: data });
					toast.success(m.data_sent_success());
					syncStatus = m.sync_completed_success();
					setTimeout(() => {
						peer.destroy();
						peer = null;
						isHost = false;
						qrCodeUrl = '';
					}, 3000);
				} catch (e) {
					toast.error(m.send_data_error());
					syncStatus = m.send_error();
				}
			});
		});

		peer.on('error', (err: any) => {
			console.error(err);
			toast.error(m.p2p_error_prefix() + err.message);
			syncStatus = m.p2p_error();
			isConnecting = false;
		});
	}

	function connectAndReceive() {
		if (!PeerJS || !connectToId) return;
		isConnecting = true;
		syncStatus = m.connecting();

		peer = new PeerJS();

		peer.on('open', () => {
			const conn = peer.connect(connectToId);
			conn.on('open', () => {
				syncStatus = m.connected_waiting_data();
			});

			conn.on('data', async (msg: any) => {
				if (msg.type === 'sync_data') {
					syncStatus = m.receiving_data();
					if (confirm(m.remote_backup_received_confirm())) {
						try {
							await performImport(msg.payload);
							toast.success(m.sync_completed_success());
							syncStatus = m.data_synced_success();
						} catch (e) {
							toast.error(m.remote_save_error());
							syncStatus = m.save_error_status();
						}
					} else {
						syncStatus = m.sync_cancelled();
					}
					setTimeout(() => {
						peer.destroy();
						peer = null;
						connectToId = '';
					}, 3000);
				}
			});

			conn.on('error', (err: any) => {
				toast.error(m.connection_error());
				console.error(err);
				syncStatus = m.connection_error();
			});
		});

		peer.on('error', (err: any) => {
			toast.error(m.unable_to_connect_prefix() + err.message);
			syncStatus = m.p2p_error();
			isConnecting = false;
		});
	}
</script>

<h1 class="mb-6 text-2xl font-bold">{m.nav_settings()}</h1>

<div class="grid max-w-4xl gap-6">
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<User class="h-5 w-5" />
				{m.profile()}
			</Card.Title>
			<Card.Description>{m.select_profile_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="max-w-md space-y-2">
				<Label for="myProfile">{m.select_contact()}</Label>
				<select
					id="myProfile"
					value={userSettings.myContactId}
					onchange={(e) => setMyContactId(e.currentTarget.value)}
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:outline-none"
				>
					<option value="">{m.none_generic()}</option>
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
				<Sparkles class="h-5 w-5 text-primary" />
				{m.ai_gemini_title()}
			</Card.Title>
			<Card.Description>{m.ai_gemini_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveGeminiSettings();
				}}
				class="max-w-md space-y-4"
			>
				<div class="space-y-2">
					<Label for="apiKey">{m.api_key_label()}</Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="apiKey"
							type={showApiKey ? 'text' : 'password'}
							bind:value={geminiApiKeyInput}
							placeholder="AIzaSy..."
						/>
						<InputGroup.Addon align="inline-end">
							<InputGroup.Button
								variant="ghost"
								size="sm"
								class="text-muted-foreground hover:bg-transparent"
								onclick={() => (showApiKey = !showApiKey)}
							>
								{#if showApiKey}
									<EyeOff class="h-4 w-4" />
								{:else}
									<Eye class="h-4 w-4" />
								{/if}
							</InputGroup.Button>
						</InputGroup.Addon>
					</InputGroup.Root>
					<p class="text-xs text-muted-foreground">
						{m.key_saved_locally()}
						<a
							href="https://aistudio.google.com/app/apikey"
							target="_blank"
							class="text-primary hover:underline">{m.get_key()}</a
						>
					</p>
				</div>
				<div class="space-y-2">
					<Label for="model">{m.llm_model()}</Label>
					<div class="relative">
						<select
							id="model"
							bind:value={geminiModelInput}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-50"
							disabled={loadingModels || availableModels.length === 0}
						>
							{#if loadingModels}
								<option value={geminiModelInput}>{m.loading_models()}</option>
							{:else if availableModels.length === 0}
								<option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
								<option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
								<option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
							{:else}
								{#each availableModels as model}
									<option value={model.name}>
										{model.name.replace('models/', '')} - {model.description
											? model.description.substring(0, 40) + '...'
											: ''}
									</option>
								{/each}
							{/if}
						</select>
						{#if loadingModels}
							<div class="absolute inset-y-0 right-8 flex items-center">
								<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
							</div>
						{/if}
					</div>
				</div>
				<Button type="submit">{m.save_ai_settings()}</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Share2 class="h-5 w-5" />
				{m.p2p_sync_title()}
			</Card.Title>
			<Card.Description>{m.p2p_transfer_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<Tabs.Root value="send" class="w-full">
				<Tabs.List class="grid w-full grid-cols-2">
					<Tabs.Trigger value="send">{m.send_data()}</Tabs.Trigger>
					<Tabs.Trigger value="receive">{m.receive_data()}</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="send" class="space-y-4 pt-4">
					{#if !isHost}
						<p class="text-sm text-muted-foreground">
							{m.p2p_host_desc()}
						</p>
						<Button onclick={startHosting} disabled={isConnecting}>
							{#if isConnecting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" /> {m.preparing()}
							{:else}
								<Share2 class="mr-2 h-4 w-4" /> {m.generate_sync_code()}
							{/if}
						</Button>
					{:else}
						<div class="flex flex-col items-center gap-4 py-4">
							{#if qrCodeUrl}
								<div class="rounded-lg border border-border bg-white p-2 shadow-sm">
									<img src={qrCodeUrl} alt={m.qr_code_alt()} class="h-48 w-48" />
								</div>
							{/if}
							<div class="text-center">
								<p class="mb-1 text-sm font-bold">
									{m.sync_id_label()}
									<span class="rounded bg-muted px-2 py-1 text-primary">{peerId}</span>
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
									syncStatus = m.disconnected();
								}}>{m.cancel_sync()}</Button
							>
						</div>
					{/if}
				</Tabs.Content>

				<Tabs.Content value="receive" class="space-y-4 pt-4">
					<p class="text-sm text-muted-foreground">
						{m.receive_sync_desc()}
					</p>
					<div class="space-y-1">
						<Label>{m.remote_sync_id()}</Label>
						<InputGroup.Root>
							<InputGroup.Input
								type="text"
								placeholder={m.sync_id_placeholder()}
								bind:value={connectToId}
							/>
							<InputGroup.Addon align="inline-end">
								<InputGroup.Button
									variant="secondary"
									onclick={connectAndReceive}
									disabled={!connectToId || isConnecting}
								>
									<ScanLine class="mr-2 h-4 w-4" />
									{m.request_and_receive()}
								</InputGroup.Button>
							</InputGroup.Addon>
						</InputGroup.Root>
					</div>
					{#if syncStatus !== m.disconnected() && !isHost}
						<p class="mt-2 text-sm font-medium text-primary">{syncStatus}</p>
					{/if}
				</Tabs.Content>
			</Tabs.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.data_portability()}</Card.Title>
			<Card.Description>{m.data_portability_desc()}</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex flex-wrap gap-4">
				<Button onclick={exportData} variant="outline">
					<Download class="mr-2 h-4 w-4" />
					{m.export_backup_btn()}
				</Button>

				<div class="relative">
					<Button variant="outline" class="w-full">
						<Upload class="mr-2 h-4 w-4" />
						{m.import_backup_btn()}
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
				<AlertTriangle class="mr-2 h-5 w-5" />
				{m.danger_zone_title()}
			</Card.Title>
			<Card.Description>{m.irreversible_actions()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button variant="destructive" onclick={resetDatabase}>
				<Trash2 class="mr-2 h-4 w-4" />
				{m.delete_all_data_btn()}
			</Button>
		</Card.Content>
	</Card.Root>
</div>
