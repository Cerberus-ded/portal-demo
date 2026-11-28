<script lang="ts">
	// Раздел каталога: фильтры слева, сетка коллекций справа. Перенесено из r31/cat.js (renderFacets, renderGrid).
	// Выбранные фильтры и сортировка лежат в адресе (?brand=Лорд&style=Классика&sort=name): ссылку можно переслать.
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import { href, file } from '#lib';
	import { SALON } from '#lib/site.ts';
	import { plural } from '#lib/text.ts';
	import Crumbs from '#lib/components/Crumbs.svelte';
	import type { Card, Facet } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const sec = $derived(data.sec);
	const pool = $derived(data.cards);

	const SOON =
		'Каталог собираем заново, по коллекциям фабрик. Начали с дверей, этот раздел добавим следующим. Пока ассортимент можно посмотреть в салоне или спросить по телефону.';
	const SORTS: [string, string][] = [['brand', 'по фабрикам'], ['name', 'по названию'], ['vars', 'по числу моделей']];
	// входные двери у фабрики делятся на квартирные и уличные (для частного дома): сначала квартирные
	const KINDS: [string, string][] = [['Квартирные', 'Квартирные двери'], ['Уличные', 'Уличные двери для частного дома']];

	let active = $state<Record<string, string[]>>({});
	let sortBy = $state('brand');
	let railOpen = $state(false);
	let closed = $state<Record<string, boolean>>({});

	// фильтры из адреса: при открытии страницы, из поиска и по кнопкам «назад» и «вперёд»
	$effect(() => {
		if (!browser) return;
		const q = page.url.searchParams,
			next: Record<string, string[]> = {};
		for (const f of sec.facets) {
			const v = q.get(f.id);
			if (v) next[f.id] = v.split(',').filter(Boolean);
		}
		active = next;
		sortBy = SORTS.some(([k]) => k === q.get('sort')) ? q.get('sort')! : 'brand';
	});
	function keep() {
		const q = new URLSearchParams();
		for (const [k, v] of Object.entries(active)) if (v.length) q.set(k, v.join(','));
		if (sortBy !== 'brand') q.set('sort', sortBy);
		const s = q.toString().replace(/%2C/g, ',');
		replaceState(href.section(sec.id, s ? '?' + s : ''), {});
	}

	function valuesOf(item: Card, facet: Facet): string[] {
		if (facet.id === 'brand') return [item.brand];
		if (facet.variantLevel) return item.fins;
		const val = item.f[facet.id];
		return val ? ([] as string[]).concat(val) : [];
	}
	function optionsOf(facet: Facet) {
		if (facet.opts) return facet.opts;
		const seen: string[] = [];
		for (const i of pool) for (const v of valuesOf(i, facet)) if (!seen.includes(v)) seen.push(v);
		return seen;
	}
	function matches(item: Card, skip: string | null) {
		return sec.facets.every((facet) => {
			if (facet.id === skip) return true;
			const chosen = active[facet.id];
			if (!chosen || !chosen.length) return true;
			const vals = valuesOf(item, facet);
			return chosen.some((c) => vals.includes(c));
		});
	}
	const brandRank = (item: Card) => {
		const i = (sec.facets[0].opts || []).indexOf(item.brand);
		return i < 0 ? 999 : i;
	};
	const kindOf = (i: Card) => ([] as string[]).concat(i.f.kind || [])[0] || '';
	const kindRank = (i: Card) => {
		const k = KINDS.findIndex(([n]) => n === kindOf(i));
		return k < 0 ? KINDS.length : k;
	};

	// Только то, что есть в разделе: строка с вечным нулём выглядит как пустой каталог.
	// Без товаров раздел показывает будущие фильтры целиком, а один вариант на всех ничего не отбирает.
	const facets = $derived(
		sec.facets
			.map((facet) => {
				let opts = optionsOf(facet);
				if (pool.length) {
					opts = opts.filter((val) => pool.some((i) => valuesOf(i, facet).includes(val)));
					if (opts.length === 1 && pool.every((i) => valuesOf(i, facet).includes(opts[0]))) opts = [];
				}
				return {
					facet,
					opts: opts.map((val) => ({
						val,
						on: (active[facet.id] || []).includes(val),
						n: pool.filter((i) => matches(i, facet.id) && valuesOf(i, facet).includes(val)).length
					}))
				};
			})
			.filter((x) => x.opts.length)
	);
	const chips = $derived(sec.facets.flatMap((facet) => (active[facet.id] || []).map((val) => ({ facet, val }))));

	const found = $derived(
		pool
			.filter((i) => matches(i, null))
			.sort((a, b) => {
				if (sortBy === 'vars') return b.n - a.n || a.name.localeCompare(b.name, 'ru');
				if (sortBy === 'brand') return brandRank(a) - brandRank(b) || kindRank(a) - kindRank(b) || a.name.localeCompare(b.name, 'ru');
				return a.name.localeCompare(b.name, 'ru');
			})
	);
	const series = $derived(pool.some((x) => x.any));

	// заголовки групп в сетке: фабрика, у входных дверей ещё квартирные и уличные
	type Row = { head?: { brand: string; n: number }; sub?: { name: string; n: number }; item: Card };
	const rows = $derived.by(() => {
		const out: Row[] = [];
		let lastBrand: string | null = null,
			lastKind: string | null = null;
		for (const item of found) {
			const r: Row = { item };
			if (sortBy === 'brand' && item.brand !== lastBrand) {
				lastBrand = item.brand;
				lastKind = null;
				r.head = { brand: item.brand, n: found.filter((x) => x.brand === item.brand).length };
			}
			if (sortBy === 'brand' && item.s === 'vhodnye' && kindOf(item) && kindOf(item) !== lastKind) {
				lastKind = kindOf(item);
				const k = lastKind;
				r.sub = { name: (KINDS.find(([n]) => n === k) || [k, k])[1], n: found.filter((x) => x.brand === item.brand && kindOf(x) === k).length };
			}
			out.push(r);
		}
		return out;
	});

	function toggle(facet: Facet, val: string, on: boolean) {
		const list = active[facet.id] || [];
		active[facet.id] = on ? list.concat([val]) : list.filter((x) => x !== val);
		if (!active[facet.id].length) delete active[facet.id];
		keep();
	}
	function resetAll() {
		active = {};
		keep();
	}
	function open(ev: MouseEvent, to: string) {
		if (ev.ctrlKey || ev.metaKey || ev.shiftKey || (ev.target as Element).closest('a')) return;
		goto(to);
	}
	const unit = (any: boolean, n: number) =>
		any ? plural(n, 'серия', 'серии', 'серий') : plural(n, 'коллекция', 'коллекции', 'коллекций');
</script>

<svelte:head>
	<title>{sec.name}: каталог салона Портал</title>
</svelte:head>

<main class="container">
	<Crumbs trail={[['Каталог', href.catalog()], [sec.short]]} />
	<div class="pagehead">
		<h1>{sec.name}</h1>
		<p>{sec.intro}</p>
	</div>

	<div class="layout">
		<aside class="rail" id="rail" aria-label="Разделы и фильтры" data-open={railOpen || undefined}>
			<div class="rail__block">
				<p class="rail__title">Разделы каталога</p>
				<div class="cats">
					{#each page.data.nav as s (s.id)}
						<a href={href.section(s.id)} aria-current={s.id === sec.id ? 'true' : 'false'}><span>{s.name}</span><em>{s.n}</em></a>
					{/each}
				</div>
			</div>
			<div class="rail__block">
				<div class="rail__row">
					<p class="rail__title">Фильтры</p>
					<button type="button" class="rail__reset" disabled={!chips.length} onclick={resetAll}>Сбросить</button>
				</div>
				<div>
					{#each facets as { facet, opts } (facet.id)}
						<details class="facet" open={closed[facet.id] !== true} ontoggle={(ev) => (closed[facet.id] = !(ev.currentTarget as HTMLDetailsElement).open)}>
							<summary>{facet.label}</summary>
							<div class="facet__body">
								{#each opts as o, k (o.val)}
									{@const id = `f-${sec.id}-${facet.id}-${k}`}
									<label class="opt" for={id}>
										<input type="checkbox" {id} checked={o.on} disabled={o.n === 0 && !o.on} onchange={(ev) => toggle(facet, o.val, (ev.currentTarget as HTMLInputElement).checked)} />
										<span>{o.val}</span>
										<em>{o.n}</em>
									</label>
								{/each}
							</div>
						</details>
					{/each}
				</div>
			</div>
		</aside>

		<div class="results">
			<div class="toolbar">
				<p>
					{#if !pool.length}Раздел пока пуст{:else}Показано {found.length} из {pool.length} {series ? plural(pool.length, 'серии', 'серий', 'серий') : plural(pool.length, 'коллекции', 'коллекций', 'коллекций')}{/if}
				</p>
				<label class="sort">
					<span>Сортировка</span>
					<select bind:value={sortBy} onchange={keep}>
						{#each SORTS as [v, label] (v)}<option value={v}>{label}</option>{/each}
					</select>
				</label>
				<button type="button" class="btn btn--outline btn--mini railtoggle" aria-controls="rail" aria-expanded={railOpen} onclick={() => (railOpen = !railOpen)}>Фильтры</button>
			</div>
			<div class="chips">
				{#each chips as c (c.facet.id + c.val)}
					<button type="button" class="chip" aria-label={`Убрать фильтр ${c.facet.label.toLowerCase()}: ${c.val}`} onclick={() => toggle(c.facet, c.val, false)}><b>{c.val}</b><i>×</i></button>
				{/each}
			</div>

			{#if !pool.length}
				<div class="empty">
					<h2>Раздел наполняем</h2>
					<p>{SOON}</p>
					<div class="empty__act">
						<a class="btn btn--outline" href={SALON.tel}>Позвонить в салон</a>
						{#if sec.id !== 'mezhkomnatnye'}<a class="btn" href={href.section('mezhkomnatnye')}>Межкомнатные двери</a>{/if}
					</div>
				</div>
			{:else if !found.length}
				<div class="empty">
					<h2>Под эти фильтры ничего не подошло</h2>
					<p>Снимите один из фильтров сверху или сбросьте все и начните заново.</p>
					<button type="button" class="btn" onclick={resetAll}>Сбросить фильтры</button>
				</div>
			{:else}
				<!-- входные двери: на фото серии две двери рядом, снаружи и изнутри, карточкам нужна ширина -->
				<div class="grid" class:grid--pair={found.some((x) => x.any)}>
					{#each rows as { head, sub, item } (item.code)}
						{#if head}
							<div class="grid__group"><h2>{head.brand}</h2><span>{head.n} {unit(!!item.any, head.n)}</span></div>
						{/if}
						{#if sub}
							<div class="grid__group grid__group--sub"><h3>{sub.name}</h3><span>{sub.n} {plural(sub.n, 'серия', 'серии', 'серий')}</span></div>
						{/if}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
						<article class={item.any ? 'card card--pair lift' : 'card lift'} onclick={(ev) => open(ev, href.item(item.s, item.slug))}>
							<div class="pic">
								<img class="pic__img" src={file(item.cover.s)} width={item.cover.sw} height={item.cover.sh} alt={item.cover.name + ', ' + item.brand} loading="lazy" decoding="async" />
							</div>
							<div class="card__body">
								<h3><a class="card__link" href={href.item(item.s, item.slug)}>{item.name}</a></h3>
								<p class="card__brand">{[item.brand].concat((item.f.style as string[]) || []).join(' · ')}</p>
								<div class="card__meta">
									<span>{#if item.any}<b>Дизайн на выбор</b>{:else}<b>{item.n}</b> {plural(item.n, 'модель', 'модели', 'моделей')}{/if}</span>
									<span class="card__price">цена по запросу</span>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</main>
