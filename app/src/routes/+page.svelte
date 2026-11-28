<script lang="ts">
	// Главная: перенесена из r31/home.body.html демо-версии. Акции и работы пока демонстрационные, как в демо
	// (в демо их меняла админка, в Svelte-версии админки ещё нет).
	import { onMount } from 'svelte';
	import { href, file } from '#lib';
	import { SALON } from '#lib/site.ts';
	import { plural } from '#lib/text.ts';
	import Fill from '#lib/components/Fill.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// фото главной в двух размерах, как их собирает tools/build31.mjs
	const PICS: Record<string, [number, number]> = {
		'k-hero': [800, 1600], 'k-dveri': [640, 1200], 'k-plitka': [640, 1200], 'k-poly': [640, 1000], 'k-oboi': [640, 1200],
		'k-santehnika': [640, 1200], 'k-work-punta': [800, 1400], 'k-work-entry': [800, 1257]
	};
	const src = (k: string) => file(`photos/${k}-${PICS[k][1]}.webp`);
	const srcset = (k: string) => `${file(`photos/${k}-${PICS[k][0]}.webp`)} ${PICS[k][0]}w, ${file(`photos/${k}-${PICS[k][1]}.webp`)} ${PICS[k][1]}w`;
	const ROOM_SIZES = '(max-width: 480px) 90vw, (max-width: 720px) 45vw, (max-width: 1100px) 30vw, 18vw';

	const rooms = $derived([
		{ id: 'mezhkomnatnye', n: data.rooms.dveri, pic: 'k-dveri', alt: 'Синие межкомнатные двери в светлом коридоре', w: 1600, h: 1120, name: 'Двери', sub: 'Межкомнатные и входные, коллекциями фабрик.' },
		{ id: 'plitka', n: data.rooms.plitka, pic: 'k-plitka', alt: 'Ванная комната с плиткой под мрамор', w: 1600, h: 1226, name: 'Плитка', sub: 'Керамогранит и плитка: Alma Ceramica, Global Tile, LB, Kerama Marazzi.' },
		{ id: 'poly', n: data.rooms.poly, pic: 'k-poly', alt: 'Ламинат под дуб, вид сверху', w: 1000, h: 1000, name: 'Полы', sub: 'Ламинат, кварцвинил и линолеум: Kastamonu, Tarkett, Egger.' },
		{ id: 'oboi', n: data.rooms.oboi, pic: 'k-oboi', alt: 'Стена с серыми обоями, столик с вазой', w: 1369, h: 1369, name: 'Обои', sub: 'Обои Grandeco, Marburg, Artsimple, Andrea Rossi.' },
		{ id: 'santehnika', n: data.rooms.santehnika, pic: 'k-santehnika', alt: 'Душевой уголок с чёрным профилем', w: 1200, h: 1200, name: 'Сантехника', sub: 'Смесители, ванны, унитазы, раковины, мебель для ванных.' }
	]);

	const works = [
		{
			pic: 'k-work-punta', alt: 'Серо-зелёные двери Punta в спальне', w: 1600, h: 1120, pos: '',
			kick: 'Межкомнатные двери', title: 'Квартира в новостройке',
			story: 'Хозяева хотели спокойный цвет, который не спорит со светлым полом. Серо-зелёную эмаль выбрали в салоне: сравнили образцы при дневном свете рядом с кусочком своего ламината. Мы сделали замер, привезли и установили двери.',
			spec: [['Что установлено', 'Межкомнатные двери, коллекция Punta'], ['Производитель', 'Лорд'], ['Покрытие', 'Эмаль'], ['Размеры', '600, 800 × 2000 мм', 'mono'], ['Цвет', 'Серо-зелёный']],
			go: href.item('mezhkomnatnye', 'lord-punta'), label: 'Смотреть коллекцию в каталоге'
		},
		{
			pic: 'k-work-entry', alt: 'Синяя входная дверь в прихожей с деревянным полом', w: 1257, h: 1257, pos: 'object-position: 50% 38%',
			kick: 'Входная дверь', title: 'Частный дом',
			story: 'Старая дверь промерзала зимой. Новую подобрали с утеплённым полотном, синий цвет взяли под фасад, а панель изнутри под деревянный пол прихожей. Ручка и замок идут в комплекте фабрики.',
			spec: [['Что установлено', 'Входная дверь'], ['Производитель', 'Двери мира'], ['Фурнитура', 'Ручка и замок в комплекте фабрики'], ['Размеры', '960 × 2050 мм', 'mono'], ['Цвет', 'Синий']],
			go: href.section('vhodnye'), label: 'Смотреть входные двери в каталоге'
		}
	];

	// ---- наши работы: фото листаются стрелками, точками, клавишами и пальцем, рядом текст про объект ----
	let at = $state(0);
	let track: HTMLUListElement;
	let calm = false;
	function go(i: number) {
		i = Math.max(0, Math.min(works.length - 1, i));
		track.scrollTo({ left: i * track.clientWidth, behavior: calm ? 'auto' : 'smooth' });
		at = i;
	}
	onMount(() => {
		calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
		let settle: ReturnType<typeof setTimeout>;
		// палец: какая фотография встала в рамку, та и выбрана
		const onScroll = () => {
			clearTimeout(settle);
			settle = setTimeout(() => (at = Math.round(track.scrollLeft / Math.max(1, track.clientWidth))), 90);
		};
		track.addEventListener('scroll', onScroll, { passive: true });
		// ширина рамки поменялась: держим ту же фотографию
		const ro = new ResizeObserver(() => (track.scrollLeft = at * track.clientWidth));
		ro.observe(track);
		return () => {
			track.removeEventListener('scroll', onScroll);
			ro.disconnect();
		};
	});
	function keys(ev: KeyboardEvent) {
		if ((ev.target as Element).closest?.('a')) return;
		if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(at - 1); }
		else if (ev.key === 'ArrowRight') { ev.preventDefault(); go(at + 1); }
	}
</script>

<svelte:head>
	<title>Портал, отделочные материалы в Димитровграде</title>
</svelte:head>

<main id="top">
	<section class="container hero" aria-labelledby="h1">
		<div class="hero__text">
			<h1 id="h1">Коллекция целиком, а не одна дверь</h1>
			<p class="lead">
				Отделочные материалы в Димитровграде: двери, плитка, полы, обои и сантехника. Карточка открывает всю коллекцию сразу, каждый цвет, каждый
				размер, каждый артикул.
			</p>
			<div class="hero__act">
				<a class="btn" href={href.catalog()}>Смотреть каталог</a>
				<a class="btn btn--outline" href="#kontakty">Как доехать</a>
			</div>
			<button type="button" class="seekfield" data-seek
				><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"
					><circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M15.2 15.2 20.5 20.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg
				><span>Найти в каталоге: коллекция, фабрика, артикул</span><kbd>/</kbd></button
			>
			<p class="hero__note">Прототип главной. Объёмы взяты из вашего ТЗ и округлены, акции и работы демонстрационные.</p>
		</div>

		<div class="mat">
			<figure class="mat__fig">
				<img src={src('k-hero')} srcset={srcset('k-hero')} alt="Две красные двери в светлой комнате, глухая и со стеклом" width="1600" height="1120"
					sizes="(max-width: 1180px) 92vw, 46vw" fetchpriority="high" decoding="async" />
			</figure>
			<div class="label">
				<span><b>Фото временное</b> из каталога LORD</span>
				<span><b>Заменим</b> вашим снимком салона</span>
			</div>
		</div>
	</section>

	<section class="container sec" id="razdely" aria-labelledby="h-razdely">
		<div class="head">
			<h2 id="h-razdely">Пять разделов каталога</h2>
			<p class="caption">Каждая карточка ведёт в каталог, уже открытый на своём разделе со своими фильтрами.</p>
		</div>
		<div class="rooms">
			{#each rooms as r (r.id)}
				<a class="room mat lift" href={href.section(r.id)}>
					<figure class="mat__fig"><img src={src(r.pic)} srcset={srcset(r.pic)} alt={r.alt} width={r.w} height={r.h} sizes={ROOM_SIZES} loading="lazy" decoding="async" /></figure>
					<span class="room__body">
						<span class="room__name">{r.name}</span>
						<span class="room__sub">{r.sub}</span>
						<span class="room__fig"><b>{r.n || 'Скоро'}</b><span>{r.n ? plural(r.n, 'коллекция', 'коллекции', 'коллекций') : 'наполняем раздел'}</span></span>
					</span>
				</a>
			{/each}
		</div>
	</section>

	<div class="band">
		<section class="container sec" id="akcii" aria-labelledby="h-akcii">
			<div class="head">
				<h2 id="h-akcii">Что сейчас по акции</h2>
				<p class="caption">Каждая строка ведёт в каталог с уже наложенным фильтром. Строки ниже демонстрационные.</p>
			</div>
			<div class="promos">
				<article class="promo">
					<h3>Двери Лорд со скидкой 15%</h3>
					<p class="promo__till">до 30 ноября</p>
					<a class="promo__go" href={href.section('mezhkomnatnye', '?brand=' + encodeURIComponent('Лорд'))}>Смотреть двери</a>
				</article>
				<article class="promo">
					<h3>Ламинат Кастамону, остатки склада</h3>
					<p class="promo__till">до 15 декабря</p>
					<a class="promo__go" href={href.section('poly')}>Смотреть полы</a>
				</article>
				<article class="promo">
					<h3>Rasch: вторая коллекция в подарок</h3>
					<p class="promo__till">до конца года</p>
					<a class="promo__go" href={href.section('oboi')}>Смотреть обои</a>
				</article>
			</div>
			<p class="promos__terms">
				Организатор акций: <Fill legal={data.legal} k="name" hint="полное наименование ИП или ООО" />, Димитровград, ул. Гончарова, 11. Сроки
				указаны у каждой акции. Подробные условия, количество товара по акции, порядок и место получения скидки или подарка можно узнать у
				менеджера по телефону {SALON.phone} и в салоне.
			</p>
		</section>
	</div>

	<section class="container sec" id="raboty" aria-labelledby="h-raboty">
		<div class="head">
			<h2 id="h-raboty">Где это уже стоит</h2>
			<p class="caption">
				У каждого объекта фотографии, пара слов от салона, паспорт того, что установлено, и ссылка на коллекцию в каталоге. Листайте стрелками
				или пальцем. Объекты и тексты пока демонстрационные.
			</p>
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="reel mat" id="reel" role="region" aria-roledescription="карусель" aria-label="Наши работы" data-js="1" onkeydown={keys}>
			<div class="reel__media">
				<div class="reel__view">
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<ul class="reel__track" tabindex="0" aria-label="Фотографии работ" bind:this={track}>
						{#each works as w, i (w.pic)}
							<li class="reel__slide" aria-label={`Фото ${i + 1} из ${works.length}`}>
								<figure class="mat__fig">
									<img src={src(w.pic)} srcset={srcset(w.pic)} alt={w.alt} width={w.w} height={w.h} loading="lazy" decoding="async"
										sizes="(max-width: 900px) 92vw, 54vw" style={w.pos} />
								</figure>
							</li>
						{/each}
					</ul>
					<button type="button" class="reel__arrow reel__arrow--prev" aria-label="Предыдущая работа" aria-controls="reel" disabled={at === 0} onclick={() => go(at - 1)}
						><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg></button
					>
					<button type="button" class="reel__arrow reel__arrow--next" aria-label="Следующая работа" aria-controls="reel" disabled={at === works.length - 1} onclick={() => go(at + 1)}
						><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg></button
					>
					<span class="reel__count" aria-hidden="true">{at + 1} / {works.length}</span>
				</div>
				<div class="reel__dots" role="group" aria-label="Выбрать работу">
					{#each works as w, j (w.pic)}
						<button type="button" aria-label={`Работа ${j + 1}`} aria-current={j === at ? 'true' : 'false'} onclick={() => go(j)}></button>
					{/each}
				</div>
			</div>
			<div class="reel__notes">
				{#each works as w, j (w.pic)}
					<article class="reel__note" hidden={j !== at}>
						<p class="reel__kick">{w.kick}</p>
						<h3>{w.title}</h3>
						<p class="reel__story">{w.story}</p>
						<table class="spec">
							<tbody>
								{#each w.spec as [k, v, cls] (k)}
									<tr><th scope="row">{k}</th><td class={cls}>{v}</td></tr>
								{/each}
							</tbody>
						</table>
						<a class="work__go" href={w.go}>{w.label}</a>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<div class="band">
		<section class="container sec" id="o-salone" aria-labelledby="h-salon">
			<div class="head">
				<h2 id="h-salon">Наши цели, задачи, концепция</h2>
				<p class="caption">Тексты взяты из описания вашей группы ВКонтакте. Поправьте, если хочется сказать иначе.</p>
			</div>
			<ol class="steps">
				<li>
					<span class="steps__n" aria-hidden="true">1</span>
					<div class="steps__t">
						<h3>Индивидуально и комплексно</h3>
						<p>Подходим к каждой интерьерной задаче отдельно и решаем её целиком: двери, полы, стены, плитка и ванная комната в одном салоне.</p>
					</div>
				</li>
				<li>
					<span class="steps__n" aria-hidden="true">2</span>
					<div class="steps__t">
						<h3>Комплектуем дизайн-проекты</h3>
						<p>Приносите дизайн-проект: укомплектуем его отделочными и строительными материалами.</p>
					</div>
				</li>
				<li>
					<span class="steps__n" aria-hidden="true">3</span>
					<div class="steps__t">
						<h3>Эксклюзивная цветовая гамма</h3>
						<p>Предлагаем эксклюзивную цветовую гамму, а рядом с ней самые популярные и стильные решения для интерьера.</p>
					</div>
				</li>
			</ol>
		</section>
	</div>

	<section class="container sec" id="brendy" aria-labelledby="h-brendy">
		<div class="head">
			<h2 id="h-brendy">34 фабрики, с которыми работаем</h2>
			<p class="caption">Список из вашего ТЗ и присланных каталогов. На сайте каждое имя ведёт в каталог, отфильтрованный по этой фабрике.</p>
		</div>
		<div class="facts">
			<section>
				<h3>Двери</h3>
				<ul><li>Лорд</li><li>Зодчий</li><li>Аэлита</li><li>Андора</li><li>Лист</li><li>Адема</li><li>Энтро</li><li>Хорошие двери</li><li>Хамелеон</li><li>Торекс</li><li>Кова и TRX</li><li>Дорстон и Тайгер</li><li>Берсеркер</li><li>Мастино</li><li>Макрус</li></ul>
			</section>
			<section>
				<h3>Плитка</h3>
				<ul><li>Global Tile</li><li>Artkera</li><li>Дако</li><li>Enface</li><li>Eternal</li><li>Itaca</li><li>ЛБ Керамика</li></ul>
			</section>
			<section>
				<h3>Напольные покрытия</h3>
				<ul><li>Таркет</li><li>Кастамону</li><li>Laminext</li></ul>
			</section>
			<section>
				<h3>Обои</h3>
				<ul><li>Marburg</li><li>Grandeco</li><li>Rasch</li><li>Art Simple</li><li>Andrea Rossi</li><li>Alesandro Alori</li><li>Bernardo Bartalucci</li><li>Roberto Borzaggi</li><li>Ортограф</li></ul>
			</section>
			<section>
				<h3>Сантехника</h3>
				<ul><li class="facts__todo">Бренды пришлите, поставим сюда</li></ul>
			</section>
		</div>
	</section>

	<div class="band--ink">
		<section class="container sec" id="kontakty" aria-labelledby="h-kontakty">
			<div class="visit">
				<div class="head head--flush">
					<h2 id="h-kontakty">Приходите посмотреть вживую</h2>
					<p class="lead">Цвет и фактуру по экрану не выбрать. Образцы всех коллекций стоят в салоне.</p>
				</div>
				<dl class="contacts">
					<div><dt>Адрес</dt><dd>{SALON.address}</dd></div>
					<div><dt>Телефон</dt><dd><a href={SALON.tel}>{SALON.phone}</a></dd></div>
					<div><dt>Часы работы</dt><dd>Будни <span>с 10:00 до 18:00</span><br />Суббота и воскресенье <span>с 10:00 до 16:00</span></dd></div>
					<div><dt>Пишите нам</dt><dd><a href={SALON.vk} target="_blank" rel="noopener">ВКонтакте</a></dd></div>
				</dl>
				<p class="fill">На сайте здесь встанет карта Яндекса с точкой на Гончарова, 11.</p>
				<div class="hero__act">
					<a class="btn" href={SALON.tel}>Позвонить в салон</a>
					<a class="btn btn--outline" href={SALON.vk} target="_blank" rel="noopener">Написать во ВКонтакте</a>
				</div>
			</div>
		</section>
	</div>
</main>
