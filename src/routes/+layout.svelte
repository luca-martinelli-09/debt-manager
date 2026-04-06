<script lang="ts">
	import './layout.css';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Plus } from '@lucide/svelte';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<ModeWatcher />
<Toaster position="top-center" richColors />

<Sidebar.Provider>
	<AppSidebar />
	<main class="relative flex min-h-screen flex-1 flex-col overflow-x-hidden">
		<header class="flex h-16 items-center border-b px-4 lg:px-6">
			<Sidebar.Trigger />
			<div class="ml-4 flex-1">
				<h1 class="text-lg font-semibold">Debt Manager</h1>
			</div>
		</header>
		<div class="flex-1 p-4 md:p-6 lg:p-8">
			{@render children()}
		</div>

		<!-- FAB for New Expense -->
		<div class="fixed right-6 bottom-6 md:right-8 md:bottom-8 lg:right-10 lg:bottom-10">
			<Button
				href="/expenses/new"
				size="icon"
				class="h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
			>
				<Plus class="h-6 w-6" />
				<span class="sr-only">Nuova Spesa</span>
			</Button>
		</div>
	</main>
</Sidebar.Provider>
