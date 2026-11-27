<script lang="ts">
	// Заявка менеджеру: перенесена из r31/cat.js (orderForm, doneNote, showFail). Оплаты за формой нет.
	// Согласие на обработку персональных данных отдельной галочкой (ст. 9 152-ФЗ), политика рядом (ст. 18.1).
	import { tick } from 'svelte';
	import { href } from '#lib';
	import { SALON, DEMO } from '#lib/site';
	import { draft } from '#lib/draft.svelte';
	import { cookies } from '#lib/cookies.svelte';
	import { sendOrder } from '#lib/orders';
	import { lineText, orderNo, orderText, phoneDigits, phoneNice } from '#lib/text';
	import type { Line, Order } from '#lib/types';

	let {
		key,
		qty = null,
		hint = 'Что важно знать менеджеру',
		what = '',
		consentV,
		lines,
		ondone
	}: {
		key: string;
		qty?: { unit: string; one: boolean } | null;
		hint?: string;
		what?: string;
		consentV: string;
		lines: (q: number | null) => Line[];
		ondone?: (order: Order) => void;
	} = $props();

	let count = $state<number | null>(qty?.one ? 1 : null);
	let err = $state<Record<string, string>>({});
	let sending = $state(false),
		failed = $state<Order | null>(null),
		done = $state<Order | null>(null),
		copied = $state('');
	let form: HTMLFormElement | undefined = $state(),
		doneEl: HTMLElement | undefined = $state();

	const id = (f: string) => `${key}-${f}`;

	function check() {
		const e: Record<string, string> = {};
		if (draft.name.trim().length < 2) e.name = 'Напишите, как к вам обращаться';
		const d = phoneDigits(draft.phone);
		if (d.length < 11 || d.length > 15) e.phone = 'Нужен номер целиком, например +7 900 000-00-00';
		if (qty) {
			const q = count ?? 0;
			if ((qty.one && !(q >= 1)) || q < 0) e.qty = 'Укажите количество';
		}
		if (!draft.ok) e.ok = 'Без согласия мы не можем принять заявку: в ней ваши имя и телефон';
		err = e;
		return Object.keys(e)[0];
	}

	async function submit(ev: SubmitEvent) {
		ev.preventDefault();
		const bad = check();
		if (bad) {
			await tick();
			(form?.querySelector<HTMLElement>('#' + id(bad)) ?? null)?.focus();
			return;
		}
		const at = new Date().toISOString();
		const order: Order = {
			id: orderNo(),
			at,
			lines: lines(qty ? count : null),
			name: draft.name.trim(),
			phone: phoneNice(draft.phone),
			via: draft.via,
			comment: draft.comment.trim(),
			// какую редакцию согласия человек принял и когда
			consent: { given: true, v: consentV, at }
		};
		sending = true;
		failed = null;
		try {
			await sendOrder(order);
			cookies.goal('order');
			draft.comment = '';
			draft.ok = false;
			done = order;
			ondone?.(order);
			await tick();
			doneEl?.focus({ preventScroll: true });
			doneEl?.scrollIntoView({ block: 'center' });
		} catch {
			// Не отправилось: честно говорим об этом и даём готовый текст, чтобы заявка не пропала.
			failed = order;
		} finally {
			sending = false;
		}
	}

	async function copy(ta: HTMLTextAreaElement) {
		ta.select();
		try {
			await navigator.clipboard.writeText(ta.value);
			copied = 'Скопировано';
		} catch {
			copied = 'Выделено, нажмите копирование';
		}
	}

	export function focus() {
		if (!form) return;
		form.scrollIntoView({ block: 'start' });
		const empty = [...form.querySelectorAll<HTMLInputElement>('input[type=text], input[type=tel]')].find((i) => !i.value);
		(empty || form.querySelector('input'))?.focus({ preventScroll: true });
	}
	export const root = () => form ?? doneEl;
	function again() {
		done = null;
		count = qty?.one ? 1 : null;
	}
</script>

{#if done}
	<div class="order order--done" role="status" tabindex="-1" bind:this={doneEl}>
		<h2>Заявка № {done.id} ушла менеджеру</h2>
		{#if DEMO}
			<p class="order__demo">
				Это демо-версия: заявка никуда не ушла, она сохранилась в этом браузере. Посмотрите её глазами менеджера: «Заявки менеджеру» в верхней
				полосе.
			</p>
		{/if}
		<p class="order__lead">
			{done.via === 'max' ? 'Менеджер напишет вам в MAX' : 'Менеджер позвонит вам'} по номеру {done.phone} в часы работы салона: {SALON.hours}. Платить
			сейчас ничего не нужно.
		</p>
		<ul class="order__list">
			{#each done.lines as l, i (i)}<li>{lineText(l)}</li>{/each}
		</ul>
		{#if !ondone}<button type="button" class="btn btn--outline" onclick={again}>Оставить ещё одну заявку</button>{/if}
	</div>
{:else}
	<form class="order" id={id('order')} novalidate bind:this={form} onsubmit={submit}>
		<h2>Заявка менеджеру</h2>
		<p class="order__lead">Платить сейчас не нужно. Заявка уйдёт менеджеру, он свяжется с вами, подтвердит наличие и цену.</p>
		{#if what}<p class="order__what">{what}</p>{/if}
		<div class="order__fields">
			{#if qty}
				<div class="field field--wide">
					<label for={id('qty')}>Количество, {qty.unit}</label>
					<input type="number" id={id('qty')} min={qty.one ? 1 : 0} step={qty.one ? 1 : 'any'} inputmode={qty.one ? 'numeric' : 'decimal'}
						placeholder={qty.one ? undefined : 'посчитает менеджер'} bind:value={count} oninput={() => delete err.qty}
						aria-invalid={err.qty ? 'true' : undefined} aria-describedby={err.qty ? id('qty-err') : undefined} />
					{#if err.qty}<p class="field__err" id={id('qty-err')}>{err.qty}</p>{/if}
				</div>
			{/if}
			<div class="field">
				<label for={id('name')}>Как к вам обращаться</label>
				<input type="text" id={id('name')} autocomplete="name" bind:value={draft.name} oninput={() => delete err.name}
					aria-invalid={err.name ? 'true' : undefined} aria-describedby={err.name ? id('name-err') : undefined} />
				{#if err.name}<p class="field__err" id={id('name-err')}>{err.name}</p>{/if}
			</div>
			<div class="field">
				<label for={id('phone')}>Телефон</label>
				<input type="tel" id={id('phone')} autocomplete="tel" inputmode="tel" placeholder="+7 900 000-00-00" bind:value={draft.phone}
					oninput={() => delete err.phone} onblur={() => draft.phone && (draft.phone = phoneNice(draft.phone))}
					aria-invalid={err.phone ? 'true' : undefined} aria-describedby={err.phone ? id('phone-err') : undefined} />
				{#if err.phone}<p class="field__err" id={id('phone-err')}>{err.phone}</p>{/if}
			</div>
			<fieldset class="field field--wide">
				<legend>Как связаться</legend>
				<div class="via">
					<label><input type="radio" name={id('via')} value="call" bind:group={draft.via} />Позвонить</label>
					<label><input type="radio" name={id('via')} value="max" bind:group={draft.via} />Написать в MAX</label>
				</div>
			</fieldset>
			<div class="field field--wide">
				<label for={id('note')}>Комментарий, если нужно</label>
				<textarea id={id('note')} placeholder={hint} bind:value={draft.comment}></textarea>
			</div>
		</div>

		<label class="order__ok">
			<input type="checkbox" id={id('ok')} bind:checked={draft.ok} onchange={() => delete err.ok} aria-invalid={err.ok ? 'true' : undefined} />
			<span>
				Даю согласие на обработку моих персональных данных (имя, телефон, комментарий), чтобы менеджер ответил на эту заявку, на условиях
				<a href={href.doc('soglasie')} target="_blank" rel="noopener">Согласия на обработку персональных данных</a>.
			</span>
		</label>
		{#if err.ok}<p class="field__err" id={id('ok-err')}>{err.ok}</p>{/if}
		<p class="order__policy">
			Как салон обращается с данными: <a href={href.doc('politika')} target="_blank" rel="noopener">Политика обработки персональных данных</a>.
		</p>

		{#if failed}
			<div class="order__fail">
				<b>Заявка не отправилась</b>
				<p>
					Ничего не потеряно: позвоните <a href={SALON.tel}>{SALON.phone}</a> или напишите во <a href={SALON.vk} target="_blank" rel="noopener">ВКонтакте</a>,
					текст заявки уже готов.
				</p>
				<textarea readonly aria-label="Текст заявки" value={orderText(failed)}></textarea>
				<div class="order__fail-act">
					<button type="button" class="btn btn--outline btn--mini" onclick={(ev) => copy((ev.currentTarget as HTMLElement).closest('.order__fail')!.querySelector('textarea')!)}
						>{copied || 'Скопировать текст'}</button
					>
				</div>
			</div>
		{/if}

		<div class="order__foot">
			<button type="submit" class="btn" disabled={sending}>{sending ? 'Отправляем заявку' : 'Отправить заявку менеджеру'}</button>
			<p>Ответим в часы работы салона: {SALON.hours}.</p>
		</div>
	</form>
{/if}
