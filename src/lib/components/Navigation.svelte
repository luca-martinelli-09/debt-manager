<script lang="ts">
	import { House, Users, Layers, Receipt, Settings } from '@lucide/svelte';
	import { page } from '$app/state';

	const navItems = [
		{ href: '/', icon: House, label: 'Home' },
		{ href: '/groups', icon: Layers, label: 'Gruppi' },
		{ href: '/expenses', icon: Receipt, label: 'Spese' },
		{ href: '/contacts', icon: Users, label: 'Contatti' },
		{ href: '/settings', icon: Settings, label: 'Impostazioni' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<nav
	class="pb-safe fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-t-muted bg-background pt-2 sm:hidden"
>
	{#each navItems as { href, icon: Icon, label }}
		<a
			{href}
			class="flex flex-col items-center gap-1 p-2 transition-colors {isActive(href)
				? 'text-primary'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<Icon class="h-6 w-6" />
			<span class="text-[10px] font-medium">{label}</span>
		</a>
	{/each}
</nav>

<!-- Sidebar per desktop (opzionale, ma utile) -->
<aside
	class="sticky top-0 hidden h-screen w-64 flex-col border-r border-r-muted bg-muted/30 p-4 sm:flex"
>
	<div class="mb-8 px-2 text-xl font-bold">Debt Manager</div>
	<nav class="flex flex-1 flex-col gap-2">
		{#each navItems as { href, icon: Icon, label }}
			<a
				{href}
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(
					href
				)
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
			>
				<Icon class="h-5 w-5" />
				{label}
			</a>
		{/each}
	</nav>
</aside>
