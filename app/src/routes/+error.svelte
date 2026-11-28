<script lang="ts">
	import { page } from '$app/state';
	import { href } from '#lib';
</script>

<svelte:head><title>Страница не найдена, салон Портал</title></svelte:head>

<main class="container lost">
	<h1>{page.status === 404 ? 'Такой страницы нет' : 'Что-то пошло не так'}</h1>
	<p>{page.error?.message}. Начните с каталога или позвоните в салон.</p>
	<p><a class="btn" href={href.catalog()}>В каталог</a></p>
</main>
