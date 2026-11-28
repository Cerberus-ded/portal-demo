<script lang="ts">
	import { href } from '#lib';
	import { cookies } from '#lib/cookies.svelte.ts';
</script>

{#if cookies.shown}
	<section class="cookies" aria-label="Cookie и Яндекс Метрика">
		<p>
			Мы хотим использовать cookie и Яндекс Метрику, чтобы видеть, какие разделы сайта нужны покупателям, и улучшать его. Нажимая «Разрешить»,
			вы даёте <a href={href.doc('cookie')}>согласие на обработку данных с помощью cookie и Метрики</a>. Если откажетесь, сайт будет работать так
			же, без Метрики.
		</p>
		<div class="cookies__acts">
			<button type="button" class="btn btn--outline btn--mini" data-cookie="yes" onclick={() => cookies.choose('yes')}>Разрешить</button>
			<button type="button" class="btn btn--outline btn--mini" data-cookie="no" onclick={() => cookies.choose('no')}>Отказаться</button>
		</div>
	</section>
{/if}
