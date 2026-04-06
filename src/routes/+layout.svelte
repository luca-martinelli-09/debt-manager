<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	let { children } = $props();
</script>

<Toaster />
<ModeWatcher />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground sm:flex-row">
	<Navigation />
	<main class="flex-1 overflow-y-auto pb-20 sm:pb-0">
		<div class="mx-auto max-w-4xl p-4 sm:p-8">
			{@render children()}
		</div>
	</main>
</div>
