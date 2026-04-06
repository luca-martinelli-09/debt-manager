<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Home, Receipt, Settings, Sparkles, Tag, User, Users } from '@lucide/svelte';

	const items = [
		{ title: 'Dashboard', url: '/', icon: Home },
		{ title: 'Assistente AI', url: '/chat', icon: Sparkles },
		{ title: 'Spese', url: '/expenses', icon: Receipt },
		{ title: 'Gruppi', url: '/groups', icon: Users },
		{ title: 'Contatti', url: '/contacts', icon: User },
		{ title: 'Categorie', url: '/categories', icon: Tag },
		{ title: 'Impostazioni', url: '/settings', icon: Settings }
	];
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Debt Manager</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each items as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<a href={item.url} {...props}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>
