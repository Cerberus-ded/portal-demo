<script lang="ts">
	import { href } from '#lib';
	import Crumbs from '#lib/components/Crumbs.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const NAMES: Record<string, string> = {
		soglasie: 'Согласии на обработку персональных данных',
		politika: 'Политике обработки персональных данных',
		cookie: 'Согласии на обработку данных с помощью cookie и Яндекс Метрики'
	};
	// [[ключ|подсказка]]: реквизит салона или выделенная подсказка; {soglasie}, {politika}, {cookie}: ссылка на другой документ
	type Part = { t: 'text'; s: string } | { t: 'fill'; s: string; hint: boolean } | { t: 'link'; k: string };
	function parts(s: string): Part[] {
		return s
			.split(/(\[\[.*?\]\]|\{soglasie\}|\{politika\}|\{cookie\})/)
			.filter(Boolean)
			.map((part): Part => {
				if (/^\[\[/.test(part)) {
					const bits = part.slice(2, -2).split('|'),
						key = bits.length > 1 ? bits[0] : null,
						hint = bits[bits.length - 1];
					return key && data.legal[key] ? { t: 'fill', s: data.legal[key], hint: false } : { t: 'fill', s: hint, hint: true };
				}
				if (/^\{(soglasie|politika|cookie)\}$/.test(part)) return { t: 'link', k: part.slice(1, -1) };
				return { t: 'text', s: part };
			});
	}
	const holes = $derived(JSON.stringify(data.doc.blocks).includes('[[') && Object.values(data.legal).some((v) => !v));
</script>

<svelte:head>
	<title>{data.doc.title}, салон Портал</title>
</svelte:head>

{#snippet rich(s: string)}
	{#each parts(s) as p, i (i)}
		{#if p.t === 'text'}{p.s}{:else if p.t === 'fill'}{#if p.hint}<mark class="legal-fill">{p.s}</mark>{:else}{p.s}{/if}{:else}<a href={href.doc(p.k)}>{NAMES[p.k]}</a>{/if}
	{/each}
{/snippet}

<main class="container">
	<Crumbs trail={[[data.doc.title]]} />
	<article class="docpage">
		<h1>{data.doc.title}</h1>
		<p class="doc__ver">Редакция от {data.doc.v}</p>
		{#each data.doc.blocks as b, i (i)}
			{#if b[0] === 'ul'}
				<ul>{#each b[1] as s, j (j)}<li>{@render rich(s)}</li>{/each}</ul>
			{:else if b[0] === 'h3'}
				<h3>{@render rich(b[1])}</h3>
			{:else}
				<p>{@render rich(b[1])}</p>
			{/if}
		{/each}
		{#if holes}<p class="doc__note">Поля, выделенные цветом, салон заполнит своими реквизитами. Перед запуском сайта текст стоит показать юристу.</p>{/if}
	</article>
</main>
