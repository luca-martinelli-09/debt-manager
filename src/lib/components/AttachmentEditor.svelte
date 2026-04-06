<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Eye, FileText, Trash2 } from '@lucide/svelte';

	let { attachments = $bindable([]) } = $props<{ attachments: (File | Blob)[] }>();
</script>

<div class="space-y-3">
	<Label>{m.attachments_label()}</Label>
	<Input
		type="file"
		multiple
		accept="image/*,application/pdf"
		onchange={(e) => {
			const target = e.target as HTMLInputElement;
			if (target.files && target.files.length > 0) {
				attachments = [...attachments, ...Array.from(target.files)];
			}
		}}
	/>
	{#if attachments.length > 0}
		<div class="rounded-md border">
			<table class="w-full text-sm">
				<tbody>
					{#each attachments as att, i}
						<tr class="border-b last:border-0 hover:bg-muted/50">
							<td class="p-2">
								<div class="flex items-center gap-2">
									<FileText class="h-4 w-4 shrink-0 text-muted-foreground" />
									<span class="block max-w-[200px] truncate sm:max-w-xs">
										{att instanceof File ? att.name : `${m.attachment_prefix()} ${i + 1}`}
									</span>
								</div>
							</td>
							<td class="w-[100px] p-2 text-right">
								<div class="flex justify-end gap-1">
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8"
										type="button"
										onclick={() => {
											const url = URL.createObjectURL(att);
											window.open(url, '_blank');
										}}
									>
										<Eye class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8 text-destructive"
										type="button"
										onclick={() => {
											attachments = attachments.filter((_: any, idx: number) => idx !== i);
										}}
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
