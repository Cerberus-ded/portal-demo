import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Хостинг продакшна ещё не выбран. Сейчас сайт собирается в обычные статические файлы (build/),
// их можно выложить на любой хостинг: свой сервер с nginx, Яндекс Object Storage, Netlify, Vercel, GitHub Pages.
// Сменить хостинг = поменять adapter-static на адаптер площадки (adapter-node, adapter-vercel и т. п.),
// страницы и данные при этом не меняются. BASE_PATH: если сайт лежит не в корне домена, например /portal-demo/next.
const base = (process.env.BASE_PATH || '').replace(/\/$/, '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ pages: 'build', assets: 'build', fallback: undefined, strict: true }),
			paths: { base },
			prerender: { handleHttpError: 'fail', handleMissingId: 'warn' }
		})
	]
});
