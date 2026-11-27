<script lang="ts">
	// Комплектация серии по прайсу фабрики (Торекс): что входит в дверь и что можно добавить. Перенесено из r31/cat.js (kitSection).
	// Картинки и подписи из розничного прайса фабрики, цен и доплат нет: цену с опциями называет менеджер. Ничего не нажимается.
	import { file } from '#lib';
	import type { Item, Kit, KitTile } from '#lib/types';

	let { item, kit }: { item: Item; kit: Kit } = $props();

	const KIT_CAT: Record<string, string> = { 'цвета отделки': 'Цвета', 'рисунок отделки': 'Рисунки отделки', защита: 'Замки и защита', прочие: 'Фурнитура и другое' };
	// исполнения серии: МР — снаружи металл, РР — снаружи панель (в прайсе буквы бывают латинские)
	function kitModels(m?: string[]) {
		const kinds: string[] = [];
		for (const x of m || []) {
			const end = String(x).replace(/P/g, 'Р').replace(/M/g, 'М').trim().slice(-2);
			if (end === 'МР' && !kinds.includes('МР — снаружи металл')) kinds.push('МР — снаружи металл');
			if (end === 'РР' && !kinds.includes('РР — снаружи панель МДФ')) kinds.push('РР — снаружи панель МДФ');
		}
		if (!kinds.length) return null;
		return kinds.length > 1 ? 'Два исполнения: ' + kinds.join(', ') + '.' : 'Исполнение ' + kinds[0] + '.';
	}
	// как в прайсе, не крупнее своего размера; высокие картинки (двери в рост) не выше 220 точек,
	// плитки-образцы из сборной картинки (k) не шире 100 точек: у фабрики они бывают крупными
	function size(t: KitTile) {
		const k = t.sw ? 1 : t.k && t.h < t.w * 1.6 ? Math.min(1, 100 / t.w) : Math.min(1, 220 / t.h);
		return { w: Math.round(t.w * k), h: Math.round(t.h * k) };
	}
	const cat = (c: string) => KIT_CAT[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Ещё');
	const models = $derived(kitModels(kit.m));
</script>

{#snippet tiles(list: KitTile[])}
	<ul class="kit__tiles">
		{#each list as t, i (i)}
			{@const s = size(t)}
			<li class={t.sw ? 'kit__tile kit__tile--sw' : 'kit__tile'}>
				<img class="kit__img" src={file(t.u)} alt={t.c || ''} width={s.w} height={s.h} loading="lazy" decoding="async" />
				{#if t.c}<span class="kit__cap">{t.c}</span>{/if}
			</li>
		{/each}
	</ul>
{/snippet}
{#snippet group(title: string | null, lines: string[] | null, list: KitTile[])}
	{#if list.length || (lines && lines.length)}
		<div class="kit__grp">
			{#if title}<h4 class="kit__name">{title}</h4>{/if}
			{#each lines || [] as x, i (i)}<p class="kit__what">{x}</p>{/each}
			{#if list.length}{@render tiles(list)}{/if}
		</div>
	{/if}
{/snippet}

<section class="kit" aria-labelledby="kit-h">
	<h2 id="kit-h">Что входит в дверь и что можно добавить</h2>
	<p class="kit__lead">
		Базовая комплектация — то, что входит в дверь серии {item.name}. Дополнительные опции — что можно поменять или добавить при заказе. Картинки
		и подписи из каталога фабрики {item.brand}, цену с выбранными опциями назовёт менеджер.
	</p>
	<div class="kit__cols">
		<div class="kit__base">
			<h3 class="kit__h">Базовая комплектация</h3>
			{#if models}<p class="kit__models">{models}</p>{/if}
			{@render group('Как устроена дверь', null, kit.dev)}
			{@render group('Фурнитура в комплекте', null, kit.hw)}
			{#each kit.base as b, i (i)}{@render group(b.t, null, b.i)}{/each}
		</div>
		<div class="kit__opts">
			<h3 class="kit__h">Дополнительные опции</h3>
			{#each kit.opts as o, i (i)}
				{#if i === 0 || kit.opts[i - 1].c !== o.c}<p class="kit__cat">{cat(o.c)}</p>{/if}
				<!-- одна строка без своего названия — сама и есть название блока -->
				{#if !o.t && o.x.length === 1}{@render group(o.x[0], null, o.i)}{:else}{@render group(o.t || null, o.x, o.i)}{/if}
			{/each}
			{#if kit.more.length}
				<p class="kit__cat">Ещё можно заказать</p>
				<ul class="kit__more">{#each kit.more as m, i (i)}<li>{m.x}</li>{/each}</ul>
			{/if}
		</div>
	</div>
</section>
