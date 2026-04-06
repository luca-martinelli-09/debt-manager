<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { debtManagerTools, getGenAIClient, systemInstruction, toolHandlers } from '$lib/gemini';
	import * as m from '$lib/paraglide/messages.js';
	import { userSettings } from '$lib/settings.svelte';
	import {
		AlertTriangle,
		FileText,
		Image as ImageIcon,
		Paperclip,
		Send,
		Settings,
		Sparkles,
		User as UserIcon,
		X
	} from '@lucide/svelte';
	import { marked } from 'marked';
	import { toast } from 'svelte-sonner';

	type Message = {
		role: 'user' | 'model' | 'system';
		text: string;
		isToolCall?: boolean;
		fileUrl?: string;
		fileName?: string;
	};

	let messages = $state<Message[]>([
		{
			role: 'system',
			text: m.ai_welcome()
		}
	]);

	let inputPrompt = $state('');
	let loading = $state(false);
	let attachedFile = $state<File | null>(null);

	async function fileToGenerativePart(file: File) {
		const base64EncodedDataPromise = new Promise<string>((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
			reader.readAsDataURL(file);
		});
		return {
			inlineData: { data: await base64EncodedDataPromise, mimeType: file.type }
		};
	}

	async function sendMessage(e?: Event) {
		if (e) e.preventDefault();
		if (!inputPrompt.trim() && !attachedFile) return;

		let client;
		try {
			client = getGenAIClient();
		} catch (err: any) {
			toast.error(err.message);
			return;
		}

		const userText = inputPrompt.trim();
		const currentFile = attachedFile;

		inputPrompt = '';
		attachedFile = null;

		messages = [
			...messages,
			{
				role: 'user',
				text: userText,
				fileUrl: currentFile ? URL.createObjectURL(currentFile) : undefined,
				fileName: currentFile ? currentFile.name : undefined
			}
		];
		loading = true;

		try {
			const chatSession = client.chats.create({
				model: userSettings.geminiModel || 'gemini-2.5-flash',
				config: {
					systemInstruction: systemInstruction,
					tools: debtManagerTools
				}
			});

			let contents: any[] = [];
			if (userText) contents.push(userText);
			if (currentFile) {
				const part = await fileToGenerativePart(currentFile);
				contents.push(part);
			}

			let response = await chatSession.sendMessage({ message: contents });

			while (response.functionCalls && response.functionCalls.length > 0) {
				const call = response.functionCalls[0];

				messages = [
					...messages,
					{
						role: 'model',
						text: `\${m.ai_querying_db()} (*\${call.name}*)`,
						isToolCall: true
					}
				];

				if (toolHandlers[call.name!]) {
					try {
						const apiResponse = await toolHandlers[call.name!](call.args);
						response = await chatSession.sendMessage({
							message: [
								{
									functionResponse: {
										name: call.name,
										response: { result: apiResponse }
									}
								}
							]
						});
					} catch (toolErr: any) {
						response = await chatSession.sendMessage({
							message: [
								{
									functionResponse: {
										name: call.name,
										response: { error: toolErr.message }
									}
								}
							]
						});
					}
				} else {
					response = await chatSession.sendMessage({
						message: [
							{
								functionResponse: {
									name: call.name,
									response: { error: m.function_not_found() }
								}
							}
						]
					});
				}
			}

			if (response.text) {
				messages = messages.filter((m) => !m.isToolCall);
				messages = [...messages, { role: 'model', text: response.text }];
			}
		} catch (err: any) {
			console.error(err);
			toast.error(m.ai_error() + err.message);
		} finally {
			loading = false;
			setTimeout(() => {
				const container = document.getElementById('chat-container');
				if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
			}, 100);
		}
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex shrink-0 items-center justify-between pb-4">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-bold">
				<Sparkles class="text-primary" /> Assistente AI
			</h1>
			<p class="text-sm text-muted-foreground">{m.powered_by()} {userSettings.geminiModel}</p>
		</div>
		<Button variant="outline" size="sm" href="/settings">
			<Settings class="mr-2 h-4 w-4" /> API Key
		</Button>
	</div>

	{#if !userSettings.geminiApiKey}
		<div
			class="mx-auto mt-8 max-w-2xl rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive"
		>
			<AlertTriangle class="mx-auto mb-2 h-8 w-8 opacity-80" />
			<p class="mb-2 font-medium">{m.ai_not_configured()}</p>
			<p class="mb-4 text-sm opacity-90">
				È necessaria una chiave API gratuita di Google Gemini per utilizzare la chat e l'analisi
				scontrini.
			</p>
			<Button variant="outline" href="/settings" class="bg-background text-foreground">
				{m.configure_now()}
			</Button>
		</div>
	{:else}
		<div
			id="chat-container"
			class="flex-1 overflow-y-auto px-2 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden"
		>
			<div class="mx-auto flex max-w-4xl flex-col space-y-6 pb-6">
				{#each messages as msg}
					<div class="flex w-full {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="flex max-w-[90%] gap-3 md:max-w-[75%] {msg.role === 'user'
								? 'flex-row-reverse'
								: 'flex-row'}"
						>
							<!-- Icona Mittente -->
							<div
								class="mt-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full {msg.role ===
								'user'
									? 'bg-primary/20 text-primary'
									: 'bg-muted text-muted-foreground'}"
							>
								{#if msg.role === 'user'}
									<UserIcon class="h-4 w-4" />
								{:else}
									<Sparkles class="h-4 w-4" />
								{/if}
							</div>

							<!-- Bolla Messaggio -->
							<div class="flex flex-col gap-1 {msg.role === 'user' ? 'items-end' : 'items-start'}">
								<span class="px-1 text-xs font-medium text-muted-foreground">
									{msg.role === 'user' ? m.you() : 'Debt Manager AI'}
								</span>

								<div
									class="rounded-2xl px-5 py-3 shadow-sm {msg.role === 'user'
										? 'rounded-br-sm bg-primary text-primary-foreground'
										: msg.isToolCall
											? 'rounded-bl-sm border border-dashed bg-muted/50 text-sm text-muted-foreground italic opacity-70'
											: 'rounded-bl-sm border bg-card'}"
								>
									{#if msg.fileName}
										<div
											class="mb-3 flex w-max max-w-full items-center gap-3 rounded-lg bg-black/10 p-2 dark:bg-white/10"
										>
											{#if msg.fileUrl && !msg.fileName.toLowerCase().endsWith('.pdf')}
												<img
													src={msg.fileUrl}
													alt="uploaded"
													class="h-12 w-12 rounded object-cover shadow-sm"
												/>
											{:else}
												<div
													class="flex h-12 w-12 items-center justify-center rounded bg-background shadow-sm"
												>
													<FileText class="h-6 w-6 text-muted-foreground" />
												</div>
											{/if}
											<div class="flex flex-col overflow-hidden">
												<span class="truncate text-sm font-bold">{msg.fileName}</span>
												<span class="text-[10px] opacity-70">{m.attachment_sent()}</span>
											</div>
										</div>
									{/if}

									{#if msg.text}
										<div
											class="prose prose-sm max-w-none break-words dark:prose-invert prose-p:leading-relaxed prose-pre:my-0"
										>
											{#if msg.role === 'user' || msg.isToolCall}
												{msg.text}
											{:else}
												{@html marked.parse(msg.text, { breaks: true })}
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}

				<!-- Indicatore di caricamento -->
				{#if loading}
					<div class="flex w-full justify-start">
						<div class="flex max-w-[75%] flex-row gap-3">
							<div
								class="mt-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
							>
								<Sparkles class="h-4 w-4" />
							</div>
							<div class="flex flex-col items-start gap-1">
								<span class="px-1 text-xs font-medium text-muted-foreground"
									>{m.app_title()} AI</span
								>
								<div
									class="flex items-center gap-3 rounded-2xl rounded-bl-sm border bg-card px-5 py-3 text-sm text-muted-foreground shadow-sm"
								>
									<div class="flex gap-1">
										<span
											class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
											style="animation-delay: 0ms"
										></span>
										<span
											class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
											style="animation-delay: 150ms"
										></span>
										<span
											class="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
											style="animation-delay: 300ms"
										></span>
									</div>
									Elaborazione...
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Area di Input -->
		<div class="mx-auto w-full max-w-4xl shrink-0 pt-2 pb-2">
			{#if attachedFile}
				<div
					class="mb-2 flex w-max max-w-full items-center gap-2 rounded-lg border bg-card p-2 pr-3 shadow-sm"
				>
					<div class="flex h-8 w-8 items-center justify-center rounded bg-muted">
						{#if attachedFile.type.startsWith('image/')}
							<ImageIcon class="h-4 w-4 text-muted-foreground" />
						{:else}
							<FileText class="h-4 w-4 text-muted-foreground" />
						{/if}
					</div>
					<span class="truncate text-xs font-medium">{attachedFile.name}</span>
					<button
						type="button"
						class="ml-2 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
						onclick={() => (attachedFile = null)}
					>
						<X class="h-4 w-4" />
					</button>
				</div>
			{/if}

			<form
				onsubmit={sendMessage}
				class="flex items-end gap-2 overflow-hidden rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring"
			>
				<label class="shrink-0 cursor-pointer">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<Paperclip class="h-5 w-5" />
					</div>
					<input
						type="file"
						class="hidden"
						accept="image/*,application/pdf"
						onchange={(e) => {
							const tgt = e.target as HTMLInputElement;
							if (tgt.files?.length) attachedFile = tgt.files[0];
							tgt.value = ''; // Reset the input so the same file can be selected again if removed
						}}
					/>
				</label>

				<textarea
					bind:value={inputPrompt}
					placeholder={m.chat_placeholder()}
					class="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					disabled={loading}
					rows="1"
					onkeydown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							sendMessage();
						}
					}}
				></textarea>

				<Button
					type="submit"
					size="icon"
					class="mb-0.5 h-9 w-9 shrink-0 rounded-full"
					disabled={loading || (!inputPrompt.trim() && !attachedFile)}
				>
					<Send class="h-4 w-4" />
				</Button>
			</form>
			<p class="mt-2 text-center text-[10px] text-muted-foreground">{m.chat_disclaimer()}</p>
		</div>
	{/if}
</div>
