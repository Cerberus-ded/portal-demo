<script lang="ts">
	import { href } from '#lib';
	// путь: [подпись, адрес]; последняя строка без адреса — текущая страница
	let { trail = [] }: { trail?: [string, string?][] } = $props();
</script>

<nav class="crumbs" aria-label="Хлебные крошки">
	<ol>
		<li><a href={href.home()}>Главная</a></li>
		{#each trail as [label, to], i (i)}
			<li aria-current={to ? undefined : 'page'}>{#if to}<a href={to}>{label}</a>{:else}{label}{/if}</li>
		{/each}
	</ol>
</nav>
