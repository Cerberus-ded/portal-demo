<script lang="ts">
	// Экран менеджера: все заявки и их статус. Перенесено из r31/cat.js (renderInbox).
	// В демо заявки лежат в браузере посетителя (src/lib/orders.ts); на рабочем сайте здесь будет вход для менеджера.
	import { onMount } from 'svelte';
	import { href } from '#lib';
	import { STATUS, listOrders, marks, setMark, watchOrders, freshCount } from '#lib/orders';
	import { lineText, phoneDigits, plural, viaText } from '#lib/text';
	import Crumbs from '#lib/components/Crumbs.svelte';
	import type { Order } from '#lib/types';

	let orders = $state<Order[]>([]),
		mk = $state<Record<string, string>>({}),
		fresh = $state(0),
		ready = $state(false);
	const pull = () => {
		orders = listOrders();
		mk = marks();
		fresh = freshCount();
		ready = true;
	};
	onMount(() => {
		pull();
		return watchOrders(pull);
	});
	const when = (at: string) => {
		const d = new Date(at);
		return isNaN(+d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
	};
</script>

<svelte:head>
	<title>Заявки менеджеру, салон Портал</title>
</svelte:head>

<main class="container">
	<Crumbs trail={[['Каталог', href.catalog()], ['Заявки менеджеру']]} />
	<div class="pagehead">
		<h1>Заявки менеджеру</h1>
		<p>
			Сюда приходят заявки с карточек и из корзины, оплаты на сайте нет. На рабочем сайте каждая заявка сразу придёт на почту салона и в чат
			менеджеров в MAX.
		</p>
	</div>
	<div class="inbox">
		{#if !ready}
			<p class="inbox__note">Загружаем заявки.</p>
		{:else if !orders.length}
			<p class="inbox__note">Заявок пока нет. Они появятся здесь сразу после отправки формы.</p>
		{:else}
			<p class="inbox__count">{orders.length} {plural(orders.length, 'заявка', 'заявки', 'заявок')}, новых {fresh}</p>
			{#each orders as order (order.id)}
				{@const mark = mk[order.id] || 'new'}
				<article class="ticket" data-status={mark}>
					<div class="ticket__top">
						<div>
							<p class="ticket__no">№ {order.id}</p>
							<p class="ticket__at">{when(order.at)}</p>
						</div>
						<select aria-label={'Статус заявки ' + order.id} value={mark} onchange={(ev) => setMark(order.id, (ev.currentTarget as HTMLSelectElement).value)}>
							{#each STATUS as [v, label] (v)}<option value={v}>{label}</option>{/each}
						</select>
					</div>
					<ul>
						{#each Array.isArray(order.lines) ? order.lines : [] as l, i (i)}<li>{lineText(l)}</li>{/each}
					</ul>
					<dl>
						<dt>Имя</dt><dd>{order.name || ''}</dd>
						<dt>Телефон</dt><dd><a href={'tel:+' + phoneDigits(order.phone || '')}>{order.phone || ''}</a></dd>
						<dt>Связаться</dt><dd>{viaText(order.via)}</dd>
						{#if order.comment}<dt>Комментарий</dt><dd>{order.comment}</dd>{/if}
						{#if order.consent}<dt>Согласие на обработку данных</dt><dd>{order.consent.v ? 'дано, редакция от ' + order.consent.v : 'дано'}</dd>{/if}
					</dl>
				</article>
			{/each}
		{/if}
	</div>
</main>
