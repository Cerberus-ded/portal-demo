// Адреса страниц сайта. Все ссылки внутри сайта идут через resolve(): так сайт работает и в корне домена,
// и в подпапке (BASE_PATH при сборке).
import { resolve, asset } from '$app/paths';

const go = (p: string) => (resolve as (p: string) => string)(p);
export const href = {
	home: (hash = '') => go('/' + hash),
	catalog: () => go('/katalog/'),
	section: (id: string, q = '') => go(`/katalog/${id}/${q}`),
	item: (s: string, slug: string, q = '') => go(`/katalog/${s}/${slug}/${q}`),
	cart: () => go('/korzina/'),
	desk: () => go('/zayavki/'),
	doc: (key: string) => go(`/dokumenty/${key}/`)
};
export const file = (p: string) => (asset as (p: string) => string)(p);
