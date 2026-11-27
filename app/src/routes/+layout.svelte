<script lang="ts">
	import '@fontsource/cormorant-garamond/400.css';
	import '@fontsource/cormorant-garamond/500.css';
	import '@fontsource/cormorant-garamond/600.css';
	import '@fontsource-variable/manrope';
	import '#lib/styles/base.css';
	import '#lib/styles/home.css';
	import '#lib/styles/catalog.css';
	import '#lib/styles/app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { href, file } from '#lib';
	import { INDEXING } from '#lib/site';
	import { cookies } from '#lib/cookies.svelte';
	import { createSeek } from '#lib/seek/seek.js';
	import Topbar from '#lib/components/Topbar.svelte';
	import Foot from '#lib/components/Foot.svelte';
	import CookieBar from '#lib/components/CookieBar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// правила главной и каталога из демо лежат каждое под своим классом (src/lib/styles/home.css, catalog.css)
	const pg = $derived(page.route.id === '/' ? 'pg-home' : 'pg-cat');

	type SeekItem = { s: string; slug: string; dir: string; cover: number; vars: { code: string }[] };
	const query = (pick: Record<string, string[]>) =>
		'?' + Object.entries(pick).map(([k, v]) => encodeURIComponent(k) + '=' + v.map(encodeURIComponent).join(',')).join('&');

	onMount(() => {
		cookies.start(data.metrika);
		// поиск: окно из демо-версии, данные static/seek.json грузятся при первом открытии
		createSeek({
			load: () => fetch(file('seek.json')).then((r) => (r.ok ? r.json() : Promise.reject(new Error('seek ' + r.status)))),
			home: href.catalog(),
			cuts: true,
			thumb: (it: SeekItem, vi: number) => file(`foto/${it.dir}/s/${it.vars[vi >= 0 ? vi : it.cover || 0].code}.webp`),
			href: (it: SeekItem, vi: number) => href.item(it.s, it.slug, vi > 0 ? '?m=' + vi : ''),
			sectionHref: (id: string) => href.section(id),
			pick: (it: SeekItem, vi: number) => goto(href.item(it.s, it.slug, vi > 0 ? '?m=' + vi : '')),
			cut: (id: string, pick: Record<string, string[]>) => goto(href.section(id, query(pick)))
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if !INDEXING}<meta name="robots" content="noindex, nofollow" />{/if}
</svelte:head>

<div class={pg}>
	<Topbar nav={data.nav} total={data.total} />
	{@render children()}
	<Foot nav={data.nav} legal={data.legal} onCookies={() => (cookies.shown = true)} />
	<CookieBar />
</div>
