<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
	import { tick } from 'svelte';

	let {
		open = $bindable(false),
		onScan
	}: {
		open: boolean;
		onScan: (decodedText: string) => void;
	} = $props();

	let scanner: Html5Qrcode | null = null;
	const elementId = 'qr-reader';

	async function startScanner() {
		// Wait for Svelte to render the Dialog content and for the Portal to attach it
		await tick();

		// Even with tick, Portals can be tricky. We check for the element immediately.
		const element = document.getElementById(elementId);
		if (!element) {
			// If not found, it might be due to the entry animation.
			// We'll try once more after a tiny delay as a fallback.
			await new Promise((r) => setTimeout(r, 50));
			if (!document.getElementById(elementId)) {
				console.error('QR Scanner element not found in DOM');
				return;
			}
		}

		try {
			scanner = new Html5Qrcode(elementId, {
				formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
				verbose: false
			});

			await scanner.start(
				{ facingMode: 'environment' },
				{
					fps: 10,
					qrbox: { width: 250, height: 250 }
				},
				(decodedText) => {
					onScan(decodedText);
					stopScanner();
					open = false;
				},
				() => {
					// Silent failure for each frame
				}
			);
		} catch (err) {
			console.error('Failed to start scanner:', err);
		}
	}

	async function stopScanner() {
		if (scanner) {
			try {
				if ((scanner as any).isScanning) {
					await scanner.stop();
				}
				scanner.clear();
			} catch (err) {
				console.error('Failed to stop scanner:', err);
			}
			scanner = null;
		}
	}

	$effect(() => {
		if (open) {
			startScanner();
		} else {
			stopScanner();
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Scan QR Code</Dialog.Title>
		</Dialog.Header>
		<div class="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
			<div id={elementId} class="h-full w-full"></div>
		</div>
		<Dialog.Footer class="sm:justify-start">
			<Button type="button" variant="secondary" onclick={() => (open = false)}>
				{m.cancel()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(#qr-reader video) {
		object-fit: cover !important;
		width: 100% !important;
		height: 100% !important;
	}
</style>
