<script lang="ts">
	// Реквизит салона из r31/legal.json, а пока его нет, выделенная подсказка (как {{ключ|подсказка}} в демо)
	let { legal, k, hint }: { legal: Record<string, string>; k: string; hint: string } = $props();
</script>

{#if legal[k]}{legal[k]}{:else}<mark class="legal-fill">{hint}</mark>{/if}
