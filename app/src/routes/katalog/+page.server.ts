import { ITEMS, SECTIONS, brandLine, itemsIn } from '#lib/server/catalog';

// обзор каталога: наполненные разделы карточками, остальные строкой «скоро»
const LEAD: Record<string, string> = { mezhkomnatnye: 'LORD-NOVITA-FELICIA', vhodnye: 'TOREX-ULTIMATUM-PRO' };

export const load = () => {
	const full = [],
		soon = [];
	for (const s of SECTIONS) {
		const items = itemsIn(s.id);
		if (!items.length) {
			soon.push({ id: s.id, name: s.name });
			continue;
		}
		const lead = items.find((x) => x.code === LEAD[s.id]) || items[0];
		full.push({ id: s.id, short: s.short, n: items.length, brands: brandLine(s.id), lead: { name: lead.name, brand: lead.brand, cover: lead.vars[lead.cover || 0] } });
	}
	return { full, soon, total: ITEMS.length };
};
