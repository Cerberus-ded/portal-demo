import { error } from '@sveltejs/kit';
import { COLORS, DOCS, F, ITEMS, kitOf, section } from '#lib/server/catalog.ts';

export const entries = () => ITEMS.map((i) => ({ section: i.s, slug: i.slug }));

export const load = ({ params }) => {
	const item = ITEMS.find((i) => i.s === params.section && i.slug === params.slug);
	if (!item) error(404, 'Такой коллекции нет');
	const sec = section(item.s)!;
	const ids = new Set(Object.values(item.fin || {}).flat());
	const colors: Record<string, string> = Object.fromEntries(Object.entries(COLORS).filter(([id]) => ids.has(id)));
	return { item, kit: kitOf(item), colors, sec: { id: sec.id, short: sec.short }, F, consentV: DOCS.soglasie.v };
};
