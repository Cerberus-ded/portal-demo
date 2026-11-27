<script lang="ts">
	// Цвета отделки серии (Торекс): квадратики с цветом и названием, ничего не выбирается, цены нет. Перенесено из r31/cat.js (finishes).
	import { file } from '#lib';
	import { plural } from '#lib/text';
	import type { Item } from '#lib/types';

	let { item, colors }: { item: Item; colors: Record<string, string> } = $props();
	const FIN: ['m' | 'p' | 'i', string][] = [['m', 'Снаружи: металл с покрытием'], ['p', 'Снаружи: панель'], ['i', 'Внутри: панель']];
</script>

<section class="fins" aria-labelledby="fins-h">
	<div class="variants__head"><h2 id="fins-h">Цвета отделки</h2><span class="count">по каталогу фабрики {item.brand}</span></div>
	<p class="fins__note">Какие цвета бывают у серии снаружи и изнутри. Цвет и рисунок панели подберём при заказе, цену назовём по запросу.</p>
	{#each FIN as [k, label] (k)}
		{@const ids = (item.fin?.[k] || []).filter((id) => colors[id])}
		{#if ids.length}
			<h3 class="fins__side">{label} · {ids.length} {plural(ids.length, 'цвет', 'цвета', 'цветов')}</h3>
			<ul class="fins__grid">
				{#each ids as id (id)}
					<li class="fin"><img class="fin__img" src={file(`foto/torex/colors/${id}.webp`)} alt="" loading="lazy" decoding="async" /><span class="fin__name">{colors[id]}</span></li>
				{/each}
			</ul>
		{/if}
	{/each}
</section>
