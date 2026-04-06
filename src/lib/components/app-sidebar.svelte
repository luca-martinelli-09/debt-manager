<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Home, Receipt, Settings, Sparkles, Tag, User, Users } from '@lucide/svelte';

	let items = $derived([
		{ title: m.nav_dashboard(), url: '/', icon: Home },
		{ title: m.nav_ai_assistant(), url: '/chat', icon: Sparkles },
		{ title: m.nav_expenses(), url: '/expenses', icon: Receipt },
		{ title: m.nav_groups(), url: '/groups', icon: Users },
		{ title: m.nav_contacts(), url: '/contacts', icon: User },
		{ title: m.nav_categories(), url: '/categories', icon: Tag },
		{ title: m.nav_settings(), url: '/settings', icon: Settings }
	]);
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>{m.app_title()}</Sidebar.GroupLabel>
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
