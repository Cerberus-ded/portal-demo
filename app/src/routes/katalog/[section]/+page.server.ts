import { error } from '@sveltejs/kit';
import { SECTIONS, card, itemsIn, section } from '#lib/server/catalog';

export const entries = () => SECTIONS.map((s) => ({ section: s.id }));

export const load = ({ params }) => {
	const sec = section(params.section);
	if (!sec) error(404, 'Такого раздела нет');
	return { sec, cards: itemsIn(sec.id).map(card) };
};
