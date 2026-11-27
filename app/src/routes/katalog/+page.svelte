<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { href, file } from '#lib';
	import { plural } from '#lib/text';
	import Crumbs from '#lib/components/Crumbs.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// старые ссылки демо-версии (katalog.html#раздел-КОД) ведут на новые адреса
	onMount(() => {
		const h = decodeURIComponent(location.hash.slice(1));
		if (!h) return;
		const [id, code] = h.includes('/') ? h.split('/') : [h.slice(0, Math.max(0, h.indexOf('-'))) || h, h.slice(h.indexOf('-') + 1)];
		if (['soglasie', 'politika', 'cookie'].includes(h)) goto(href.doc(h), { replaceState: true });
		else if (h === 'korzina') goto(href.cart(), { replaceState: true });
		else if (h === 'zayavki') goto(href.desk(), { replaceState: true });
		else if (data.full.some((s) => s.id === h) || data.soon.some((s) => s.id === h)) goto(href.section(h), { replaceState: true });
		else if (code && code !== h) goto(href.item(id, code.toLowerCase()), { replaceState: true });
	});

	function open(ev: MouseEvent, to: string) {
		if (ev.ctrlKey || ev.metaKey || ev.shiftKey || (ev.target as Element).closest('a')) return;
		goto(to);
	}
</script>

<svelte:head>
	<title>Каталог салона Портал, Димитровград</title>
</svelte:head>

<main class="container">
	<Crumbs trail={[['Каталог']]} />
	<div class="pagehead">
		<h1>Каталог</h1>
		<p>
			Каталог собираем заново, по коллекциям фабрик. Межкомнатные двери: Лорд, Зодчий, Андора, Хамелеон, Адема и серия «Лайн», у каждой
			коллекции все её модели. Входные: квартирные и уличные двери Торекс, дизайн любой на выбор.
		</p>
		<button type="button" class="seekfield" data-seek
			><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"
				><circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M15.2 15.2 20.5 20.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg
			><span>Найти коллекцию, фабрику, размер или артикул</span><kbd>/</kbd></button
		>
	</div>

	<div class="overview">
		{#each data.full as s (s.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
			<article class="card card--sec lift" onclick={(ev) => open(ev, href.section(s.id))}>
				<div class="pic">
					<img class="pic__img" src={file(s.lead.cover.s)} width={s.lead.cover.sw} height={s.lead.cover.sh} alt={s.lead.name + ', ' + s.lead.brand} decoding="async" />
				</div>
				<div class="card__body">
					<h2><a class="card__link" href={href.section(s.id)}>{s.short}</a></h2>
					<p class="card__brand">{s.brands}</p>
					<div class="card__meta"><span><b>{s.n}</b> {plural(s.n, 'коллекция', 'коллекции', 'коллекций')}</span></div>
				</div>
			</article>
		{/each}
		{#if data.soon.length}
			<section class="soon">
				<h2>Скоро в каталоге</h2>
				<p>Каталог собираем заново, по коллекциям фабрик. Эти разделы наполним следующими, а пока их ассортимент можно посмотреть в салоне.</p>
				<ul>
					{#each data.soon as s (s.id)}<li><a href={href.section(s.id)}>{s.name}</a></li>{/each}
				</ul>
			</section>
		{/if}
	</div>
</main>
