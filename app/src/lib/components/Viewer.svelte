<script lang="ts">
	// Дверь крупно: снимок на весь экран, листание, заявка и корзина прямо отсюда. Перенесено из r31/cat.js (buildViewer).
	// Приближения (лупы) нет: по просьбе салона снимок показываем целиком.
	import { file } from '#lib';
	import type { Item } from '#lib/types.ts';

	let {
		item,
		at = $bindable(0),
		onCart,
		onForm
	}: { item: Item; at: number; onCart: (i: number) => void; onForm: (i: number) => void } = $props();

	let dlg: HTMLDialogElement;
	let shut: HTMLButtonElement;
	let added = $state(false);
	let big = $state(false);
	const x = $derived(item.vars[at]);
	const n = $derived(item.vars.length);

	export function open(i: number) {
		at = i;
		added = false;
		if (!dlg.open) dlg.showModal();
		shut.focus();
	}
	function move(k: number) {
		if (n < 2) return;
		at = (at + k + n) % n;
		added = false;
	}
	// пока большой снимок едет, стоит маленький
	$effect(() => {
		void at;
		big = false;
	});

	let downX: number | null = null;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<dialog class="viewer" aria-label="Дверь крупно" bind:this={dlg}
	onkeydown={(ev) => {
		if (ev.key === 'ArrowLeft') { ev.preventDefault(); move(-1); }
		if (ev.key === 'ArrowRight') { ev.preventDefault(); move(1); }
	}}
	onclick={(ev) => {
		// клик мимо снимка и панели закрывает
		if (ev.target === dlg || (ev.target as Element).classList.contains('viewer__stage')) dlg.close();
	}}>
	<div class="viewer__stage" role="presentation"
		onpointerdown={(ev) => (downX = ev.isPrimary ? ev.clientX : null)}
		onpointercancel={() => (downX = null)}
		onpointerup={(ev) => {
			// пальцем вбок: соседняя модель
			if (downX === null) return;
			const dx = ev.clientX - downX;
			downX = null;
			if (Math.abs(dx) > 48) move(dx < 0 ? 1 : -1);
		}}>
		{#key at}
			<img class="viewer__img" src={file(big ? x.l : x.s)} alt={'Дверь ' + x.name + ', ' + item.brand} decoding="async" />
			<img src={file(x.l)} alt="" hidden onload={() => (big = true)} />
		{/key}
	</div>
	<div class="viewer__bar">
		<div class="viewer__what">
			<p class="viewer__name">{x.name}</p>
			<p class="viewer__sub">
				{item.brand}{item.any ? ', серия ' : ', коллекция '}{item.name}{x.on ? ' · на фото: ' + x.on : ''}{n > 1 ? ` · ${at + 1} из ${n}` : ''}
			</p>
			<p class="viewer__hint">{n > 1 ? 'Соседние модели: стрелки или пальцем вбок.' : ''}</p>
		</div>
		<div class="viewer__acts">
			<button type="button" class="viewer__btn" hidden={n < 2} onclick={() => move(-1)}>← Предыдущая</button>
			<button type="button" class="viewer__btn" hidden={n < 2} onclick={() => move(1)}>Следующая →</button>
			<button type="button" class="viewer__btn" onclick={() => { onCart(at); added = true; }}>{added ? 'Добавлено' : 'В корзину'}</button>
			<button type="button" class="viewer__btn viewer__btn--main" onclick={() => { dlg.close(); onForm(at); }}>Оставить заявку</button>
			<button type="button" class="viewer__btn" bind:this={shut} onclick={() => dlg.close()}>Закрыть</button>
		</div>
	</div>
</dialog>
