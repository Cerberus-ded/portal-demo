<script lang="ts">
	// Страница коллекции: все модели, крупно по нажатию, заявка на выбранную. Перенесено из r31/cat.js (renderDetail).
	// ?m=3 в адресе: открыть с выбранной моделью (так ведёт поиск).
	import { onMount, tick } from 'svelte';
	import { href, file } from '#lib';
	import { SALON } from '#lib/site';
	import { cart } from '#lib/cart.svelte';
	import { lineOf, lineText, plural } from '#lib/text';
	import Crumbs from '#lib/components/Crumbs.svelte';
	import OrderForm from '#lib/components/OrderForm.svelte';
	import Viewer from '#lib/components/Viewer.svelte';
	import Kit from '#lib/components/Kit.svelte';
	import Finishes from '#lib/components/Finishes.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const item = $derived(data.item);
	const n = $derived(item.vars.length);

	let selected = $state(0);
	let added = $state(false);
	let barShown = $state(false);
	let viewer: Viewer | undefined = $state();
	let form: OrderForm | undefined = $state();
	let ask: HTMLButtonElement | undefined = $state();
	let tiles: HTMLButtonElement[] = $state([]);

	// из поиска пришли к конкретной модели: она в рамке и видна
	onMount(() => {
		const m = Number(new URLSearchParams(location.search).get('m'));
		selected = m > 0 && m < item.vars.length ? m : item.cover || 0;
		if (selected) tick().then(() => tiles[selected]?.scrollIntoView({ block: 'nearest' }));
	});

	// на телефоне кнопка заявки закреплена внизу, пока на экране нет ни верхней кнопки, ни формы
	$effect(() => {
		const formEl = form?.root();
		if (!ask || !formEl) return;
		const seen: Record<string, boolean> = {};
		const io = new IntersectionObserver((list) => {
			for (const e of list) seen[e.target === ask ? 'ask' : 'form'] = e.isIntersecting;
			barShown = !(seen.ask || seen.form);
			if (barShown) document.body.setAttribute('data-askbar', '1');
			else document.body.removeAttribute('data-askbar');
		});
		io.observe(ask);
		io.observe(formEl);
		return () => {
			io.disconnect();
			document.body.removeAttribute('data-askbar');
		};
	});

	const line = (i: number, q: number | null) => lineOf(item, item.vars[i], q, null, data.F);
	function addToCart(i: number) {
		cart.load();
		cart.add(line(i, 1));
	}
	function toCart() {
		addToCart(selected);
		added = true;
		setTimeout(() => (added = false), 1400);
	}
	const kick = $derived([data.sec.short, item.brand].concat((item.f.style as string[]) || []).join(' · '));
	const styles = $derived(([] as string[]).concat((item.f.style as string[]) || []));
	const street = $derived(([] as string[]).concat((item.f.kind as string[]) || []).includes('Уличные'));
</script>

<svelte:head>
	<title>{item.name}, {item.brand}: каталог салона Портал</title>
</svelte:head>

<main class="container">
	<Crumbs trail={[['Каталог', href.catalog()], [data.sec.short, href.section(item.s)], [item.name]]} />

	<div class="detail">
		<a class="btn btn--outline btn--mini detail__back" href={href.section(item.s)}>← Назад к коллекциям</a>

		<div class="detail__top">
			<div class="detail__title">
				<p class="detail__kick">{kick}</p>
				<h1>{item.name}</h1>
			</div>
			<p>{item.any ? 'Дизайн любой на выбор · цена по запросу' : `${n} ${plural(n, 'модель', 'модели', 'моделей')} · цена по запросу`}</p>
		</div>

		<div class="coll">
			<section class="coll__models" aria-labelledby="models-h">
				<div class="variants__head">
					<h2 id="models-h">{item.any ? 'Пример дизайна' : 'Модели коллекции'}</h2>
					<span class="count">{item.any ? 'снаружи и изнутри, нажмите, чтобы рассмотреть' : 'нажмите на дверь, чтобы рассмотреть'}</span>
				</div>
				<ul class={item.any ? 'models models--pair' : 'models'}>
					{#each item.vars as x, i (x.code)}
						<li>
							<button type="button" class={item.any ? 'model model--pair' : 'model'} aria-pressed={i === selected} aria-label={'Рассмотреть крупно: ' + x.name}
								bind:this={tiles[i]} onclick={() => { selected = i; viewer?.open(i); }}>
								<span class="model__pic"><img class="model__img" src={file(x.s)} width={x.sw} height={x.sh} alt={'Дверь ' + x.name} loading={i < 8 ? 'eager' : 'lazy'} decoding="async" /></span>
								<span class="model__name">{x.name}</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if item.fin}<Finishes {item} colors={data.colors} />{/if}
			</section>

			<div class="coll__side">
				<div class="pick">
					<div class="pick__info">
						<p class="pick__tag">{item.any ? 'Серия ' + item.name : 'Выбрана модель'}</p>
						<p class="pick__name">{item.vars[selected].name}</p>
						<p class="pick__fin">{item.brand}{item.any ? (street ? ', уличная входная дверь' : ', квартирная входная дверь') : ', коллекция ' + item.name}</p>
					</div>
					<!-- дизайн серии любой: так и говорим, цену называет менеджер -->
					{#if item.any}
						<p class="pick__note">Дизайн снаружи и изнутри любой на выбор из каталога фабрики. Цена зависит от выбранного дизайна, назовём её по запросу.</p>
					{/if}
					<div class="pick__act">
						<button type="button" class="btn" bind:this={ask} onclick={() => form?.focus()}>Оставить заявку</button>
						<button type="button" class="btn btn--outline" onclick={toCart}>{added ? 'Добавлено' : 'В корзину'}</button>
						<button type="button" class="btn btn--outline" onclick={() => viewer?.open(selected)}>Рассмотреть крупно</button>
					</div>
				</div>

				<!-- что фабрика пишет о коллекции -->
				<section class="specs">
					<h2>{item.any ? 'О серии' : 'О коллекции'}</h2>
					{#if item.about}<p class="specs__about">{item.about}</p>{/if}
					<table>
						<tbody>
							<tr><th>Фабрика</th><td>{item.brand}</td></tr>
							{#if styles.length}<tr><th>Стиль</th><td>{styles.join(', ')}</td></tr>{/if}
							{#each item.specs || [] as [k, v, list], i (i)}
								{#if v === null}
									<!-- строка без значения — группа таблицы из прайса фабрики («Полотно», «Короб») -->
									<tr class="specs__grp"><th colspan="2" scope="colgroup">{k}</th></tr>
								{:else}
									<tr>
										<th>{k}</th>
										<td>
											{#if list && list.length}
												<!-- длинный перечень (цвета покрытия) прячется под строкой «N вариантов» -->
												<details class="specs__list"><summary>{v}</summary><p>{list.join(', ')}</p></details>
											{:else}{v}{/if}
										</td>
									</tr>
								{/if}
							{/each}
							{#if item.sizes}<tr><th>Размеры</th><td>{item.sizes}</td></tr>{/if}
							{#if item.any}<tr><th>Дизайн</th><td>любой на выбор, цена зависит от дизайна, по запросу</td></tr>
							{:else}<tr><th>Моделей в коллекции</th><td>{n}</td></tr>{/if}
						</tbody>
					</table>
					{#each item.specNote || [] as s, i (i)}<p class="specs__note">{s}</p>{/each}
					{#if item.url}
						<a class="detail__src" href={item.url} target="_blank" rel="noopener">{item.any ? 'Серия' : 'Коллекция'} на сайте фабрики {item.brand}</a>
					{/if}
				</section>

				<section class="visit">
					<h2>Посмотреть вживую</h2>
					<p>Образцы стоят в салоне: цвет и фактуру по экрану не выбрать.</p>
					<dl>
						<dt>Адрес</dt><dd>{SALON.address}</dd>
						<dt>Телефон</dt><dd><a href={SALON.tel}>{SALON.phone}</a></dd>
						<dt>Часы</dt><dd>{SALON.hours}</dd>
						<dt>Пишите</dt><dd><a href={SALON.vk} target="_blank" rel="noopener">ВКонтакте</a></dd>
					</dl>
				</section>
			</div>
		</div>

		{#if data.kit}<Kit {item} kit={data.kit} />{/if}

		<div class="coll__form">
			{#key item.code}
				<OrderForm bind:this={form} key="one" qty={{ unit: 'шт.', one: true }} consentV={data.consentV}
					hint={item.any ? 'Размер проёма, сторона открывания, какой дизайн нравится снаружи и изнутри, нужен ли замер' : 'Размер проёма, сторона открывания, покрытие и цвет, нужен ли замер'}
					what={lineText(line(selected, null))}
					lines={(q) => [line(selected, q)]} />
			{/key}
		</div>

		<div class="askbar" hidden={!barShown}>
			<span>{item.vars[selected].name}</span>
			<button type="button" class="btn" onclick={() => form?.focus()}>Оставить заявку</button>
		</div>
	</div>
</main>

<Viewer {item} bind:this={viewer} bind:at={selected} onCart={addToCart} onForm={(i) => { selected = i; form?.focus(); }} />
