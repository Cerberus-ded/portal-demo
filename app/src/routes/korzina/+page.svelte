<script lang="ts">
	// Корзина: позиции из коллекций, количество, одна заявка на всё. Цены нет. Перенесено из r31/cat.js (renderCart).
	import { onMount } from 'svelte';
	import { href } from '#lib';
	import { cart } from '#lib/cart.svelte';
	import { plural } from '#lib/text';
	import Crumbs from '#lib/components/Crumbs.svelte';
	import OrderForm from '#lib/components/OrderForm.svelte';
	import type { Order } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let done = $state<Order | null>(null);
	onMount(() => cart.load());

	const name = (l: (typeof cart.lines)[number]) => l.brand + ', ' + (String(l.variant).indexOf(l.coll) === 0 ? l.variant : l.coll + ', ' + l.variant);
</script>

<svelte:head>
	<title>Корзина, салон Портал</title>
</svelte:head>

<main class="container">
	<Crumbs trail={[['Каталог', href.catalog()], ['Корзина']]} />
	<div class="pagehead">
		<h1>Корзина</h1>
		<p>Цен на сайте нет: соберите позиции и отправьте одну заявку, менеджер назовёт цену и подтвердит наличие.</p>
	</div>

	<div class="cartbox">
		{#if !cart.ready}
			<p>Загружаем корзину.</p>
		{:else if cart.lines.length || done}
			{#if !done}
				<h2>В корзине {cart.lines.length} {plural(cart.lines.length, 'позиция', 'позиции', 'позиций')}</h2>
				<table class="lines">
					<tbody>
						{#each cart.lines as l, i (i)}
							<tr>
								<td>
									{#if l.slug}<a href={href.item(l.s, l.slug)}>{name(l)}</a>{:else}{name(l)}{/if}
									<small>{(l.finish || '') + (l.calc ? '; посчитано: ' + l.calc : '')}</small>
								</td>
								<td>
									<input type="number" min="0" step="any" placeholder={l.unit} aria-label={'Количество, ' + l.unit} value={l.qty ?? ''}
										oninput={(ev) => { const v = (ev.currentTarget as HTMLInputElement).value; l.qty = v === '' ? null : Number(v); l.calc = null; cart.save(); }} />
									<span class="lines__unit">{l.unit}</span>
								</td>
								<td><button type="button" class="btn btn--outline btn--mini" onclick={() => cart.remove(i)}>Убрать</button></td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p>Цену и наличие менеджер назовёт, когда свяжется с вами.</p>
			{/if}
			<!-- одна и та же форма до и после отправки: после неё на месте формы остаётся «Заявка ушла менеджеру» -->
			<OrderForm key="cart" consentV={data.consentV} lines={() => cart.lines.map((l) => ({ ...l }))} ondone={(o) => { done = o; cart.clear(); }} />
			<div class="cartbox__act">
				{#if !done}<button type="button" class="btn btn--outline" onclick={() => cart.clear()}>Очистить корзину</button>{/if}
				<a class="btn btn--outline" href={href.catalog()}>В каталог</a>
			</div>
		{:else}
			<h2>Корзина пуста</h2>
			<p>Откройте коллекцию, выберите вариант и нажмите «В корзину». Заявка на несколько позиций уйдёт менеджеру одной строкой.</p>
			<div class="cartbox__act"><a class="btn" href={href.catalog()}>В каталог</a></div>
		{/if}
	</div>
</main>
