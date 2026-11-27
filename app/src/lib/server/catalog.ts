// Каталог на сервере сборки: читается один раз при пререндере, в браузер уходит только то, что нужно странице.
import data from './generated/catalog.json';
import type { Card, Doc, Item, Kit, NavSection, Section } from '../types';

export const F: Record<string, string> = data.F;
export const SECTIONS = data.sections as Section[];
export const ITEMS = data.items as unknown as Item[];
export const DOCS = data.docs as Record<string, Doc>;
export const LEGAL = data.legal as Record<string, string>;
export const METRIKA = String(data.metrika || '');
export const COLORS = data.colors as Record<string, string>;

const kits = import.meta.glob<Kit>('./generated/kit/*.json', { eager: true, import: 'default' });
export const kitOf = (item: Item): Kit | null => (item.kit ? kits[`./generated/kit/${item.coll}.json`] || null : null);

export const section = (id: string) => SECTIONS.find((s) => s.id === id);
export const itemsIn = (id: string) => ITEMS.filter((i) => i.s === id);

function brandsOf(id: string) {
	const seen: string[] = [];
	for (const x of itemsIn(id)) if (!seen.includes(x.brand)) seen.push(x.brand);
	return seen;
}
// Подпись под разделом: четыре фабрики и сколько ещё, чтобы строка не разрасталась в абзац.
export function brandLine(id: string) {
	const all = brandsOf(id),
		more = all.length - 4;
	return more > 0 ? all.slice(0, 4).join(', ') + ' и ещё ' + more : all.join(', ');
}

export const nav = (): NavSection[] =>
	SECTIONS.map((s) => ({ id: s.id, name: s.name, short: s.short, n: itemsIn(s.id).length, brands: brandLine(s.id), soon: s.soon }));

export function card(i: Item): Card {
	const fins: string[] = [];
	for (const v of i.vars) if (F[v.fin] && !fins.includes(F[v.fin])) fins.push(F[v.fin]);
	return { s: i.s, brand: i.brand, name: i.name, code: i.code, slug: i.slug, f: i.f, any: i.any, n: i.vars.length, cover: i.vars[i.cover || 0], fins };
}
