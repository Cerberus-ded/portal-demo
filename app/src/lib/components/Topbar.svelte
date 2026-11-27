<script lang="ts">
	// Верхняя полоса демо и шапка: салон, меню с разделами каталога, поиск, телефон, корзина.
	// Перенесено из r31/cat.body.html и home.body.html: та же разметка и те же классы base.css.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { href } from '#lib';
	import { SALON, DEMO } from '#lib/site';
	import { cart } from '#lib/cart.svelte';
	import { collections } from '#lib/text';
	import { freshCount, resetDemo, watchOrders } from '#lib/orders';
	import type { NavSection } from '#lib/types';

	let { nav, total }: { nav: NavSection[]; total: number } = $props();

	let drop = $state(false),
		menu = $state(false),
		stuck = $state(false),
		fresh = $state(0),
		armed = $state(false);
	let bar: HTMLElement, item: HTMLElement, proto: HTMLElement;

	const path = $derived(page.url.pathname);
	const inCatalog = $derived(page.route.id?.startsWith('/katalog') ?? false);
	const current = $derived(page.params.section);

	onMount(() => {
		cart.load();
		const wide = window.matchMedia('(min-width: 1181px)');
		// Высота шапки: от неё считаются липкая колонка фильтров и отступ при прокрутке к форме.
		// Открытое меню на телефоне не в счёт: оно лежит поверх страницы.
		const measure = () => {
			if (menu) return;
			document.documentElement.style.setProperty('--bar-h', Math.round(bar.getBoundingClientRect().height) + 'px');
		};
		const ro = new ResizeObserver(measure);
		ro.observe(bar);
		measure();
		// шапка прилипла к верху: под ней появляется лёгкая тень
		const io = new IntersectionObserver((seen) => (stuck = !seen[0].isIntersecting));
		io.observe(proto);

		let over = false,
			shut: ReturnType<typeof setTimeout>;
		const enter = () => {
			over = true;
			clearTimeout(shut);
			if (wide.matches) drop = true;
		};
		const leave = () => {
			over = false;
			if (wide.matches) shut = setTimeout(() => (drop = false), 160);
		};
		item.addEventListener('mouseenter', enter);
		item.addEventListener('mouseleave', leave);
		caret = () => (drop = over && wide.matches ? true : !drop);
		const outside = (ev: MouseEvent) => {
			if (!item.contains(ev.target as Node)) drop = false;
		};
		const esc = (ev: KeyboardEvent) => {
			if (ev.key === 'Escape') drop = menu = false;
		};
		document.addEventListener('click', outside);
		document.addEventListener('keydown', esc);

		const count = () => (fresh = freshCount());
		count();
		const unwatch = watchOrders(count);
		return () => {
			ro.disconnect();
			io.disconnect();
			document.removeEventListener('click', outside);
			document.removeEventListener('keydown', esc);
			unwatch();
		};
	});
	let caret = () => (drop = !drop);

	// переход на другую страницу закрывает меню
	$effect(() => {
		void path;
		drop = menu = false;
	});

	function reset() {
		if (!armed) {
			armed = true;
			setTimeout(() => (armed = false), 4000);
			return;
		}
		resetDemo();
		cart.clear();
		armed = false;
		location.reload();
	}
</script>

<div class="protobar" bind:this={proto}>
	<div class="container protobar__in">
		<p class="modeline">
			{#if DEMO}Новая версия сайта салона «Портал», собирается на Svelte. Цен на сайте нет: покупатель собирает позиции в корзину
				или оставляет заявку, менеджер называет цену. Заявки сохраняются только в этом браузере и никуда не отправляются.{/if}
		</p>
		<a class="protolink" href={href.desk()}>Заявки менеджеру <b>{fresh}</b></a>
		<button type="button" class="protolink" data-demo-reset data-armed={armed || undefined} onclick={reset}>
			{armed ? 'Точно стереть? Нажмите ещё раз' : 'Начать демо заново'}
		</button>
	</div>
</div>

<header class="topbar" bind:this={bar} data-open={menu ? '1' : '0'} data-stuck={stuck ? '1' : '0'}>
	<div class="topbar__strip">
		<div class="container">
			<span>{SALON.address}</span>
			<span><b>Без выходных:</b> {SALON.hours}</span>
		</div>
	</div>
	<div class="container topbar__main">
		<a class="brand" href={href.home()}>
			<b>{SALON.name}</b>
			<span>{SALON.tagline}</span>
		</a>

		<nav class="nav" id="nav" aria-label="Главное меню">
			<ul class="nav__list">
				<li class="nav__item" bind:this={item}>
					<span class="nav__split">
						<a class="nav__top" href={href.catalog()} aria-current={inCatalog ? 'page' : undefined}>Каталог</a>
						<button type="button" class="nav__caret" aria-expanded={drop} aria-controls="catmenu" aria-label="Разделы каталога" onclick={() => caret()}></button>
					</span>
					<div class="nav__drop" id="catmenu" hidden={!drop}>
						<ul>
							<li>
								<a href={href.catalog()} aria-current={path.endsWith('/katalog/') ? 'true' : 'false'}>
									<b>Весь каталог</b><em>{collections(total)}</em><span>Все разделы на одной странице</span>
								</a>
							</li>
							{#each nav as s (s.id)}
								<li>
									<a href={href.section(s.id)} aria-current={current === s.id ? 'true' : 'false'}>
										<b>{s.name}</b><em>{s.n ? collections(s.n) : 'скоро'}</em><span>{s.brands || 'раздел наполняем'}</span>
									</a>
								</li>
							{/each}
						</ul>
					</div>
				</li>
				<li class="nav__item"><a class="nav__link" href={href.home('#akcii')}>Акции</a></li>
				<li class="nav__item"><a class="nav__link" href={href.home('#raboty')}>Наши работы</a></li>
				<li class="nav__item"><a class="nav__link" href={href.home('#o-salone')}>О салоне</a></li>
				<li class="nav__item"><a class="nav__link" href={href.home('#kontakty')}>Контакты</a></li>
			</ul>
		</nav>

		<div class="tools">
			<button type="button" class="seekbtn" data-seek aria-label="Поиск по каталогу" title="Поиск по каталогу ( / )"
				><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"
					><circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="1.6" /><path
						d="M15.2 15.2 20.5 20.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
					/></svg
				></button
			>
			<a class="tools__tel" href={SALON.tel}>
				<b>{SALON.phone}</b>
				<span>позвонить в салон</span>
			</a>
			<a class="cart" href={href.cart()} aria-current={path.endsWith('/korzina/') ? 'page' : undefined}>Корзина <b>{cart.lines.length}</b></a>
			<button type="button" class="burger" aria-expanded={menu} aria-controls="nav" aria-label="Меню" onclick={() => (menu = !menu)}><span></span></button>
		</div>
	</div>
</header>
