<script lang="ts">
	// Подвал, общий для всех страниц: перенесён с главной демо-версии (r31/home.body.html).
	import { href } from '#lib';
	import { SALON } from '#lib/site';
	import Fill from './Fill.svelte';
	import type { NavSection } from '#lib/types';

	let { nav, legal, onCookies }: { nav: NavSection[]; legal: Record<string, string>; onCookies: () => void } = $props();
</script>

<footer class="container foot">
	<div class="foot__cols">
		<section class="foot__mast">
			<p class="foot__name">{SALON.name}</p>
			<p>Отделочные материалы в Димитровграде: двери, плитка, полы, обои, сантехника. Образцы стоят в салоне на {SALON.addressShort}.</p>
		</section>
		<section>
			<h3>Каталог</h3>
			<ul>
				{#each nav as s (s.id)}
					<li><a href={href.section(s.id)}>{s.id === 'santehnika' ? s.short : s.name}</a></li>
				{/each}
			</ul>
		</section>
		<section>
			<h3>Салон</h3>
			<ul>
				<li><a href={href.home('#o-salone')}>О салоне</a></li>
				<li><a href={href.home('#raboty')}>Наши работы</a></li>
				<li><a href={href.home('#akcii')}>Акции</a></li>
				<li><a href={href.home('#brendy')}>Фабрики</a></li>
			</ul>
		</section>
		<section>
			<h3>Контакты</h3>
			<ul>
				<li><a href={href.home('#kontakty')}>{SALON.addressShort}</a></li>
				<li><a href={SALON.tel}>{SALON.phone}</a></li>
				<li><a href={SALON.vk} target="_blank" rel="noopener">ВКонтакте</a></li>
			</ul>
		</section>
	</div>
	<div class="foot__legal">
		<p class="foot__docs">
			<a href={href.doc('soglasie')}>Согласие на обработку персональных данных</a>
			<a href={href.doc('politika')}>Политика обработки персональных данных</a>
			<a href={href.doc('cookie')} onclick={(ev) => { ev.preventDefault(); onCookies(); }}>Настройки cookie</a>
		</p>
		<p>
			Продавец: <Fill {legal} k="name" hint="полное наименование ИП или ООО" />, ИНН <Fill {legal} k="inn" hint="…" />, ОГРН/ОГРНИП
			<Fill {legal} k="ogrn" hint="…" />. Адрес: {SALON.addressLegal}. Режим работы: {SALON.hours}. Телефон {SALON.phone}, e-mail
			<Fill {legal} k="email" hint="e-mail салона" />.
		</p>
		<p>Информация на сайте справочная и не является публичной офертой (ст. 437 ГК РФ). Цену, наличие и условия продажи называет менеджер.</p>
	</div>
	<p class="foot__credit">
		Фотографии временные, из каталогов и с сайтов фабрик: Лорд, Зодчий, Андора, Хамелеон, Адема, Торекс, Двери мира, Global Tile, Marburg,
		Vincea, Kastamonu. Для рабочего сайта нужно разрешение фабрик или ваши снимки.
	</p>
</footer>
